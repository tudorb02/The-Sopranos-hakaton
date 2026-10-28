from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.pipeline import AnalyticsPipeline
from app.analytics.preprocessing.categorize import SPENDING_TYPES, categorize
from app.analytics.preprocessing.merchants import normalize_merchant, resolve_merchant
from app.db import utcnow
from app.models import Account, Import, Merchant, MerchantAlias, Transaction, User
from app.services.analytics_service import get_user, owned
from app.services.csv_parser import CSVFormatError, RaiffeisenCSVParser

MAX_IMPORT_BYTES = 10 * 1024 * 1024


def import_csv(
    session: Session,
    user_id: UUID,
    data: bytes,
    account_id: UUID | None = None,
    currency: str = "RON",
    as_of: datetime | None = None,
) -> Import:
    get_user(session, user_id)
    session.scalar(select(User).where(User.id == user_id).with_for_update())
    if account_id:
        account = owned(session, Account, account_id, user_id)
        if account.currency != currency:
            raise ValueError("Moneda extrasului diferă de moneda contului.")
    else:
        account = session.scalar(
            select(Account).where(
                Account.user_id == user_id, Account.provider == "csv", Account.currency == currency
            )
        )
        if account is None:
            account = Account(user_id=user_id, currency=currency)
            session.add(account)
            session.flush()
    job = Import(user_id=user_id, account_id=account.id, status="processing")
    session.add(job)
    session.commit()  # Durable job, even if parsing or analysis fails below.
    job_id = job.id
    try:
        if len(data) > MAX_IMPORT_BYTES:
            raise CSVFormatError("Fișierul depășește limita de 10 MiB.")
        rows = RaiffeisenCSVParser().parse(data)
        session.scalar(select(User).where(User.id == user_id).with_for_update())
        # Serialize writes to this account; catalog insertions have a savepoint below.
        session.scalar(select(Account).where(Account.id == account.id).with_for_update())
        merchants = {merchant.name_normalized: merchant for merchant in session.scalars(select(Merchant))}
        aliases = {alias.alias: alias for alias in session.scalars(select(MerchantAlias))}
        alias_names = {
            alias: session.get(Merchant, value.merchant_id).name_normalized
            for alias, value in aliases.items()
        }
        existing = set(
            session.scalars(select(Transaction.dedup_hash).where(Transaction.account_id == account.id))
        )
        order = (
            session.scalar(
                select(func.max(Transaction.statement_order)).where(Transaction.account_id == account.id)
            )
            or 0
        )
        for row in rows:
            if row.dedup_hash in existing:
                job.duplicate_count += 1
                continue
            normalized = normalize_merchant(row.description_raw)
            name = resolve_merchant(row.description_raw, list(merchants), alias_names)
            alias = aliases.get(normalized)
            category, spending_type = categorize(name, alias.category_override if alias else None)
            merchant = merchants.get(name)
            if merchant is None:
                merchant = Merchant(name_normalized=name, category_default=category)
                # Savepoint protects against another user's simultaneous new merchant.
                from sqlalchemy.exc import IntegrityError

                try:
                    with session.begin_nested():
                        session.add(merchant)
                        session.flush()
                except IntegrityError:
                    merchant = session.scalar(select(Merchant).where(Merchant.name_normalized == name))
                merchants[name] = merchant
            elif not (alias and alias.category_override):
                category = merchant.category_default
                spending_type = SPENDING_TYPES.get(category, "essential")
            order += 1
            session.add(
                Transaction(
                    account_id=account.id,
                    import_id=job.id,
                    booked_at=row.booked_at,
                    occurred_at=row.occurred_at,
                    occurred_at_precision=row.occurred_at_precision,
                    statement_order=order,
                    amount_minor=row.amount_minor,
                    balance_minor=row.balance_minor,
                    currency=currency,
                    description_raw=row.description_raw,
                    merchant_id=merchant.id,
                    category=category,
                    spending_type=spending_type,
                    dedup_hash=row.dedup_hash,
                )
            )
            existing.add(row.dedup_hash)
            job.inserted_count += 1
        session.flush()
        AnalyticsPipeline(session).run_full(user_id, as_of)
        job.status = "completed"
        job.completed_at = utcnow()
        session.commit()
    except Exception:
        import sys

        parsing = isinstance(sys.exception(), CSVFormatError)
        safe_message = (
            str(sys.exception()) if parsing else "Lipsă de date valide sau eroare la procesarea importului."
        )
        session.rollback()
        job = session.get(Import, job_id)
        job.status = "failed"
        job.inserted_count = job.duplicate_count = 0
        job.error_code = "invalid_csv" if parsing else "import_failed"
        job.error_message = safe_message
        job.completed_at = utcnow()
        session.commit()
    return job

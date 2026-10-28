"""The only component that knows the provisional Raiffeisen CSV format."""

import csv
import hashlib
import io
import re
from dataclasses import dataclass
from datetime import date, datetime, time

from app.analytics.preprocessing.timestamps import extract_occurred_at, local_to_utc


class CSVFormatError(ValueError):
    """Safe message: never include row contents or bank descriptions."""


@dataclass(frozen=True)
class ParsedTransaction:
    booked_at: datetime
    occurred_at: datetime
    occurred_at_precision: str
    description_raw: str
    amount_minor: int
    balance_minor: int
    dedup_hash: str


class RaiffeisenCSVParser:
    columns = ["Data inregistrare", "Data tranzactiei", "Descriere", "Debit", "Credit", "Sold"]

    @staticmethod
    def money(value: str) -> int:
        if not re.fullmatch(r"-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}", value):
            raise ValueError("Invalid money format")
        whole, fraction = value.replace(".", "").lstrip("-").split(",")
        return (-1 if value.startswith("-") else 1) * (int(whole) * 100 + int(fraction))

    @staticmethod
    def date(value: str) -> date:
        if not re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", value):
            raise ValueError("Invalid date")
        return datetime.strptime(value, "%d.%m.%Y").date()

    def parse(self, data: bytes) -> list[ParsedTransaction]:
        try:
            reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")), delimiter=";", strict=True)
            if reader.fieldnames != self.columns:
                raise CSVFormatError("Antet CSV invalid.")
            result = []
            for line, row in enumerate(reader, start=2):
                try:
                    if None in row or any(value is None for value in row.values()):
                        raise ValueError("Column count")
                    row = {key: value.strip() for key, value in row.items()}
                    if bool(row["Debit"]) == bool(row["Credit"]):
                        raise ValueError("Exactly one debit or credit required")
                    debit = self.money(row["Debit"]) if row["Debit"] else 0
                    credit = self.money(row["Credit"]) if row["Credit"] else 0
                    if debit < 0 or credit < 0 or debit == credit:
                        raise ValueError("Invalid amount sign")
                    booked = self.date(row["Data inregistrare"])
                    transacted = self.date(row["Data tranzactiei"])
                    description = row["Descriere"]
                    if not description or len(description) > 10000:
                        raise ValueError("Invalid description")
                    occurred_at, precision = extract_occurred_at(description, transacted)
                    balance = self.money(row["Sold"])
                    if abs(balance) > 2**63 - 1 or abs(credit - debit) > 2**63 - 1:
                        raise ValueError("Amount overflow")
                    normalized = " ".join(description.casefold().split())
                    fingerprint = f"{transacted.isoformat()}|{credit - debit}|{normalized}|{balance}"
                    result.append(
                        ParsedTransaction(
                            local_to_utc(datetime.combine(booked, time.min)),
                            occurred_at,
                            precision,
                            description,
                            credit - debit,
                            balance,
                            hashlib.sha256(fingerprint.encode()).hexdigest(),
                        )
                    )
                except (ValueError, KeyError) as exc:
                    raise CSVFormatError(f"Rând CSV invalid la linia {line}.") from exc
            if not result:
                raise CSVFormatError("Fișierul CSV nu conține tranzacții.")
            return result
        except (UnicodeError, csv.Error) as exc:
            raise CSVFormatError("Fișier CSV invalid; este necesar UTF-8 și separatorul ;.") from exc

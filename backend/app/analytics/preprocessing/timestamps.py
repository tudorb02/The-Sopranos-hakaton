import re
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

BUCHAREST = ZoneInfo("Europe/Bucharest")
POS_PREFIX = re.compile(r"^POS\s+(\d{2}\.\d{2}\.\d{4})(?:\s+(\d{2}:\d{2}))?\s+", re.I)


def local_to_utc(value: datetime) -> datetime:
    aware = value.replace(tzinfo=BUCHAREST, fold=0)
    result = aware.astimezone(UTC)
    if result.astimezone(BUCHAREST).replace(tzinfo=None) != value:
        raise ValueError("Nonexistent local time")
    return result


def extract_occurred_at(description: str, transaction_date: date) -> tuple[datetime, str]:
    match = POS_PREFIX.match(description)
    if match:
        actual_date = datetime.strptime(match[1], "%d.%m.%Y").date()
        if match[2]:
            actual_time = datetime.strptime(match[2], "%H:%M").time()
            return local_to_utc(datetime.combine(actual_date, actual_time)), "minute"
        transaction_date = actual_date
    return local_to_utc(datetime.combine(transaction_date, time.min)), "day"

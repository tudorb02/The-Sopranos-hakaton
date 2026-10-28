"""Independent assertions over exported artifacts; no backend analytics imports."""

import csv
import json
import math
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import mean, median, pstdev
from zoneinfo import ZoneInfo

import pytest

from seed.generate import generate

IDS = ("end_of_month", "daily_coffee", "unused_gym", "birthday_month", "goal_2000", "balanced")
COLUMNS = ["Data inregistrare", "Data tranzactiei", "Descriere", "Debit", "Credit", "Sold"]
TOOLS = {"get_spending_summary", "get_cashflow_pattern", "find_recurring_expenses", "list_subscriptions", "get_upcoming_expenses", "simulate_goal", "create_budget_rule", "create_goal", "update_goal", "update_subscription_status", "save_memory"}
TYPES = {"daily_habit", "weekly_habit", "subscription", "morning_spending", "end_of_cycle_shortage", "unused_subscription", "category_anomaly", "upcoming_spike"}
END = date(2026, 10, 31)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def minor(value):
    if not value:
        return 0
    assert re.fullmatch(r"-?\d+,\d{2}", value)
    major, fraction = value.lstrip("-").split(",")
    return (-1 if value.startswith("-") else 1) * (int(major) * 100 + int(fraction))


def parse_date(value):
    assert re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", value)
    return datetime.strptime(value, "%d.%m.%Y").date()


def rows(root, persona):
    with (root / persona / "transactions.csv").open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        assert reader.fieldnames == COLUMNS
        result = list(reader)
    for row in result:
        row["day"] = parse_date(row["Data tranzactiei"])
        row["booked"] = parse_date(row["Data inregistrare"])
        row["amount"] = minor(row["Credit"]) - minor(row["Debit"])
        row["balance"] = minor(row["Sold"])
        match = re.search(r"^POS \d{2}\.\d{2}\.\d{4} (\d{2}):(\d{2}) ", row["Descriere"])
        row["minute"] = int(match[1]) * 60 + int(match[2]) if match else None
        row["merchant"] = merchant(row["Descriere"])
    return result


def merchant(description):
    # Test-side normalization deliberately does not import generator alias mappings.
    text = re.sub(r"^POS \S+ (?:\d{2}:\d{2} )?", "", description.upper())
    text = re.sub(r"BUCURESTI$", "", text).strip()
    compact = re.sub(r"[^A-Z0-9]", "", text)
    for prefix in ("CAFENEAORIZONT", "MEGAIMAGE", "LIDL", "KAUFLAND", "CARREFOUR", "PROFI", "18GYM"):
        if compact.startswith(prefix):
            return prefix
    return text


def discretionary(row):
    excluded = ("LIDL", "KAUFLAND", "MEGAIMAGE", "CARREFOUR", "PROFI", "BOLT", "UBER", "STB", "OMV", "PETROM", "LUKOIL", "CATENA", "DR. MAX", "NETFLIX", "SPOTIFY", "HBO MAX", "18GYM")
    return row["Descriere"].startswith("POS ") and row["merchant"] not in excluded


def by_month(transactions):
    result = defaultdict(list)
    for row in transactions:
        result[row["day"].strftime("%Y-%m")].append(row)
    return result


@pytest.fixture(scope="module", params=[42, 7, 2026])
def output(tmp_path_factory, request):
    directory = tmp_path_factory.mktemp(f"seed-{request.param}")
    generate(END, 6, request.param, directory)
    return directory


def test_contract_and_balances(output):
    manifest = read_json(output / "manifest.json")
    assert [item["persona_id"] for item in manifest["personas"]] == list(IDS)
    for summary in manifest["personas"]:
        persona = summary["persona_id"]
        directory = output / persona
        assert {path.name for path in directory.iterdir()} == {"transactions.csv", "profile.json", "usage_signals.json", "calendar_events.json", "expected_patterns.json", "chat_scenarios.json"}
        data = rows(output, persona)
        balance = summary["opening_balance_minor"]
        previous = date.min
        lags = Counter()
        for row in data:
            assert bool(row["Debit"]) != bool(row["Credit"])
            assert minor(row["Debit"]) >= 0 and minor(row["Credit"]) >= 0
            assert row["amount"] != 0
            assert previous <= row["booked"] <= END
            assert row["booked"] >= row["day"]
            assert row["booked"] >= date(2026, 5, 1)
            previous = row["booked"]
            balance += row["amount"]
            assert balance == row["balance"] >= 0
            if row["Descriere"].startswith("POS "):
                assert row["Descriere"].startswith(f"POS {row['Data tranzactiei']} ")
                lag = sum((row["day"] + timedelta(days=n)).weekday() < 5 for n in range(1, (row["booked"] - row["day"]).days + 1))
                assert lag <= 2
                lags[lag] += 1
        assert len(lags) >= 2
        assert len(data) == summary["transaction_count"]
        assert balance == summary["closing_balance_minor"]
        assert sum(max(row["amount"], 0) for row in data) == summary["income_minor"]
        assert sum(max(-row["amount"], 0) for row in data) == summary["expenses_minor"]
        cards = [row for row in data if row["Descriere"].startswith("POS ")]
        assert 0.08 <= sum(row["minute"] is None for row in cards) / len(cards) <= 0.12
        profile = read_json(directory / "profile.json")
        assert set(profile) == {"persona_id", "name", "salary_day", "monthly_income_minor", "declared_problems", "context"}
        assert profile["persona_id"] == persona
        assert isinstance(profile["monthly_income_minor"], int)
        for signal in read_json(directory / "usage_signals.json"):
            assert set(signal) == {"subscription_merchant", "source", "occurred_at"}
            assert signal["source"] in ("geofence", "health", "manual")
            when = datetime.fromisoformat(signal["occurred_at"])
            assert when.utcoffset() == when.astimezone(ZoneInfo("Europe/Bucharest")).utcoffset()
            assert date(2026, 5, 1) <= when.date() <= END
        for event in read_json(directory / "calendar_events.json"):
            assert set(event) == {"title", "starts_at", "type"}
            assert event["type"] in ("birthday", "holiday", "other")
            assert datetime.fromisoformat(event["starts_at"]).utcoffset() is not None
        chats = read_json(directory / "chat_scenarios.json")
        assert 3 <= len(chats) <= 5
        for chat in chats:
            assert set(chat) == {"message", "expected_tools", "expected_topic"}
            assert chat["message"] and chat["expected_topic"]
            assert set(chat["expected_tools"]) <= TOOLS
        for pattern in read_json(directory / "expected_patterns.json"):
            assert pattern["type"] in TYPES
            assert pattern["notes"]
            assert set(pattern) <= {"type", "merchant", "window", "min_confidence", "notes"}


def test_salary_and_background(output):
    for persona in IDS:
        profile = read_json(output / persona / "profile.json")
        data = rows(output, persona)
        salaries = [row for row in data if row["amount"] > 0]
        assert len(salaries) == 6
        for row in salaries:
            nominal = row["day"].replace(day=profile["salary_day"])
            while nominal.weekday() >= 5:
                nominal -= timedelta(days=1)
            assert row["day"] == row["booked"] == nominal
            assert row["amount"] == profile["monthly_income_minor"]
        groceries = [row for row in data if row["merchant"] in ("LIDL", "KAUFLAND", "MEGAIMAGE", "CARREFOUR", "PROFI")]
        assert 2 <= len(groceries) / (184 / 7) <= 3
        for row in groceries:
            if row["minute"] is not None:
                assert 8 * 60 <= row["minute"] < 22 * 60
        for row in data:
            if row["merchant"] in ("BAR FELINAR", "PUB CASTAN") and row["minute"] is not None:
                assert row["minute"] >= 18 * 60
                assert row["day"].weekday() >= 5
            if row["merchant"] in ("GLOVO", "TAZZ", "BOLT FOOD") and row["minute"] is not None:
                assert 12 * 60 <= row["minute"] < 22 * 60
        mega_aliases = {row["Descriere"].split(" ", 2)[-1] for row in groceries if row["merchant"] == "MEGAIMAGE"}
        assert len(mega_aliases) >= 3


def test_daily_coffee(output):
    data = rows(output, "daily_coffee")
    coffee = [row for row in data if row["merchant"] in ("CAFENEAORIZONT", "5 TO GO", "TEDS COFFEE")]
    for month, group in by_month(coffee).items():
        assert 20 <= len(group) <= 22, month
        assert sum(row["minute"] is not None for row in group) >= 18
        assert sum(row["merchant"] != "CAFENEAORIZONT" for row in group) in (1, 2)
        for row in group:
            assert row["day"].weekday() < 5
            assert 2_500 <= -row["amount"] <= 3_500
            if row["minute"] is not None:
                assert 450 <= row["minute"] <= 585
    disc = [row for row in data if discretionary(row) and row["minute"] is not None]
    morning = sum(420 <= row["minute"] < 600 for row in disc)
    assert 0.55 <= morning / len(disc) <= 0.70
    # Exact binomial upper tail against the documented 18% morning baseline.
    p_value = sum(math.comb(len(disc), k) * 0.18**k * 0.82**(len(disc) - k) for k in range(morning, len(disc) + 1))
    assert p_value < 0.001
    main = [row for row in coffee if row["merchant"] == "CAFENEAORIZONT"]
    assert len({row["day"].isocalendar()[:2] for row in main}) >= 3
    assert len(main) >= 8
    assert sum(-row["amount"] for row in main) // 6 >= 5_000
    dates = sorted(row["day"] for row in main)
    gaps = [sum((left + timedelta(days=i)).weekday() < 5 for i in range(1, (right - left).days + 1)) for left, right in zip(dates, dates[1:])]
    assert median(gaps) == 1
    assert pstdev(gaps) / mean(gaps) < 0.4


def test_shortage_cycles(output):
    data = rows(output, "end_of_month")
    salaries = [row for row in data if row["amount"] > 0]
    daily = {}
    for row in data:
        daily[row["booked"]] = row["balance"]
    balance = read_json(output / "manifest.json")["personas"][0]["opening_balance_minor"]
    for offset in range(184):
        day = date(2026, 5, 1) + timedelta(days=offset)
        balance = daily.get(day, balance)
        daily[day] = balance
    affected = 0
    for salary in salaries:
        last_days = [salary["booked"] - timedelta(days=i) for i in range(1, 6)]
        affected += all(0 <= daily.get(day, 100_000) < 10_000 for day in last_days)
    assert affected >= 4
    for salary, following in zip(salaries, salaries[1:]):
        spent = sum(-row["amount"] for row in data if row["amount"] < 0 and salary["booked"] <= row["booked"] < salary["booked"] + timedelta(days=7))
        assert 0.45 <= spent / salary["amount"] <= 0.55
        assert following["booked"] > salary["booked"]


def test_gym(output):
    for persona in ("unused_gym", "goal_2000"):
        gym = [row for row in rows(output, persona) if row["merchant"] == "18GYM"]
        assert len(gym) == 6
        assert {-row["amount"] for row in gym} == {23_000}
        gaps = [(right["day"] - left["day"]).days for left, right in zip(gym, gym[1:])]
        assert 28 <= median(gaps) <= 31
        assert pstdev(gaps) / mean(gaps) < 0.15
        signals = [datetime.fromisoformat(signal["occurred_at"]).date() for signal in read_json(output / persona / "usage_signals.json") if signal["subscription_merchant"] == "18GYM"]
        if persona == "unused_gym":
            assert signals
            assert 28 <= (max(signals) - min(signals)).days <= 42
            assert max(signals) <= date(2026, 5, 1) + timedelta(days=42)
            assert not any(day >= END - timedelta(days=90) for day in signals)
            assert all(datetime.fromisoformat(signal["occurred_at"]).date() < END - timedelta(days=90) for signal in read_json(output / persona / "usage_signals.json"))
        else:
            assert max(signals) >= END - timedelta(days=7)
            assert all(sum(day.strftime("%Y-%m") == month for day in signals) >= 6 for month in by_month(gym))


def test_birthdays(output):
    events = read_json(output / "birthday_month" / "calendar_events.json")
    counts = Counter(datetime.fromisoformat(event["starts_at"]).strftime("%Y-%m") for event in events if event["type"] == "birthday")
    assert counts["2026-11"] == 10
    data = rows(output, "birthday_month")
    totals = Counter()
    for row in data:
        if row["merchant"] in ("CADOURI ATELIER", "FLORARIA IRIS", "RESTAURANT ANIVERSAR"):
            totals[row["day"].strftime("%Y-%m")] -= row["amount"]
    assert len(totals) == 6
    high = [amount for month, amount in totals.items() if counts[month] >= 4]
    low = [amount for month, amount in totals.items() if counts[month] == 1]
    assert len(high) >= 2 and mean(high) > 3 * mean(low)
    cost_per_event = sum(totals.values()) // sum(counts[month] for month in totals)
    assert 35_000 <= cost_per_event <= 60_000
    average_expense = sum(-row["amount"] for row in data if row["amount"] < 0) // 6
    assert cost_per_event * 10 > average_expense // 4


def test_goal_savings(output):
    data = rows(output, "goal_2000")
    for group in by_month(data).values():
        assert 20_000 <= sum(row["amount"] for row in group) <= 40_000
    profile = read_json(output / "goal_2000" / "profile.json")
    assert "2.000" in " ".join(profile["declared_problems"])
    assert "renunț" in " ".join(profile["context"])


def test_balanced_negative(output):
    assert read_json(output / "balanced" / "expected_patterns.json") == []
    data = rows(output, "balanced")
    assert min(row["balance"] for row in data) > 75_000
    disc = [row for row in data if discretionary(row)]
    weeks = Counter((row["merchant"], row["day"].isocalendar()[:2]) for row in disc)
    assert max(weeks.values()) < 3
    timed = [row for row in disc if row["minute"] is not None]
    boundaries = (420, 600, 840, 1080, 1320, 1440)
    observed = [sum(lo <= row["minute"] < hi for row in timed) for lo, hi in zip(boundaries, boundaries[1:])]
    expected = [len(timed) * hours / 17 for hours in (3, 4, 4, 4, 2)]
    chi_squared = sum((actual - target)**2 / target for actual, target in zip(observed, expected))
    assert chi_squared < 9.488  # chi-square 95th percentile, df=4
    assert 0.10 <= observed[0] / len(timed) <= 0.25
    per_merchant = defaultdict(list)
    for row in disc:
        per_merchant[row["merchant"]].append(row)
    for group in per_merchant.values():
        assert len(group) < 8  # below behavioral support threshold
    streams = Counter(row["merchant"] for row in data if row["merchant"] in ("NETFLIX", "SPOTIFY", "HBO MAX"))
    assert set(streams.values()) == {2}  # rotating single-month access, no three-payment subscription


def tree_bytes(root):
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in root.rglob("*") if path.is_file()}


def test_determinism_and_committed_artifacts(tmp_path):
    first, second = tmp_path / "first", tmp_path / "second"
    generate(END, 6, 42, first)
    # New process avoids relying on interpreter hash state or shared random state.
    subprocess.run([sys.executable, "-m", "seed.generate", "--end-date", "2026-10-31", "--months", "6", "--seed", "42", "--out", str(second)], check=True, cwd=Path(__file__).resolve().parents[2])
    assert tree_bytes(first) == tree_bytes(second)
    assert tree_bytes(first) == tree_bytes(Path(__file__).resolve().parents[1] / "output")
    generate(END, 6, 7, second)
    assert tree_bytes(first) != tree_bytes(second)
    generate(END, 6, 42, second)
    assert tree_bytes(first) == tree_bytes(second)


@pytest.mark.parametrize("end,months", [(date(2024, 2, 29), 6), (date(2027, 1, 31), 6), (date(2026, 10, 15), 1), (date(2026, 1, 1), 1), (date(2026, 10, 31), 12)])
def test_date_boundaries(tmp_path, end, months):
    generate(end, months, 42, tmp_path)
    for persona in IDS:
        data = rows(tmp_path, persona)
        assert all(row["booked"] <= end and row["balance"] >= 0 for row in data)
        if months < 3:
            assert read_json(tmp_path / persona / "expected_patterns.json") == []


@pytest.mark.parametrize("months", [0, -1, 121])
def test_invalid_months(tmp_path, months):
    with pytest.raises(ValueError, match="months"):
        generate(END, months, 42, tmp_path)


def category(row):
    normalized = row["merchant"]
    if normalized.startswith("PLATA FACTURA "):
        return "utilities"
    groups = {
        "groceries": {"LIDL", "KAUFLAND", "MEGAIMAGE", "CARREFOUR", "PROFI"},
        "coffee": {"CAFENEAORIZONT", "5 TO GO", "TEDS COFFEE", "CAFENEA MESTEACAN"},
        "shopping": {"EMAG", "H&M", "ZARA", "DECATHLON"},
        "leisure": {"CARTURESTI", "CINEMA CITY", "MUZEUL SATULUI", "LIBRARIA HUMANITAS"},
        "delivery": {"GLOVO", "TAZZ", "BOLT FOOD", "RESTAURANT TEI"},
        "bar": {"BAR FELINAR", "PUB CASTAN"},
        "pharmacy": {"CATENA", "DR. MAX"},
        "transport": {"BOLT", "UBER", "STB", "OMV", "PETROM", "LUKOIL"},
        "streaming": {"NETFLIX", "SPOTIFY", "HBO MAX"},
    }
    return next((name for name, merchants in groups.items() if normalized in merchants), normalized)


def test_no_unintended_current_category_anomalies(output):
    for persona in IDS:
        monthly = defaultdict(Counter)
        for row in rows(output, persona):
            if row["amount"] < 0:
                monthly[category(row)][row["day"].month] -= row["amount"]
        for name, amounts in monthly.items():
            history = [amounts[month] for month in range(5, 10)]
            center = median(history)
            mad = median(abs(amount - center) for amount in history)
            increase = amounts[10] - center
            if increase < 5_000:
                continue
            assert mad > 0, (persona, name, amounts)
            assert increase / (1.4826 * mad) <= 3, (persona, name, amounts)

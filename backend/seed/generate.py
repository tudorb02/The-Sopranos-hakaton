"""Generate reproducible fixtures without importing any backend detector."""

import argparse
import calendar
import csv
import hashlib
import json
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from . import __version__
from .personas import PERSONAS

TZ = ZoneInfo("Europe/Bucharest")
HEADER = ("Data inregistrare", "Data tranzactiei", "Descriere", "Debit", "Credit", "Sold")
ALIASES = {
    "MEGA IMAGE": ("MEGA IMAGE 0123", "MEGAIMAGE*456", "Mega Image SRL"),
    "LIDL": ("LIDL 034", "LIDL*BUC12", "Lidl Romania SRL"),
    "KAUFLAND": ("KAUFLAND 021", "KAUFLAND*123", "Kaufland Romania SRL"),
    "CARREFOUR": ("CARREFOUR 009", "CARREFOUR*778", "Carrefour Romania SA"),
    "PROFI": ("PROFI 021", "PROFI*090", "Profi Rom Food SRL"),
    "CAFENEA ORIZONT": ("CAFENEA ORIZONT SRL", "CAFENEAORIZONT*1234", "Cafenea Orizont"),
    "18GYM": ("18GYM*021", "18GYM SRL", "18GYM FITNESS"),
}
GROCERS = ("LIDL", "KAUFLAND", "MEGA IMAGE", "CARREFOUR", "PROFI")
STREAMING = (("NETFLIX", 5_990), ("SPOTIFY", 2_690), ("HBO MAX", 3_990))


def month_shift(day, offset):
    number = day.year * 12 + day.month - 1 + offset
    year, month = divmod(number, 12)
    return date(year, month + 1, 1)


def days_between(start, end):
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def payday(month, salary_day):
    day = month.replace(day=min(salary_day, calendar.monthrange(month.year, month.month)[1]))
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    return day


def business_lag(day, lag):
    while lag:
        day += timedelta(days=1)
        if day.weekday() < 5:
            lag -= 1
    return day


def money(minor):
    sign = "-" if minor < 0 else ""
    major, fraction = divmod(abs(minor), 100)
    return f"{sign}{major},{fraction:02d}"


def timestamp(day, minute):
    return datetime.combine(day, time(minute // 60, minute % 60), TZ).isoformat()


@dataclass
class Transaction:
    day: date
    minute: int
    description: str
    amount: int
    category: str
    card: bool = True
    fixed: bool = False
    booked: date | None = None
    missing_time: bool = False


class Builder:
    def __init__(self, persona, start, end, seed):
        self.persona = persona
        self.start = start
        self.end = end
        # A stable per-persona seed makes adding a persona independent of existing output.
        digest = hashlib.sha256(f"{seed}:{persona.persona_id}".encode()).digest()
        self.rng = random.Random(int.from_bytes(digest, "big"))
        self.transactions = []
        self.signals = []
        self.events = []

    def add(self, day, merchant, amount, category, minute=None, card=True, fixed=False):
        if minute is None:
            # Shopping is later on workdays; weekends allow a daytime visit.
            minute = self.rng.randint(10 * 60, 20 * 60) if day.weekday() >= 5 else self.rng.randint(16 * 60, 21 * 60 + 45)
        alias = self.rng.choice(ALIASES.get(merchant, (merchant,)))
        tx = Transaction(day, minute, alias, -amount, category, card, fixed)
        self.transactions.append(tx)
        return tx

    def distribute(self, txs, total):
        """Allocate a budget in integer bani, preserving fixed-price subscriptions."""
        variable = [tx for tx in txs if not tx.fixed]
        remainder = total - sum(-tx.amount for tx in txs if tx.fixed)
        weights = [-tx.amount for tx in variable]
        if not variable or remainder < len(variable):
            raise ValueError("Budget is too small for scheduled transactions")
        denominator = sum(weights)
        amounts = [remainder * weight // denominator for weight in weights]
        for index in range(remainder - sum(amounts)):
            amounts[index % len(amounts)] += 1
        for tx, amount in zip(variable, amounts):
            tx.amount = -amount

    def background(self, month, index):
        p = self.persona
        last = month_shift(month, 1) - timedelta(days=1)
        # Keep regular expenses away from the statement boundary; coffees are handled separately.
        available = days_between(month, last - timedelta(days=3))
        salary = payday(month, p.salary_day)
        self.add(salary, "Transfer intrare SALARIU EXEMPLU DEMO SRL", -p.monthly_income_minor, "income", 8 * 60, False, True)
        self.add(salary + timedelta(days=1), "Plata chirie", p.rent_minor, "housing", 11 * 60, False, True)
        variation = (94, 103, 98, 106, 100, 101)[index % 6]
        for merchant, base in (("ENEL", 16_000), ("ENGIE", 15_000), ("DIGI", 7_000)):
            self.add(month.replace(day=self.rng.randint(12, 24)), f"Plata factura {merchant}", base * variation // 100 + self.rng.randint(-900, 900), "utilities", 12 * 60, False)
        groceries = []
        # Stratified dates yield 2–3 grocery visits per week on average, without a weekly habit.
        for slot in range(12):
            lo = slot * len(available) // 12
            hi = (slot + 1) * len(available) // 12
            day = self.rng.choice(available[lo:hi])
            groceries.append(self.add(day, self.rng.choice(GROCERS), self.rng.randint(6_000, 19_000), "groceries"))
        self.distribute(groceries, 135_000 * variation // 100)
        transport = []
        for merchant in ("BOLT", "UBER", "STB", "OMV", "PETROM", "LUKOIL"):
            amount = self.rng.randint(2_000, 5_000) if merchant in ("BOLT", "UBER", "STB") else self.rng.randint(6_000, 12_000)
            transport.append(self.add(self.rng.choice(available), merchant, amount, "transport", self.rng.randint(8 * 60, 22 * 60)))
        self.distribute(transport, 36_000 * variation // 100)
        pharmacies = [self.add(self.rng.choice(available), merchant, self.rng.randint(3_500, 6_500), "pharmacy") for merchant in ("CATENA", "DR. MAX")]
        self.distribute(pharmacies, 9_000 * variation // 100)
        stream, price = STREAMING[index % len(STREAMING)]
        stream_day = month.replace(day=self.rng.randint(8, 22))
        self.add(stream_day, stream, price, "streaming", 20 * 60, fixed=True)
        if p.gym:
            self.add(month.replace(day=15), "18GYM", 23_000, "gym", 12 * 60, fixed=True)
        discretionary = self.discretionary(available, p.coffee)
        budgets = {"shopping": 10_000, "leisure": 10_000, "delivery": 20_000, "bar": 8_000} if p.coffee else {"coffee": 9_000, "shopping": 28_000, "leisure": 19_000, "delivery": 27_000, "bar": 10_000}
        for category, budget in budgets.items():
            self.distribute([tx for tx in discretionary if tx.category == category], budget * variation // 100)
        if p.coffee:
            weekdays = [day for day in days_between(month, min(last, self.end)) if day.weekday() < 5]
            count = min(22, len(weekdays))
            selected = sorted(self.rng.sample(weekdays, count))
            alternate = self.rng.choice(selected) if selected else None
            for day in selected:
                merchant = self.rng.choice(("5 TO GO", "TEDS COFFEE")) if day == alternate else "CAFENEA ORIZONT"
                self.add(day, merchant, self.rng.randint(2_500, 3_500), "coffee", self.rng.randint(450, 585))
        if p.birthdays:
            self.birthday_history(month, index)
        if p.savings_goal:
            month_txs = [tx for tx in self.transactions if month <= tx.day <= last and tx.amount < 0]
            # A modest, explicit cash surplus; no invisible transfers to savings accounts.
            flexible = [tx for tx in month_txs if tx.category in ("shopping", "groceries", "transport")]
            nonflexible = sum(-tx.amount for tx in month_txs if tx not in flexible)
            self.distribute(flexible, p.monthly_income_minor - self.rng.randint(22_000, 38_000) - nonflexible)

    def discretionary(self, available, coffee):
        # Baseline is uniform over 07–24 (3/17 morning); realistic merchant opening hours.
        specs = [] if coffee else [("5 TO GO", "coffee", 450, 585), ("TEDS COFFEE", "coffee", 450, 585), ("CAFENEA MESTEACAN", "coffee", 480, 585)]
        specs += [(m, "shopping", 10 * 60, 14 * 60 - 1) for m in ("EMAG", "H&M", "ZARA", "DECATHLON")]
        specs += [(m, "leisure", 14 * 60, 18 * 60 - 1) for m in ("CARTURESTI", "CINEMA CITY", "MUZEUL SATULUI", "LIBRARIA HUMANITAS")]
        specs += [(m, "delivery", 18 * 60, 22 * 60 - 1) for m in ("GLOVO", "TAZZ", "BOLT FOOD", "RESTAURANT TEI")]
        specs += [(m, "bar", 22 * 60, 23 * 60 + 45) for m in ("BAR FELINAR", "PUB CASTAN")]
        result = []
        for merchant, category, lower, upper in specs:
            candidates = [day for day in available if day.weekday() >= 5] if category == "bar" else available
            day = self.rng.choice(candidates or available)
            amount = self.rng.randint(2_500, 3_500) if category == "coffee" else self.rng.randint(3_000, 10_000)
            result.append(self.add(day, merchant, amount, category, self.rng.randint(lower, upper)))
        return result

    def birthday_history(self, month, index):
        count = (1, 4, 1, 5, 2, 1)[index % 6]
        for number, day in enumerate(sorted(self.rng.sample(range(5, 26), count)), 1):
            event_day = month.replace(day=day)
            self.events.append({"title": f"Ziua de naștere — Prieten fictiv {index + 1}.{number}", "starts_at": timestamp(event_day, 19 * 60), "type": "birthday"})
            for merchant, category, lower, upper in (("CADOURI ATELIER", "gifts", 20_000, 26_000), ("FLORARIA IRIS", "flowers", 7_000, 10_000), ("RESTAURANT ANIVERSAR", "birthday_restaurant", 12_000, 17_000)):
                self.add(event_day, merchant, self.rng.randint(lower, upper), category, self.rng.randint(12 * 60, 21 * 60))

    def shortage_cycle(self, month, index):
        p = self.persona
        start = payday(month, p.salary_day)
        end = payday(month_shift(month, 1), p.salary_day)
        self.add(start, "Transfer intrare SALARIU EXEMPLU DEMO SRL", -p.monthly_income_minor, "income", 8 * 60, False, True)
        early = [self.add(start + timedelta(days=1), "Plata chirie", p.rent_minor, "housing", 11 * 60, False, True)]
        for merchant in ("ENEL", "E.ON", "ORANGE"):
            early.append(self.add(start + timedelta(days=self.rng.randint(1, 5)), f"Plata factura {merchant}", self.rng.randint(8_000, 15_000), "utilities", 12 * 60, False))
        for offset in (2, 5):
            early.append(self.add(start + timedelta(days=offset), self.rng.choice(GROCERS), self.rng.randint(9_000, 16_000), "groceries"))
        early.append(self.add(start + timedelta(days=3), ("EMAG", "H&M", "ZARA", "DECATHLON")[index % 4], self.rng.randint(20_000, 35_000), "shopping", 13 * 60))
        middle = []
        middle_end = (end - start).days - 8
        for slot in range(8):
            offset = 7 + slot * (middle_end - 7) // 7
            middle.append(self.add(start + timedelta(days=offset), self.rng.choice(GROCERS), self.rng.randint(7_000, 18_000), "groceries"))
        for merchant, category, amount in (("BOLT", "transport", 4_000), ("UBER", "transport", 3_500), ("STB", "transport", 2_500), ("OMV", "transport", 20_000), ("CATENA", "pharmacy", 7_000), ("DR. MAX", "pharmacy", 5_000), ("GLOVO", "delivery", 8_000), ("TAZZ", "delivery", 7_000), ("BOLT FOOD", "delivery", 7_000)):
            middle.append(self.add(start + timedelta(days=self.rng.randint(7, middle_end)), merchant, amount + self.rng.randint(-500, 500), category, self.rng.randint(12 * 60, 21 * 60)))
        stream, price = STREAMING[index % 3]
        stream_day = start + timedelta(days=9)
        middle.append(self.add(stream_day, stream, price, "streaming", 20 * 60, fixed=True))
        early_budget = p.monthly_income_minor * self.rng.randint(48, 52) // 100
        variation = (90, 106, 94, 110, 97, 100)[index % 6]
        early_groceries = [tx for tx in early if tx.category == "groceries"]
        middle_groceries = [tx for tx in middle if tx.category == "groceries"]
        grocery_budgets = (30_000 * variation // 100, 150_000 * variation // 100)
        self.distribute(early_groceries, grocery_budgets[0])
        self.distribute([tx for tx in early if tx.category != "groceries"], early_budget - grocery_budgets[0])
        self.distribute(middle_groceries, grocery_budgets[1])
        self.distribute([tx for tx in middle if tx.category != "groceries"], p.monthly_income_minor - early_budget - 4_000 - grocery_budgets[1])
        # Opening 45 lei + final essentials 40 lei: below 100 for the final five days.
        first_basket = self.rng.randint(1_500, 2_500)
        for offset, amount in ((4, first_basket), (2, 4_000 - first_basket)):
            self.add(end - timedelta(days=offset), self.rng.choice(GROCERS), amount, "groceries", 18 * 60)
        # Ensure settlement cannot move the shortage across the next salary.
        for tx in early + middle:
            limit = start + timedelta(days=6) if tx in early else end - timedelta(days=6)
            tx.booked = self.rng.choice([business_lag(tx.day, lag) for lag in range(3) if business_lag(tx.day, lag) <= limit])
        # The last main grocery basket triggers exactly five critical end-of-day balances.
        final_basket = middle_groceries[-1]
        final_basket.day = end - timedelta(days=5)
        final_basket.booked = final_basket.day

    def usage(self):
        if not self.persona.gym:
            return
        last = min(self.start + timedelta(days=41), self.end - timedelta(days=91)) if self.persona.inactive_gym else self.end
        for day in days_between(self.start, last):
            if day.weekday() in (1, 4):
                self.signals.append({"subscription_merchant": "18GYM", "source": "geofence" if self.persona.inactive_gym else "health", "occurred_at": timestamp(day, 19 * 60 + self.rng.randint(0, 45))})

    def build(self, months):
        if self.persona.shortage:
            for index in range(-1, months):
                self.shortage_cycle(month_shift(self.start, index), index)
        else:
            for index in range(months):
                self.background(month_shift(self.start, index), index)
        self.usage()
        if self.persona.birthdays:
            upcoming = month_shift(self.end, 1)
            for number, day in enumerate((2, 4, 7, 10, 12, 15, 18, 21, 24, 27), 1):
                self.events.append({"title": f"Ziua de naștere — Invitat fictiv {number}", "starts_at": timestamp(upcoming.replace(day=day), 19 * 60), "type": "birthday"})
        for tx in self.transactions:
            if tx.booked is None:
                choices = [business_lag(tx.day, lag) for lag in range(3)]
                if self.persona.shortage:
                    # Late essentials settle immediately, even on weekends.
                    tx.booked = tx.day
                else:
                    tx.booked = self.rng.choice([day for day in choices if day <= self.end] or choices[:1]) if tx.card else tx.day
        self.transactions.sort(key=lambda tx: (tx.booked, tx.day, tx.minute, tx.description))
        cards = [tx for tx in self.transactions if tx.card and self.start <= tx.booked <= self.end]
        # Retain at least 18 timestamped coffees in full months while omitting ~10% overall.
        protected = set()
        if self.persona.coffee:
            for index in range(months):
                month = month_shift(self.start, index)
                coffees = [tx for tx in cards if tx.category == "coffee" and tx.day.month == month.month and tx.day.year == month.year]
                for tx in self.rng.sample(coffees, min(18, len(coffees))):
                    protected.add(id(tx))
        eligible = [tx for tx in cards if id(tx) not in protected]
        for tx in self.rng.sample(eligible, len(cards) // 10):
            tx.missing_time = True
        self.signals = sorted([signal for signal in self.signals if self.start <= datetime.fromisoformat(signal["occurred_at"]).date() <= self.end], key=lambda item: (item["occurred_at"], item["subscription_merchant"]))
        self.events.sort(key=lambda item: item["starts_at"])
        return self

    def write(self, directory):
        directory.mkdir(parents=True, exist_ok=True)
        balance = self.persona.opening_balance_minor
        rows = []
        income = expense = 0
        opening = balance
        for tx in self.transactions:
            if tx.booked > self.end:
                continue
            balance += tx.amount
            if tx.booked < self.start:
                opening = balance
                continue
            if balance < 0:
                raise ValueError(f"Unexpected negative balance: {self.persona.persona_id} {tx.booked}")
            description = tx.description
            if tx.card:
                clock = "" if tx.missing_time else f" {tx.minute // 60:02d}:{tx.minute % 60:02d}"
                description = f"POS {tx.day:%d.%m.%Y}{clock} {description} BUCURESTI"
            rows.append((tx.booked.strftime("%d.%m.%Y"), tx.day.strftime("%d.%m.%Y"), description, money(-tx.amount) if tx.amount < 0 else "", money(tx.amount) if tx.amount > 0 else "", money(balance)))
            income += max(tx.amount, 0)
            expense += max(-tx.amount, 0)
        with (directory / "transactions.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, delimiter=";", lineterminator="\n")
            writer.writerow(HEADER)
            writer.writerows(rows)
        p = self.persona
        write_json(directory / "profile.json", {"persona_id": p.persona_id, "name": p.name, "salary_day": p.salary_day, "monthly_income_minor": p.monthly_income_minor, "declared_problems": p.declared_problems, "context": p.context})
        write_json(directory / "usage_signals.json", self.signals)
        write_json(directory / "calendar_events.json", self.events)
        write_json(directory / "expected_patterns.json", self.expected_patterns())
        write_json(directory / "chat_scenarios.json", [{"message": message, "expected_tools": tools, "expected_topic": topic} for message, tools, topic in p.chats])
        return {"persona_id": p.persona_id, "transaction_count": len(rows), "opening_balance_minor": opening, "closing_balance_minor": balance, "income_minor": income, "expenses_minor": expense}

    def expected_patterns(self):
        p = self.persona
        patterns = []
        history = (self.end - self.start).days + 1
        if history < 90:
            return patterns
        if p.shortage:
            patterns.append({"type": "end_of_cycle_shortage", "notes": "Sold sub 100 lei în ultimele 5 zile; aproximativ 50% din venit cheltuit în primele 7 zile. Minimum 2 din ultimele 3 cicluri complete."})
        if p.coffee:
            patterns.extend([
                {"type": "daily_habit", "merchant": "CAFENEA ORIZONT", "notes": "20–22 dimineți lucrătoare/lună, cu o alternativă; intervalele se măsoară în zile lucrătoare."},
                {"type": "morning_spending", "window": "07:00–10:00", "min_confidence": 0.95, "notes": "Aproximativ 60% din numărul plăților discreționare cu oră; minimum 18 cafele cu oră pe lună completă."},
            ])
        if p.gym:
            patterns.append({"type": "subscription", "merchant": "18GYM", "notes": "230 lei lunar pe 15; prag specific minimum 3 plăți, CV interval < 0,15 și sumă constantă."})
        if p.inactive_gym:
            patterns.append({"type": "unused_subscription", "merchant": "18GYM", "notes": "Sursa geofence este conectată (vezi context); zero utilizări în ultimele 90 de zile."})
        if p.birthdays:
            patterns.append({"type": "upcoming_spike", "notes": "10 aniversări luna viitoare; costul per eveniment se estimează din cadouri, flori și restaurant în istoricul calendarului."})
        return patterns


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def generate(end_date, months, seed, out):
    if not 1 <= months <= 120:
        raise ValueError("months must be between 1 and 120")
    start = month_shift(end_date, 1 - months)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    summaries = [Builder(persona, start, end_date, seed).build(months).write(out / persona.persona_id) for persona in PERSONAS]
    manifest = {"generator_version": __version__, "parameters": {"end_date": end_date.isoformat(), "start_date": start.isoformat(), "months": months, "seed": seed, "timezone": "Europe/Bucharest", "currency": "RON"}, "personas": summaries}
    write_json(out / "manifest.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Generează date financiare fictive pentru România.")
    parser.add_argument("--end-date", type=date.fromisoformat, required=True)
    parser.add_argument("--months", type=int, default=6)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=Path("seed/output"))
    args = parser.parse_args()
    try:
        manifest = generate(args.end_date, args.months, args.seed, args.out)
    except ValueError as exc:
        parser.error(str(exc))
    for item in manifest["personas"]:
        print(f"{item['persona_id']}: {item['transaction_count']} tranzacții")


if __name__ == "__main__":
    main()

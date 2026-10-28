from datetime import UTC, date, datetime

import pandas as pd
import pytest

from app.analytics.preprocessing.categorize import UncategorizedFallback, categorize
from app.analytics.preprocessing.merchants import normalize_merchant, resolve_merchant
from app.analytics.preprocessing.salary import detect_salary
from app.analytics.preprocessing.timestamps import extract_occurred_at
from app.services.csv_parser import CSVFormatError, RaiffeisenCSVParser

HEADER = "Data inregistrare;Data tranzactiei;Descriere;Debit;Credit;Sold\n"
VALID = HEADER + "13.10.2026;12.10.2026;POS 12.10.2026 08:14 CAFENEA X SRL BUCURESTI;30,00;;1.000,01\n"


def test_parser_exact_money_signs_time_and_balance():
    row = RaiffeisenCSVParser().parse(VALID.encode())[0]
    assert row.amount_minor == -3000
    assert row.balance_minor == 100001
    assert row.occurred_at == datetime(2026, 10, 12, 5, 14, tzinfo=UTC)
    assert row.booked_at == datetime(2026, 10, 12, 21, tzinfo=UTC)
    assert row.occurred_at_precision == "minute"


def test_credit_day_precision_and_bom():
    row = RaiffeisenCSVParser().parse(
        ("\ufeff" + HEADER + "12.10.2026;12.10.2026;Transfer intrare SALARIU;;6500,00;6500,00\n").encode()
    )[0]
    assert row.amount_minor == 650000
    assert row.occurred_at_precision == "day"


@pytest.mark.parametrize(
    "data",
    [
        b"invalid",
        VALID.encode() + b"bad;row\n",
        VALID.replace("30,00;;", "30,00;20,00;").encode(),
        VALID.replace("30,00", "30.001").encode(),
        VALID.replace("30,00", "-30,00").encode(),
        VALID.replace("08:14", "28:14").encode(),
        VALID.replace("13.10.2026", "31.02.2026").encode(),
        HEADER.encode(),
        b"\xff",
    ],
)
def test_parser_rejects_invalid_data_without_exposing_content(data):
    with pytest.raises(CSVFormatError) as error:
        RaiffeisenCSVParser().parse(data)
    assert "CAFENEA" not in str(error.value)


def test_hash_normalizes_case_whitespace_and_keeps_balance():
    parser = RaiffeisenCSVParser()
    first = parser.parse(VALID.encode())[0]
    same = parser.parse(VALID.replace("CAFENEA X", "cafenea  x").encode())[0]
    other = parser.parse(VALID.replace("1.000,01", "1.000,00").encode())[0]
    assert first.dedup_hash == same.dedup_hash
    assert first.dedup_hash != other.dedup_hash


@pytest.mark.parametrize(
    "description",
    ["CAFENEA X SRL BUC", "CAFENEAX*1234", "Cafenea X", "POS 12.10.2026 08:14 CAFENEA X SRL BUCURESTI"],
)
def test_merchant_normalization(description):
    assert normalize_merchant(description) == "CAFENEA X"


def test_fuzzy_matching_and_manual_alias_priority():
    assert resolve_merchant("CAFENEA ORIZNT", ["CAFENEA ORIZONT"], {}) == "CAFENEA ORIZONT"
    assert resolve_merchant("CAFENEA ORIZNT", ["CAFENEA ORIZONT"], {"CAFENEA ORIZNT": "ALIAS"}) == "ALIAS"
    assert normalize_merchant("18GYM") == "18GYM"
    assert normalize_merchant("MEGAIMAGE*456") == "MEGA IMAGE"
    assert normalize_merchant("18GYM FITNESS") == "18GYM"


def test_offline_fuzzy_metric_preserves_threshold_and_best_match(monkeypatch):
    from app.analytics.preprocessing import merchants

    monkeypatch.setattr(merchants, "process", None)
    assert (
        merchants.resolve_merchant("CAFENEA ORIZNT", ["CAFENEA X", "CAFENEA ORIZONT"], {})
        == "CAFENEA ORIZONT"
    )
    assert (
        merchants.resolve_merchant("CAFENEA ORIZNT", ["CAFENEA ORIZONT"], {}, threshold=100)
        == "CAFENEA ORIZNT"
    )


def test_categorization_rules_alias_and_no_llm_fallback():
    assert categorize("CAFENEA X") == ("coffee", "discretionary")
    assert categorize("18GYM") == ("gym", "fixed")
    assert categorize("LIDL") == ("groceries", "essential")
    assert categorize("CAFENEA X", "groceries") == ("groceries", "essential")
    assert UncategorizedFallback().categorize("UNKNOWN") == "uncategorized"
    assert categorize("UNKNOWN") == ("uncategorized", "essential")


def test_local_time_dst_and_day_precision():
    summer, _ = extract_occurred_at("POS 12.10.2026 08:14 X", date(2026, 10, 12))
    winter, _ = extract_occurred_at("POS 28.10.2026 08:14 X", date(2026, 10, 28))
    assert summer.hour == 5 and winter.hour == 6
    assert extract_occurred_at("POS 12.10.2026 X", date(2026, 10, 13))[1] == "day"
    with pytest.raises(ValueError):
        extract_occurred_at("POS 29.03.2026 03:30 X", date(2026, 3, 29))


def test_salary_largest_recurring_stable_credit():
    frame = pd.DataFrame(
        [
            {
                "merchant": merchant,
                "amount_minor": amount,
                "occurred_at": datetime(2026, month, 5, tzinfo=UTC),
            }
            for month in range(5, 11)
            for merchant, amount in [("EMPLOYER", 650000), ("SMALL", 20000)]
        ]
    )
    estimate = detect_salary(frame)
    assert estimate.salary_day == 5 and estimate.monthly_income_minor == 650000
    assert detect_salary(frame.iloc[:2]) is None
    frame.loc[frame.merchant == "EMPLOYER", "amount_minor"] = [650000, 850000, 300000, 650000, 850000, 300000]
    assert detect_salary(frame).monthly_income_minor == 20000

"""Pure daily balance reconstruction using statement order and opening balances."""

from datetime import timedelta

import pandas as pd

from app.analytics.preprocessing.timestamps import BUCHAREST


def daily_balances(txs: pd.DataFrame) -> dict:
    if txs.empty:
        return {}
    by_account = []
    all_days = []
    for _, group in txs.groupby("account_id"):
        group = group.sort_values(["booked_at", "statement_order"])
        balances = {}
        for row in group.itertuples():
            day = row.booked_at.astimezone(BUCHAREST).date()
            balances[day] = int(row.balance_minor)
        first = group.iloc[0]
        opening = int(first.balance_minor) - int(first.amount_minor)
        by_account.append((balances, opening))
        all_days.extend(balances)
    start, end = min(all_days), max(all_days)
    current = [opening for _, opening in by_account]
    result = {}
    day = start
    while day <= end:
        for index, (balances, _) in enumerate(by_account):
            current[index] = balances.get(day, current[index])
        result[day] = sum(current)
        day += timedelta(days=1)
    return result

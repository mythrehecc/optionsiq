"""
Analytics service – aggregations on top of MonthlySummary / Trade data.
(Extended computations can be added here as the platform grows.)
"""
from typing import Any


def compute_win_rate(monthly_summaries: list) -> float:
    """Percentage of months with positive net P&L."""
    if not monthly_summaries:
        return 0.0
    winning = sum(1 for m in monthly_summaries if float(m.net_pnl) > 0)
    return round(winning / len(monthly_summaries) * 100, 2)


def compute_fee_drag(monthly_summaries: list) -> float:
    """Total fees as % of total premium collected."""
    total_premium = sum(float(m.premium_collected) for m in monthly_summaries)
    total_fees = sum(float(m.total_fees) for m in monthly_summaries)
    if total_premium == 0:
        return 0.0
    return round(total_fees / total_premium * 100, 2)


def compute_best_worst_month(monthly_summaries: list) -> dict[str, Any]:
    if not monthly_summaries:
        return {"best": None, "worst": None}
    sorted_by_pnl = sorted(monthly_summaries, key=lambda m: float(m.net_pnl))
    return {
        "best": sorted_by_pnl[-1].to_dict() if sorted_by_pnl else None,
        "worst": sorted_by_pnl[0].to_dict() if sorted_by_pnl else None,
    }

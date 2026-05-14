"""
Risk Engine — generates structured risk alerts from a list of Trade objects.
"""
from datetime import date
from collections import defaultdict
from typing import Any

def generate_alerts(trades: list) -> list[dict[str, Any]]:
    alerts = []
    today = date.today()

    # Group open positions (future expiration dates, TRD type)
    open_positions = [t for t in trades if t.trade_type == "TRD" and t.expiration_date and t.expiration_date >= today]

    # --- DASH-11: DTE < 7 days ---
    for t in open_positions:
        dte = (t.expiration_date - today).days
        if dte < 7:
            alerts.append({
                "severity": "High",
                "title": f"{t.ticker} expires in {dte} day{'s' if dte != 1 else ''}",
                "description": (
                    f"Your {t.strategy or 'option'} position on {t.ticker} "
                    f"(strike {t.strike_short}) expires {t.expiration_date.strftime('%b %d')}. "
                    f"Consider closing or rolling before expiration."
                ),
                "ticker": t.ticker,
                "alert_type": "expiration",
            })

    # --- DASH-12: Naked short calls ---
    calls = [t for t in open_positions if t.option_type == "CALL"]
    call_tickers = defaultdict(list)
    for c in calls:
        call_tickers[c.ticker].append(c)

    for ticker, pos_list in call_tickers.items():
        short_calls = [p for p in pos_list if p.strategy in ("Short Call", "Covered Call")]
        spread_calls = [p for p in pos_list if "Spread" in (p.strategy or "") or "Condor" in (p.strategy or "") or "Diagonal" in (p.strategy or "")]
        if short_calls and not spread_calls:
            alerts.append({
                "severity": "High",
                "title": f"{ticker}: Naked short call detected",
                "description": (
                    f"You have an uncovered short call on {ticker} with no paired long call. "
                    f"This carries unlimited loss potential if the stock rises sharply."
                ),
                "ticker": ticker,
                "alert_type": "naked_call",
            })

    # --- DASH-13: Tickers rolled more than once ---
    roll_counts = defaultdict(int)
    for t in trades:
        if t.strategy and "roll" in t.strategy.lower():
            roll_counts[t.ticker] += 1

    for ticker, count in roll_counts.items():
        if count > 1:
            alerts.append({
                "severity": "Medium",
                "title": f"{ticker}: Rolled more than once",
                "description": f"{ticker} has been rolled {count} times. Repeated rolls can indicate a losing position.",
                "ticker": ticker,
                "alert_type": "repeated_roll",
            })

    # --- DASH-14: Concentration risk (CONSISTENT WITH PARSER/DASHBOARD) ---
    # We now use t.gross_amount directly since the parser saves (unit * price * 100) there.
    ticker_premium = defaultdict(float)
    total_premium = 0.0

    for t in trades:
        if t.trade_type == "TRD":
            # Convert to float to ensure mathematical consistency
            val = float(t.gross_amount or 0.0)
            if val > 0:
                ticker_premium[t.ticker] += val
                total_premium += val

    if total_premium > 0:
        for ticker, prem in ticker_premium.items():
            pct = (prem / total_premium) * 100
            if pct > 25:
                alerts.append({
                    "severity": "Medium",
                    "title": f"{ticker}: Concentration risk ({pct:.0f}% of premium)",
                    "description": (
                        f"{ticker} accounts for {pct:.0f}% of your total premium collected (${prem:,.2f}). "
                        f"High concentration increases portfolio risk."
                    ),
                    "ticker": ticker,
                    "alert_type": "concentration",
                })

    # --- DASH-15: Assignment events ---
    assignments = [t for t in trades if t.trade_type == "EXP"]
    for a in assignments:
        cost = abs(float(a.gross_amount or 0.0))
        alerts.append({
            "severity": "Low",
            "title": f"{a.ticker}: Assignment",
            "description": f"You were assigned {a.ticker} shares. Cash outflow: ${cost:,.2f}.",
            "ticker": a.ticker,
            "alert_type": "assignment",
        })

    # Sort: High → Medium → Low
    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    alerts.sort(key=lambda x: severity_order.get(x.get("severity", "Low"), 2))

    return alerts
"""
ThinkorSwim CSV Parser — pure stdlib implementation (no pandas).
Parses TD Ameritrade / Charles Schwab ThinkorSwim account statement CSV files.
"""

import csv
import re
import io
from datetime import date, datetime
from typing import Any, Optional


def _parse_amount(val) -> float:
    """Parse dollar strings like '$1,234.56' or '(1,234.56)' into float."""
    if val is None or str(val).strip() == "":
        return 0.0
    s = str(val).strip().replace("$", "").replace(",", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_date(val) -> Optional[date]:
    if not val or str(val).strip() == "":
        return None
    s = str(val).strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _detect_strategy(description: str) -> tuple:
    desc = str(description).upper()
    strategy = "Other"
    option_type = None
    strike_short = None
    strike_long = None

    if "IRON CONDOR" in desc:
        strategy = "Iron Condor"
        option_type = "MIXED"
    elif "VERTICAL" in desc or "VERT" in desc:
        if "PUT" in desc:
            strategy = "Bull Put Spread"
            option_type = "PUT"
        elif "CALL" in desc:
            strategy = "Bear Call Spread"
            option_type = "CALL"
    elif "DIAGONAL" in desc:
        strategy = "Diagonal"
        option_type = "CALL" if "CALL" in desc else "PUT"
    elif "COVERED" in desc or ("CALL" in desc and "SELL" in desc):
        strategy = "Covered Call"
        option_type = "CALL"
    elif "CSP" in desc or ("PUT" in desc and "SELL" in desc and "VERTICAL" not in desc):
        strategy = "Cash-Secured Put"
        option_type = "PUT"
    elif "PUT" in desc:
        option_type = "PUT"
        strategy = "Short Put"
    elif "CALL" in desc:
        option_type = "CALL"
        strategy = "Short Call"

    strikes = re.findall(r"\b(\d{2,4}(?:\.\d+)?)/(\d{2,4}(?:\.\d+)?)\b", desc)
    if strikes:
        strike_short = float(strikes[0][0])
        strike_long = float(strikes[0][1])
    else:
        single = re.findall(r"\b(\d{2,4}(?:\.\d+)?)\s+(?:PUT|CALL)\b", desc)
        if single:
            strike_short = float(single[0])

    return strategy, option_type, strike_short, strike_long


def _extract_ticker(description: str) -> str:
    desc = str(description).upper()
    for prefix in ["SELL", "BUY", "BOT", "VERTICAL", "IRON", "CONDOR", "COVERED", "-1", "+1", "-2", "+2"]:
        desc = desc.replace(prefix, " ")
    tokens = desc.split()
    for token in tokens:
        if re.match(r"^[A-Z]{1,5}$", token) and token not in {"PUT", "CALL", "MIXED", "VERT", "EXP", "TRD"}:
            return token
    return "UNKNOWN"


def _extract_expiration(description: str) -> Optional[date]:
    desc = str(description)
    pattern = r"(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{2,4})"
    m = re.search(pattern, desc, re.IGNORECASE)
    if m:
        day, month_str, year_str = m.groups()
        year = int(year_str)
        if year < 100:
            year += 2000
        try:
            return datetime.strptime(f"{day} {month_str[:3].capitalize()} {year}", "%d %b %Y").date()
        except ValueError:
            pass
    pattern2 = r"(\d{2}/\d{2}/\d{4})"
    m2 = re.search(pattern2, desc)
    if m2:
        try:
            return datetime.strptime(m2.group(1), "%m/%d/%Y").date()
        except ValueError:
            pass
    return None


def _find_section(lines: list, section_name: str) -> int:
    for i, line in enumerate(lines):
        if section_name.lower() in line.lower():
            return i
    return -1


def parse_thinkorswim_csv(file_path: str) -> dict:
    """
    Parse a ThinkorSwim account statement CSV using stdlib only.
    Returns dict with: account_id, account_type, start_date, end_date, ending_balance, trades.
    """
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        content = f.read()

    lines = content.splitlines()

    account_id = "UNKNOWN"
    account_type = "Individual"
    start_date = None
    end_date = None
    ending_balance = None

    for line in lines[:30]:
        if "account" in line.lower():
            m = re.search(r"Account[:\s]+([\w\-]+)", line, re.IGNORECASE)
            if m and m.group(1).lower() not in ["trade", "statement", "history", "name", "number"]:
                account_id = m.group(1)
        if "ira" in line.lower():
            account_type = "Rollover IRA"
        if "date range" in line.lower() or "period" in line.lower():
            dates = re.findall(r"\d{1,2}/\d{1,2}/\d{4}", line)
            if len(dates) >= 2:
                start_date = _parse_date(dates[0])
                end_date = _parse_date(dates[1])
            elif len(dates) == 1:
                end_date = _parse_date(dates[0])

    # Find trades section
    trades_section_start = -1
    for keyword in ["Account Trade History", "Trade History", "Trades", "Transaction History"]:
        idx = _find_section(lines, keyword)
        if idx >= 0:
            trades_section_start = idx
            break

    trades: list = []

    if trades_section_start >= 0:
        # Find header row
        header_idx = -1
        for i in range(trades_section_start, min(trades_section_start + 10, len(lines))):
            if any(col in lines[i].lower() for col in ["date", "description", "amount", "balance"]):
                header_idx = i
                break

        if header_idx >= 0:
            section_text = "\n".join(lines[header_idx:])
            try:
                reader = csv.DictReader(io.StringIO(section_text))
                # Normalize column names
                raw_rows = list(reader)
                if not raw_rows:
                    pass
                else:
                    # Map normalized column names
                    sample = raw_rows[0]
                    cols = {k.strip().lower().replace(" ", "_"): k for k in sample.keys()}

                    date_col = next((cols[c] for c in cols if "date" in c), None)
                    desc_col = next((cols[c] for c in cols if "description" in c or "trade" in c), None)
                    amount_col = next((cols[c] for c in cols if "amount" in c or "net" in c), None)
                    balance_col = next((cols[c] for c in cols if "balance" in c or "running" in c), None)
                    commission_col = next((cols[c] for c in cols if "commission" in c), None)
                    misc_col = next((cols[c] for c in cols if "misc" in c or "fee" in c), None)
                    contracts_col = next((cols[c] for c in cols if "qty" in c or "quantity" in c or "contracts" in c), None)

                    all_dates = []
                    running_balance = None

                    for row in raw_rows:
                        trade_date = _parse_date(row.get(date_col, "")) if date_col else None
                        if not trade_date:
                            continue

                        all_dates.append(trade_date)
                        description = str(row.get(desc_col, "")) if desc_col else ""
                        gross = _parse_amount(row.get(amount_col, 0)) if amount_col else 0.0
                        commission = _parse_amount(row.get(commission_col, 0)) if commission_col else 0.0
                        misc_fee = _parse_amount(row.get(misc_col, 0)) if misc_col else 0.0

                        # Capture this row's running balance BEFORE updating the shared tracker
                        bal_raw = row.get(balance_col, "") if balance_col else ""
                        row_balance = None
                        if bal_raw and str(bal_raw).strip():
                            b = _parse_amount(bal_raw)
                            if b:
                                row_balance = b
                                running_balance = b  # keep track of last-seen balance

                        if "exp" in description.lower() or "assignment" in description.lower() or "assigned" in description.lower():
                            trade_type = "EXP"
                        else:
                            trade_type = "TRD"

                        ticker = _extract_ticker(description)
                        strategy, option_type, strike_short, strike_long = _detect_strategy(description)
                        expiration_date = _extract_expiration(description)

                        contracts = None
                        if contracts_col:
                            try:
                                contracts = int(float(str(row.get(contracts_col, "")).replace(",", "")))
                            except (ValueError, TypeError):
                                pass

                        premium_per_contract = None
                        if contracts and contracts != 0:
                            try:
                                premium_per_contract = abs(gross) / abs(contracts) / 100
                            except ZeroDivisionError:
                                pass

                        trades.append({
                            "trade_date": trade_date,
                            "trade_type": trade_type,
                            "ticker": ticker,
                            "strategy": strategy,
                            "option_type": option_type,
                            "contracts": contracts,
                            "strike_short": strike_short,
                            "strike_long": strike_long,
                            "expiration_date": expiration_date,
                            "premium_per_contract": premium_per_contract,
                            "gross_amount": gross,
                            "commissions": commission,
                            "misc_fees": misc_fee,
                            "running_balance": row_balance,
                        })

                    if all_dates:
                        start_date = start_date or min(all_dates)
                        end_date = end_date or max(all_dates)

                    ending_balance = running_balance

            except Exception:
                pass

    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()

    return {
        "account_id": account_id,
        "account_type": account_type,
        "start_date": start_date,
        "end_date": end_date,
        "ending_balance": ending_balance,
        "trades": trades,
    }

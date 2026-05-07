"""
Unified ThinkorSwim CSV Parser.

Handles two CSV formats automatically:
  - TOS_NATIVE  : Full TOS export with DATE,TIME,TYPE,REF #,DESCRIPTION,...
  - SIMPLIFIED  : Condensed format with Date,Description,Qty,Amount,Commission,Misc,Balance

Entry point: parse_thinkorswim_csv(file_path) — returns the same dict shape
the statements route expects (account_id, trades list, etc.).
"""

import re
import io
import csv
from datetime import date, datetime
from typing import Optional

# ── Format detection ─────────────────────────────────────────────────────────

def detect_format(filepath: str) -> str:
    """Sniff the CSV header and return 'TOS_NATIVE', 'SIMPLIFIED', or 'UNKNOWN'."""
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        upper = stripped.upper()
        # Full TOS export has TIME and REF # columns
        if "TIME" in upper and "REF #" in upper and "TYPE" in upper:
            return "TOS_NATIVE"
        # Simplified format has Qty but no TIME column
        if stripped.startswith(("DATE,", "Date,")) and "QTY" in upper and "TIME" not in upper:
            return "SIMPLIFIED"
        # Section-based simplified (Account Trade History header then columns)
        if "ACCOUNT TRADE HISTORY" in upper:
            return "SIMPLIFIED"

    return "UNKNOWN"


# ── Helpers ──────────────────────────────────────────────────────────────────

MONTH_MAP = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04",
    "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08",
    "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
}


def _parse_amount(val) -> float:
    if val is None or str(val).strip() == "":
        return 0.0
    s = str(val).strip().replace("$", "").replace(",", "").strip('"=')
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
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_expiry_alpha(day: str, mon: str, yr: str) -> Optional[date]:
    """Convert '10 APR 26' → date object."""
    mon_num = MONTH_MAP.get(mon.upper(), mon)
    yr_full = f"20{yr}" if len(yr) == 2 else yr
    try:
        return datetime.strptime(f"{yr_full}-{mon_num}-{day.zfill(2)}", "%Y-%m-%d").date()
    except ValueError:
        return None


# ── Description parser (works for BOTH formats) ──────────────────────────────

def parse_description(desc: str) -> dict:
    """
    Extract ticker, strategy, option_type, strike, expiry, contracts,
    premium_per_contract from a TOS description string.
    Works for both TOS_NATIVE and SIMPLIFIED format descriptions.
    """
    r: dict = {}
    desc = str(desc)
    upper = desc.upper()

    # ── Side ────────────────────────────────────────────────────────────────
    r["side"] = "SELL" if upper.startswith("SELL") or upper.startswith("SOLD") else "BUY"

    # ── Contracts ───────────────────────────────────────────────────────────
    m = re.search(r"(?:SELL|SOLD|BOT|BUY)\s+([+\-]?\d+)", desc, re.I)
    r["contracts"] = int(m.group(1)) if m else None

    # ── Strategy — order matters: most specific first ───────────────────────
    strategy = "Single"
    for strat in [
        "IRON CONDOR", "COVERED CALL", "DIAGONAL", "CALENDAR",
        "VERT ROLL", "VERTICAL", "SHORT PUT", "SHORT CALL",
    ]:
        if strat in upper:
            strategy = strat.title()
            break
    r["strategy"] = strategy

    # ── Ticker — word before "100" that isn't a keyword ─────────────────────
    SKIP = {
        "SELL", "SOLD", "BOT", "BUY", "PUT", "CALL", "MIXED",
        "SHORT", "LONG", "COVERED", "IRON", "CONDOR", "VERTICAL",
        "VERT", "DIAGONAL", "CALENDAR", "ROLL", "EXP", "TRD",
        "AND", "THE", "CSP",
    }
    m = re.search(
        r"(?:IRON\s+CONDOR|COVERED\s+CALL|DIAGONAL|CALENDAR|"
        r"VERT\s+ROLL|VERTICAL|SHORT\s+PUT|SHORT\s+CALL)?\s*"
        r"([A-Z]{1,5}(?:/[A-Z])?)\s+100",
        desc, re.I,
    )
    if m:
        r["ticker"] = m.group(1).upper()
    else:
        # Fallback: first 1-5 uppercase token that isn't a keyword
        clean = re.sub(r"[+\-]\d+", " ", upper)
        for tok in clean.split():
            tok = tok.strip(".,")
            if re.match(r"^[A-Z]{1,5}$", tok) and tok not in SKIP:
                r["ticker"] = tok
                break
        else:
            r["ticker"] = "UNKNOWN"

    # ── Expiry ───────────────────────────────────────────────────────────────
    # Pattern A: "10 APR 26"
    dates_alpha = re.findall(
        r"(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{2,4})",
        desc, re.I,
    )
    # Pattern B: "01/17/2025"
    dates_slash = re.findall(r"(\d{2})/(\d{2})/(\d{4})", desc)

    r["expiry_date"] = None
    r["expiry_str"] = None

    if dates_alpha:
        d, mon_str, yr = dates_alpha[-1]
        r["expiry_str"] = f"{d} {mon_str.upper()} {yr}"
        r["expiry_date"] = _parse_expiry_alpha(d, mon_str, yr)
        if len(dates_alpha) > 1:
            d2, m2, y2 = dates_alpha[0]
            r["expiry_front_str"] = f"{d2} {m2.upper()} {y2}"
    elif dates_slash:
        mo, dy, yr = dates_slash[0]
        r["expiry_str"] = f"{dy}/{mo}/{yr}"
        try:
            r["expiry_date"] = datetime.strptime(f"{yr}-{mo}-{dy}", "%Y-%m-%d").date()
        except ValueError:
            pass

    # ── Strike + option type ─────────────────────────────────────────────────
    r["strike_short"] = None
    r["strike_long"] = None
    r["option_type"] = None

    m = re.search(r"([\d.]+(?:/[\d.]+)+|[\d.]+)\s+(PUT|CALL|MIXED|CALL/PUT)", desc, re.I)
    if m:
        raw_strike = m.group(1)
        r["option_type"] = m.group(2).upper()
        parts = raw_strike.split("/")
        if len(parts) >= 2:
            r["strike_short"] = float(parts[0])
            r["strike_long"] = float(parts[1])
        else:
            r["strike_short"] = float(parts[0])

    # ── Premium per contract  @X.XX ──────────────────────────────────────────
    m = re.search(r"@([\d.]+)", desc)
    r["premium_per_contract"] = float(m.group(1)) if m else None

    # ── Trade type ───────────────────────────────────────────────────────────
    low = desc.lower()
    if "exp" in low or "assignment" in low or "assigned" in low:
        r["trade_type"] = "EXP"
    else:
        r["trade_type"] = "TRD"

    return r


# ── TOS_NATIVE loader ────────────────────────────────────────────────────────

def _load_tos_native(filepath: str) -> list:
    """Parse full TOS export (DATE,TIME,TYPE,REF #,DESCRIPTION,...) → list of trade dicts."""
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        raw = f.read()

    # Find the trade history block
    marker = "DATE,TIME,TYPE,REF #,DESCRIPTION"
    start = raw.upper().find(marker.upper())
    if start == -1:
        return []

    block = raw[start:]
    end = re.search(r"\n\s*\n", block)
    csv_block = block[: end.start()] if end else block

    rows = list(csv.DictReader(io.StringIO(csv_block)))
    trades = []

    for row in rows:
        # Normalise keys
        norm = {k.strip().upper(): v for k, v in row.items()}
        if norm.get("TYPE", "").strip().upper() != "TRD":
            continue

        trade_date = _parse_date(norm.get("DATE", ""))
        if not trade_date:
            continue

        description = norm.get("DESCRIPTION", "")
        gross = _parse_amount(norm.get("AMOUNT", 0))
        commission = _parse_amount(norm.get("COMMISSIONS & FEES", norm.get("COMMISSION", 0)))
        misc_fee = _parse_amount(norm.get("MISC FEES", norm.get("MISC", 0)))
        balance = _parse_amount(norm.get("BALANCE", "")) or None

        parsed = parse_description(description)

        contracts = parsed.get("contracts")
        if not contracts:
            try:
                contracts = int(float(str(norm.get("QTY", "")).replace(",", "")))
            except (ValueError, TypeError):
                contracts = None

        premium_pc = parsed.get("premium_per_contract")
        if not premium_pc and contracts and contracts != 0:
            try:
                premium_pc = abs(gross) / abs(contracts) / 100
            except ZeroDivisionError:
                pass

        trades.append({
            "trade_date":           trade_date,
            "trade_type":           parsed["trade_type"],
            "ticker":               parsed.get("ticker", "UNKNOWN"),
            "strategy":             parsed.get("strategy", "Other"),
            "option_type":          parsed.get("option_type"),
            "contracts":            contracts,
            "strike_short":         parsed.get("strike_short"),
            "strike_long":          parsed.get("strike_long"),
            "expiration_date":      parsed.get("expiry_date"),
            "premium_per_contract": premium_pc,
            "gross_amount":         gross,
            "commissions":          commission,
            "misc_fees":            misc_fee,
            "running_balance":      balance,
        })

    return trades


# ── SIMPLIFIED loader ────────────────────────────────────────────────────────

def _find_section_start(lines: list, keyword: str) -> int:
    for i, line in enumerate(lines):
        if keyword.lower() in line.lower():
            return i
    return -1


def _load_simplified(filepath: str) -> list:
    """Parse section-based simplified format (Date,Description,Qty,Amount,...) → list of trade dicts."""
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        content = f.read()

    lines = content.splitlines()

    # Find trade section header
    section_start = -1
    for kw in ["Account Trade History", "Trade History", "Trades"]:
        idx = _find_section_start(lines, kw)
        if idx >= 0:
            section_start = idx
            break

    if section_start < 0:
        # Try reading as plain CSV directly
        section_start = 0

    # Find the column header row
    header_idx = -1
    for i in range(section_start, min(section_start + 10, len(lines))):
        if any(col in lines[i].lower() for col in ["date", "description", "amount", "balance"]):
            header_idx = i
            break

    if header_idx < 0:
        return []

    # Collect rows until blank line or new section
    trade_lines = []
    for i in range(header_idx, len(lines)):
        if i > header_idx and (
            lines[i].strip() == "" or
            any(kw in lines[i] for kw in ["Account", "Section", "***"])
        ):
            break
        trade_lines.append(lines[i])

    if not trade_lines:
        return []

    reader = csv.DictReader(io.StringIO("\n".join(trade_lines)))
    raw_rows = list(reader)
    if not raw_rows:
        return []

    # Map column names flexibly
    sample = raw_rows[0]
    cols = {k.strip().lower().replace(" ", "_"): k for k in sample.keys()}

    date_col        = next((cols[c] for c in cols if "date" in c), None)
    desc_col        = next((cols[c] for c in cols if "description" in c or "trade" in c), None)
    amount_col      = next((cols[c] for c in cols if "amount" in c or "net" in c), None)
    balance_col     = next((cols[c] for c in cols if "balance" in c or "running" in c), None)
    commission_col  = next((cols[c] for c in cols if "commission" in c), None)
    misc_col        = next((cols[c] for c in cols if "misc" in c or "fee" in c), None)
    qty_col         = next((cols[c] for c in cols if "qty" in c or "quantity" in c or "contracts" in c), None)

    trades = []
    for row in raw_rows:
        trade_date = _parse_date(row.get(date_col, "")) if date_col else None
        if not trade_date:
            continue

        description = str(row.get(desc_col, "")) if desc_col else ""
        gross       = _parse_amount(row.get(amount_col, 0)) if amount_col else 0.0
        commission  = _parse_amount(row.get(commission_col, 0)) if commission_col else 0.0
        misc_fee    = _parse_amount(row.get(misc_col, 0)) if misc_col else 0.0
        bal_raw     = row.get(balance_col, "") if balance_col else ""
        balance     = _parse_amount(bal_raw) if bal_raw and str(bal_raw).strip() else None

        parsed = parse_description(description)

        # Prefer qty column, fall back to parsed contracts
        contracts = None
        if qty_col:
            try:
                contracts = int(float(str(row.get(qty_col, "")).replace(",", "")))
            except (ValueError, TypeError):
                pass
        if not contracts:
            contracts = parsed.get("contracts")

        premium_pc = parsed.get("premium_per_contract")
        if not premium_pc and contracts and contracts != 0:
            try:
                premium_pc = abs(gross) / abs(contracts) / 100
            except ZeroDivisionError:
                pass

        trades.append({
            "trade_date":           trade_date,
            "trade_type":           parsed["trade_type"],
            "ticker":               parsed.get("ticker", "UNKNOWN"),
            "strategy":             parsed.get("strategy", "Other"),
            "option_type":          parsed.get("option_type"),
            "contracts":            contracts,
            "strike_short":         parsed.get("strike_short"),
            "strike_long":          parsed.get("strike_long"),
            "expiration_date":      parsed.get("expiry_date"),
            "premium_per_contract": premium_pc,
            "gross_amount":         gross,
            "commissions":          commission,
            "misc_fees":            misc_fee,
            "running_balance":      balance,
        })

    return trades


# ── Meta-data helpers ────────────────────────────────────────────────────────

def _extract_meta(filepath: str) -> dict:
    """Pull account_id, account_type, start/end date, ending_balance from header lines."""
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()

    account_id   = "UNKNOWN"
    account_type = "Individual"
    start_date   = None
    end_date     = None

    for line in lines[:30]:
        if "ira" in line.lower():
            account_type = "Rollover IRA"
        m = re.search(r"Account[:\s]+([\w\-]+)", line, re.I)
        if m and m.group(1).lower() not in ["trade", "statement", "history", "name", "number"]:
            account_id = m.group(1)
        if "date range" in line.lower() or "period" in line.lower():
            dates = re.findall(r"\d{1,2}/\d{1,2}/\d{4}", line)
            if len(dates) >= 2:
                start_date = _parse_date(dates[0])
                end_date   = _parse_date(dates[1])
            elif len(dates) == 1:
                end_date = _parse_date(dates[0])

    return {
        "account_id":   account_id,
        "account_type": account_type,
        "start_date":   start_date,
        "end_date":     end_date,
    }


# ── Public entry point ───────────────────────────────────────────────────────

def parse_thinkorswim_csv(file_path: str) -> dict:
    """
    Unified parser for ThinkorSwim CSV files.
    Auto-detects format and returns:
      account_id, account_type, start_date, end_date,
      ending_balance, buying_power_total, buying_power_remaining,
      order_stats, trades (list of dicts)
    """
    fmt = detect_format(file_path)

    if fmt == "TOS_NATIVE":
        trades = _load_tos_native(file_path)
    else:
        # SIMPLIFIED or UNKNOWN — try simplified loader
        trades = _load_simplified(file_path)

    meta = _extract_meta(file_path)

    # Fill dates from trades if not found in header
    all_dates = [t["trade_date"] for t in trades if t.get("trade_date")]
    if all_dates:
        meta["start_date"] = meta["start_date"] or min(all_dates)
        meta["end_date"]   = meta["end_date"]   or max(all_dates)

    if not meta["start_date"]:
        meta["start_date"] = date.today().replace(day=1)
    if not meta["end_date"]:
        meta["end_date"] = date.today()

    ending_balance = None
    for t in reversed(trades):
        if t.get("running_balance"):
            ending_balance = t["running_balance"]
            break

    return {
        "account_id":             meta["account_id"],
        "account_type":           meta["account_type"],
        "start_date":             meta["start_date"],
        "end_date":               meta["end_date"],
        "ending_balance":         ending_balance,
        "buying_power_total":     None,
        "buying_power_remaining": None,
        "order_stats":            {"active": 0, "cancelled": 0, "filled": 0, "total": 0, "orders": []},
        "trades":                 trades,
        "format_detected":        fmt,
    }

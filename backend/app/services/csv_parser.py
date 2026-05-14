import re
import io
import csv
from datetime import date, datetime
from typing import Optional

def detect_format(filepath: str) -> str:
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        upper = stripped.upper()
        if "TIME" in upper and "REF #" in upper and "TYPE" in upper:
            return "TOS_NATIVE"
        if stripped.startswith(("DATE,", "Date,")) and "QTY" in upper and "TIME" not in upper:
            return "SIMPLIFIED"
        if "ACCOUNT TRADE HISTORY" in upper:
            return "SIMPLIFIED"
    return "UNKNOWN"

MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
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

def _extract_expiry_date(desc: str) -> Optional[date]:
    if not desc:
        return None
    upper = str(desc).upper()
    dates = []
    
    for m in re.finditer(r'(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{2,4})', upper):
        try:
            yr_str = m.group(3)
            yr = int(f"20{yr_str}") if len(yr_str) == 2 else int(yr_str)
            dates.append((m.start(), date(yr, MONTH_MAP[m.group(2)], int(m.group(1)))))
        except ValueError:
            pass

    for m in re.finditer(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', upper):
        try:
            yr_str = m.group(3)
            yr = int(f"20{yr_str}") if len(yr_str) == 2 else int(yr_str)
            dates.append((m.start(), date(yr, int(m.group(1)), int(m.group(2)))))
        except ValueError:
            pass
            
    if not dates:
        return None
        
    dates.sort(key=lambda x: x[0])
    return dates[0][1]

def parse_description(desc: str) -> dict:
    upper_desc = str(desc).upper()
    
    # 1. Capture the Unit (Handle SOLD -10 and BOT +4)
    m_unit = re.search(r"(SELL|SOLD|BOT|BUY|BOUGHT)\s*([+\-]?\d+)", upper_desc)
    unit = 0
    if m_unit:
        unit = abs(int(m_unit.group(2)))

    # 2. Capture the Price (The number after @)
    m_prem = re.search(r"@\s*([\d.]+)", upper_desc)
    price = abs(float(m_prem.group(1))) if m_prem else 0.0

    # 3. AUTHORITY CALCULATION (unit * price * 100)
    # User specifically requested ALL premiums be positive
    calculated_premium = unit * price * 100

    # 4. Ticker extraction — skip strategy keywords to find the real ticker
    STRATEGY_WORDS = {
        "VERTICAL", "VERT", "IRON", "CONDOR", "CALENDAR", "DIAGONAL",
        "BUTTERFLY", "STRADDLE", "STRANGLE", "SPREAD", "RATIO",
        "COVERED", "NAKED", "COLLAR", "UNBALANCED", "BROKEN",
        "SKIP", "JADE", "LIZARD", "CALL", "PUT",
    }
    NOISE_WORDS = {"THE", "AND", "FOR", "TO", "IN", "OF", "AT", "IS", "OR"}
    EXCHANGE_WORDS = {"CBOE", "NYSE", "NASDAQ", "ARCA", "PHLX", "ISE", "BOX"}
    ticker = "UNKNOWN"
    if m_unit:
        remainder = upper_desc[m_unit.end():]
        # Find all uppercase letter-only tokens (tickers are letters only, 1-6 chars)
        tokens = re.findall(r"\b([A-Z]{1,6})\b", remainder)
        for tok in tokens:
            if tok in STRATEGY_WORDS:
                continue
            if tok in NOISE_WORDS:
                continue
            if tok in MONTH_MAP:
                continue
            if tok in EXCHANGE_WORDS:
                continue
            # Valid ticker found
            ticker = tok
            break

    return {
        "ticker": ticker,
        "contracts": unit,
        "premium_per_contract": price,
        "calculated_premium": calculated_premium,
        "expiry_date": _extract_expiry_date(desc),
        "trade_type": "TRD"
    }

def _load_tos_native(filepath: str) -> list:
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        raw = f.read()

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
        norm = {k.strip().upper(): v for k, v in row.items()}
        if norm.get("TYPE", "").strip().upper() != "TRD":
            continue

        trade_date = _parse_date(norm.get("DATE", ""))
        if not trade_date:
            continue

        description = norm.get("DESCRIPTION", "")
        parsed = parse_description(description)

        trades.append({
            "trade_date": trade_date,
            "trade_type": parsed["trade_type"],
            "ticker": parsed.get("ticker", "UNKNOWN"),
            "strategy": "Other",
            "contracts": parsed.get("contracts"),
            "expiration_date": parsed.get("expiry_date"),
            "premium_per_contract": parsed.get("premium_per_contract"),
            
            # --- MAP FORMULA TO gross_amount ---
            "gross_amount": parsed.get("calculated_premium"), 
            
            "commissions": 0.0,
            "misc_fees": 0.0,
            "running_balance": _parse_amount(norm.get("BALANCE", "")) or None,
            "description": description,
        })
    return trades # FIXED: Indentation corrected to be outside the loop

def _load_simplified(filepath: str) -> list:
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        content = f.read()
    lines = content.splitlines()

    section_start = -1
    for kw in ["Account Trade History", "Trade History", "Trades"]:
        idx = _find_section_start(lines, kw)
        if idx >= 0:
            section_start = idx
            break
    if section_start < 0:
        section_start = 0

    header_idx = -1
    for i in range(section_start, min(section_start + 10, len(lines))):
        if any(col in lines[i].lower() for col in ["date", "description", "amount", "balance"]):
            header_idx = i
            break
    if header_idx < 0:
        return []

    trade_lines = []
    for i in range(header_idx, len(lines)):
        if i > header_idx and (
            lines[i].strip() == ""
            or any(kw in lines[i] for kw in ["Account", "Section", "***"])
        ):
            break
        trade_lines.append(lines[i])
    
    reader = csv.DictReader(io.StringIO("\n".join(trade_lines)))
    raw_rows = list(reader)

    trades = []
    for row in raw_rows:
        cols = {k.strip().lower().replace(" ", "_"): k for k in row.keys()}
        date_col = next((cols[c] for c in cols if "date" in c), None)
        desc_col = next((cols[c] for c in cols if "description" in c or "trade" in c), None)
        balance_col = next((cols[c] for c in cols if "balance" in c or "running" in c), None)

        trade_date = _parse_date(row.get(date_col, "")) if date_col else None
        if not trade_date:
            continue

        description = str(row.get(desc_col, "")) if desc_col else ""
        bal_raw = row.get(balance_col, "") if balance_col else ""
        parsed = parse_description(description)

        trades.append({
            "trade_date": trade_date,
            "trade_type": parsed["trade_type"],
            "ticker": parsed.get("ticker", "UNKNOWN"),
            "strategy": "Other",
            "contracts": parsed.get("contracts"),
            "expiration_date": parsed.get("expiry_date"),
            "premium_per_contract": parsed.get("premium_per_contract"),
            
            # --- MAP FORMULA TO gross_amount ---
            "gross_amount": parsed.get("calculated_premium"), 
            
            "commissions": 0.0,
            "misc_fees": 0.0,
            "running_balance": _parse_amount(bal_raw) if bal_raw else None,
            "description": description,
        })
    return trades

def _find_section_start(lines: list, keyword: str) -> int:
    for i, line in enumerate(lines):
        if keyword.lower() in line.lower():
            return i
    return -1

def _extract_meta(filepath: str) -> dict:
    with open(filepath, encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()

    account_id = "UNKNOWN"
    account_type = "Individual"
    start_date = None
    end_date = None
    buying_power_total = 0.0
    buying_power_remaining = 0.0

    def _clean_number(s: str) -> float:
        """Strip $, commas, quotes and parse a dollar amount."""
        s = s.strip().strip('"').replace("$", "").replace(",", "").replace(" ", "")
        s = s.replace("(", "-").replace(")", "")
        try:
            return float(s)
        except ValueError:
            return 0.0

    def _get_csv_value(row_str: str) -> float:
        """Parse a quoted CSV row and return the first positive numeric field after col 0."""
        import csv as _csv
        try:
            parts = list(_csv.reader([row_str]))[0]
        except Exception:
            parts = row_str.split(",")
        for p in parts[1:]:
            val = _clean_number(p)
            if val > 0:
                return val
        return 0.0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        lower = stripped.lower()

        # ── IRA detection ─────────────────────────────────────
        if "ira" in lower:
            account_type = "Rollover IRA"

        # ── Account ID ────────────────────────────────────────
        # TOS Line 1: "Account Statement for 23429012SCHW (Designated Benefi...) since ..."
        if account_id == "UNKNOWN":
            m = re.search(r"Account\s+Statement\s+for\s+([\w\-]+)", stripped, re.I)
            if m:
                account_id = m.group(1).strip()

        # Fallback: "Account: 123456" or "Account Number,123456"
        if account_id == "UNKNOWN":
            SKIP = {"trade", "statement", "history", "name", "number",
                    "type", "value", "balance", "summary", "cash",
                    "date", "range", "period", "report", "for"}
            # Colon / space separator
            m2 = re.search(r"Account(?:\s+Number)?[\s:,]+([A-Za-z0-9][A-Za-z0-9\-]{2,})", stripped, re.I)
            if m2:
                cand = m2.group(1).strip()
                if cand.lower() not in SKIP:
                    account_id = cand
            # Pure numeric line (e.g. bare "123456789")
            if account_id == "UNKNOWN":
                m3 = re.fullmatch(r"\s*(\d{6,12})\s*", stripped)
                if m3:
                    account_id = m3.group(1)

        # ── Date range ────────────────────────────────────────
        # TOS Line 1: "...since 3/1/26 through 5/6/26"
        if start_date is None:
            m_since = re.search(r"since\s+(\d{1,2}/\d{1,2}/\d{2,4})\s+through\s+(\d{1,2}/\d{1,2}/\d{2,4})", stripped, re.I)
            if m_since:
                start_date = _parse_date(m_since.group(1))
                end_date = _parse_date(m_since.group(2))

        # Generic "date range X to Y" or "period X - Y"
        if start_date is None and ("date range" in lower or "period" in lower):
            dates = re.findall(r"\d{1,2}/\d{1,2}/\d{2,4}", stripped)
            if len(dates) >= 2:
                start_date = _parse_date(dates[0])
                end_date = _parse_date(dates[1])

        # ── Buying Power TOTAL — Net Liquidating Value ────────
        # TOS format: 'Net Liquidating Value,"$1,296,239.44 ",,,...'
        if "net liquidating value" in lower or "net liq" in lower:
            val = _get_csv_value(stripped)
            if val > 0 and val > buying_power_total:
                buying_power_total = val

        # ── Buying Power REMAINING ────────────────────────────
        # TOS format: 'Option Buying Power,"$20,244.20 ",,,...'
        #             'Stock Buying Power,"$40,488.40 ",,,...'
        is_bp = any(kw in lower for kw in [
            "option buying power",
            "overnight buying power",
            "stock buying power",
            "cash & sweep vehicle",
            "cash and sweep",
            "available funds",
            "available for trading",
            "excess equity",
            "funds available",
        ])
        if is_bp:
            val = _get_csv_value(stripped)
            if val > 0 and val > buying_power_remaining:
                buying_power_remaining = val

    return {
        "account_id": account_id,
        "account_type": account_type,
        "start_date": start_date,
        "end_date": end_date,
        "buying_power_total": buying_power_total,
        "buying_power_remaining": buying_power_remaining,
    }

def parse_thinkorswim_csv(file_path: str) -> dict:
    fmt = detect_format(file_path)
    trades = _load_tos_native(file_path) if fmt == "TOS_NATIVE" else _load_simplified(file_path)
    meta = _extract_meta(file_path)

    all_dates = [t["trade_date"] for t in trades if t.get("trade_date")]
    if all_dates:
        meta["start_date"] = meta["start_date"] or min(all_dates)
        meta["end_date"] = meta["end_date"] or max(all_dates)

    return {
        "account_id": meta["account_id"],
        "account_type": meta["account_type"],
        "start_date": meta["start_date"],
        "end_date": meta["end_date"],
        "ending_balance": 0.0,
        "buying_power_total": meta["buying_power_total"],
        "buying_power_remaining": meta["buying_power_remaining"],
        "order_stats": {"active": 0, "cancelled": 0, "filled": 0, "total": 0, "orders": []},
        "trades": trades,
        "format_detected": fmt,
    }
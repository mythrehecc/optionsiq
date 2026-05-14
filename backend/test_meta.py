import sys
sys.path.insert(0, '.')
from app.services.csv_parser import _extract_meta

filepath = 'uploads/452d0eab-1af6-4401-83f1-8ce00e1481ae_2026-05-06-AccountStatement_-_xls_1.csv'
meta = _extract_meta(filepath)
print("=== META EXTRACTION RESULTS ===")
print("Account ID    :", meta["account_id"])
print("Account Type  :", meta["account_type"])
print("Start Date    :", meta["start_date"])
print("End Date      :", meta["end_date"])
print("Buying Power  : $", meta["buying_power_total"])
print("Remaining BP  : $", meta["buying_power_remaining"])

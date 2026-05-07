import sys
sys.path.insert(0, 'app')
from services.csv_parser import parse_thinkorswim_csv, detect_format

files = [
    '../sample_statement_3.csv',
    '../large_statement.csv',
    '../sample_statement.csv',
    '../sample_statement_2.csv',
]

for fp in files:
    try:
        fmt = detect_format(fp)
        result = parse_thinkorswim_csv(fp)
        trades = result['trades']
        print(f"\n{'='*60}")
        print(f"File   : {fp}")
        print(f"Format : {fmt}")
        print(f"Account: {result['account_id']}")
        print(f"Period : {result['start_date']} to {result['end_date']}")
        print(f"Trades : {len(trades)}")
        if trades:
            print("First 3 trades:")
            for t in trades[:3]:
                print(f"  {str(t['trade_date']):<12} {t['ticker']:<8} {t['strategy']:<22} "
                      f"type={str(t['option_type']):<5} gross={t['gross_amount']}")
    except Exception as e:
        import traceback
        print(f"\nERROR on {fp}: {e}")
        traceback.print_exc()

print("\nDONE")

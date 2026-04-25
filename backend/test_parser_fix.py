from app.services.csv_parser import parse_thinkorswim_csv

result = parse_thinkorswim_csv("../sample_statement.csv")
print("Account:", result["account_id"])
print("Total trades parsed:", len(result["trades"]))
print("Date range:", result["start_date"], "->", result["end_date"])
print()
for t in result["trades"]:
    print(
        t["trade_date"],
        "|", t["ticker"].ljust(8),
        "|", t["strategy"].ljust(20),
        "| amount=", t["gross_amount"],
        "| balance=", t["running_balance"]
    )

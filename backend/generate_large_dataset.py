import csv
import random
from datetime import datetime, timedelta

start_date = datetime(2025, 1, 1)
tickers = ["AAPL", "MSFT", "TSLA", "AMZN", "NVDA", "META", "GOOGL", "SPY", "QQQ"]
strategies = [
    ("IRON CONDOR", "100/105/90/85 CALL/PUT"),
    ("VERTICAL", "150/145 PUT"),
    ("VERTICAL", "200/210 CALL"),
    ("COVERED CALL", "500 CALL"),
    ("SHORT PUT", "120 PUT"),
]

def generate_large_csv(filename):
    with open(filename, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Account: 111222333"])
        writer.writerow(["Date Range: 01/01/2025 - 12/31/2025"])
        writer.writerow([])
        writer.writerow(["Account Trade History"])
        writer.writerow(["Date", "Description", "Qty", "Amount", "Commission", "Misc", "Balance"])

        balance = 100000.00
        current_date = start_date
        
        for i in range(500):
            # Advance 0 to 2 days
            current_date += timedelta(days=random.randint(0, 2))
            
            is_opening = random.choice([True, False])
            qty = random.randint(1, 20)
            ticker = random.choice(tickers)
            strategy, strikes = random.choice(strategies)
            
            expiration_date = current_date + timedelta(days=random.randint(7, 45))
            exp_str = expiration_date.strftime("%m/%d/%Y")
            
            if is_opening:
                action = "SELL" if random.random() > 0.3 else "BOT"
                qty_mult = -1 if action == "SELL" else 1
            else:
                action = "BOT" if random.random() > 0.3 else "SELL"
                qty_mult = 1 if action == "BOT" else -1

            sign = "+" if qty_mult > 0 else "-"
            price = round(random.uniform(0.5, 5.0), 2)
            desc = f"{action} {sign}{qty} {strategy} {ticker} 100 {exp_str} {strikes} @{price:.2f}"
            
            # Simulated P&L. If opening, premium in or out. If closing, opposite.
            if action == "SELL":
                amount = round(price * qty * 100, 2)
            else:
                amount = round(-price * qty * 100, 2)
                
            # Randomize a bit to simulate wins and losses
            if not is_opening:
                amount = amount * random.uniform(0.1, 2.5)
                
            amount = round(amount, 2)
            commission = round(-0.65 * qty * (4 if "CONDOR" in strategy else 2 if "VERTICAL" in strategy else 1), 2)
            misc = -0.10
            
            balance += amount + commission + misc
            
            date_str = current_date.strftime("%m/%d/%Y")
            
            writer.writerow([
                date_str,
                desc,
                qty * qty_mult,
                f"{amount:.2f}",
                f"{commission:.2f}",
                f"{misc:.2f}",
                f"{balance:.2f}"
            ])

if __name__ == "__main__":
    generate_large_csv("../large_statement.csv")

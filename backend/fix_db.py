import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "instance", "optionsiq.db")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

alters = [
    "ALTER TABLE statements ADD COLUMN filename VARCHAR(500)",
    "ALTER TABLE statements ADD COLUMN buying_power_total NUMERIC(15, 2)",
    "ALTER TABLE statements ADD COLUMN buying_power_remaining NUMERIC(15, 2)",
    
    "ALTER TABLE monthly_summaries ADD COLUMN total_options_placed INTEGER DEFAULT 0",
    "ALTER TABLE monthly_summaries ADD COLUMN total_active_orders INTEGER DEFAULT 0",
    "ALTER TABLE monthly_summaries ADD COLUMN total_cancelled_orders INTEGER DEFAULT 0",
    "ALTER TABLE monthly_summaries ADD COLUMN total_closed_orders INTEGER DEFAULT 0",
    "ALTER TABLE monthly_summaries ADD COLUMN commissions_paid NUMERIC(10, 2) DEFAULT 0",
]

for alt in alters:
    try:
        cursor.execute(alt)
        print(f"Success: {alt}")
    except Exception as e:
        print(f"Skipped (or error): {alt} -> {e}")

conn.commit()
conn.close()
print("Done fixing database schema.")

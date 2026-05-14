from app import create_app, db
from sqlalchemy import text

app = create_app()

def run_wipe():
    with app.app_context():
        print("--- ☢️ STARTING CLEAN WIPE ☢️ ---")
        
        tables = ["monthly_summaries", "trades", "orders", "statements"]
        
        # 1. Disable foreign keys
        db.session.execute(text("PRAGMA foreign_keys = OFF;"))
        
        for table in tables:
            try:
                print(f"Purging: {table}")
                # Clear all data
                db.session.execute(text(f"DELETE FROM {table};"))
                
                # Try to reset sequence, but ignore if it fails
                try:
                    db.session.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}';"))
                except Exception:
                    pass 
                    
            except Exception as e:
                print(f"Could not clear {table}: {e}")
        
        db.session.commit()
        print("\n✅ SUCCESS: Database cleared.")

if __name__ == "__main__":
    run_wipe()
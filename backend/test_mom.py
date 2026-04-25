from app import create_app, db
from app.models import MonthlySummary

app = create_app()
with app.app_context():
    moms = MonthlySummary.query.filter_by(account_id="Trade").all()
    print(f"Found {len(moms)} Monthly Summaries for Trade account")
    for m in moms:
        print(m.to_dict())

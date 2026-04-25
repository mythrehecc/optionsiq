from app import create_app, db
from app.models import Statement, Trade, MonthlySummary

app = create_app()
with app.app_context():
    db.session.query(MonthlySummary).delete()
    db.session.query(Trade).delete()
    db.session.query(Statement).delete()
    db.session.commit()
    print("Database wiped successfully. Ready for fresh uploads.")

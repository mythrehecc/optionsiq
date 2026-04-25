import sys
from app import create_app, db
from app.models import Statement, User, Trade

app = create_app()
with app.app_context():
    users = User.query.all()
    print("Users:")
    for u in users:
        print(u.email, u.user_id)
        
    stmts = Statement.query.all()
    print("\nStatements:")
    for s in stmts:
        print(s.statement_id, s.user_id, s.account_id, s.filename)

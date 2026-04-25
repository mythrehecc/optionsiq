from app import create_app, db
from app.models import Statement, User
from flask_jwt_extended import create_access_token

app = create_app()
with app.app_context():
    # User demo@option.com
    user = User.query.filter_by(email="demo@option.com").first()
    if not user:
        print("User not found")
        exit()
        
    stmts = Statement.query.filter_by(user_id=user.user_id).order_by(Statement.statement_end.desc()).all()
    print(f"Found {len(stmts)} statements for user {user.user_id}")
    for s in stmts:
        print(s.to_dict())

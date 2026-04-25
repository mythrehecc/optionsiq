from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
import os

load_dotenv()

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
migrate = Migrate()


def create_app():
    app = Flask(__name__)

    env = os.environ.get("FLASK_ENV", "development")
    from app.config import config_by_name
    app.config.from_object(config_by_name.get(env, config_by_name["development"]))

    # Extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    CORS(app)

    # Prevent 308 redirect loops through the Next.js proxy
    app.url_map.strict_slashes = False

    # Blueprints
    from app.routes.auth import auth_bp
    from app.routes.statements import statements_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(statements_bp, url_prefix="/statements")
    app.register_blueprint(dashboard_bp, url_prefix="/dashboard")

    # Ensure tables are created automatically in production
    with app.app_context():
        from app.models import User, Statement, Trade, MonthlySummary
        db.create_all()

    return app

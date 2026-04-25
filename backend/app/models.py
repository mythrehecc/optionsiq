import uuid
from app import db
from datetime import datetime, timezone


def gen_uuid():
    return str(uuid.uuid4())


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    email = db.Column(db.String(255), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True)
    subscription_tier = db.Column(db.String(50), default="free")

    statements = db.relationship("Statement", backref="user", lazy=True, cascade="all, delete-orphan")
    trades = db.relationship("Trade", backref="user", lazy=True, cascade="all, delete-orphan")
    summaries = db.relationship("MonthlySummary", backref="user", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "email": self.email,
            "full_name": self.full_name,
            "subscription_tier": self.subscription_tier,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Statement(db.Model):
    __tablename__ = "statements"

    statement_id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)
    account_id = db.Column(db.String(50), nullable=False)
    account_type = db.Column(db.String(50), nullable=True)
    statement_start = db.Column(db.Date, nullable=False)
    statement_end = db.Column(db.Date, nullable=False)
    ending_balance = db.Column(db.Numeric(15, 2), nullable=True)
    parse_status = db.Column(db.String(20), default="pending")
    file_path = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    trade_count = db.Column(db.Integer, default=0)
    filename = db.Column(db.String(500), nullable=True)

    trades = db.relationship("Trade", backref="statement", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "statement_id": self.statement_id,
            "account_id": self.account_id,
            "account_type": self.account_type,
            "statement_start": self.statement_start.isoformat() if self.statement_start else None,
            "statement_end": self.statement_end.isoformat() if self.statement_end else None,
            "ending_balance": float(self.ending_balance) if self.ending_balance else None,
            "parse_status": self.parse_status,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "trade_count": self.trade_count,
            "filename": self.filename,
        }


class Trade(db.Model):
    __tablename__ = "trades"

    trade_id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    statement_id = db.Column(db.String(36), db.ForeignKey("statements.statement_id"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)
    trade_date = db.Column(db.Date, nullable=False)
    trade_type = db.Column(db.String(10), nullable=False)  # TRD or EXP
    ticker = db.Column(db.String(10), nullable=False)
    strategy = db.Column(db.String(30), nullable=True)
    option_type = db.Column(db.String(5), nullable=True)  # PUT | CALL | MIXED
    contracts = db.Column(db.Integer, nullable=True)
    strike_short = db.Column(db.Numeric(10, 2), nullable=True)
    strike_long = db.Column(db.Numeric(10, 2), nullable=True)
    expiration_date = db.Column(db.Date, nullable=True)
    premium_per_contract = db.Column(db.Numeric(8, 4), nullable=True)
    gross_amount = db.Column(db.Numeric(12, 2), nullable=False)
    commissions = db.Column(db.Numeric(8, 2), default=0)
    misc_fees = db.Column(db.Numeric(8, 2), default=0)
    running_balance = db.Column(db.Numeric(15, 2), nullable=True)

    def to_dict(self):
        return {
            "trade_id": self.trade_id,
            "trade_date": self.trade_date.isoformat() if self.trade_date else None,
            "trade_type": self.trade_type,
            "ticker": self.ticker,
            "strategy": self.strategy,
            "option_type": self.option_type,
            "contracts": self.contracts,
            "strike_short": float(self.strike_short) if self.strike_short else None,
            "strike_long": float(self.strike_long) if self.strike_long else None,
            "expiration_date": self.expiration_date.isoformat() if self.expiration_date else None,
            "premium_per_contract": float(self.premium_per_contract) if self.premium_per_contract else None,
            "gross_amount": float(self.gross_amount),
            "commissions": float(self.commissions),
            "misc_fees": float(self.misc_fees),
            "running_balance": float(self.running_balance) if self.running_balance else None,
        }


class MonthlySummary(db.Model):
    __tablename__ = "monthly_summaries"

    summary_id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.user_id"), nullable=False)
    account_id = db.Column(db.String(50), nullable=False)
    month_year = db.Column(db.Date, nullable=False)
    premium_collected = db.Column(db.Numeric(12, 2), default=0)
    losses_realized = db.Column(db.Numeric(12, 2), default=0)
    assignment_costs = db.Column(db.Numeric(12, 2), default=0)
    total_fees = db.Column(db.Numeric(10, 2), default=0)
    net_pnl = db.Column(db.Numeric(12, 2), default=0)
    total_fills = db.Column(db.Integer, default=0)
    ending_balance = db.Column(db.Numeric(15, 2), nullable=True)
    assignment_count = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.Index("ix_mom_user_account_month", "user_id", "account_id", "month_year"),
    )

    def to_dict(self):
        return {
            "summary_id": self.summary_id,
            "account_id": self.account_id,
            "month_year": self.month_year.isoformat() if self.month_year else None,
            "premium_collected": float(self.premium_collected),
            "losses_realized": float(self.losses_realized),
            "assignment_costs": float(self.assignment_costs),
            "total_fees": float(self.total_fees),
            "net_pnl": float(self.net_pnl),
            "total_fills": self.total_fills,
            "ending_balance": float(self.ending_balance) if self.ending_balance else None,
            "assignment_count": self.assignment_count,
        }

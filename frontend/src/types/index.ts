// OptionsIQ — TypeScript type definitions

export interface User {
  user_id: string;
  email: string;
  full_name: string;
  subscription_tier: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface Statement {
  statement_id: string;
  account_id: string;
  account_type: string | null;
  statement_start: string;
  statement_end: string;
  ending_balance: number | null;
  parse_status: "pending" | "processing" | "complete" | "error";
  uploaded_at: string;
  trade_count: number;
  filename: string;
}

export interface Trade {
  trade_id: string;
  trade_date: string;
  trade_type: "TRD" | "EXP";
  ticker: string;
  strategy: string | null;
  option_type: "PUT" | "CALL" | "MIXED" | null;
  contracts: number | null;
  strike_short: number | null;
  strike_long: number | null;
  expiration_date: string | null;
  premium_per_contract: number | null;
  gross_amount: number;
  commissions: number;
  misc_fees: number;
  running_balance: number | null;
  dte?: number;
  risk_level?: "High" | "Medium" | "Low";
}

export interface MonthlySummary {
  summary_id: string;
  account_id: string;
  month_year: string;
  premium_collected: number;
  losses_realized: number;
  assignment_costs: number;
  total_fees: number;
  net_pnl: number;
  total_fills: number;
  ending_balance: number | null;
  assignment_count: number;
}

export interface DashboardSummary {
  cash_balance: number | null;
  balance_delta: number | null;
  net_pnl: number;
  premium_collected: number;
  total_fees: number;
  fee_pct_of_premium: number;
  tickers_traded: number;
  period_start: string;
  period_end: string;
  account_id: string;
}

export interface RiskAlert {
  severity: "High" | "Medium" | "Low";
  title: string;
  description: string;
  ticker: string;
  alert_type: "expiration" | "naked_call" | "repeated_roll" | "concentration" | "assignment";
  cost?: number;
}

export interface TickerPnL {
  ticker: string;
  pnl: number;
}

export interface StrategyPnL {
  strategy: string;
  pnl: number;
}

export interface Account {
  account_id: string;
  account_type: string | null;
}

"use client";
import React, { useEffect, useCallback, useState } from "react";
import { Row, Col, Card, Statistic, Tag, Typography, Table, Empty, Spin, Badge, Button, InputNumber, Progress, Tooltip as AntTooltip } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, ThunderboltOutlined, WarningOutlined, RiseOutlined, UploadOutlined, FileTextOutlined, AppstoreOutlined, CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi, statementsApi } from "@/services/api";
import { Statement, Trade } from "@/types";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const PIE_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#34d399"];

const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9))",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

const StatCard = ({ title, value, prefix, suffix, delta, color, icon }: any) => (
  <Card style={{ ...cardStyle, height: "100%" }} bodyStyle={{ padding: "20px 24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: color || "#fff" }}>
            {prefix}{typeof value === "number" ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (value ?? "—")}
            {suffix && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{suffix}</span>}
          </span>
        </div>
        {delta !== null && delta !== undefined && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            {delta >= 0 ? <ArrowUpOutlined style={{ color: "#10b981", fontSize: 12 }} /> : <ArrowDownOutlined style={{ color: "#f43f5e", fontSize: 12 }} />}
            <Text style={{ color: delta >= 0 ? "#10b981" : "#f43f5e", fontSize: 12, fontWeight: 600 }}>
              ${Math.abs(delta).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs prior period
            </Text>
          </div>
        )}
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color || "#6366f1"}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {React.cloneElement(icon, { style: { fontSize: 22, color: color || "#6366f1" } })}
      </div>
    </div>
  </Card>
);

const severityColor: Record<string, string> = { High: "#f43f5e", Medium: "#f59e0b", Low: "#10b981" };

// ─── Statement Selector Bar ───────────────────────────────────────────────────
interface StatementSelectorBarProps {
  statements: Statement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpload: () => void;
}

function StatementSelectorBar({ statements, selectedId, onSelect, onUpload }: StatementSelectorBarProps) {
  const sorted = [...statements].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );

  const chipBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: "12px 16px",
    borderRadius: 14,
    cursor: "pointer",
    border: "1px solid rgba(99,102,241,0.18)",
    background: "rgba(26,26,46,0.85)",
    transition: "all 0.2s ease",
    minWidth: 180,
    maxWidth: 220,
    flexShrink: 0,
    position: "relative",
  };

  const chipActive: React.CSSProperties = {
    border: "1px solid #6366f1",
    background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))",
    boxShadow: "0 0 0 2px rgba(99,102,241,0.25), 0 4px 16px rgba(99,102,241,0.15)",
  };

  const allActive = selectedId === null;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AppstoreOutlined style={{ color: "#6366f1", fontSize: 18 }} />
          <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 15 }}>
            Analysing Statement
          </Text>
          {statements.length > 0 && (
            <Tag color="purple" style={{ borderRadius: 20, fontSize: 11 }}>
              {statements.length} file{statements.length > 1 ? "s" : ""}
            </Tag>
          )}
        </div>
        <Button
          size="small"
          icon={<UploadOutlined />}
          onClick={onUpload}
          style={{
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.35)",
            color: "#a5b4fc",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Upload New
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 8,
          scrollbarWidth: "thin",
        }}
      >
        {/* All Statements chip */}
        <div
          style={{ ...chipBase, ...(allActive ? chipActive : {}), minWidth: 140 }}
          onClick={() => onSelect(null)}
        >
          {allActive && (
            <CheckCircleFilled
              style={{ position: "absolute", top: 8, right: 8, color: "#6366f1", fontSize: 13 }}
            />
          )}
          <AppstoreOutlined style={{ fontSize: 20, color: allActive ? "#a5b4fc" : "rgba(255,255,255,0.4)" }} />
          <Text style={{ color: allActive ? "#fff" : "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
            All Statements
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
            Aggregated view
          </Text>
        </div>

        {/* Per-file chips */}
        {sorted.map((s) => {
          const isActive = selectedId === s.statement_id;
          const label = s.filename ? s.filename.replace(/\.csv$/i, "") : s.account_id;
          const period = s.statement_start
            ? `${dayjs(s.statement_start).format("MMM D")} – ${dayjs(s.statement_end).format("MMM D, YYYY")}`
            : "—";
          return (
            <div
              key={s.statement_id}
              style={{ ...chipBase, ...(isActive ? chipActive : {}) }}
              onClick={() => onSelect(s.statement_id)}
            >
              {isActive && (
                <CheckCircleFilled
                  style={{ position: "absolute", top: 8, right: 8, color: "#6366f1", fontSize: 13 }}
                />
              )}
              <FileTextOutlined style={{ fontSize: 20, color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.4)" }} />
              <AntTooltip title={label}>
                <Text
                  style={{
                    color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                    fontWeight: 700,
                    fontSize: 13,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 180,
                    display: "block",
                  }}
                >
                  {label}
                </Text>
              </AntTooltip>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <CalendarOutlined style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }} />
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{period}</Text>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <Tag
                  color="purple"
                  style={{ fontSize: 10, padding: "0 6px", lineHeight: "18px", borderRadius: 6, margin: 0 }}
                >
                  {s.account_id}
                </Tag>
                <Tag
                  color="cyan"
                  style={{ fontSize: 10, padding: "0 6px", lineHeight: "18px", borderRadius: 6, margin: 0 }}
                >
                  {s.trade_count} trades
                </Tag>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [taxRate, setTaxRate] = useState(15);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(true);
  const { selectedAccount, selectedStatementId, setSelectedStatementId, setSelectedAccount, summary, setSummary, monthlySummaries, setMonthlySummaries, alerts, setAlerts, tickerPnL, setTickerPnL, strategyPnL, setStrategyPnL, positions, setPositions, isLoading, setLoading } = useDashboard();

  // Load statements list for the selector
  useEffect(() => {
    statementsApi.list()
      .then((res) => setStatements(res.data.statements || []))
      .catch(() => {})
      .finally(() => setStatementsLoading(false));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, momRes, alertRes, tickerRes, stratRes, posRes] = await Promise.all([
        dashboardApi.summary({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.mom({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.alerts({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.tickerPnl({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.strategyPnl({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.positions({ accountId: selectedAccount, statementId: selectedStatementId }),
      ]);
      setSummary(sumRes.data.summary);
      setMonthlySummaries(momRes.data.mom);
      setAlerts(alertRes.data.alerts);
      setTickerPnL(tickerRes.data.ticker_pnl);
      setStrategyPnL(stratRes.data.strategy_pnl);
      setPositions(posRes.data.positions || []);
    } catch (e) { /* no data yet */ }
    setLoading(false);
  }, [selectedAccount, selectedStatementId]);

  useEffect(() => { loadData(); }, [loadData]);

  const momChartData = monthlySummaries.map((m) => ({
    month: dayjs(m.month_year).format("MMM YY"),
    premium: m.premium_collected,
    pnl: m.net_pnl,
    fees: m.total_fees,
  }));

  const strategyData = strategyPnL.map((s) => ({ name: s.strategy, value: Math.abs(s.pnl) }));
  const topTickers = tickerPnL.slice(0, 8);

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}><Spin size="large" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>
            Welcome back, {user?.full_name?.split(" ")[0]} 👋
          </Title>
          {summary?.period_start && (
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
              Period: {dayjs(summary.period_start).format("MMM D")} – {dayjs(summary.period_end).format("MMM D, YYYY")} · Account: {summary.account_id}
            </Text>
          )}
        </div>
      </div>

      {/* Statement Selector */}
      {!statementsLoading && (
        <StatementSelectorBar
          statements={statements}
          selectedId={selectedStatementId}
          onSelect={(id) => {
            setSelectedStatementId(id);
            setSelectedAccount(null);
          }}
          onUpload={() => router.push("/statements")}
        />
      )}

      {!summary || Object.keys(summary).length === 0 ? (
        <Card style={cardStyle}>
          {statements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px" }}>
              <FileTextOutlined style={{ fontSize: 56, color: "rgba(99,102,241,0.35)", marginBottom: 16 }} />
              <div>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, display: "block", marginBottom: 8 }}>
                  No statements uploaded yet
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, display: "block", marginBottom: 20 }}>
                  Upload a ThinkorSwim CSV statement to start analysing your portfolio
                </Text>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => router.push("/statements")}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    height: 42,
                    padding: "0 28px",
                    borderRadius: 10,
                    fontWeight: 600,
                    boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                  }}
                >
                  Upload Statement
                </Button>
              </div>
            </div>
          ) : (
            <Empty description={
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                No data available for the selected statement. Try choosing another above.
              </span>
            } />
          )}
        </Card>
      ) : (
        <>
          {/* Section 1: Overall Summary */}
          <div style={{ marginBottom: 28 }}>
            <Title level={4} style={{ color: "#fff", marginBottom: 16, fontWeight: 700 }}>Overall Summary</Title>
            <Card style={cardStyle} bodyStyle={{ padding: "24px" }}>
              <Row gutter={[32, 24]} align="middle">
                <Col xs={24} sm={12} md={4}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, display: "block", marginBottom: 4 }}>OPENING CASH</Text>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>${summary.opening_cash_balance?.toLocaleString() || "—"}</Text>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, display: "block", marginBottom: 4 }}>NET P&L</Text>
                  <Text style={{ color: summary.net_pnl >= 0 ? "#10b981" : "#f43f5e", fontSize: 20, fontWeight: 700 }}>
                    {summary.net_pnl >= 0 ? "+" : "-"}${Math.abs(summary.net_pnl).toLocaleString()}
                  </Text>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>TAX TO BE PAID</Text>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>Rate:</Text>
                      <InputNumber 
                        size="small" 
                        min={0} max={100} value={taxRate} 
                        onChange={(v) => setTaxRate(v || 0)} 
                        style={{ width: 55, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                      />
                      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>%</Text>
                    </div>
                  </div>
                  <Text style={{ color: "#f59e0b", fontSize: 20, fontWeight: 700 }}>
                    ${(Math.max(0, summary.net_pnl) * (taxRate / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </Col>
                <Col xs={24} sm={12} md={5}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, display: "block", marginBottom: 4 }}>TOTAL BUYING POWER</Text>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>${summary.buying_power_total?.toLocaleString() || "—"}</Text>
                </Col>
                <Col xs={24} sm={12} md={5}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, display: "block", marginBottom: 4 }}>REMAINING BP</Text>
                  <Text style={{ color: "#22d3ee", fontSize: 20, fontWeight: 700 }}>${summary.buying_power_remaining?.toLocaleString() || "—"}</Text>
                </Col>
              </Row>
            </Card>
          </div>

          {/* KPI Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Cash Balance" value={summary.cash_balance} prefix="$" delta={summary.balance_delta} color="#6366f1" icon={<DollarOutlined />} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Net P&L" value={summary.net_pnl} prefix="$" color={summary.net_pnl >= 0 ? "#10b981" : "#f43f5e"} icon={<RiseOutlined />} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Premium Collected" value={summary.premium_collected} prefix="$" color="#22d3ee" icon={<ThunderboltOutlined />} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Fee Drag" value={summary.fee_pct_of_premium} suffix="% of premium" color="#f59e0b" icon={<WarningOutlined />} />
            </Col>
          </Row>

          {/* Charts Row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* MoM Chart */}
            <Col xs={24}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Month-over-Month P&L</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                {momChartData.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No monthly data</span>} /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={momChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                      <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                      <Bar dataKey="premium" name="Premium" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pnl" name="Net P&L" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
          </Row>

          {/* Ticker PnL + Alerts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={13}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Top Tickers by P&L</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                {topTickers.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={topTickers} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="ticker" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                      <Bar dataKey="pnl" name="P&L" radius={[0, 4, 4, 0]}
                        fill="#6366f1"
                        label={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>

            <Col xs={24} xl={11}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Risk Alerts <Badge count={alerts.length} style={{ background: "#f43f5e", marginLeft: 8 }} /></span>} style={cardStyle} bodyStyle={{ padding: "12px 16px", maxHeight: 280, overflowY: "auto" }}>
                {alerts.length === 0 ? (
                  <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No alerts — portfolio looks healthy!</span>} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {alerts.slice(0, 6).map((alert, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px", borderLeft: `3px solid ${severityColor[alert.severity]}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{alert.title}</Text>
                          <Tag color={alert.severity === "High" ? "red" : alert.severity === "Medium" ? "orange" : "green"} style={{ margin: 0, fontSize: 10 }}>{alert.severity}</Tag>
                        </div>
                        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.5 }}>{alert.description}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* Section 2: Month over Month Performance */}
          <div style={{ marginTop: 24 }}>
            <Title level={4} style={{ color: "#fff", marginBottom: 16, fontWeight: 700 }}>Month-over-month Performance</Title>
            <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
              <Table 
                dataSource={monthlySummaries}
                pagination={false}
                rowKey="summary_id"
                columns={[
                  {
                    title: "EXP MONTH",
                    dataIndex: "month_year",
                    render: (val) => <Text style={{ color: "#fff", fontWeight: 600 }}>{dayjs(val).format("MMM 'YY")}</Text>
                  },
                  {
                    title: "PLACED",
                    dataIndex: "total_options_placed",
                    render: (val) => <Text style={{ color: "rgba(255,255,255,0.8)" }}>{val}</Text>
                  },
                  {
                    title: "PREMIUM",
                    dataIndex: "premium_collected",
                    render: (val) => <Text style={{ color: "#10b981", fontWeight: 700 }}>${val?.toLocaleString()}</Text>
                  },
                  {
                    title: "BAR (VS BEST)",
                    render: (_, record) => {
                      const maxPremium = Math.max(...monthlySummaries.map(m => m.premium_collected), 1);
                      const pct = (record.premium_collected / maxPremium) * 100;
                      return (
                        <div style={{ width: 120 }}>
                          <Progress percent={pct} showInfo={false} strokeColor="#10b981" trailColor="rgba(255,255,255,0.05)" strokeWidth={8} />
                        </div>
                      );
                    }
                  },
                  {
                    title: "BTC / LOSSES",
                    dataIndex: "losses_realized",
                    render: (val) => <Text style={{ color: val < 0 ? "#f43f5e" : "rgba(255,255,255,0.45)" }}>{val < 0 ? `-$${Math.abs(val).toLocaleString()}` : "—"}</Text>
                  },
                  {
                    title: "ASSIGNMENTS",
                    dataIndex: "assignment_costs",
                    render: (val) => <Text style={{ color: val < 0 ? "#f43f5e" : "rgba(255,255,255,0.45)" }}>{val < 0 ? `-$${Math.abs(val).toLocaleString()}` : "—"}</Text>
                  },
                  {
                    title: "NET P&L",
                    dataIndex: "net_pnl",
                    render: (val) => <Text style={{ color: val >= 0 ? "#10b981" : "#f43f5e", fontWeight: 700 }}>{val >= 0 ? "+" : "-"}${Math.abs(val).toLocaleString()}</Text>
                  },
                  {
                    title: "TAX",
                    render: (_, record) => (
                      <Text style={{ color: "rgba(255,255,255,0.45)" }}>
                        ${(Math.max(0, record.net_pnl) * (taxRate / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    )
                  },
                  {
                    title: "COMMISSION",
                    dataIndex: "commissions_paid",
                    render: (val) => <Text style={{ color: "rgba(255,255,255,0.45)" }}>${val?.toLocaleString()}</Text>
                  },
                  {
                    title: "STATUS",
                    render: (_, record) => {
                      const isClosed = dayjs(record.month_year).isBefore(dayjs(), "month");
                      return <Tag color={isClosed ? "default" : "processing"} style={{ borderRadius: 6, textTransform: "uppercase", fontSize: 10 }}>{isClosed ? "Closed" : "Open"}</Tag>
                    }
                  }
                ]}
                className="custom-table"
                style={{ background: "transparent" }}
              />
            </Card>
          </div>

          {/* ─── Section 3: Open Positions ─────────────────────────────────── */}
          <div style={{ marginTop: 28 }}>
            <Title level={4} style={{ color: "#fff", marginBottom: 16, fontWeight: 700 }}>📊 Open Positions</Title>
            {positions.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Total Positions", value: positions.length, color: "#6366f1" },
                  { label: "High Risk (DTE < 7)", value: positions.filter((p) => p.risk_level === "High").length, color: "#f43f5e" },
                  { label: "Medium Risk (DTE ≤ 21)", value: positions.filter((p) => p.risk_level === "Medium").length, color: "#f59e0b" },
                ].map((item) => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 20px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ color: item.color, fontSize: 24, fontWeight: 800 }}>{item.value}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            )}
            <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={positions}
                rowKey="trade_id"
                pagination={{ pageSize: 10, style: { padding: "12px 24px" } }}
                scroll={{ x: 900 }}
                locale={{ emptyText: <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No open positions found.</span>} /> }}
                style={{ background: "transparent" }}
                columns={[
                  { title: "Ticker", dataIndex: "ticker", key: "ticker", render: (t: string) => <Text style={{ color: "#6366f1", fontWeight: 700, fontSize: 15 }}>{t}</Text>, sorter: (a: Trade, b: Trade) => a.ticker.localeCompare(b.ticker) },
                  { title: "Strategy", dataIndex: "strategy", key: "strategy", render: (s: string) => <Tag color="purple" style={{ fontWeight: 500 }}>{s || "Other"}</Tag> },
                  { title: "Type", dataIndex: "option_type", key: "option_type", render: (t: string) => <Tag color={t === "PUT" ? "red" : t === "CALL" ? "green" : "blue"}>{t || "—"}</Tag> },
                  { title: "Strike", key: "strikes", render: (_: any, r: Trade) => <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>{r.strike_short ?? "—"}{r.strike_long ? ` / ${r.strike_long}` : ""}</Text> },
                  { title: "Expiry", dataIndex: "expiration_date", key: "expiration_date", render: (d: string) => <Text style={{ color: "rgba(255,255,255,0.7)" }}>{d ? dayjs(d).format("MMM D, YYYY") : "—"}</Text>, sorter: (a: Trade, b: Trade) => (a.expiration_date || "").localeCompare(b.expiration_date || "") },
                  { title: "DTE", dataIndex: "dte", key: "dte", render: (d: number) => <Tag color={d < 7 ? "red" : d <= 21 ? "orange" : "green"} style={{ fontWeight: 700 }}>{d ?? "—"} days</Tag>, sorter: (a: Trade, b: Trade) => (a.dte ?? 999) - (b.dte ?? 999) },
                  { title: "Contracts", dataIndex: "contracts", key: "contracts", render: (c: number) => <Text style={{ color: "rgba(255,255,255,0.7)" }}>{c ?? "—"}</Text> },
                  { title: "Premium/Contract", dataIndex: "premium_per_contract", key: "premium_per_contract", render: (v: number) => <Text style={{ color: "#22d3ee", fontWeight: 600 }}>{v != null ? `$${v.toFixed(2)}` : "—"}</Text> },
                  { title: "Risk", dataIndex: "risk_level", key: "risk_level", render: (r: string) => {
                    const riskColors: Record<string, string> = { High: "#f43f5e", Medium: "#f59e0b", Low: "#10b981" };
                    const riskBg: Record<string, string> = { High: "rgba(244,63,94,0.12)", Medium: "rgba(245,158,11,0.12)", Low: "rgba(16,185,129,0.12)" };
                    return (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: riskBg[r] || "transparent", borderRadius: 8, padding: "3px 10px" }}>
                        {r === "High" ? <WarningOutlined style={{ color: riskColors[r] }} /> : r === "Medium" ? <ExclamationCircleOutlined style={{ color: riskColors[r] }} /> : <CheckCircleOutlined style={{ color: riskColors[r] }} />}
                        <Text style={{ color: riskColors[r] || "#fff", fontWeight: 700, fontSize: 12 }}>{r}</Text>
                      </div>
                    );
                  }, filters: [{ text: "High", value: "High" }, { text: "Medium", value: "Medium" }, { text: "Low", value: "Low" }], onFilter: (v: any, r: Trade) => r.risk_level === v },
                ]}
              />
            </Card>
          </div>

          {/* ─── Section 4: Analytics ──────────────────────────────────────── */}
          <div style={{ marginTop: 28 }}>
            <Title level={4} style={{ color: "#fff", marginBottom: 16, fontWeight: 700 }}>📈 Analytics</Title>

            {/* Analytics KPIs */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {(() => {
                const totalPremium = monthlySummaries.reduce((s, m) => s + m.premium_collected, 0);
                const totalPnl = monthlySummaries.reduce((s, m) => s + m.net_pnl, 0);
                const totalFees = monthlySummaries.reduce((s, m) => s + m.total_fees, 0);
                const totalFills = monthlySummaries.reduce((s, m) => s + m.total_fills, 0);
                const winMonths = monthlySummaries.filter((m) => m.net_pnl > 0).length;
                const winRate = monthlySummaries.length > 0 ? ((winMonths / monthlySummaries.length) * 100).toFixed(1) : "—";
                return [
                  { title: "Total Premium", value: totalPremium, prefix: "$", color: "#6366f1" },
                  { title: "Total Net P&L", value: totalPnl, prefix: "$", color: totalPnl >= 0 ? "#10b981" : "#f43f5e" },
                  { title: "Total Fees", value: totalFees, prefix: "$", color: "#f59e0b" },
                  { title: "Win Rate", value: winRate, suffix: "%", color: "#22d3ee" },
                  { title: "Total Fills", value: totalFills, color: "#a78bfa" },
                ].map((stat) => (
                  <Col key={stat.title} xs={12} sm={8} lg={4} xl={4}>
                    <Card style={{ ...cardStyle, textAlign: "center" }} bodyStyle={{ padding: "16px 12px" }}>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{stat.title}</div>
                      <div style={{ color: stat.color, fontSize: 20, fontWeight: 800 }}>
                        {stat.prefix}{typeof stat.value === "number" ? stat.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : stat.value}{stat.suffix}
                      </div>
                    </Card>
                  </Col>
                ));
              })()}
            </Row>

            {/* Premium vs Losses + Strategy Breakdown */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} xl={15}>
                <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Premium vs Losses (Monthly)</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                  {momChartData.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={momChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                        <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                        <Bar dataKey="premium" name="Premium Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="fees" name="Fees" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </Col>
              <Col xs={24} xl={9}>
                <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Strategy Breakdown</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                  {strategyData.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={strategyData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {strategyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Net P&L Trend + Ticker Table */}
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={14}>
                <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Net P&L Trend</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                  {momChartData.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={momChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                        <Line type="monotone" dataKey="pnl" name="Net P&L" stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: "#22d3ee", r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </Col>
              <Col xs={24} xl={10}>
                <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Ticker P&L Breakdown</span>} style={cardStyle} bodyStyle={{ padding: 0 }}>
                  <Table
                    dataSource={tickerPnL}
                    columns={[
                      { title: "Ticker", dataIndex: "ticker", key: "ticker", render: (t: string) => <Text style={{ color: "#6366f1", fontWeight: 700 }}>{t}</Text> },
                      { title: "P&L", dataIndex: "pnl", key: "pnl", render: (v: number) => <Text style={{ color: v >= 0 ? "#10b981" : "#f43f5e", fontWeight: 700 }}>{v >= 0 ? "+" : ""}${v.toFixed(2)}</Text>, sorter: (a: any, b: any) => a.pnl - b.pnl, defaultSortOrder: "descend" as any },
                    ]}
                    rowKey="ticker"
                    size="small"
                    pagination={{ pageSize: 8 }}
                    style={{ background: "transparent" }}
                    locale={{ emptyText: <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> }}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        </>
      )}
    </div>
  );
}

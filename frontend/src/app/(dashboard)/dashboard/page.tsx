"use client";
import React, { useEffect, useCallback } from "react";
import { Row, Col, Card, Statistic, Tag, Typography, Table, Empty, Spin, Alert as AntAlert, Badge } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, ThunderboltOutlined, WarningOutlined, RiseOutlined } from "@ant-design/icons";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi } from "@/services/api";
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

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedAccount, selectedStatementId, summary, setSummary, monthlySummaries, setMonthlySummaries, alerts, setAlerts, tickerPnL, setTickerPnL, strategyPnL, setStrategyPnL, isLoading, setLoading } = useDashboard();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, momRes, alertRes, tickerRes, stratRes] = await Promise.all([
        dashboardApi.summary({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.mom({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.alerts({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.tickerPnl({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.strategyPnl({ accountId: selectedAccount, statementId: selectedStatementId }),
      ]);
      setSummary(sumRes.data.summary);
      setMonthlySummaries(momRes.data.mom);
      setAlerts(alertRes.data.alerts);
      setTickerPnL(tickerRes.data.ticker_pnl);
      setStrategyPnL(stratRes.data.strategy_pnl);
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
      <div style={{ marginBottom: 28 }}>
        <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>
          Welcome back, {user?.full_name?.split(" ")[0]} 👋
        </Title>
        {summary?.period_start && (
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
            Period: {dayjs(summary.period_start).format("MMM D")} – {dayjs(summary.period_end).format("MMM D, YYYY")} · Account: {summary.account_id}
          </Text>
        )}
      </div>

      {!summary || Object.keys(summary).length === 0 ? (
        <Card style={cardStyle}>
          <Empty description={<span style={{ color: "rgba(255,255,255,0.5)" }}>No data yet. Upload a ThinkorSwim statement to get started.</span>} />
        </Card>
      ) : (
        <>
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
            <Col xs={24} xl={15}>
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

            {/* Strategy Pie */}
            <Col xs={24} xl={9}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Strategy Mix</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                {strategyData.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={strategyData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3}>
                        {strategyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                      <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                    </PieChart>
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
        </>
      )}
    </div>
  );
}

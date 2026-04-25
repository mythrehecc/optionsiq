"use client";
import React, { useEffect, useCallback } from "react";
import { Card, Row, Col, Typography, Empty, Spin, Statistic, Table } from "antd";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi } from "@/services/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#34d399", "#fb923c"];

const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9))",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

const tooltipStyle = { background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#fff" };

export default function AnalyticsPage() {
  const { selectedAccount, selectedStatementId, monthlySummaries, setMonthlySummaries, tickerPnL, setTickerPnL, strategyPnL, setStrategyPnL, isLoading, setLoading } = useDashboard();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [momRes, tickerRes, stratRes] = await Promise.all([
        dashboardApi.mom({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.tickerPnl({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.strategyPnl({ accountId: selectedAccount, statementId: selectedStatementId }),
      ]);
      setMonthlySummaries(momRes.data.mom || []);
      setTickerPnL(tickerRes.data.ticker_pnl || []);
      setStrategyPnL(stratRes.data.strategy_pnl || []);
    } catch {}
    setLoading(false);
  }, [selectedAccount, selectedStatementId]);

  useEffect(() => { load(); }, [load]);

  const momData = monthlySummaries.map((m) => ({
    month: dayjs(m.month_year).format("MMM YY"),
    premium: +m.premium_collected.toFixed(2),
    losses: +Math.abs(m.losses_realized).toFixed(2),
    pnl: +m.net_pnl.toFixed(2),
    fees: +m.total_fees.toFixed(2),
    balance: m.ending_balance ? +m.ending_balance.toFixed(2) : null,
    fills: m.total_fills,
  }));

  const totalPremium = monthlySummaries.reduce((s, m) => s + m.premium_collected, 0);
  const totalPnl = monthlySummaries.reduce((s, m) => s + m.net_pnl, 0);
  const totalFees = monthlySummaries.reduce((s, m) => s + m.total_fees, 0);
  const totalFills = monthlySummaries.reduce((s, m) => s + m.total_fills, 0);
  const winMonths = monthlySummaries.filter((m) => m.net_pnl > 0).length;
  const winRate = monthlySummaries.length > 0 ? ((winMonths / monthlySummaries.length) * 100).toFixed(1) : "—";

  const stratData = strategyPnL.map((s) => ({ name: s.strategy, value: Math.abs(s.pnl), raw: s.pnl }));

  const tickerTableCols = [
    { title: "Ticker", dataIndex: "ticker", key: "ticker", render: (t: string) => <Text style={{ color: "#6366f1", fontWeight: 700 }}>{t}</Text> },
    { title: "P&L", dataIndex: "pnl", key: "pnl", render: (v: number) => <Text style={{ color: v >= 0 ? "#10b981" : "#f43f5e", fontWeight: 700 }}>{v >= 0 ? "+" : ""}${v.toFixed(2)}</Text>, sorter: (a: any, b: any) => a.pnl - b.pnl, defaultSortOrder: "descend" as any },
  ];

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>📈 Analytics</Title>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Comprehensive breakdown of your trading performance</Text>
      </div>

      {monthlySummaries.length === 0 ? (
        <Card style={cardStyle}>
          <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>Upload a statement to see analytics</span>} />
        </Card>
      ) : (
        <>
          {/* Summary KPIs */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[
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
            ))}
          </Row>

          {/* Area Chart: Balance over time */}
          {momData.some((m) => m.balance !== null) && (
            <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Account Balance History</span>} style={{ ...cardStyle, marginBottom: 24 }} bodyStyle={{ padding: "16px 8px" }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={momData.filter((m) => m.balance !== null)}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toLocaleString()}`]} />
                  <Area type="monotone" dataKey="balance" name="Balance" stroke="#6366f1" strokeWidth={2.5} fill="url(#balGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Premium vs Losses + Strategy Pie */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} xl={15}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Premium vs Losses (Monthly)</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={momData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                    <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                    <Bar dataKey="premium" name="Premium Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="losses" name="Losses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fees" name="Fees" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={9}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Strategy Breakdown</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                {stratData.length === 0 ? <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={stratData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {stratData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
          </Row>

          {/* Net P&L line + Ticker Table */}
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Net P&L Trend</span>} style={cardStyle} bodyStyle={{ padding: "16px 8px" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={momData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(2)}`]} />
                    <Line type="monotone" dataKey="pnl" name="Net P&L" stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: "#22d3ee", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title={<span style={{ color: "#fff", fontWeight: 700 }}>Ticker P&L Breakdown</span>} style={cardStyle} bodyStyle={{ padding: 0 }}>
                <Table
                  dataSource={tickerPnL}
                  columns={tickerTableCols}
                  rowKey="ticker"
                  size="small"
                  pagination={{ pageSize: 8 }}
                  style={{ background: "transparent" }}
                  locale={{ emptyText: <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No data</span>} /> }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

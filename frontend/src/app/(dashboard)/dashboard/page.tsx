"use client";
import React, { useEffect, useCallback } from "react";
import Row from "antd/lib/row";
import Col from "antd/lib/col";
import Card from "antd/lib/card";
import Tag from "antd/lib/tag";
import Typography from "antd/lib/typography";
import Table from "antd/lib/table";
import Spin from "antd/lib/spin";

import Button from "antd/lib/button";
import Empty from "antd/lib/empty";
import ThunderboltOutlined from "@ant-design/icons/ThunderboltOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import AppstoreOutlined from "@ant-design/icons/AppstoreOutlined";
import UploadOutlined from "@ant-design/icons/UploadOutlined";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ExclamationCircleOutlined from "@ant-design/icons/ExclamationCircleOutlined";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi } from "@/services/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9))",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

const StatCard = ({ title, value, prefix, color, icon }: any) => (
  <Card
    style={{ ...cardStyle, height: "100%" }}
    styles={{ body: { padding: "16px 20px" } }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
        <div style={{
          fontSize: "clamp(16px, 2vw, 26px)",
          fontWeight: 800,
          color: color || "#fff",
          lineHeight: 1.2,
          wordBreak: "break-all",
        }}>
          {prefix}{typeof value === "number"
            ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : (value ?? "—")}
        </div>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color || "#6366f1"}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8 }}>
        {React.cloneElement(icon, { style: { fontSize: 18, color: color || "#6366f1" } })}
      </div>
    </div>
  </Card>
);

// Severity badge showing "X days left"
const SeverityBadge = ({ expirationDate }: { expirationDate: string | null }) => {
  if (!expirationDate) return <Tag color="default">—</Tag>;
  const daysLeft = dayjs(expirationDate).diff(dayjs().startOf("day"), "day");
  const label = daysLeft < 0 ? "Expired" : daysLeft === 0 ? "Today!" : `${daysLeft} days left`;
  const color = daysLeft < 0 ? "default" : daysLeft <= 10 ? "red" : daysLeft <= 20 ? "orange" : "green";
  const icon = daysLeft <= 0 ? <WarningOutlined /> : daysLeft <= 10 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />;
  return (
    <Tag color={color} icon={icon} style={{ fontWeight: 700 }}>
      {label}
    </Tag>
  );
};

// Scrolling ticker marquee
const TickerMarquee = ({ tickers }: { tickers: string[] }) => {
  if (!tickers.length) return null;
  const unique = Array.from(new Set(tickers)).filter(Boolean);
  const doubled = [...unique, ...unique]; // duplicate for seamless loop
  return (
    <div style={{
      overflow: "hidden",
      background: "rgba(99,102,241,0.08)",
      border: "1px solid rgba(99,102,241,0.2)",
      borderRadius: 10,
      padding: "8px 0",
      marginBottom: 16,
      position: "relative",
    }}>
      <div style={{
        display: "flex",
        gap: 32,
        animation: "marquee 20s linear infinite",
        whiteSpace: "nowrap",
        width: "max-content",
      }}>
        {doubled.map((t, i) => (
          <span key={i} style={{
            color: "#6366f1",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 1,
            padding: "2px 12px",
            background: "rgba(99,102,241,0.1)",
            borderRadius: 6,
            border: "1px solid rgba(99,102,241,0.25)",
          }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    selectedAccount,
    selectedStatementId,
    summary,
    setSummary,
    monthlySummaries,
    setMonthlySummaries,
    positions,
    setPositions,
    isLoading,
    setLoading
  } = useDashboard();

  const [dailySummaries, setDailySummaries] = React.useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, momRes, posRes, dailyRes] = await Promise.all([
        dashboardApi.summary({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.mom({ accountId: selectedAccount, statementId: selectedStatementId }),
        dashboardApi.positions({ accountId: selectedAccount, statementId: selectedStatementId, page: 1, per_page: 200 }),
        dashboardApi.daily({ accountId: selectedAccount, statementId: selectedStatementId }),
      ]);
      setSummary(sumRes.data?.summary || {});
      setMonthlySummaries(momRes.data?.mom || []);
      setPositions(posRes.data?.positions || []);
      setDailySummaries(dailyRes.data?.daily || []);
    } catch (e) {
      console.error("Dashboard Load Error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, selectedStatementId, setSummary, setMonthlySummaries, setPositions, setLoading]);

  useEffect(() => { loadData(); }, [loadData]);

  const momChartData = (monthlySummaries || []).map((item: any) => ({
    month: item?.month_year ? dayjs(item.month_year).format("MMM YY") : "—",
    displayPremium: Number(item?.premium_collected || 0)
  }));

  const tickerList = (positions || []).map((p: any) => p.ticker).filter(Boolean);

  if (isLoading) return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 100 }}>
      <Spin size="large" tip="Loading Dashboard..." />
    </div>
  );

  const isEmpty = !isLoading && !summary?.account_id && (!positions || positions.length === 0);

  if (isEmpty) {
    return (
      <div style={{ padding: "16px" }}>
        <Title level={3} style={{ color: "#fff", margin: "0 0 24px" }}>Dashboard 👋</Title>
        <Card style={{ ...cardStyle, textAlign: "center", padding: "60px 20px" }}>
          <Empty
            image={null}
            description={
              <>
                <UploadOutlined style={{ fontSize: 64, color: "rgba(99,102,241,0.5)", marginBottom: 16 }} />
                <br />
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: 600, display: "block", marginBottom: 8 }}>No Statements Uploaded</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Upload your ThinkorSwim statement to view insights and track premium.</Text>
              </>
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<UploadOutlined />}
              onClick={() => router.push("/statements")}
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", marginTop: 24, borderRadius: 10, fontWeight: 600 }}
            >
              Upload Statement Now
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  const posColumns = [
    {
      title: "Ticker",
      dataIndex: "ticker",
      key: "ticker",
      render: (t: string) => (
        <Text style={{ color: "#6366f1", fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>{t || "—"}</Text>
      ),
    },
    {
      title: "Expiry",
      dataIndex: "expiration_date",
      key: "expiration_date",
      render: (d: string) => (
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
          {d ? dayjs(d).format("MMM D, YYYY") : "—"}
        </Text>
      ),
    },
    {
      title: "Type",
      dataIndex: "option_type",
      key: "option_type",
      render: (t: string) => (
        <Tag color={t === "PUT" ? "red" : t === "CALL" ? "green" : "blue"}>{t || "—"}</Tag>
      ),
    },
    {
      title: "Contracts",
      dataIndex: "contracts",
      key: "contracts",
      render: (c: number) => <Text style={{ color: "rgba(255,255,255,0.7)" }}>{c ?? "—"}</Text>,
    },
    {
      title: "Premium",
      dataIndex: "premium_per_contract",
      key: "premium_per_contract",
      render: (v: number) => (
        <Text style={{ color: "#22d3ee", fontWeight: 700 }}>
          {v != null ? `$${Number(v).toFixed(2)}` : "—"}
        </Text>
      ),
    },
    {
      title: "Tax (15%)",
      key: "tax",
      render: (_: any, r: any) => {
        const tax = r.contracts && r.premium_per_contract
          ? Math.abs(r.contracts * r.premium_per_contract * 100) * 0.15
          : 0;
        return <Text style={{ color: "#f59e0b", fontWeight: 600 }}>${tax.toFixed(2)}</Text>;
      },
    },
    {
      title: "Severity",
      key: "severity",
      dataIndex: "expiration_date",
      render: (d: string) => <SeverityBadge expirationDate={d} />,
    },
  ];

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dashboard-header">
        <Title level={3} style={{ color: "#fff", margin: 0 }}>Dashboard 👋</Title>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => router.push("/statements")}
          style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.3)", color: "#6366f1", fontWeight: 600, borderRadius: 8 }}
        >
          Upload Statement
        </Button>
      </div>

      {/* Stat Cards — xs:1col sm:2col xl:4col */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Total Buying Power"
            value={Number(summary?.buying_power_total ?? 0) > 0
              ? Number(summary?.buying_power_total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "Not Available"}
            prefix={Number(summary?.buying_power_total ?? 0) > 0 ? "$" : ""}
            color="#a78bfa"
            icon={<ThunderboltOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Remaining Buying Power"
            value={Number(summary?.buying_power_remaining ?? 0) > 0
              ? Number(summary?.buying_power_remaining).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "Not Available"}
            prefix={Number(summary?.buying_power_remaining ?? 0) > 0 ? "$" : ""}
            color="#22d3ee"
            icon={<AppstoreOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard title="Authority Premium" value={summary?.premium_collected || 0} prefix="$" color="#10b981" icon={<ThunderboltOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard title="Tickers Traded" value={summary?.tickers_traded || 0} color="#6366f1" icon={<FileTextOutlined />} />
        </Col>
      </Row>

      {/* Chart */}
      <Card
        title={<span style={{ color: "#fff", fontWeight: 600 }}>Monthly Premium Performance (By Expiry)</span>}
        style={{ ...cardStyle, marginBottom: 24 }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={momChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} axisLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: "12px", color: "#fff" }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Premium"]}
            />
            <Bar dataKey="displayPremium" name="Premium" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Open Positions */}
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ color: "#fff", margin: "0 0 4px" }}>📊 Open Positions</Title>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Severity based on days remaining to expiry &nbsp;•&nbsp;
          <span style={{ color: "#f43f5e" }}>≤10 days</span> &nbsp;|&nbsp;
          <span style={{ color: "#f59e0b" }}>≤20 days</span> &nbsp;|&nbsp;
          <span style={{ color: "#10b981" }}>&gt;20 days</span>
        </Text>
      </div>

      {/* Ticker Marquee */}
      <TickerMarquee tickers={tickerList} />

      <Card style={{ ...cardStyle, marginBottom: 24 }} styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={positions || []}
          rowKey="trade_id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          className="custom-table flex-table"
          columns={posColumns}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No positions found</span>} />
            ),
          }}
          rowClassName={(r: any) => {
            const daysLeft = r.expiration_date
              ? dayjs(r.expiration_date).diff(dayjs().startOf("day"), "day")
              : 999;
            return daysLeft <= 10 ? "row-high-risk" : daysLeft <= 20 ? "row-med-risk" : "";
          }}
        />
      </Card>

      {/* Monthly Breakdown */}
      <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>📅 Monthly Premium Breakdown (By Expiry Month)</Title>
      <Card style={{ ...cardStyle, marginBottom: 24 }} styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={monthlySummaries || []}
          rowKey={(record) => record.month_year || Math.random()}
          pagination={false}
          className="custom-table"
          columns={[
            {
              title: "EXPIRY MONTH",
              dataIndex: "month_year",
              render: (v) => <Text style={{ color: "#fff", fontWeight: 600 }}>{dayjs(v).format("MMMM YYYY")}</Text>,
            },
            {
              title: "PREMIUM COLLECTED",
              dataIndex: "premium_collected",
              render: (v) => (
                <Text style={{ color: "#10b981", fontWeight: 700 }}>
                  ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              ),
            },
            {
              title: "ALLOCATION",
              render: (_, record) => {
                const max = Math.max(...(monthlySummaries || []).map((m: any) => m.premium_collected || 0), 1);
                const pct = ((record.premium_collected || 0) / max) * 100;
                return (
                  <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round(pct)}%`, height: "100%", background: "#10b981", borderRadius: 4, transition: "width 0.4s ease" }} />
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      {/* Daily Breakdown */}
      {dailySummaries.length > 0 && (
        <>
          <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>📆 Daily Premium Breakdown (By Exact Expiry Date)</Title>
          <Card style={cardStyle} styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={dailySummaries}
              rowKey="expiry_date"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              className="custom-table"
              columns={[
                {
                  title: "EXPIRY DATE",
                  dataIndex: "expiry_date",
                  render: (v) => <Text style={{ color: "#fff", fontWeight: 600 }}>{dayjs(v).format("MMM DD, YYYY")}</Text>,
                },
                {
                  title: "PREMIUM COLLECTED",
                  dataIndex: "premium_collected",
                  render: (v) => (
                    <Text style={{ color: "#22d3ee", fontWeight: 700 }}>
                      ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  ),
                  sorter: (a: any, b: any) => a.premium_collected - b.premium_collected,
                },
                {
                  title: "ALLOCATION",
                  render: (_: any, record: any) => {
                    const max = Math.max(...dailySummaries.map((d) => d.premium_collected || 0), 1);
                    const pct = ((record.premium_collected || 0) / max) * 100;
                    return (
                      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round(pct)}%`, height: "100%", background: "#22d3ee", borderRadius: 4, transition: "width 0.4s ease" }} />
                      </div>
                    );
                  },
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
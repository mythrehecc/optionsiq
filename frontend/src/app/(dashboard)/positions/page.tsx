"use client";
import React, { useEffect, useCallback, useState } from "react";
import { Card, Table, Tag, Typography, Empty, Spin, Tooltip, Badge, Space } from "antd";
import { WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi } from "@/services/api";
import { Trade } from "@/types";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9))",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

const riskColors: Record<string, string> = { High: "#f43f5e", Medium: "#f59e0b", Low: "#10b981" };
const riskBg: Record<string, string> = { High: "rgba(244,63,94,0.12)", Medium: "rgba(245,158,11,0.12)", Low: "rgba(16,185,129,0.12)" };

export default function PositionsPage() {
  const [posPage, setPosPage] = useState(1);
  const [posPageSize, setPosPageSize] = useState(15);
  const { selectedAccount, selectedStatementId, positions, setPositions, totalPositions, setTotalPositions, isLoading, setLoading } = useDashboard();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.positions({ accountId: selectedAccount, statementId: selectedStatementId, page: posPage, per_page: posPageSize });
      setPositions(res.data.positions || []);
      setTotalPositions(res.data.total || 0);
    } catch {}
    setLoading(false);
  }, [selectedAccount, selectedStatementId, posPage, posPageSize]);

  useEffect(() => { load(); }, [load]);

  // Reset to first page when filters change
  useEffect(() => {
    setPosPage(1);
  }, [selectedAccount, selectedStatementId]);

  const columns = [
    {
      title: "Ticker",
      dataIndex: "ticker",
      key: "ticker",
      render: (t: string) => <Text style={{ color: "#6366f1", fontWeight: 700, fontSize: 15 }}>{t}</Text>,
      sorter: (a: Trade, b: Trade) => a.ticker.localeCompare(b.ticker),
    },
    {
      title: "Strategy",
      dataIndex: "strategy",
      key: "strategy",
      render: (s: string) => <Tag color="purple" style={{ fontWeight: 500 }}>{s || "Other"}</Tag>,
    },
    {
      title: "Type",
      dataIndex: "option_type",
      key: "option_type",
      render: (t: string) => <Tag color={t === "PUT" ? "red" : t === "CALL" ? "green" : "blue"}>{t || "—"}</Tag>,
    },
    {
      title: "Strike",
      key: "strikes",
      render: (_: any, r: Trade) => (
        <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>
          {r.strike_short ?? "—"}{r.strike_long ? ` / ${r.strike_long}` : ""}
        </Text>
      ),
    },
    {
      title: "Expiry",
      dataIndex: "expiration_date",
      key: "expiration_date",
      render: (d: string) => <Text style={{ color: "rgba(255,255,255,0.7)" }}>{d ? dayjs(d).format("MMM D, YYYY") : "—"}</Text>,
      sorter: (a: Trade, b: Trade) => (a.expiration_date || "").localeCompare(b.expiration_date || ""),
    },
    {
      title: "DTE",
      dataIndex: "dte",
      key: "dte",
      render: (d: number) => (
        <Tag color={d < 7 ? "red" : d <= 21 ? "orange" : "green"} style={{ fontWeight: 700 }}>
          {d ?? "—"} days
        </Tag>
      ),
      sorter: (a: Trade, b: Trade) => (a.dte ?? 999) - (b.dte ?? 999),
    },
    {
      title: "Contracts",
      dataIndex: "contracts",
      key: "contracts",
      render: (c: number) => <Text style={{ color: "rgba(255,255,255,0.7)" }}>{c ?? "—"}</Text>,
    },
    {
      title: "Premium/Contract",
      dataIndex: "premium_per_contract",
      key: "premium_per_contract",
      render: (v: number) => <Text style={{ color: "#22d3ee", fontWeight: 600 }}>{v != null ? `$${v.toFixed(2)}` : "—"}</Text>,
    },
    {
      title: "Risk",
      dataIndex: "risk_level",
      key: "risk_level",
      render: (r: string) => (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: riskBg[r] || "transparent", borderRadius: 8, padding: "3px 10px" }}>
          {r === "High" ? <WarningOutlined style={{ color: riskColors[r] }} /> : r === "Medium" ? <ExclamationCircleOutlined style={{ color: riskColors[r] }} /> : <CheckCircleOutlined style={{ color: riskColors[r] }} />}
          <Text style={{ color: riskColors[r] || "#fff", fontWeight: 700, fontSize: 12 }}>{r}</Text>
        </div>
      ),
      filters: [{ text: "High", value: "High" }, { text: "Medium", value: "Medium" }, { text: "Low", value: "Low" }],
      onFilter: (v: any, r: Trade) => r.risk_level === v,
    },
  ];

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}><Spin size="large" /></div>;
  }

  const highRisk = positions.filter((p) => p.risk_level === "High").length;
  const medRisk = positions.filter((p) => p.risk_level === "Medium").length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>📊 Open Positions</Title>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Positions with future expiration dates — sorted by DTE</Text>
      </div>

      {/* Risk Summary */}
      {positions.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total Positions", value: positions.length, color: "#6366f1" },
            { label: "High Risk (DTE < 7)", value: highRisk, color: "#f43f5e" },
            { label: "Medium Risk (DTE ≤ 21)", value: medRisk, color: "#f59e0b" },
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
          columns={columns}
          rowKey="trade_id"
          pagination={{ 
            current: posPage,
            pageSize: posPageSize,
            total: totalPositions,
            showSizeChanger: true,
            pageSizeOptions: ["15", "30", "50"],
            showTotal: (total) => `Total ${total} positions`,
            style: { padding: "12px 24px" } 
          }}
          onChange={(pagination) => {
            setPosPage(pagination.current || 1);
            setPosPageSize(pagination.pageSize || 15);
          }}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No open positions found. Upload a statement to see your positions.</span>} /> }}
          rowClassName={(r) => r.risk_level === "High" ? "row-high-risk" : ""}
          className="custom-table"
          style={{ background: "transparent" }}
        />
      </Card>
    </div>
  );
}

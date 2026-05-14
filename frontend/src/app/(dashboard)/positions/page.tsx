"use client";
import React, { useEffect, useRef, useState } from "react";
import Card from "antd/lib/card";
import Table from "antd/lib/table";
import Tag from "antd/lib/tag";
import Typography from "antd/lib/typography";
import Empty from "antd/lib/empty";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ExclamationCircleOutlined from "@ant-design/icons/ExclamationCircleOutlined";
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

// DTE-based: ≤10 = High, ≤20 = Medium, >20 = Low
const riskColors: Record<string, string> = { High: "#f43f5e", Medium: "#f59e0b", Low: "#10b981" };
const riskBg: Record<string, string> = {
  High: "rgba(244,63,94,0.12)",
  Medium: "rgba(245,158,11,0.12)",
  Low: "rgba(16,185,129,0.12)",
};

const SeverityBadge = ({ risk }: { risk: string }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: riskBg[risk] || "transparent",
      borderRadius: 8,
      padding: "3px 10px",
      border: `1px solid ${riskColors[risk] || "#666"}30`,
    }}
  >
    {risk === "High" ? (
      <WarningOutlined style={{ color: riskColors[risk] }} />
    ) : risk === "Medium" ? (
      <ExclamationCircleOutlined style={{ color: riskColors[risk] }} />
    ) : (
      <CheckCircleOutlined style={{ color: riskColors[risk] }} />
    )}
    <Text style={{ color: riskColors[risk] || "#fff", fontWeight: 700, fontSize: 12 }}>
      {risk}
    </Text>
  </div>
);

export default function PositionsPage() {
  const [posPage, setPosPage] = useState(1);
  const [posPageSize, setPosPageSize] = useState(15);
  const {
    selectedAccount,
    selectedStatementId,
    positions,
    setPositions,
    totalPositions,
    setTotalPositions,
    isLoading,
    setLoading,
  } = useDashboard();

  const prevFilters = useRef({ selectedAccount, selectedStatementId });

  useEffect(() => {
    const prev = prevFilters.current;
    const filtersChanged =
      prev.selectedAccount !== selectedAccount ||
      prev.selectedStatementId !== selectedStatementId;

    const page = filtersChanged ? 1 : posPage;
    if (filtersChanged) {
      setPosPage(1);
      prevFilters.current = { selectedAccount, selectedStatementId };
    }

    let cancelled = false;
    setLoading(true);

    dashboardApi
      .positions({
        accountId: selectedAccount,
        statementId: selectedStatementId,
        page,
        per_page: posPageSize,
      })
      .then((res) => {
        if (!cancelled) {
          setPositions(res.data.positions || []);
          setTotalPositions(res.data.total || 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, selectedStatementId, posPage, posPageSize]);

  const highRisk   = positions.filter((p) => p.risk_level === "High").length;
  const medRisk    = positions.filter((p) => p.risk_level === "Medium").length;
  const lowRisk    = positions.filter((p) => p.risk_level === "Low").length;

  const columns = [
    {
      title: "Date Placed",
      dataIndex: "trade_date",
      key: "trade_date",
      render: (d: string) => (
        <Text style={{ color: "rgba(255,255,255,0.7)" }}>
          {d ? dayjs(d).format("MMM D, YYYY") : "—"}
        </Text>
      ),
    },
    {
      title: "Ticker",
      dataIndex: "ticker",
      key: "ticker",
      render: (t: string) => (
        <Text style={{ color: "#6366f1", fontWeight: 700, fontSize: 15 }}>{t}</Text>
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
      title: "Strike",
      key: "strikes",
      render: (_: any, r: Trade) => (
        <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>
          {r.strike_short ?? "—"}
          {r.strike_long ? ` / ${r.strike_long}` : ""}
        </Text>
      ),
    },
    {
      title: "Expiry",
      dataIndex: "expiration_date",
      key: "expiration_date",
      render: (d: string) => (
        <Text style={{ color: "rgba(255,255,255,0.7)" }}>
          {d ? dayjs(d).format("MMM D, YYYY") : "—"}
        </Text>
      ),
    },
    {
      title: "DTE",
      dataIndex: "dte",
      key: "dte",
      render: (d: number) => {
        const color = d <= 10 ? "red" : d <= 20 ? "orange" : "green";
        return (
          <Tag color={color} style={{ fontWeight: 700 }}>
            {d ?? "—"} days
          </Tag>
        );
      },
    },
    {
      title: "Contracts",
      dataIndex: "contracts",
      key: "contracts",
      render: (c: number) => (
        <Text style={{ color: "rgba(255,255,255,0.7)" }}>{c ?? "—"}</Text>
      ),
    },
    {
      title: "Premium/Contract",
      dataIndex: "premium_per_contract",
      key: "premium_per_contract",
      render: (v: number) => (
        <Text style={{ color: "#22d3ee", fontWeight: 600 }}>
          {v != null ? `$${v.toFixed(2)}` : "—"}
        </Text>
      ),
    },
    {
      title: "Tax (15%)",
      key: "tax",
      render: (_: any, r: Trade) => {
        if (r.contracts != null && r.premium_per_contract != null) {
          const tax = Math.abs(r.contracts * r.premium_per_contract * 100) * 0.15;
          return (
            <Text style={{ color: "#f59e0b", fontWeight: 600 }}>
              ${tax.toFixed(2)}
            </Text>
          );
        }
        return <Text style={{ color: "rgba(255,255,255,0.7)" }}>—</Text>;
      },
    },
    {
      title: "Severity",
      key: "severity",
      dataIndex: "expiration_date",
      render: (d: string) => {
        if (!d) return <Tag color="default">—</Tag>;
        const daysLeft = dayjs(d).diff(dayjs().startOf("day"), "day");
        const label = daysLeft < 0 ? "Expired" : daysLeft === 0 ? "Today!" : `${daysLeft} days left`;
        const color = daysLeft < 0 ? "default" : daysLeft <= 10 ? "red" : daysLeft <= 20 ? "orange" : "green";
        const icon = daysLeft <= 0
          ? <WarningOutlined />
          : daysLeft <= 10
            ? <ExclamationCircleOutlined />
            : <CheckCircleOutlined />;
        return <Tag color={color} icon={icon} style={{ fontWeight: 700 }}>{label}</Tag>;
      },
      filters: [
        { text: "🔴 ≤10 days", value: "high" },
        { text: "🟡 ≤20 days", value: "medium" },
        { text: "🟢 >20 days", value: "low" },
      ],
      onFilter: (v: any, r: Trade) => r.risk_level === (v === "high" ? "High" : v === "medium" ? "Medium" : "Low"),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>
          📊 Open Positions
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Severity: <span style={{ color: "#f43f5e" }}>High</span> = DTE ≤10 &nbsp;|&nbsp;
          <span style={{ color: "#f59e0b" }}>Medium</span> = DTE 11–20 &nbsp;|&nbsp;
          <span style={{ color: "#10b981" }}>Low</span> = DTE &gt;20 &nbsp;•&nbsp; High priority shown first
        </Text>
      </div>

      {/* Severity Summary */}
      {totalPositions > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total Positions", value: totalPositions, color: "#6366f1" },
            { label: "🔴 High Severity (DTE ≤10)", value: highRisk, color: "#f43f5e" },
            { label: "🟡 Medium Severity (DTE ≤20)", value: medRisk, color: "#f59e0b" },
            { label: "🟢 Low Severity (DTE >20)", value: lowRisk, color: "#10b981" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: "12px 20px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ color: item.color, fontSize: 24, fontWeight: 800 }}>{item.value}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card style={cardStyle} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={positions}
          columns={columns}
          rowKey="trade_id"
          loading={isLoading}
          pagination={{
            current: posPage,
            pageSize: posPageSize,
            total: totalPositions,
            showSizeChanger: true,
            pageSizeOptions: ["15", "30", "50", "100"],
            showTotal: (total, range) =>
              `${range[0]}–${range[1]} of ${total} positions`,
            style: {
              padding: "16px 24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            },
          }}
          onChange={(paginationInfo) => {
            const newPage = paginationInfo.current ?? 1;
            const newSize = paginationInfo.pageSize ?? posPageSize;
            if (newSize !== posPageSize) {
              setPosPageSize(newSize);
              setPosPage(1);
            } else {
              setPosPage(newPage);
            }
          }}
          scroll={{ x: "max-content" }}
          className="custom-table flex-table"
          style={{ background: "transparent" }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>No positions found</span>
                }
              />
            ),
          }}
          rowClassName={(r) =>
            r.risk_level === "High"
              ? "row-high-risk"
              : r.risk_level === "Medium"
              ? "row-med-risk"
              : ""
          }
        />
      </Card>
    </div>
  );
}
"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Card from "antd/lib/card";
import Table from "antd/lib/table";
import Button from "antd/lib/button";
import Typography from "antd/lib/typography";
import Tag from "antd/lib/tag";
import Upload from "antd/lib/upload";
import Modal from "antd/lib/modal";
import message from "antd/lib/message";
import Popconfirm from "antd/lib/popconfirm";
import Empty from "antd/lib/empty";
import Space from "antd/lib/space";
import Tooltip from "antd/lib/tooltip";
import Spin from "antd/lib/spin";

import UploadOutlined from "@ant-design/icons/UploadOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import InboxOutlined from "@ant-design/icons/InboxOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import BarChartOutlined from "@ant-design/icons/BarChartOutlined";
import { useDashboard } from "@/context/DashboardContext";
import { statementsApi } from "@/services/api";
import { Statement } from "@/types";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9))",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{ visible: boolean; statementId: string; file: File | null; message: string }>({ visible: false, statementId: "", file: null, message: "" });
  const [tradesMap, setTradesMap] = useState<Record<string, any[]>>({});
  const router = useRouter();
  const { setSelectedStatementId, setSelectedAccount } = useDashboard();

  const loadStatements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await statementsApi.list();
      setStatements(res.data.statements || []);
    } catch (e: any) {
      // 401 is handled by the interceptor (redirects to /signin) — don't show an extra error toast
      if (e.response?.status !== 401) {
        message.error("Failed to load statements: " + (e.response?.data?.error || "Unknown error"));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatements(); }, [loadStatements]);

  const handleUpload = async (file: File, replace = false) => {
    setUploading(true);
    try {
      const res = await statementsApi.upload(file, replace);
      message.success(`✅ Uploaded ${res.data.trade_count} trades successfully! Redirecting to dashboard…`);
      setDuplicateModal({ visible: false, statementId: "", file: null, message: "" });
      // Pre-select the newly uploaded statement and go straight to the dashboard
      setSelectedStatementId(res.data.statement_id);
      setSelectedAccount(null);
      router.push("/dashboard");
    } catch (e: any) {
      if (e.response?.status === 409 && e.response.data?.duplicate) {
        setDuplicateModal({ visible: true, statementId: e.response.data.statement_id, file, message: e.response.data.message });
      } else {
        message.error(e.response?.data?.error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDelete = async (id: string) => {
    try {
      await statementsApi.delete(id);
      message.success("Statement deleted");
      loadStatements();
    } catch {
      message.error("Delete failed");
    }
  };

  const columns = [
    {
      title: "File",
      dataIndex: "filename",
      key: "filename",
      render: (name: string) => <Text style={{ color: "#6366f1", fontWeight: 600 }}>{name || "—"}</Text>,
    },
    {
      title: "Account",
      dataIndex: "account_id",
      key: "account_id",
      render: (id: string) => <Tag color="purple">{id}</Tag>,
    },
    {
      title: "Period",
      key: "period",
      render: (_: any, r: Statement) => (
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {r.statement_start ? dayjs(r.statement_start).format("MMM D, YYYY") : "—"} → {r.statement_end ? dayjs(r.statement_end).format("MMM D, YYYY") : "—"}
        </Text>
      ),
    },
    {
      title: "Trades",
      dataIndex: "trade_count",
      key: "trade_count",
      render: (n: number) => <Tag color="cyan">{n} trades</Tag>,
    },
    {
      title: "Balance",
      dataIndex: "ending_balance",
      key: "ending_balance",
      render: (v: number | null) => <Text style={{ color: "#10b981", fontWeight: 600 }}>{v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</Text>,
    },
    {
      title: "Status",
      dataIndex: "parse_status",
      key: "parse_status",
      render: (s: string) => s === "complete"
        ? <Tag icon={<CheckCircleOutlined />} color="success">Complete</Tag>
        : <Tag icon={<ClockCircleOutlined />} color="processing">Pending</Tag>,
    },
    {
      title: "Uploaded",
      dataIndex: "uploaded_at",
      key: "uploaded_at",
      render: (d: string) => <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{dayjs(d).format("MMM D, YYYY HH:mm")}</Text>,
    },
    {
      title: "",
      key: "actions",
      render: (_: any, r: Statement) => (
        <Space size="small">
          <Tooltip title="View Statement Output">
            <Button 
              type="text" 
              icon={<BarChartOutlined />} 
              style={{ color: "#22d3ee" }}
              onClick={() => {
                setSelectedStatementId(r.statement_id);
                setSelectedAccount(null);
                router.push("/dashboard");
              }}
            >
              View
            </Button>
          </Tooltip>
          <Popconfirm title="Delete this statement?" description="All trades and summaries will be removed." onConfirm={() => handleDelete(r.statement_id)} okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete statement">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const loadTrades = async (statementId: string) => {
    if (tradesMap[statementId]) return;
    try {
      const res = await statementsApi.trades(statementId);
      setTradesMap(prev => ({ ...prev, [statementId]: res.data.trades }));
    } catch {
      message.error("Failed to load trades");
    }
  };

  const expandedRowRender = (record: Statement) => {
    const trades = tradesMap[record.statement_id];
    if (!trades) {
      return <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>Loading trades...</div>;
    }
    const tradeColumns = [
      { title: "Date", dataIndex: "trade_date", key: "trade_date", render: (d: string) => <Text style={{ color: "rgba(255,255,255,0.85)" }}>{d}</Text> },
      { title: "Ticker", dataIndex: "ticker", key: "ticker", render: (t: string) => <Text strong style={{ color: "#fff" }}>{t}</Text> },
      { title: "Type", dataIndex: "trade_type", key: "trade_type", render: (t: string) => <Tag color={t === 'EXP' ? 'magenta' : 'blue'}>{t}</Tag> },
      { title: "Strategy", dataIndex: "strategy", key: "strategy", render: (s: string) => <Text style={{ color: "rgba(255,255,255,0.7)" }}>{s}</Text> },
      { title: "Contracts", dataIndex: "contracts", key: "contracts", render: (c: number) => <Text style={{ color: "#fff" }}>{c || '-'}</Text> },
      { 
        title: "Amount", 
        dataIndex: "gross_amount", 
        key: "gross_amount",
        render: (val: number) => (
           <span style={{ color: val >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
             {val >= 0 ? '+' : ''}${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}
           </span>
        )
      },
      { title: "Balance", dataIndex: "running_balance", key: "running_balance", render: (v: number) => <Text style={{ color: "rgba(255,255,255,0.6)" }}>{v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</Text> },
    ];

    return (
      <Table 
        columns={tradeColumns} 
        dataSource={trades} 
        pagination={false} 
        rowKey="trade_id"
        size="small"
        style={{ margin: 0, background: 'rgba(0,0,0,0.2)' }}
      />
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>📄 Statements</Title>
        <Button icon={<ReloadOutlined />} onClick={loadStatements} loading={loading} style={{ borderColor: "rgba(99,102,241,0.4)", color: "#6366f1", background: "transparent" }}>
          Refresh
        </Button>
      </div>

      {/* Upload Zone */}
      <Card style={{ ...cardStyle, marginBottom: 24 }} styles={{ body: { padding: 24 } }}>
        <Title level={5} style={{ color: "#fff", marginBottom: 16 }}>Upload ThinkorSwim Statement</Title>
        <Dragger
          name="file" accept=".csv" multiple={false} showUploadList={false}
          beforeUpload={(file) => { handleUpload(file); return false; }}
          disabled={uploading}
          style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.35)", borderRadius: 12 }}
        >
          <p style={{ margin: "16px 0 8px" }}>
            <InboxOutlined style={{ fontSize: 48, color: uploading ? "#6366f1" : "rgba(99,102,241,0.6)" }} />
          </p>
          {uploading ? (
            <>
              <Text style={{ color: "#6366f1", fontWeight: 600, fontSize: 16 }}>Parsing your statement…</Text>
              <Spin size="small" style={{ marginTop: 8 }} />

            </>
          ) : (
            <>
              <Text style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>Click or drag your ThinkorSwim CSV here</Text>
              <br />
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Supports .csv exports from TD Ameritrade / Charles Schwab ThinkorSwim · Max 10 MB</Text>
            </>
          )}
        </Dragger>
      </Card>

      {/* Statements Table */}
      <Card style={cardStyle} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Title level={5} style={{ color: "#fff", margin: 0 }}>Uploaded Statements</Title>
        </div>
        <Table
          dataSource={statements} columns={columns} rowKey="statement_id" loading={loading}
          expandable={{ 
            expandedRowRender, 
            onExpand: (expanded, record) => { if (expanded) loadTrades(record.statement_id); } 
          }}
          pagination={{ 
            pageSize: 10, 
            showSizeChanger: true, 
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => `Total ${total} statements`,
            style: { padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)" } 
          }}
          locale={{ emptyText: <Empty description={<span style={{ color: "rgba(255,255,255,0.4)" }}>No statements uploaded yet</span>} /> }}
          style={{ background: "transparent" }}
          className="custom-table flex-table"
        />
      </Card>

      {/* Duplicate Modal */}
      <Modal
        title={<span style={{ color: "#fff" }}>Duplicate Statement Detected</span>}
        open={duplicateModal.visible}
        onCancel={() => setDuplicateModal({ visible: false, statementId: "", file: null, message: "" })}
        footer={[
          <Button key="cancel" onClick={() => setDuplicateModal({ visible: false, statementId: "", file: null, message: "" })}>Keep Existing</Button>,
          <Button key="replace" type="primary" danger loading={uploading} onClick={() => { if (duplicateModal.file) handleUpload(duplicateModal.file, true); }}>
            Replace
          </Button>,
        ]}
        styles={{ content: { background: "#1a1a2e" }, header: { background: "#1a1a2e" }, footer: { background: "#1a1a2e" } }}
      >
        <p style={{ color: "rgba(255,255,255,0.7)" }}>{duplicateModal.message}</p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Replacing will delete all existing trades for that period and reimport from the new file.</p>
      </Modal>
    </div>
  );
}

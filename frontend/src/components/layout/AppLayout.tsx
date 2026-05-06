"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Button, Avatar, Dropdown, Space, Typography, Select, Spin, Tag } from "antd";
import {
  DashboardOutlined, FileTextOutlined, BarChartOutlined,
  LineChartOutlined, UserOutlined, LogoutOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, RocketOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi } from "@/services/api";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const { accounts, selectedAccount, setSelectedAccount, setAccounts, selectedStatementId, setSelectedStatementId } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);

  // Track client-side mount to avoid SSR/hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Auth guard — only fires after mounting + loading complete
  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!user) {
      // Fallback: also check localStorage in case context hydration lagged
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (!token) {
        router.push("/signin");
      }
    }
  }, [mounted, isLoading, user]); // intentionally omit `router` — it's stable

  // Load accounts once user is confirmed
  useEffect(() => {
    if (user) {
      dashboardApi.accounts()
        .then((res) => {
          const accts = res.data.accounts || [];
          setAccounts(accts);
          if (accts.length > 0 && !selectedAccount) {
            setSelectedAccount(accts[0].account_id);
          }
        })
        .catch(() => {});
    }
  }, [user]); // eslint-disable-line

  // Show spinner while still hydrating
  if (!mounted || isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f23" }}>
        <Spin size="large" />
      </div>
    );
  }

  // If there's no user AND no token → redirect is in-flight, show nothing
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("access_token");
  if (!user && !hasToken) return null;

  const menuItems = [
    { key: "/dashboard",   icon: <DashboardOutlined />,  label: "Dashboard"  },
    { key: "/statements",  icon: <FileTextOutlined />,   label: "Statements" },
    { key: "/predictions", icon: <LineChartOutlined />,  label: "Predictions" },
  ];

  const userMenuItems = [
    { key: "profile",  icon: <UserOutlined />,  label: "Profile"   },
    { type: "divider" as const },
    { key: "signout",  icon: <LogoutOutlined />, label: "Sign Out", onClick: signOut },
  ];

  const displayUser = user || JSON.parse(localStorage.getItem("user") || "null");

  return (
    <Layout style={{ minHeight: "100vh", background: "#0f0f23" }}>
      <Sider
        trigger={null} collapsible collapsed={collapsed} width={240}
        style={{
          background: "linear-gradient(180deg, #0d0d1a 0%, #0f0f23 100%)",
          borderRight: "1px solid rgba(99,102,241,0.15)",
          boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div style={{ padding: collapsed ? "20px 16px" : "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 15px rgba(99,102,241,0.4)" }}>
            <RocketOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          {!collapsed && (
            <Title level={4} style={{ color: "#fff", margin: 0, fontWeight: 800, background: "linear-gradient(90deg,#6366f1,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Opencap
            </Title>
          )}
        </div>

        {/* Navigation */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={pathname ? [pathname] : []}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ background: "transparent", border: "none", padding: "8px 0", marginTop: 8 }}
        />

        {/* User card at bottom */}
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, padding: "0 12px" }}>
          {!collapsed && displayUser && (
            <div style={{ background: "rgba(99,102,241,0.1)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayUser.full_name}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayUser.email}
              </div>
            </div>
          )}
        </div>
      </Sider>

      <Layout>
        {/* Header */}
        <Header style={{ padding: "0 24px", background: "rgba(15,15,35,0.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <Space size={16}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", border: "none", background: "transparent" }}
            />
            {accounts.length > 0 && (
              <Select
                value={selectedAccount}
                placeholder="Select Account"
                style={{ width: 220 }}
                onChange={setSelectedAccount}
                allowClear
                options={accounts.map((a) => ({ value: a.account_id, label: `${a.account_id} (${a.account_type || "—"})` }))}
                disabled={!!selectedStatementId}
              />
            )}
            {selectedStatementId && (
              <Tag 
                color="cyan" 
                closable 
                onClose={(e) => {
                  e.preventDefault();
                  setSelectedStatementId(null);
                }}
                style={{ padding: "4px 10px", fontSize: 13, borderRadius: 6, display: "inline-flex", alignItems: "center", border: "1px solid rgba(34, 211, 238, 0.4)" }}
              >
                Viewing Single Statement
              </Tag>
            )}
          </Space>

          <Space size={8}>
            <Button type="text" icon={<BellOutlined />} style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }} />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}>
                <Avatar style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", fontWeight: 700 }}>
                  {displayUser?.full_name?.charAt(0).toUpperCase()}
                </Avatar>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500 }}>
                  {displayUser?.full_name}
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Page content */}
        <Content style={{ margin: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

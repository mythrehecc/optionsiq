"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Layout from "antd/lib/layout";
import Menu from "antd/lib/menu";
import Button from "antd/lib/button";
import Avatar from "antd/lib/avatar";
import Dropdown from "antd/lib/dropdown";
import Space from "antd/lib/space";
import Typography from "antd/lib/typography";
import Select from "antd/lib/select";
import Spin from "antd/lib/spin";
import DashboardOutlined from "@ant-design/icons/DashboardOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import LineChartOutlined from "@ant-design/icons/LineChartOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import LogoutOutlined from "@ant-design/icons/LogoutOutlined";
import MenuFoldOutlined from "@ant-design/icons/MenuFoldOutlined";
import MenuUnfoldOutlined from "@ant-design/icons/MenuUnfoldOutlined";
import BellOutlined from "@ant-design/icons/BellOutlined";
import RocketOutlined from "@ant-design/icons/RocketOutlined";
import FolderOpenOutlined from "@ant-design/icons/FolderOpenOutlined";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { dashboardApi, statementsApi } from "@/services/api";
import dayjs from "dayjs";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const { accounts, selectedAccount, setSelectedAccount, setAccounts, selectedStatementId, setSelectedStatementId, statements, setStatements } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track client-side mount to avoid SSR/hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const w = window.innerWidth;
      const mobile = w < 768;
      const laptop = w < 1280; // collapse sidebar on laptops too
      setIsMobile(mobile);
      // On mobile: overlay mode (collapsed=true hides it via translateX)
      // On laptop: icon-only collapsed mode
      // On desktop (≥1280): full sidebar
      setCollapsed(mobile || laptop);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Load accounts + statements once user is confirmed
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

      statementsApi.list()
        .then((res) => {
          setStatements(res.data.statements || []);
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
    { key: "/dashboard",   icon: <DashboardOutlined />,  label: "Dashboard"   },
    { key: "/statements",  icon: <FileTextOutlined />,   label: "Statements"  },
    { key: "/predictions", icon: <LineChartOutlined />,  label: "Predictions" },
  ];

  const userMenuItems = [
    { key: "profile",  icon: <UserOutlined />,  label: "Profile"   },
    { type: "divider" as const },
    { key: "signout",  icon: <LogoutOutlined />, label: "Sign Out", onClick: signOut },
  ];

  const displayUser = user || JSON.parse(localStorage.getItem("user") || "null");

  const siderWidth = 240;

  return (
    <Layout style={{ minHeight: "100vh", background: "#0f0f23" }}>
      {/* Mobile backdrop overlay */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 998, backdropFilter: "blur(2px)",
          }}
        />
      )}

      <Sider
        trigger={null}
        collapsible
        collapsed={isMobile ? false : collapsed}
        width={siderWidth}
        style={{
          background: "linear-gradient(180deg, #0d0d1a 0%, #0f0f23 100%)",
          borderRight: "1px solid rgba(99,102,241,0.15)",
          boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
          // On mobile: fixed overlay; hide when collapsed
          ...(isMobile ? {
            position: "fixed",
            top: 0, left: 0, bottom: 0,
            zIndex: 999,
            transform: collapsed ? `translateX(-${siderWidth}px)` : "translateX(0)",
            transition: "transform 0.3s ease",
            width: `${siderWidth}px`,
          } : {}),
        }}
      >
        {/* Logo */}
        <div style={{ padding: (!isMobile && collapsed) ? "20px 16px" : "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 15px rgba(99,102,241,0.4)" }}>
            <RocketOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          {(!collapsed || isMobile) && (
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
          onClick={({ key }) => { router.push(key); if (isMobile) setCollapsed(true); }}
          style={{ background: "transparent", border: "none", padding: "8px 0", marginTop: 8 }}
        />

        {/* User card at bottom */}
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, padding: "0 12px" }}>
          {(!collapsed || isMobile) && displayUser && (
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

      <Layout style={{ transition: "all 0.2s" }}>
        {/* Header */}
        <Header style={{
          padding: isMobile ? "0 12px" : "0 24px",
          background: "rgba(15,15,35,0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: 56,
          lineHeight: "56px",
        }}>
          <Space size={isMobile ? 8 : 16} wrap={false}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", border: "none", background: "transparent", width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            />

            {/* Account selector — hidden on mobile */}
            {accounts.length > 0 && !isMobile && (
              <Select
                value={selectedAccount}
                placeholder="Select Account"
                style={{ width: 180 }}
                onChange={setSelectedAccount}
                allowClear
                options={accounts.map((a) => ({ value: a.account_id, label: `${a.account_id} (${a.account_type || "—"})` }))}
              />
            )}

            {/* Statement selector */}
            {statements.length > 0 && (
              <Select
                value={selectedStatementId ?? "all"}
                style={{ width: isMobile ? 130 : 240 }}
                onChange={(val) => setSelectedStatementId(val === "all" ? null : val)}
                suffixIcon={<FolderOpenOutlined style={{ color: "#6366f1" }} />}
                options={[
                  { value: "all", label: isMobile ? "📂 All" : "📂 All Statements" },
                  ...statements.map((s: any) => ({
                    value: s.statement_id,
                    label: isMobile
                      ? `📄 ${dayjs(s.statement_end).format("MMM DD")}`
                      : `📄 ${s.filename || s.account_id} (${dayjs(s.statement_end).format("MMM DD, YYYY")})`
                  }))
                ]}
              />
            )}
          </Space>

          <Space size={8}>
            {!isMobile && <Button type="text" icon={<BellOutlined />} style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }} />}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}>
                <Avatar style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", fontWeight: 700, width: 32, height: 32, lineHeight: "32px", fontSize: 14 }}>
                  {displayUser?.full_name?.charAt(0).toUpperCase()}
                </Avatar>
                {!isMobile && (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500 }}>
                    {displayUser?.full_name}
                  </span>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Page content */}
        <Content style={{ margin: isMobile ? 8 : 24, minHeight: 280, overflowX: "hidden" }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

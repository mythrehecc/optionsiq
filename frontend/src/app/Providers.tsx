"use client";
import React from "react";
import { ConfigProvider, theme } from "antd";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          colorBgBase: "#0f0f23",
          colorBgContainer: "#1a1a2e",
          colorBgElevated: "#16213e",
          borderRadius: 10,
          fontFamily: "'Inter', sans-serif",
        },
        components: {
          Layout: {
            siderBg: "#0d0d1a",
            headerBg: "#0f0f23",
            bodyBg: "#0f0f23",
          },
          Menu: {
            darkItemBg: "#0d0d1a",
            darkSubMenuItemBg: "#0d0d1a",
          },
          Card: {
            colorBgContainer: "#1a1a2e",
          },
          Table: {
            colorBgContainer: "#1a1a2e",
            headerBg: "#16213e",
          },
        },
      }}
    >
      <AuthProvider>
        <DashboardProvider>{children}</DashboardProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}

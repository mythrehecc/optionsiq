"use client";
import React, { useState } from "react";
import Form from "antd/lib/form";
import Input from "antd/lib/input";
import Button from "antd/lib/button";
import Typography from "antd/lib/typography";
import Alert from "antd/lib/alert";
import Divider from "antd/lib/divider";
import { MailOutlined, LockOutlined, UserOutlined, RocketOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/services/api";
import Link from "next/link";

const { Title, Text } = Typography;

export default function SignUpPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { full_name: string; email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.signup(values);
      signIn(res.data.user, res.data.access_token, res.data.refresh_token);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.response?.data?.error || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d0d1a 100%)",
      padding: "24px",
    }}>
      <div style={{ position: "fixed", top: "15%", right: "15%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "15%", left: "15%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{
        width: "100%", maxWidth: 440, background: "rgba(26,26,46,0.85)",
        backdropFilter: "blur(20px)", borderRadius: 20, padding: "48px 40px",
        border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            marginBottom: 16, boxShadow: "0 8px 25px rgba(99,102,241,0.4)",
          }}>
            <RocketOutlined style={{ fontSize: 28, color: "#fff" }} />
          </div>
          <Title level={2} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>Create Account</Title>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Start analyzing your options trades</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 8 }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="full_name" rules={[{ required: true, message: "Full name is required" }]}>
            <Input
              prefix={<UserOutlined style={{ color: "rgba(255,255,255,0.3)" }} />}
              placeholder="Full name" size="large"
              style={{ borderRadius: 10, height: 48, background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </Form.Item>
          <Form.Item name="email" rules={[{ required: true, type: "email", message: "Enter a valid email" }]}>
            <Input
              prefix={<MailOutlined style={{ color: "rgba(255,255,255,0.3)" }} />}
              placeholder="Email address" size="large"
              style={{ borderRadius: 10, height: 48, background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 8, message: "Min 8 chars, 1 uppercase, 1 number" }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: "rgba(255,255,255,0.3)" }} />}
              placeholder="Password (min 8 chars)" size="large"
              style={{ borderRadius: 10, height: 48, background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            />
          </Form.Item>

          <Button
            type="primary" htmlType="submit" block size="large" loading={loading}
            style={{ height: 50, borderRadius: 12, fontWeight: 700, fontSize: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", boxShadow: "0 8px 25px rgba(99,102,241,0.4)", marginTop: 8 }}
          >
            Create Account
          </Button>
        </Form>

        <Divider style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          Already have an account?
        </Divider>
        <div style={{ textAlign: "center" }}>
          <Link href="/signin">
            <Button block size="large" style={{ height: 48, borderRadius: 12, borderColor: "rgba(99,102,241,0.4)", color: "#6366f1", background: "transparent", fontWeight: 600 }}>
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

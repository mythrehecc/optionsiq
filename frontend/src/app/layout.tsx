import type { Metadata } from "next";
import Providers from "./Providers";
import "@/index.css";

export const metadata: Metadata = {
  title: "OptionsIQ – Options Trading Analytics",
  description: "Advanced ThinkorSwim options analytics – P&L, risk alerts, and month-over-month insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: "'Inter', sans-serif", background: "#0f0f23" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

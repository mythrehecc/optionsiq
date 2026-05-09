"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Account, DashboardSummary, Trade, MonthlySummary, RiskAlert, TickerPnL, StrategyPnL } from "../types";

interface DashboardContextValue {
  selectedAccount: string | null;
  selectedStatementId: string | null;
  accounts: Account[];
  summary: DashboardSummary | null;
  positions: Trade[];
  monthlySummaries: MonthlySummary[];
  alerts: RiskAlert[];
  tickerPnL: TickerPnL[];
  strategyPnL: StrategyPnL[];
  statements: any[];
  totalPositions: number;
  isLoading: boolean;
  setSelectedAccount: (accountId: string | null) => void;
  setSelectedStatementId: (statementId: string | null) => void;
  setAccounts: (accounts: Account[]) => void;
  setSummary: (summary: DashboardSummary | null) => void;
  setPositions: (positions: Trade[]) => void;
  setTotalPositions: (total: number) => void;
  setMonthlySummaries: (summaries: MonthlySummary[]) => void;
  setAlerts: (alerts: RiskAlert[]) => void;
  setTickerPnL: (tickerPnL: TickerPnL[]) => void;
  setStrategyPnL: (strategyPnL: StrategyPnL[]) => void;
  setStatements: (statements: any[]) => void;
  setLoading: (loading: boolean) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [positions, setPositions] = useState<Trade[]>([]);
  const [totalPositions, setTotalPositions] = useState(0);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [tickerPnL, setTickerPnL] = useState<TickerPnL[]>([]);
  const [strategyPnL, setStrategyPnL] = useState<StrategyPnL[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [isLoading, setLoading] = useState(false);

  return (
    <DashboardContext.Provider
      value={{
        selectedAccount,
        selectedStatementId,
        accounts,
        summary,
        positions,
        totalPositions,
        monthlySummaries,
        alerts,
        tickerPnL,
        strategyPnL,
        statements,
        isLoading,
        setSelectedAccount,
        setSelectedStatementId,
        setAccounts,
        setSummary,
        setPositions,
        setTotalPositions,
        setMonthlySummaries,
        setAlerts,
        setTickerPnL,
        setStrategyPnL,
        setStatements,
        setLoading,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencySelector } from "@/components/portfolio/currency-selector";
import { AccountFilter, resolveAccountIds } from "@/components/portfolio/account-filter";
import { PerformanceChart } from "@/components/portfolio/performance-chart";
import { PositionsTable } from "@/components/portfolio/positions-table";
import type { Position } from "@/lib/portfolio/positions";

interface Account {
  id: string;
  name: string;
  institution: string;
  type: string;
}

interface PortfolioData {
  totalUsd: number;
  positions: Position[];
  updatedAt: string | null;
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [currency, setCurrency] = useState("CAD");
  const [fxRate, setFxRate] = useState(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountFilter, setAccountFilter] = useState("all");

  const fetchPortfolio = useCallback(async (filter = "all", allAccounts: Account[] = []) => {
    setLoading(true);
    const ids = resolveAccountIds(allAccounts, filter);
    const url = ids ? `/api/portfolio?accountIds=${ids.join(",")}` : "/api/portfolio";
    const res = await fetch(url);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (currency === "USD") { setFxRate(1); return; }
    fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`)
      .then((r) => r.json())
      .then((d) => setFxRate(d.rates?.[currency] ?? 1))
      .catch(() => setFxRate(1));
  }, [currency]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        fetchPortfolio("all", data);
      });
  }, [fetchPortfolio]);

  function handleFilterChange(filter: string) {
    setAccountFilter(filter);
    fetchPortfolio(filter, accounts);
  }

  async function refreshPrices() {
    setRefreshLoading(true);
    await fetch("/api/portfolio/refresh", { method: "POST" });
    await fetchPortfolio(accountFilter, accounts);
    setRefreshLoading(false);
  }

  async function takeSnapshot() {
    setSnapshotLoading(true);
    await fetch("/api/portfolio/snapshot", { method: "POST" });
    await fetchPortfolio(accountFilter, accounts);
    setSnapshotLoading(false);
  }

  const totalDisplay = data ? (data.totalUsd * fxRate).toLocaleString("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }) : "—";

  const totalCostUsd = data?.positions.reduce((s, p) => s + p.costBasisUsd, 0) ?? 0;
  const totalPlUsd = data ? data.totalUsd - totalCostUsd : null;
  const totalPlPct = totalCostUsd > 0 && totalPlUsd !== null ? (totalPlUsd / totalCostUsd) * 100 : null;
  const isPositive = (totalPlUsd ?? 0) >= 0;

  const updatedAt = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.positions.length ?? 0} position{(data?.positions.length ?? 0) !== 1 ? "s" : ""}
            {updatedAt && (
              <span className="ml-2">· prices as of {updatedAt}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AccountFilter accounts={accounts} value={accountFilter} onChange={handleFilterChange} />
          <CurrencySelector value={currency} onChange={setCurrency} />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPrices}
            disabled={refreshLoading || snapshotLoading}
          >
            {refreshLoading ? "Refreshing..." : "Refresh prices"}
          </Button>
          <Button
            size="sm"
            onClick={takeSnapshot}
            disabled={snapshotLoading || refreshLoading}
          >
            {snapshotLoading ? "Saving..." : "Take snapshot"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{loading ? "..." : totalDisplay}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {loading || totalPlUsd === null ? "..." : (totalPlUsd * fxRate).toLocaleString("en-CA", {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">P&L %</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <p className={`text-3xl font-semibold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {loading || totalPlPct === null ? "..." : `${totalPlPct >= 0 ? "+" : ""}${totalPlPct.toFixed(2)}%`}
            </p>
            {!loading && totalPlPct !== null && (
              <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
                {isPositive ? "gain" : "loss"}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceChart displayCurrency={currency} fxRate={fxRate} />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-4">Positions</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <PositionsTable
            positions={data?.positions ?? []}
            displayCurrency={currency}
            fxRate={fxRate}
          />
        )}
      </div>
    </div>
  );
}

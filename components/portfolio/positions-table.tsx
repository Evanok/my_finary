"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Position } from "@/lib/portfolio/positions";

type SortKey = "value" | "pl" | "plPct";
type SortDir = "asc" | "desc";

const CATEGORY_STYLES: Record<string, string> = {
  crypto:      "bg-violet-100 text-violet-700",
  stock:       "bg-sky-100 text-sky-700",
  etf:         "bg-teal-100 text-teal-700",
  cash:        "bg-yellow-100 text-yellow-700",
  real_estate: "bg-orange-100 text-orange-700",
  bond:        "bg-blue-100 text-blue-700",
  reit:        "bg-pink-100 text-pink-700",
  other:       "bg-gray-100 text-gray-600",
};

interface Props {
  positions: Position[];
  displayCurrency: string;
  fxRate: number;
  onValuationUpdated?: () => void;
}

export function PositionsTable({ positions, displayCurrency, fxRate, onValuationUpdated }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [valuationInput, setValuationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...positions].sort((a, b) => {
    let av: number, bv: number;
    if (sortKey === "value") { av = a.valueUsd ?? 0; bv = b.valueUsd ?? 0; }
    else if (sortKey === "pl") { av = a.plUsd ?? 0; bv = b.plUsd ?? 0; }
    else { av = a.plPct ?? 0; bv = b.plPct ?? 0; }
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  function fmt(usd: number | null) {
    if (usd === null) return "—";
    return (usd * fxRate).toLocaleString("en-CA", {
      style: "currency",
      currency: displayCurrency,
      maximumFractionDigits: 2,
    });
  }

  function fmtPct(pct: number | null) {
    if (pct === null) return "—";
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  }

  async function saveValuation(assetId: string) {
    const value = parseFloat(valuationInput);
    if (isNaN(value) || value <= 0) return;
    setSaving(true);
    await fetch(`/api/assets/${assetId}/valuation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, currency: displayCurrency }),
    });
    setSaving(false);
    setEditingId(null);
    setValuationInput("");
    onValuationUpdated?.();
  }

  if (positions.length === 0) {
    return <p className="text-sm text-muted-foreground">No positions yet.</p>;
  }

  return (
    <div className="rounded-xl border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asset</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Qty</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Avg cost</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Price</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("value")}>Value{sortIndicator("value")}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("pl")}>P&L{sortIndicator("pl")}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("plPct")}>P&L %{sortIndicator("plPct")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const positive = (p.plUsd ?? 0) >= 0;
            const isRealEstate = p.category.toLowerCase() === "real_estate";
            const isEditing = editingId === p.assetId;
            const categoryStyle = CATEGORY_STYLES[p.category.toLowerCase()] ?? CATEGORY_STYLES.other;
            return (
              <tr key={p.assetId} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.symbol}</span>
                    {!p.priceValidated && (
                      <Badge className="text-xs bg-amber-100 text-amber-600 border-0">~</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryStyle}`}>
                    {p.category.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmt(p.avgCostUsd)}</td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {p.currentPriceUsd === null ? "—" : fmt(p.currentPriceUsd)}
                </td>
                <td className="px-4 py-3 font-semibold">{fmt(p.valueUsd)}</td>
                <td className={`px-4 py-3 font-medium hidden sm:table-cell ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                  {fmt(p.plUsd)}
                </td>
                <td className={`px-4 py-3 font-medium ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                  {fmtPct(p.plPct)}
                </td>
                <td className="px-4 py-3">
                  {isRealEstate && (
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="1000"
                          placeholder={`Value in ${displayCurrency}`}
                          value={valuationInput}
                          onChange={(e) => setValuationInput(e.target.value)}
                          className="w-28 h-7 text-xs"
                          autoFocus
                        />
                        <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => saveValuation(p.assetId)}>
                          {saving ? "..." : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setEditingId(p.assetId); setValuationInput(""); }}
                      >
                        Update value
                      </Button>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

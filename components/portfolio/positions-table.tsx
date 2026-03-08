"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Position } from "@/lib/portfolio/positions";

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
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {["Asset", "Category", "Qty", "Avg cost", "Current price", "Value", "P&L", "P&L %", ""].map((h, i) => (
              <th key={i} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const positive = (p.plUsd ?? 0) >= 0;
            const isRealEstate = p.category.toLowerCase() === "real_estate";
            const isEditing = editingId === p.assetId;
            return (
              <tr key={p.assetId} className="border-t hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.symbol}</span>
                    {!p.priceValidated && (
                      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                        unvalidated
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                </td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{p.category}</td>
                <td className="px-4 py-3">{p.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmt(p.avgCostUsd)}</td>
                <td className="px-4 py-3">
                  {p.currentPriceUsd === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    fmt(p.currentPriceUsd)
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{fmt(p.valueUsd)}</td>
                <td className={`px-4 py-3 font-medium ${positive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {fmt(p.plUsd)}
                </td>
                <td className={`px-4 py-3 font-medium ${positive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
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
                          className="w-32 h-7 text-xs"
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

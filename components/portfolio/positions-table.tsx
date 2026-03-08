"use client";

import { Badge } from "@/components/ui/badge";
import type { Position } from "@/lib/portfolio/positions";

interface Props {
  positions: Position[];
  displayCurrency: string;
  fxRate: number;
}

export function PositionsTable({ positions, displayCurrency, fxRate }: Props) {
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

  if (positions.length === 0) {
    return <p className="text-sm text-muted-foreground">No positions yet.</p>;
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {["Asset", "Category", "Qty", "Avg cost", "Current price", "Value", "P&L", "P&L %"].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const positive = (p.plUsd ?? 0) >= 0;
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Position } from "@/lib/portfolio/positions";

const CATEGORY_COLORS: Record<string, string> = {
  crypto:      "#8b5cf6",
  stock:       "#38bdf8",
  cash:        "#facc15",
  real_estate: "#fb923c",
  commodity:   "#d97706",
  bond:        "#60a5fa",
  reit:        "#f472b6",
  other:       "#9ca3af",
};

// Merge ETF into stock for allocation display
function normalizeCategory(cat: string): string {
  if (cat === "etf") return "stock";
  return cat;
}

interface Props {
  positions: Position[];
  displayCurrency: string;
  fxRate: number;
}

export function AllocationChart({ positions, displayCurrency, fxRate }: Props) {
  const totals = new Map<string, number>();
  for (const p of positions) {
    const cat = normalizeCategory(p.category.toLowerCase());
    totals.set(cat, (totals.get(cat) ?? 0) + (p.valueUsd ?? 0));
  }

  const total = [...totals.values()].reduce((s, v) => s + v, 0);
  const data = [...totals.entries()]
    .map(([cat, valueUsd]) => ({ cat, valueUsd, pct: total > 0 ? (valueUsd / total) * 100 : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  function fmt(usd: number) {
    return (usd * fxRate).toLocaleString("en-CA", {
      style: "currency",
      currency: displayCurrency,
      maximumFractionDigits: 0,
    });
  }

  if (data.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="w-full sm:w-48 shrink-0">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="valueUsd"
              nameKey="cat"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.cat} fill={CATEGORY_COLORS[d.cat] ?? CATEGORY_COLORS.other} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [fmt(v as number), ""]}
              labelFormatter={(l) => (l as string).replace("_", " ")}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-1.5 w-full">
        {data.map((d) => (
          <div key={d.cat} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: CATEGORY_COLORS[d.cat] ?? CATEGORY_COLORS.other }}
            />
            <span className="capitalize w-24 text-muted-foreground">{d.cat.replace("_", " ")}</span>
            <span className="font-medium">{fmt(d.valueUsd)}</span>
            <span className="text-xs text-muted-foreground ml-auto">{d.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

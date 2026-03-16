"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Period = "1w" | "1m" | "all";

interface SnapshotPoint {
  date: string;
  totalUsd: number;
}

interface Props {
  displayCurrency: string;
  fxRate: number;
  categoryFilter?: string;
  period: Period;
}

export function PerformanceChart({ displayCurrency, fxRate, categoryFilter = "all", period }: Props) {
  const [data, setData] = useState<SnapshotPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portfolio/snapshots?period=${period}&category=${categoryFilter}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [period, categoryFilter]);

  const converted = data.map((p) => ({
    date: p.date,
    value: p.totalUsd * fxRate,
  }));

  const first = converted[0]?.value ?? 0;
  const last = converted[converted.length - 1]?.value ?? 0;
  const isPositive = last >= first;
  const color = isPositive ? "#34d399" : "#fb7185";

  const values = converted.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.1 || maxVal * 0.05;
  const yDomain: [number, number] = [
    Math.max(0, minVal - padding),
    maxVal + padding,
  ];

  function formatCurrency(v: number) {
    return v.toLocaleString("en-CA", {
      style: "currency",
      currency: displayCurrency,
      maximumFractionDigits: 0,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : data.length < 2 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Not enough snapshots yet — click "Take snapshot" to start tracking.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={converted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d) =>
                new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(v as number)}
              width={90}
              domain={yDomain}
            />
            <Tooltip
              formatter={(v) => [formatCurrency(v as number), "Value"]}
              labelFormatter={(l) =>
                new Date(l as string).toLocaleDateString("en-CA", { dateStyle: "medium" })
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#colorValue)"
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

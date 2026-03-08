"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Groups multiple raw categories under a single label
const CATEGORY_GROUPS: { value: string; label: string; matches: string[] }[] = [
  { value: "all",         label: "All asset types",  matches: [] },
  { value: "crypto",      label: "Crypto",            matches: ["crypto"] },
  { value: "stock",       label: "Stock / ETF",       matches: ["stock", "etf"] },
  { value: "real_estate", label: "Real estate",       matches: ["real_estate"] },
  { value: "cash",        label: "Cash",              matches: ["cash"] },
  { value: "other",       label: "Other",             matches: ["bond", "reit", "other"] },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  availableCategories: string[];
}

export function CategoryFilter({ value, onChange, availableCategories }: Props) {
  const visible = CATEGORY_GROUPS.filter(
    (g) => g.value === "all" || g.matches.some((m) => availableCategories.includes(m))
  );

  const label = CATEGORY_GROUPS.find((g) => g.value === value)?.label ?? "All asset types";

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-44">
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {visible.map((g) => (
          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Returns true if a position's category matches the selected filter
export function matchesCategory(category: string, filter: string): boolean {
  if (filter === "all") return true;
  const group = CATEGORY_GROUPS.find((g) => g.value === filter);
  return group?.matches.includes(category.toLowerCase()) ?? false;
}

"use client";

import { Button } from "@/components/ui/button";

const CURRENCIES = ["USD", "CAD", "EUR"];

interface Props {
  value: string;
  onChange: (currency: string) => void;
}

export function CurrencySelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {CURRENCIES.map((c) => (
        <Button
          key={c}
          variant={value === c ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(c)}
        >
          {c}
        </Button>
      ))}
    </div>
  );
}

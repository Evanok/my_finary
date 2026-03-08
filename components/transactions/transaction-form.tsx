"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ["stock", "etf", "crypto", "bond", "reit", "other"];
const CURRENCIES = ["USD", "CAD", "EUR"];
const TRANSACTION_TYPES = ["buy", "sell"];

interface Account {
  id: string;
  institution: string;
  type: string;
}

interface Props {
  onCreated: () => void;
}

export function TransactionForm({ onCreated }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("stock");
  const [nativeCurrency, setNativeCurrency] = useState("USD");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [type, setType] = useState("buy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const assetRes = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, name: name || symbol, category, nativeCurrency }),
    });
    if (!assetRes.ok) {
      setError("Failed to create asset");
      setLoading(false);
      return;
    }
    const asset = await assetRes.json();

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, assetId: asset.id, date, quantity, price, currency, type }),
    });

    if (res.ok) {
      setSymbol(""); setName(""); setQuantity(""); setPrice("");
      setDate(new Date().toISOString().split("T")[0]);
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create transaction");
    }
    setLoading(false);
  }

  function onCurrencyChange(v: string | null) {
    if (!v) return;
    setCurrency(v);
    setNativeCurrency(v);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Account</Label>
          <Select value={accountId} onValueChange={(v) => v && setAccountId(v)} required>
            <SelectTrigger>
              <SelectValue placeholder="Select account">
                {selectedAccount
                  ? `${selectedAccount.institution} — ${selectedAccount.type}`
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.institution} — {a.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Symbol</Label>
          <Input
            placeholder="e.g. AAPL, VFV.TO"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Name</Label>
          <Input
            placeholder="e.g. Apple Inc"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => v && setType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Quantity</Label>
          <Input
            type="number"
            step="any"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Price per unit</Label>
          <Input
            type="number"
            step="any"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={onCurrencyChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || !accountId || !symbol} className="self-start">
        {loading ? "Saving..." : "Add transaction"}
      </Button>
    </form>
  );
}

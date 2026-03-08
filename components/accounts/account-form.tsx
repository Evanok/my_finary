"use client";

import { useState } from "react";
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

const ACCOUNT_TYPES = ["CELI", "REER", "TFSA", "RRSP", "Taxable", "Crypto", "Other"];

interface Props {
  onCreated: () => void;
}

export function AccountForm({ onCreated }: Props) {
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!institution || !type) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution,
        type,
        name: `${institution} ${type}`,
      }),
    });

    if (res.ok) {
      setInstitution("");
      setType("");
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create account");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="institution">Institution</Label>
          <Input
            id="institution"
            placeholder="e.g. WealthSimple"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Account type</Label>
          <Select value={type} onValueChange={(v) => v && setType(v)} required>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || !institution || !type} className="self-start">
        {loading ? "Creating..." : "Add account"}
      </Button>
    </form>
  );
}

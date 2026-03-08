"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  institution: string;
  type: string;
}

interface Props {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
}

// Returns the account IDs corresponding to a filter value.
// value = "all" | "institution:<name>" | "<accountId>"
export function resolveAccountIds(accounts: Account[], value: string): string[] | undefined {
  if (value === "all") return undefined;
  if (value.startsWith("institution:")) {
    const institution = value.slice("institution:".length);
    return accounts.filter((a) => a.institution === institution).map((a) => a.id);
  }
  return [value];
}

export function AccountFilter({ accounts, value, onChange }: Props) {
  // Group accounts by institution
  const byInstitution = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    (acc[a.institution] ??= []).push(a);
    return acc;
  }, {});

  const institutions = Object.keys(byInstitution).sort();

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-52">
        <SelectValue>
          {value === "all"
            ? "All accounts"
            : value.startsWith("institution:")
              ? value.slice("institution:".length)
              : (() => {
                  const a = accounts.find((a) => a.id === value);
                  return a ? `${a.institution} — ${a.type}` : "All accounts";
                })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All accounts</SelectItem>
        {institutions.map((institution) => {
          const group = byInstitution[institution];
          return (
            <SelectGroup key={institution}>
              <SelectLabel
                className="cursor-pointer hover:text-foreground"
                onClick={() => onChange(`institution:${institution}`)}
              >
                {institution}
              </SelectLabel>
              {group.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.type}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

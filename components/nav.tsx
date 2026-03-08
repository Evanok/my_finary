"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Portfolio" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 flex h-14 items-center gap-6">
        <span className="font-semibold text-sm tracking-tight">my_finary</span>
        <div className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-sm font-medium text-foreground"
                  : "text-sm text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

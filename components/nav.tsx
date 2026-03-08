"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Portfolio" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 flex h-14 items-center gap-6">
        <span className="font-semibold text-sm tracking-tight">my_finary</span>
        <div className="flex gap-4 flex-1">
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
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
          Sign out
        </Button>
      </div>
    </nav>
  );
}

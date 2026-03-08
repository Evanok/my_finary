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
    <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-4 flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
          <span className="font-semibold text-sm tracking-tight">my_finary</span>
        </Link>
        <div className="flex gap-1 flex-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-sm font-medium px-3 py-1.5 rounded-md bg-violet-50 text-violet-700"
                  : "text-sm text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-md transition-colors"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground text-xs">
          Sign out
        </Button>
      </div>
    </nav>
  );
}

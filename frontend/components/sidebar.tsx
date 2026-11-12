"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ScanSearch,
  Database,
  LogOut,
  Leaf,
  ShieldCheck,
  Building2,
  ExternalLink,
} from "lucide-react";
import { getSession, clearSession, User } from "@/lib/auth";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getSession());
    const onAuthChange = () => setUser(getSession());
    window.addEventListener("ncv_auth_change", onAuthChange);
    return () => window.removeEventListener("ncv_auth_change", onAuthChange);
  }, []);

  const handleSignOut = () => {
    clearSession();
    router.push("/login");
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/verify", label: "Verify Product", icon: ScanSearch },
    { href: "/dataset", label: "Dataset Explorer", icon: Database },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-5 border-b border-sidebar-border/60">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Leaf className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-foreground">
              Nutrition Claim
            </span>
            <span className="text-xs font-medium text-primary">Verifier · FSSAI</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 px-3 py-5">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Audit Workspace
        </p>
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className={`size-4.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* FSSAI Reference Box */}
        <div className="mt-8 mx-1 p-3.5 rounded-xl border border-border bg-card/80 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <ShieldCheck className="size-4 text-primary" />
            <span>Regulatory Standards</span>
          </div>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            FSSAI Advertising & Claims Regulations, 2018 (amended 2020). Deterministic threshold enforcement.
          </p>
          <a
            href="https://www.fssai.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
          >
            FSSAI Official Portal <ExternalLink className="size-3" />
          </a>
        </div>
      </nav>

      {/* User Session & Sign Out */}
      <div className="border-t border-sidebar-border p-4 bg-sidebar/50">
        {user ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                {user.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="size-3 shrink-0" />
                  {user.organization}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {user.role}
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors py-1 px-2 rounded-md hover:bg-destructive/10 font-medium"
                title="Sign out of Nutrition Claim Verifier"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors"
          >
            Sign In to Auditor Portal
          </Link>
        )}
      </div>
    </aside>
  );
}

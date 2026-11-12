"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Leaf, LogOut, CheckCircle2, AlertCircle, Menu, X, ScanSearch } from "lucide-react";
import { getSession, clearSession, User } from "@/lib/auth";
import { fetchHealth, API_BASE } from "@/lib/api";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getSession());
    const onAuthChange = () => setUser(getSession());
    window.addEventListener("ncv_auth_change", onAuthChange);

    fetchHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));

    return () => window.removeEventListener("ncv_auth_change", onAuthChange);
  }, []);

  const handleSignOut = () => {
    clearSession();
    router.push("/login");
  };

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/verify", label: "Verify Product" },
    { href: "/dataset", label: "Dataset Explorer" },
  ];

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border/80 bg-card/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Mobile brand & toggle */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-border text-foreground hover:bg-muted"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="size-4" />
          </span>
          <span className="text-sm font-bold text-foreground">Nutrition Claim Verifier</span>
        </Link>
      </div>

      {/* Desktop breadcrumb */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Research Workspace</span>
        <span>/</span>
        <span className="capitalize text-primary font-medium">
          {pathname === "/" ? "Dashboard & Analytics" : pathname.replace("/", "")}
        </span>
      </div>

      {/* Right status & actions */}
      <div className="flex items-center gap-3">
        {/* Backend status pill */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
            apiOnline === true
              ? "bg-success/10 text-success border-success/30"
              : apiOnline === false
              ? "bg-destructive/10 text-destructive border-destructive/30"
              : "bg-muted text-muted-foreground border-border"
          }`}
          title={`Backend: ${API_BASE}`}
        >
          <span
            className={`size-2 rounded-full ${
              apiOnline === true ? "bg-success animate-pulse" : apiOnline === false ? "bg-destructive" : "bg-muted-foreground"
            }`}
          />
          <span className="hidden sm:inline">
            {apiOnline === true ? "API Live (Render)" : apiOnline === false ? "API Disconnected" : "Checking API..."}
          </span>
        </div>

        {/* Quick Verify button */}
        <Link
          href="/verify"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          <ScanSearch className="size-3.5" />
          <span>New Audit</span>
        </Link>

        {/* User button / Sign Out */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col text-right leading-tight">
              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">{user.name}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user.role}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Sign In
          </Link>
        )}
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="absolute top-16 inset-x-0 bg-card border-b border-border p-4 shadow-lg flex flex-col gap-2 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg text-sm font-medium ${
                pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
              className="mt-2 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Sign Out ({user.email})
            </button>
          )}
        </div>
      )}
    </header>
  );
}

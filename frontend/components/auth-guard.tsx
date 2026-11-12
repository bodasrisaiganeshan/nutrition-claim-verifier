"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated, getSession, User } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { Leaf } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // If we're already on /login, no guard needed
    if (pathname === "/login") {
      setChecked(true);
      return;
    }

    const authed = isAuthenticated();
    if (!authed) {
      router.replace("/login");
    } else {
      setCurrentUser(getSession());
      setChecked(true);
    }
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center animate-bounce shadow-md">
            <Leaf className="size-6" />
          </div>
          <p className="text-sm font-semibold tracking-tight">Verifying Auditor Session...</p>
          <p className="text-xs text-muted-foreground">Nutrition Claim Verifier</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

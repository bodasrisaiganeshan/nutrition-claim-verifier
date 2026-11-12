"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ScanSearch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Database,
  RefreshCw,
  Award,
} from "lucide-react";
import { fetchStats, StatsResponse } from "@/lib/api";
import { getSession, User } from "@/lib/auth";

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load live statistics from Render backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getSession());
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <Award className="size-3.5" />
            <span>Official FSSAI Phase-1 Audit Dataset</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Nutrition Claim Audit Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auditing front-of-pack claims on Indian packaged foods against declared nutrient values and ingredients.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <ScanSearch className="size-4" />
            <span>Verify New Product</span>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline text-xs font-semibold">
            Try again
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Products */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Audited
            </span>
            <span className="p-2 rounded-xl bg-secondary text-primary">
              <Database className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-foreground">
            {stats ? stats.products_analysed : 25}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Packaged food products in Indian FMCG audit</p>
        </div>

        {/* Legal Compliance */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Technically Compliant
            </span>
            <span className="p-2 rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-success">
            {stats ? `${stats.compliant_percentage}%` : "84.0%"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats ? `${stats.compliant_count} of ${stats.products_analysed} products satisfy literal rules` : "21 of 25 products"}
          </p>
        </div>

        {/* Non-Compliant */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Outright Non-Compliant
            </span>
            <span className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-destructive">
            {stats ? `${stats.non_compliant_percentage}%` : "16.0%"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats ? `${stats.non_compliant_count} products fail explicit FSSAI limits` : "4 of 25 products fail"}
          </p>
        </div>

        {/* High Misleading Risk */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              High Deceptive Risk
            </span>
            <span className="p-2 rounded-xl bg-warning/10 text-warning">
              <ShieldAlert className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-warning">
            {stats ? `${Math.round((stats.risk_breakdown.high / stats.products_analysed) * 100)}%` : "36.0%"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats ? `${stats.risk_breakdown.high} products have severe loopholes/hidden sugars` : "9 products with severe loopholes"}
          </p>
        </div>
      </div>

      {/* Grid: Category Breakdown + Misleading Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown (2 columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Compliance by FMCG Category</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share of products meeting official FSSAI nutrient thresholds
              </p>
            </div>
            <Link href="/dataset" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <span>View All 25</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-4">
            {stats?.categories?.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{cat.category}</span>
                  <span className="text-muted-foreground">
                    {cat.total - cat.non_compliant}/{cat.total} Compliant ({cat.compliance_rate}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${cat.compliance_rate}%` }}
                  />
                </div>
              </div>
            )) || (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading category distribution...</p>
            )}
          </div>
        </div>

        {/* Misleading Risk Breakdown (1 column) */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Misleading Risk Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consumer expectation vs. back-of-pack reality
            </p>

            <div className="mt-6 space-y-4">
              <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-destructive" />
                    High Risk Loopholes
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Masked sugar, palm oil, refined flour</p>
                </div>
                <span className="text-xl font-bold text-destructive">
                  {stats?.risk_breakdown.high ?? 9}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-warning/20 bg-warning/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-warning flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-warning" />
                    Moderate Risk
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">High natural sugar, vague healthy terms</p>
                </div>
                <span className="text-xl font-bold text-warning">
                  {stats?.risk_breakdown.moderate ?? 12}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-success/20 bg-success/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-success flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-success" />
                    Low Risk / Clean
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Fully backed by ingredients & macros</p>
                </div>
                <span className="text-xl font-bold text-success">
                  {stats?.risk_breakdown.low ?? 4}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-muted/60 text-[11px] text-muted-foreground leading-relaxed border border-border">
            <strong>Key Finding:</strong> 84% of products comply with literal FSSAI rules, yet 84% (21/25) exhibit moderate-to-high deceptive framing.
          </div>
        </div>
      </div>

      {/* Recent Audits Table */}
      <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Recent Audited Products</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live records from the 25-product Indian FMCG benchmark dataset
            </p>
          </div>
          <Link
            href="/dataset"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>Explore full dataset</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-5 py-3 font-semibold">ID</th>
                <th className="px-5 py-3 font-semibold">Product Name</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Front Claim</th>
                <th className="px-5 py-3 font-semibold">Legal Verdict</th>
                <th className="px-5 py-3 font-semibold">Misleading Severity</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats?.recent_analyses?.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-muted-foreground font-medium">{p.id}</td>
                  <td className="px-5 py-3.5 font-semibold text-foreground max-w-xs truncate">
                    {p.product_name}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{p.category}</td>
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-primary font-semibold">
                      {p.claim}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium ${
                        p.is_compliant
                          ? "bg-success/10 text-success border border-success/30"
                          : "bg-destructive/10 text-destructive border border-destructive/30"
                      }`}
                    >
                      {p.is_compliant ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                      {p.is_compliant ? "Compliant" : "Non-Compliant"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        p.severity.toLowerCase() === "high"
                          ? "bg-destructive/10 text-destructive"
                          : p.severity.toLowerCase() === "low"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {p.severity} Risk
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/verify?prefill=${encodeURIComponent(p.product_name)}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      <span>Audit</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    Loading recent audits...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

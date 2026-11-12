"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ShieldCheck, ArrowRight, CheckCircle2, Lock, Mail, Building, UserCheck, AlertTriangle } from "lucide-react";
import { loginUser, requestAccess, isAuthenticated, DEMO_USERS, User } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"signin" | "request">("signin");

  // Sign In Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request Access Form State
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqOrg, setReqOrg] = useState("");
  const [reqRole, setReqRole] = useState<User["role"]>("Academic / Research Auditor");
  const [reqUseCase, setReqUseCase] = useState("University Research Experience (URE) audit of Indian FMCG front-of-pack claims");

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/");
    }
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginUser(email, password);
      if (result.success) {
        router.push("/");
      } else {
        setError(result.error || "Failed to sign in. Please verify your credentials.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await requestAccess({
        name: reqName,
        email: reqEmail,
        organization: reqOrg,
        role: reqRole,
        useCase: reqUseCase,
      });
      if (result.success) {
        router.push("/");
      } else {
        setError(result.error || "Unable to register request. Please check your fields.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (demoEmail: string) => {
    const demo = DEMO_USERS[demoEmail];
    if (demo) {
      setEmail(demoEmail);
      setPassword(demo.pass);
      setError(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Column: Standalone Authentication Flow */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-14 max-w-2xl mx-auto">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Leaf className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-tight">
              Nutrition Claim Verifier
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              FSSAI Food Label Audit & Deception Detection
            </p>
          </div>
        </div>

        {/* Auth Box */}
        <div className="my-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {activeTab === "signin" ? "Auditor Sign In" : "Request Research Access"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {activeTab === "signin"
                ? "Sign in to audit front-of-pack claims against official FSSAI nutrient thresholds."
                : "Submit institutional credentials to obtain an audit session token."}
            </p>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "signin"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("request");
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "request"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Request Access / Register
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "signin" ? (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="login-email">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <Mail className="size-4 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="auditor@fssai-audit.ac.in"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="login-password">
                    Password
                  </label>
                  <span className="text-[11px] text-muted-foreground">Demo: audit2026</span>
                </div>
                <div className="relative">
                  <Lock className="size-4 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Remember session on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Audit Workspace</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              {/* Quick Fill Demo Roles */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Quick Access (Preconfigured Roles):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials("auditor@fssai-audit.ac.in")}
                    className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] font-medium text-foreground transition-colors"
                  >
                    🎓 Lead Research Auditor
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials("consumer@safefood.org")}
                    className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] font-medium text-foreground transition-colors"
                  >
                    🛡️ Consumer Advocate
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials("regulatory@compliance.in")}
                    className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] font-medium text-foreground transition-colors"
                  >
                    🏢 Brand Compliance
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestAccess} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1" htmlFor="req-name">
                  Full Name
                </label>
                <input
                  id="req-name"
                  type="text"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  required
                  placeholder="e.g. Dr. Arpita Sen"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1" htmlFor="req-email">
                  Work / University Email
                </label>
                <input
                  id="req-email"
                  type="email"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  required
                  placeholder="researcher@university.edu.in"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1" htmlFor="req-org">
                  Institution / Organization
                </label>
                <input
                  id="req-org"
                  type="text"
                  value={reqOrg}
                  onChange={(e) => setReqOrg(e.target.value)}
                  required
                  placeholder="e.g. University Food Technology Department"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1" htmlFor="req-role">
                  Auditor Role
                </label>
                <select
                  id="req-role"
                  value={reqRole}
                  onChange={(e) => setReqRole(e.target.value as User["role"])}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Academic / Research Auditor">Academic / Research Auditor</option>
                  <option value="Consumer Advocate">Consumer Advocate</option>
                  <option value="Food Brand Compliance Officer">Food Brand Compliance Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1" htmlFor="req-usecase">
                  Intended Research Use Case
                </label>
                <input
                  id="req-usecase"
                  type="text"
                  value={reqUseCase}
                  onChange={(e) => setReqUseCase(e.target.value)}
                  placeholder="Auditing front-of-pack claims on Indian packaged foods"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Registering Request..." : "Register & Enter Workspace"}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-border/80 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>FSSAI (Labelling & Display) Regulations, 2020</span>
          <span>URE Research Phase 1</span>
        </div>
      </div>

      {/* Right Column: Hero Visuals and Research Context */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sidebar-accent via-background to-secondary/60 border-l border-border flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-success/5 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-primary">
          <ShieldCheck className="size-4" />
          <span>Grounded Food Safety Verification</span>
        </div>

        <div className="max-w-lg space-y-6 my-auto">
          <blockquote className="text-2xl font-bold leading-snug tracking-tight text-foreground">
            “‘High fibre’, ‘no added sugar’, ‘low fat’ — every claim checked against the numbers on the back of the pack.”
          </blockquote>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Many packaged foods sold in India display appealing health claims on the front while masking high sugar, refined starches, or palm oil on the back. This research auditor provides deterministic compliance checks and grounded AI explanations.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="p-3.5 rounded-xl border border-border bg-card/90 shadow-2xs">
              <p className="text-xl font-bold text-foreground">25 Products</p>
              <p className="text-xs text-muted-foreground mt-0.5">Audited Indian FMCG dataset</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card/90 shadow-2xs">
              <p className="text-xl font-bold text-foreground">9 Rules</p>
              <p className="text-xs text-muted-foreground mt-0.5">FSSAI Phase-1 thresholds</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card/90 shadow-2xs">
              <p className="text-xl font-bold text-primary">Dual Verdict</p>
              <p className="text-xs text-muted-foreground mt-0.5">Legal status + Misleading risk</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card/90 shadow-2xs">
              <p className="text-xl font-bold text-foreground">Groq AI</p>
              <p className="text-xs text-muted-foreground mt-0.5">Grounded, deterministic explanations</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>URE Research Project · University Academic Demo</span>
          <span>Open Source Food Audit</span>
        </div>
      </div>
    </div>
  );
}

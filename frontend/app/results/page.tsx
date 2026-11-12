"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  Download,
  Printer,
  Info,
  ChevronRight,
  ExternalLink,
  Layers,
} from "lucide-react";
import { VerifyResponse } from "@/lib/api";

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [productInput, setProductInput] = useState<{
    product_name?: string;
    category?: string;
    claim?: string;
    foodForm?: string;
    nutrients?: Record<string, number>;
    ingredients?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const rawRes = sessionStorage.getItem("ncv_active_verification");
      const rawInput = sessionStorage.getItem("ncv_product_input");
      if (rawRes) {
        setResult(JSON.parse(rawRes));
      }
      if (rawInput) {
        setProductInput(JSON.parse(rawInput));
      }
    } catch (e) {
      console.error("Failed to parse verification session", e);
    }
  }, []);

  const handleExportJson = () => {
    if (!result) return;
    const exportData = {
      product: productInput,
      verification: result,
      audit_timestamp: new Date().toISOString(),
      standard: "FSSAI (Advertising & Claims) Regulations, 2018 (amended 2020)",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NCV_Audit_${(productInput?.product_name || "Product").replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="size-12 rounded-2xl bg-secondary text-primary mx-auto flex items-center justify-center">
          <Layers className="size-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">No Active Audit Result Found</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Please submit a product for verification or explore the benchmark dataset.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/verify"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
          >
            Go to Product Verification
          </Link>
          <Link
            href="/dataset"
            className="px-4 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted"
          >
            View 25 Audited Products
          </Link>
        </div>
      </div>
    );
  }

  const isCompliant = result.verdict === "Compliant";
  const isMisleading = result.verdict === "Technically Compliant but Misleading";
  const isNonCompliant = result.verdict === "Non-Compliant";

  const productName = productInput?.product_name || "Audited Food Product";
  const category = productInput?.category || "Packaged Food";
  const testedClaim = result.claim || productInput?.claim || "Nutrition Claim";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Verification Input</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {productName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary font-semibold text-primary">
              {category}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Audited Claim: <strong className="text-foreground">“{testedClaim}”</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Download className="size-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Printer className="size-3.5" />
            <span>Print Report</span>
          </button>
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <span>Audit Another</span>
          </Link>
        </div>
      </div>

      {/* DUAL VERDICT BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Legal Compliance Status */}
        <div
          className={`rounded-2xl border p-6 shadow-2xs flex flex-col justify-between ${
            isCompliant
              ? "border-success/30 bg-success/5"
              : isMisleading
              ? "border-warning/30 bg-warning/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                FSSAI Legal Status
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isCompliant
                    ? "bg-success/20 text-success"
                    : isMisleading
                    ? "bg-warning/20 text-warning"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {isCompliant ? (
                  <CheckCircle2 className="size-3.5" />
                ) : isMisleading ? (
                  <AlertTriangle className="size-3.5" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                {result.verdict}
              </span>
            </div>

            <p className="mt-3 text-lg font-bold text-foreground">
              {isCompliant
                ? "Claim complies with official nutrient limit"
                : isMisleading
                ? "Technically meets literal rule, but deceptive loophole detected"
                : "Claim fails mandatory FSSAI regulatory threshold"}
            </p>
          </div>

          <p className="mt-4 text-xs text-muted-foreground pt-3 border-t border-border/60">
            FSSAI (Advertising & Claims) Regulations, 2018 (amended 2020)
          </p>
        </div>

        {/* Card B: Misleading Risk Level */}
        <div
          className={`rounded-2xl border p-6 shadow-2xs flex flex-col justify-between ${
            result.misleading_risk.level === "High Risk"
              ? "border-destructive/30 bg-destructive/5"
              : result.misleading_risk.level === "Moderate Risk"
              ? "border-warning/30 bg-warning/5"
              : "border-success/30 bg-success/5"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Consumer Misleading Risk
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-foreground"
                style={{ backgroundColor: `${result.misleading_risk.color}20`, color: result.misleading_risk.color }}
              >
                <span>{result.misleading_risk.badge}</span>
                {result.misleading_risk.level}
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold text-foreground leading-relaxed">
              {result.misleading_risk.reason}
            </p>
          </div>

          <p className="mt-4 text-xs text-muted-foreground pt-3 border-t border-border/60">
            Framing, omission of negative nutrients & consumer perception audit
          </p>
        </div>
      </div>

      {/* Section 1: Plain-Language Grounded Explanation */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Why this claim passes or fails</h2>
              <p className="text-xs text-muted-foreground">
                Plain-language analysis grounded in official rules and label facts
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              result.explanation_source === "groq"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {result.explanation_source === "groq"
              ? `Groq AI (${result.model_used || "Grounded"})`
              : "Rule Engine Template"}
          </span>
        </div>

        <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line space-y-2 font-sans bg-secondary/30 p-4 rounded-xl border border-border/60">
          {result.explanation}
        </div>

        {result.explanation_source === "template" && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Info className="size-3" />
            <span>
              Deterministic rule template used. Configure <code>GROQ_API_KEY</code> on Render to enable live Groq LLM reasoning.
            </span>
          </p>
        )}
      </div>

      {/* Section 2: FSSAI Rule Engine Breakdown */}
      <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border">
          <h2 className="text-base font-bold text-foreground">FSSAI Regulatory Rule Checks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Individual rule evaluations from the deterministic compliance engine
          </p>
        </div>

        <div className="divide-y divide-border">
          {result.checks && result.checks.length > 0 ? (
            result.checks.map((check, idx) => (
              <div key={idx} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {check.rule_id}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {check.claim_name}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      check.status === "pass"
                        ? "bg-success/10 text-success"
                        : check.status === "misleading"
                        ? "bg-warning/10 text-warning"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {check.status === "pass" ? "Passed" : check.status === "misleading" ? "Misleading" : "Failed"}
                  </span>
                </div>

                <p className="text-xs text-foreground font-medium">{check.message}</p>

                {check.evidence && check.evidence.length > 0 && (
                  <div className="pt-1">
                    <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5">
                      {check.evidence.map((ev, eIdx) => (
                        <li key={eIdx}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-5 text-xs text-muted-foreground text-center">
              No specific rule failures flagged for this claim.
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Declared Nutrients & Ingredients Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nutrients Table */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Declared Nutrients (per 100 {productInput?.foodForm === "liquid" ? "ml" : "g"})
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {productInput?.nutrients && Object.keys(productInput.nutrients).length > 0 ? (
              Object.entries(productInput.nutrients).map(([k, v]) => (
                <div key={k} className="p-2.5 rounded-lg border border-border bg-secondary/20 flex justify-between">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-bold text-foreground">{v}</span>
                </div>
              ))
            ) : (
              <p className="col-span-2 text-xs text-muted-foreground">No numerical values declared.</p>
            )}
          </div>
        </div>

        {/* Ingredients Text */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Declared Ingredients
            </h3>
            <p className="text-xs font-mono text-foreground leading-relaxed bg-secondary/20 p-3 rounded-lg border border-border">
              {productInput?.ingredients || "No ingredients entered."}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Scanned for hidden sweeteners, hydrogenated oils, palm oil, and maida.
          </p>
        </div>
      </div>

      {/* Section 4: Similar Products from FMCG Dataset */}
      {result.similar_products && result.similar_products.length > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Similar Products in Curated FMCG Dataset
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real benchmark products with matching claims or deceptive mechanisms
              </p>
            </div>
            <Link href="/dataset" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <span>View full dataset</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {result.similar_products.map((p, idx) => (
              <div key={idx} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/30 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-foreground">{p.product_name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-primary font-semibold">
                      {p.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Claim: <strong className="text-foreground">“{p.front_claim}”</strong>
                    {p.match_reason && <span> · Match reason: {p.match_reason}</span>}
                  </p>
                  {p.deceptive_mechanism && (
                    <p className="text-[11px] text-foreground/80 mt-1">
                      ⚠️ Loophole: {p.deceptive_mechanism}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      p.is_technically_compliant
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {p.is_technically_compliant ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                    {p.is_technically_compliant ? "Compliant" : "Non-Compliant"}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-1 rounded-md ${
                      p.severity_level?.toLowerCase() === "high"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {p.severity_level || "Medium"} Risk
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

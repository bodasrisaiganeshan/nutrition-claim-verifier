export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://nutrition-claim-verifier-api.onrender.com";

export interface HealthResponse {
  status: string;
  dataset_products: number;
  supported_claims: number;
}

export interface StatsResponse {
  products_analysed: number;
  compliant_count: number;
  compliant_percentage: number;
  non_compliant_count: number;
  non_compliant_percentage: number;
  cannot_determine_count: number;
  risk_breakdown: {
    high: number;
    moderate: number;
    low: number;
  };
  categories: Array<{
    category: string;
    total: number;
    non_compliant: number;
    compliance_rate: number;
  }>;
  recent_analyses: Array<{
    id: string;
    product_name: string;
    category: string;
    claim: string;
    is_compliant: boolean;
    severity: string;
    deceptive_mechanism: string;
  }>;
}

export interface ProductRecord {
  id: number;
  product_name: string;
  category: string;
  front_claim: string;
  ingredients: string;
  is_technically_compliant: boolean;
  deceptive_mechanism: string;
  severity_level: string;
  nutrients: Record<string, number>;
  form: string;
}

export interface RuleCheck {
  rule_id: string;
  claim_name: string;
  status: "pass" | "fail" | "misleading" | "vague" | "prohibited";
  message: string;
  evidence: string[];
}

export interface VerifyResponse {
  verdict: "Compliant" | "Technically Compliant but Misleading" | "Non-Compliant" | "Insufficient Data";
  verdict_color: string;
  verdict_badge: string;
  misleading_risk: {
    level: "Low Risk" | "Moderate Risk" | "High Risk" | "Uncertain";
    color: string;
    badge: string;
    reason: string;
  };
  claim: string;
  form: string;
  warnings: string[];
  checks: RuleCheck[];
  explanation: string;
  explanation_source: "groq" | "template";
  model_used?: string;
  fallback_reason?: string;
  similar_products: Array<{
    product_name: string;
    front_claim: string;
    is_technically_compliant: boolean;
    deceptive_mechanism: string;
    severity_level: string;
    match_reason: string;
    category: string;
  }>;
}

export interface OcrResponse {
  success: boolean;
  engine: string;
  lines: string[];
  ingredients: string;
  nutrients: Record<string, number>;
  basis: string;
  form: string;
  full_text: string;
  error?: string;
  message?: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/api/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stats fetch failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchDataset(category?: string, compliant?: boolean): Promise<{ products: ProductRecord[]; total: number }> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (compliant !== undefined) params.set("compliant", String(compliant));

  const url = `${API_BASE}/api/dataset${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Dataset fetch failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchSupportedClaims(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/claims`, { cache: "no-store" });
  if (!res.ok) return [
    "No Added Sugar",
    "Sugar Free",
    "Low Sugar",
    "High Protein",
    "Source of Protein",
    "High Fibre",
    "Source of Fibre",
    "Low Fat",
    "Fat Free",
  ];
  const data = await res.json();
  return data.claims || [];
}

export async function runVerify(payload: {
  claim: string;
  ingredients: string;
  nutrients: Record<string, number>;
  form?: string;
  basis?: string;
  full_text?: string;
  category?: string;
  product_name?: string;
  product_id?: number;
}): Promise<VerifyResponse> {
  const res = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Verification failed (${res.status}): ${errorText}`);
  }
  return res.json();
}

export async function runOcr(imageFile: File): Promise<OcrResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);

  const res = await fetch(`${API_BASE}/api/ocr`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.message || `OCR extraction failed with HTTP ${res.status}`);
  }
  return data;
}

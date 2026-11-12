"""
api.py
------
FastAPI REST backend for the Nutrition Claim Verifier.

Exposes the Python rule engine, Groq AI explanations, 25-product dataset,
OCR and similar-product search as JSON endpoints that any frontend can call.

Run locally:
    .venv\\Scripts\\python -m uvicorn api:app --reload --port 8000

Endpoints:
    GET  /                        health check
    GET  /api/health              health check (JSON)
    GET  /api/claims              list of supported claim types
    GET  /api/dataset             full 25-product dataset
    POST /api/verify              run the rule engine + AI explanation
    POST /api/ocr                 upload image, get extracted label data
    GET  /api/similar             find similar products by claim / category
"""

import base64
import io
import json
import logging
import os
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# --- project imports --------------------------------------------------------
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from rule_engine import verify_claim, supported_claims, V_NON_COMPLIANT, V_MISLEADING, V_COMPLIANT
from dataset_utils import load_dataset, row_nutrients, row_form, find_similar, NUTRIENT_COLUMNS
from llm_utils import generate_explanation, last_status

# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("api")

# ---------------------------------------------------------------------------
# App & CORS
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Nutrition Claim Verifier API",
    description="FSSAI Phase-1 rule engine + Groq AI explanations + 25-product dataset",
    version="1.0.0",
)

# Allow requests from the Vercel frontend and localhost dev
ALLOWED_ORIGINS = [
    "https://nutrition-claim-verifier-ui.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache dataset once at startup
_df = None


def get_dataset():
    global _df
    if _df is None:
        _df = load_dataset()
    return _df


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class VerifyRequest(BaseModel):
    claim: str = Field(..., description="Front-of-pack claim text e.g. 'No Added Sugar'")
    ingredients: str = Field("", description="Ingredients list text")
    nutrients: dict = Field(default_factory=dict, description="Nutrient values per 100 g/ml")
    form: str = Field("solid", description="'solid' or 'liquid'")
    basis: str = Field("per_100", description="'per_100' or 'per_serving'")
    full_text: Optional[str] = Field(None, description="Full OCR text (for disclaimer check)")
    category: Optional[str] = Field(None, description="Product category (for similar products)")
    product_id: Optional[int] = Field(None, description="Dataset product ID to exclude from similar")
    product_name: Optional[str] = Field(None, description="Product name for context")
    deceptive_mechanism: Optional[str] = Field(None, description="Known deceptive mechanism (dataset)")


def _verdict_color(verdict):
    colors = {
        V_NON_COMPLIANT: "red",
        V_MISLEADING: "amber",
        V_COMPLIANT: "green",
    }
    return colors.get(verdict, "gray")


def _verdict_badge(verdict):
    icons = {
        V_NON_COMPLIANT: "❌",
        V_MISLEADING: "⚠️",
        V_COMPLIANT: "✅",
    }
    return icons.get(verdict, "ℹ️")


def compute_misleading_risk(verdict, product_extra=None):
    """
    Separates legal compliance from consumer deception risk:
    - High Risk: known deceptive mechanism, soft-deny masking ingredient, or outright non-compliance
    - Moderate Risk: vague claim or technically compliant with loopholes
    - Low Risk: clean ingredients, genuine compliance, no deception
    - Uncertain: insufficient data to determine
    """
    if product_extra and product_extra.get("severity_level"):
        sev = str(product_extra["severity_level"]).strip().lower()
        if sev == "high":
            return {
                "level": "High Risk",
                "color": "#c0392b",
                "badge": "🚨",
                "reason": product_extra.get("deceptive_mechanism") or "High deceptive loophole detected.",
            }
        elif sev in ("medium", "moderate"):
            return {
                "level": "Moderate Risk",
                "color": "#d68910",
                "badge": "⚠️",
                "reason": product_extra.get("deceptive_mechanism") or "Moderate consumer expectation gap.",
            }

    has_misleading = any(c.status == "misleading" for c in verdict.checks)
    has_vague = any(c.status == "vague" for c in verdict.checks)
    has_fail = any(c.status in ("fail", "prohibited") for c in verdict.checks)

    if has_misleading or has_fail:
        return {
            "level": "High Risk",
            "color": "#c0392b",
            "badge": "🚨",
            "reason": "Ingredients or framing conflict with consumer expectations or regulatory limits.",
        }
    elif has_vague or verdict.verdict == V_MISLEADING:
        return {
            "level": "Moderate Risk",
            "color": "#d68910",
            "badge": "⚠️",
            "reason": "Technically compliant or vague claim terms that may mislead consumers.",
        }
    elif verdict.verdict == V_COMPLIANT:
        return {
            "level": "Low Risk",
            "color": "#1e8449",
            "badge": "🛡️",
            "reason": "Claim is supported by declared nutrition facts and ingredients.",
        }
    else:
        return {
            "level": "Uncertain",
            "color": "#566573",
            "badge": "ℹ️",
            "reason": "Insufficient label facts to evaluate misleading risk.",
        }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def root():
    return {"status": "ok", "app": "Nutrition Claim Verifier API v1.0"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "dataset_products": len(get_dataset()),
        "supported_claims": len(supported_claims()),
    }


@app.get("/api/claims")
def get_claims():
    """Return list of supported claim types for dropdowns."""
    return {"claims": supported_claims()}


@app.get("/api/dataset")
def get_dataset_route(category: Optional[str] = None, compliant: Optional[bool] = None):
    """Return all 25 products (optionally filtered)."""
    df = get_dataset()
    if category:
        df = df[df["category"].str.lower() == category.lower()]
    if compliant is not None:
        df = df[df["is_technically_compliant"] == compliant]

    records = []
    for _, row in df.iterrows():
        rec = {
            "id": int(row["id"]),
            "product_name": row["product_name"],
            "category": row["category"],
            "front_claim": row["front_claim"],
            "ingredients": row.get("ingredients", ""),
            "is_technically_compliant": bool(row["is_technically_compliant"]),
            "deceptive_mechanism": row.get("deceptive_mechanism", ""),
            "severity_level": row.get("severity_level", ""),
            "nutrients": {
                col: float(row[col]) for col in NUTRIENT_COLUMNS if str(row.get(col, "")) not in ("", "nan")
            },
            "form": row_form(row),
        }
        records.append(rec)
    return {"products": records, "total": len(records)}


@app.post("/api/verify")
def verify(req: VerifyRequest):
    """
    Run the FSSAI rule engine on the provided claim + label data.
    Returns the verdict, all rule checks, an AI explanation, and similar products.
    """
    # 1. Rule engine (always deterministic, never the AI)
    verdict = verify_claim(
        claim=req.claim,
        ingredients=req.ingredients,
        nutrients=req.nutrients,
        form=req.form,
        basis=req.basis,
        full_text=req.full_text,
    )

    # 2. Find similar products from the dataset
    df = get_dataset()
    similar_df = find_similar(df, req.claim, category=req.category, exclude_id=req.product_id, k=3)
    similar = [
        {
            "product_name": r["product_name"],
            "front_claim": r["front_claim"],
            "is_technically_compliant": bool(r["is_technically_compliant"]),
            "deceptive_mechanism": r.get("deceptive_mechanism", ""),
            "severity_level": r.get("severity_level", ""),
            "match_reason": r.get("match_reason", ""),
            "category": r.get("category", ""),
        }
        for _, r in similar_df.iterrows()
    ]

    # 3. AI explanation (or template fallback — verdict is NOT modified)
    product_ctx = {
        "claim": req.claim,
        "ingredients": req.ingredients,
        "nutrients_per_100": req.nutrients,
        "form": req.form,
    }
    if req.product_name:
        product_ctx["product_name"] = req.product_name
    if req.deceptive_mechanism:
        product_ctx["deceptive_mechanism"] = req.deceptive_mechanism

    explanation, explanation_source = generate_explanation(verdict, product_ctx, similar)
    model_used = last_status.get("model")
    fallback_reason = last_status.get("reason")
    risk = compute_misleading_risk(verdict, product_ctx)

    # 4. Build response
    return {
        "verdict": verdict.verdict,
        "verdict_color": _verdict_color(verdict.verdict),
        "verdict_badge": _verdict_badge(verdict.verdict),
        "misleading_risk": risk,
        "claim": verdict.claim,
        "form": verdict.form,
        "warnings": verdict.warnings,
        "checks": [
            {
                "rule_id": c.rule_id,
                "claim_name": c.claim_name,
                "status": c.status,
                "message": c.message,
                "evidence": c.evidence,
            }
            for c in verdict.checks
        ],
        "explanation": explanation,
        "explanation_source": explanation_source,
        "model_used": model_used,
        "fallback_reason": fallback_reason,
        "similar_products": similar,
    }


@app.get("/api/stats")
def get_dashboard_stats():
    """
    Computes live dashboard statistics from the 25-product audited dataset,
    matching the metrics expected by the dashboard view.
    """
    df = get_dataset()
    total = len(df)
    compliant = int(df["is_technically_compliant"].sum())
    non_compliant = total - compliant
    high_risk = int((df["severity_level"].astype(str).str.lower() == "high").sum())
    moderate_risk = int((df["severity_level"].astype(str).str.lower().isin(["medium", "moderate"])).sum())
    low_risk = total - high_risk - moderate_risk

    # Category breakdown
    cat_counts = df["category"].value_counts().to_dict()
    cat_non_comp = df[~df["is_technically_compliant"]]["category"].value_counts().to_dict()
    category_breakdown = [
        {
            "category": cat,
            "total": count,
            "non_compliant": cat_non_comp.get(cat, 0),
            "compliance_rate": round(((count - cat_non_comp.get(cat, 0)) / count) * 100, 1),
        }
        for cat, count in cat_counts.items()
    ]

    # Recent audited products list for the dashboard table
    recent = []
    for _, r in df.head(5).iterrows():
        recent.append({
            "id": f"NCV-{int(r['id']):04d}",
            "product_name": r["product_name"],
            "category": r["category"],
            "claim": r["front_claim"],
            "is_compliant": bool(r["is_technically_compliant"]),
            "severity": r.get("severity_level", "Medium"),
            "deceptive_mechanism": r.get("deceptive_mechanism", ""),
        })

    return {
        "products_analysed": total,
        "compliant_count": compliant,
        "compliant_percentage": round((compliant / total) * 100, 1),
        "non_compliant_count": non_compliant,
        "non_compliant_percentage": round((non_compliant / total) * 100, 1),
        "cannot_determine_count": 0,
        "risk_breakdown": {
            "high": high_risk,
            "moderate": moderate_risk,
            "low": low_risk,
        },
        "categories": category_breakdown,
        "recent_analyses": recent,
    }


@app.post("/api/ocr")
async def ocr_image(image: UploadFile = File(...)):
    """
    Upload a label photo. Returns extracted ingredients, nutrients, basis and form.
    Falls back gracefully if OCR engines are not available.
    """
    try:
        import ocr_utils
        from PIL import Image

        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        lines, engine_name = ocr_utils.extract_text(pil_image)
        parsed = ocr_utils.parse_label(lines)
        return {
            "success": True,
            "engine": engine_name,
            "lines": lines,
            "ingredients": parsed["ingredients"],
            "nutrients": parsed["nutrients"],
            "basis": parsed["basis"],
            "form": parsed["form"],
            "full_text": parsed["full_text"],
        }
    except ocr_utils.OCRUnavailable as exc:
        return JSONResponse(status_code=503, content={
            "success": False,
            "error": "ocr_unavailable",
            "message": str(exc),
        })
    except Exception as exc:
        log.exception("OCR failed")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": "ocr_error",
            "message": str(exc),
        })


@app.get("/api/similar")
def get_similar(claim: str, category: Optional[str] = None, exclude_id: Optional[int] = None, k: int = 3):
    """Find similar products from the dataset by claim type and category."""
    df = get_dataset()
    similar_df = find_similar(df, claim, category=category, exclude_id=exclude_id, k=k)
    products = [
        {
            "id": int(r["id"]),
            "product_name": r["product_name"],
            "category": r["category"],
            "front_claim": r["front_claim"],
            "is_technically_compliant": bool(r["is_technically_compliant"]),
            "deceptive_mechanism": r.get("deceptive_mechanism", ""),
            "severity_level": r.get("severity_level", ""),
            "match_reason": r.get("match_reason", ""),
        }
        for _, r in similar_df.iterrows()
    ]
    return {"similar_products": products, "total": len(products)}


# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)


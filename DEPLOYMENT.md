# Deployment & Integration Guide
## Nutrition Claim Verifier — Full Stack Application Guide

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS VERCEL FRONTEND                      │
│             nutrition-claim-verifier-ui.vercel.app              │
│   (Standalone /login, Dashboard, Verify, Results, Dataset)      │
│   Source code located in: /frontend                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │ REST API (JSON / Multipart)
                                 │ NEXT_PUBLIC_API_URL
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (api.py)                     │
│        Hosted on Render: nutrition-claim-verifier-api           │
├─────────────────────────────────────────────────────────────────┤
│ • GET  /api/health      • GET  /api/stats    • GET  /api/claims │
│ • GET  /api/dataset     • POST /api/verify   • POST /api/ocr    │
│ • GET  /api/similar                                             │
└───────────────┬────────────────────────────────┬────────────────┘
                │                                │
                ▼                                ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│       FSSAI RULE ENGINE       │  │        GROQ AI ENGINE         │
│       (rule_engine.py)        │  │        (llm_utils.py)         │
│ • Deterministic thresholds    │  │ • Strictly grounded facts     │
│ • Phase-1 FSSAI JSON rules    │  │ • openai/gpt-oss-120b model   │
│ • Misleading-risk assessment  │  │ • Deterministic rule template │
│ • Unverifiable/vague detector │  │   fallback on error/offline   │
└───────────────────────────────┘  └───────────────────────────────┘
```

---

## 2. Deploying the Updated Frontend on Vercel

The full Next.js App Router frontend source code is committed in the `/frontend` directory of:
`https://github.com/bodasrisaiganeshan/nutrition-claim-verifier`

### Deploy via Vercel Dashboard (Recommended)

1. Open your [Vercel Dashboard](https://vercel.com/dashboard).
2. Open the project **`nutrition-claim-verifier-ui`** (or import `bodasrisaiganeshan/nutrition-claim-verifier` as a new project).
3. Under **Settings** -> **General**:
   - Set **Root Directory** to: `frontend`
   - Framework Preset: **Next.js**
   - Build Command: `next build`
   - Output Directory: `.next`
4. Under **Settings** -> **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://nutrition-claim-verifier-api.onrender.com`
5. Click **Deploy / Redeploy**.

---

## 3. Live Deployment Status & Health Checks

| Component | Target URL | Health Status |
|-----------|------------|---------------|
| **Backend API (Render)** | `https://nutrition-claim-verifier-api.onrender.com` | ✅ Live (200 OK) |
| **Backend Health Check** | `https://nutrition-claim-verifier-api.onrender.com/api/health` | ✅ Live (25 products, 9 claims) |
| **Backend Stats API** | `https://nutrition-claim-verifier-api.onrender.com/api/stats` | ✅ Live (84% compliant, 16% non-compliant) |
| **Frontend UI (Vercel)** | `https://nutrition-claim-verifier-ui.vercel.app` | Updated Next.js application |
| **GitHub Repository** | `https://github.com/bodasrisaiganeshan/nutrition-claim-verifier` | Production master branch |

---

## 4. Authentication & Session Architecture

### Standalone Sign-In Landing Page (`/login`)
- Replaced the intrusive popup dialog with a dedicated, professional landing page.
- Branding correctly updated to **Nutrition Claim Verifier** (removed legacy "LabelCheck" branding).
- Two operational modes:
  1. **Auditor Sign In**: Validates institutional credentials and creates a persistent session token.
  2. **Request Research Access**: Allows academic auditors, consumer advocates, and brand compliance officers to register their research use case and instantly receive a session token.
- Preconfigured Demo Auditor profiles available with one click:
  - Lead Auditor: `auditor@fssai-audit.ac.in` / `audit2026`
  - Consumer Advocate: `consumer@safefood.org` / `consumer2026`
  - Food Brand Compliance: `regulatory@compliance.in` / `fssai2026`
- **Route Guard**: The `AuthGuard` component intercepts unauthenticated visits to `/`, `/verify`, `/results`, and `/dataset`, redirecting immediately to `/login`.
- **Sign-Out Flow**: The sidebar and top navigation include an explicit "Sign Out" button that clears session tokens and returns the user to `/login`.

---

## 5. End-to-End Verification Flow

1. **User enters product name and selects/types a front-of-pack claim** (e.g. Lay's potato chips, "No Added Sugar").
2. **User uploads back-of-pack label photo** (optional):
   - "Run OCR" calls `POST /api/ocr` on the Render backend.
   - RapidOCR/PaddleOCR extracts ingredients and declared nutrients.
   - Values auto-populate into editable input fields.
3. **User clicks "Verify Claim against FSSAI Rules"**:
   - `POST /api/verify` executes the deterministic rule engine.
   - Evaluates mandatory thresholds, hidden sweetener keywords, and positive/negative nutrient ratios.
   - Identifies similar products from the 25-product Indian FMCG benchmark dataset.
   - Generates plain-language explanation (Groq AI `openai/gpt-oss-120b` or deterministic template fallback).
   - AI is strictly prohibited from altering the rule engine's legal verdict.
4. **Results Page (`/results`)**:
   - Displays real user-submitted product name and claim (eliminates static "Baked Ragi Chips" mock).
   - Dual Verdict banner: Legal compliance + Consumer misleading risk level.
   - Nutrient comparison table and detected ingredient flags.
   - Export audit report as JSON or print summary.

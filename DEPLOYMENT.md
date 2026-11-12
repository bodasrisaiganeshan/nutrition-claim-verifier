# Deployment & Integration Guide
## Nutrition Claim Verifier — Frontend & Backend Integration

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS VERCEL FRONTEND                      │
│             nutrition-claim-verifier-ui.vercel.app              │
│   (Dashboard, Verify Product, OCR Upload, Dataset Explorer)     │
└────────────────────────────────┬────────────────────────────────┘
                                 │ REST API (JSON)
                                 │ NEXT_PUBLIC_API_URL
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (api.py)                     │
│               Hosted on Render / Railway / Local                │
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

## 2. Running Locally

### Prerequisites
- Python 3.12 (`.venv` already configured in workspace)
- Groq API Key (already configured in `.streamlit/secrets.toml`)

### A. Run the Full Streamlit App (Frontend + Backend in One)
```powershell
cd c:\Users\ganes\OneDrive\Desktop\arpita\nutrition-claim-verifier
.venv\Scripts\streamlit run app.py
```
Open `http://localhost:8501` in your browser. This includes:
- **📈 Dashboard**: Live analytics, compliance percentages, category chart, recent audited products
- **📦 Verify Product**: Check any of the 25 curated products against official FSSAI thresholds
- **📷 Check Label Photo (OCR)**: Upload food packaging photo for automatic text and nutrition extraction
- **📊 Dataset Explorer**: Interactive search, filtering by category/compliance, and CSV download
- **🔐 User Session & Auth**: Academic Auditor vs. Guest Consumer role switcher in the sidebar

### B. Run the FastAPI REST Backend
```powershell
cd c:\Users\ganes\OneDrive\Desktop\arpita\nutrition-claim-verifier
.venv\Scripts\uvicorn api:app --reload --port 8000
```
- Interactive API Documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`
- Dataset endpoint: `http://localhost:8000/api/dataset`
- Stats endpoint: `http://localhost:8000/api/stats`

---

## 3. Connecting the Vercel Frontend to the Backend

The Vercel deployment at `https://nutrition-claim-verifier-ui.vercel.app` is currently rendering static mockup UI components. To connect it to the real Python backend:

### Step 1: Deploy `api.py` to Render / Railway (Free)

#### Repository already pushed and available at:
`https://github.com/bodasrisaiganeshan/nutrition-claim-verifier`

#### Deploying on Render (Free Web Service):
1. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Web Service**.
2. Connect your repository: `bodasrisaiganeshan/nutrition-claim-verifier`.
3. Set:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   - `GROQ_API_KEY`: *(your real Groq key)*
   - `GROQ_MODEL`: `openai/gpt-oss-120b`
5. Click **Create Web Service**. Your public URL will be:
   `https://nutrition-claim-verifier-api.onrender.com`

---

### Step 2: Set Environment Variable in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select the `nutrition-claim-verifier-ui` project.
3. Navigate to **Settings** -> **Environment Variables**.
4. Add a new variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://nutrition-claim-verifier-api.onrender.com` (or your local backend tunnel like `https://xxx.ngrok-free.app` during testing)
5. Redeploy the latest commit on Vercel.

---

## 4. API Endpoints Specification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Backend status, dataset size & rule counts |
| `GET` | `/api/stats` | Dynamic dashboard stats (total products, compliance %, category breakdown) |
| `GET` | `/api/claims` | Supported claim types for selection dropdowns |
| `GET` | `/api/dataset` | Full 25-product catalogue with search & filter params |
| `POST` | `/api/verify` | Runs rule engine, calculates misleading risk, generates Groq explanation |
| `POST` | `/api/ocr` | Accepts label photo, runs RapidOCR/PaddleOCR, extracts nutrients & ingredients |
| `GET` | `/api/similar` | Finds similar products in dataset by claim type & category |


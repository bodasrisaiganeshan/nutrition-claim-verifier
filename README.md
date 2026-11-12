# Nutrition Claim Verifier

**Do the claims match the contents?** A URE implementation-phase tool that checks front-of-pack
nutrition claims on Indian packaged foods against FSSAI Phase-1 rules, explains the loophole in
plain language, and shows similar products from a curated 25-product dataset.

## Run it

### 1. Full Streamlit Web App (Dashboard, Verification, OCR, Dataset Explorer)
```bash
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m streamlit run app.py
```

### 2. FastAPI REST Backend (for Next.js / Vercel frontend)
```bash
.venv\Scripts\python -m uvicorn api:app --reload --port 8000
```
Interactive API docs: `http://localhost:8000/docs`

Use **Python 3.12**. PaddlePaddle has no wheels for Python 3.13+. If PaddleOCR fails to install, the
app uses RapidOCR automatically: the same PP-OCR models, running on ONNX Runtime.

To get Groq LLM explanations, get a free key at https://console.groq.com/keys and paste it into
`.streamlit/secrets.toml` (git-ignored):

```toml
GROQ_API_KEY = "gsk_your_real_key"
```

or set it in the terminal before starting the app:

```bash
set GROQ_API_KEY=your_key_here
```

Models are tried in order: `openai/gpt-oss-120b`, then `openai/gpt-oss-20b`, then
`llama-3.3-70b-versatile`. To force one, set `GROQ_MODEL`. The caption under each explanation shows
which model wrote it. If the template was used instead, the caption gives the reason: no key, invalid
key, rate limit, or offline.

Without a key, or without internet, the app shows a rule-based template explanation, so the demo
still works. Verdicts always come from the deterministic rule engine, never from the LLM.

## How it works

| Step | Module | Notes |
|---|---|---|
| Label text | `ocr_utils.py` | PaddleOCR, falling back to RapidOCR, with a parser for ingredients, nutrients, basis and solid/liquid form. The user confirms the values before verification. |
| Verdict | `rule_engine.py` | Deterministic checks against `fssai_phase1_rules.json` and `rules_supplement.json` |
| Similar products | `dataset_utils.py` | Same claim rule first, then same category, then shared claim words |
| Explanation | `llm_utils.py` | Groq LLM grounded only in the rule results, the label and the dataset; template fallback |
| UI | `app.py` | Dataset mode, photo mode (with paste-text fallback), and a dataset overview |

### Verdicts

- **Non-Compliant**: a rule threshold, a refined/added-ingredient ban, or a prohibited term is violated.
- **Technically Compliant but Misleading**: the rule passes literally, but a sugar substitute,
  masking ingredient, or vague health term undermines the claim.
- **Compliant**: every check passes.
- **Unverifiable Claim**: only vague terms ("Wholesome", "Smart Snacking") with no FSSAI threshold.
- **Outside Phase-1 Rule Coverage** / **Insufficient Data**.

### Team decisions encoded in the engine

- `SOFT_DENY_IS_MISLEADING = True` in `rule_engine.py`: soft-deny ingredients (fruit concentrate,
  maltodextrin, fructose ...) produce "misleading", not "non-compliant". Set it to `False` for a
  stricter reading.
- `rules_supplement.json` adds three things on top of the official extraction:
  - plain `sugar` and `glucose` as hard-deny for No Added Sugar
  - vague health terms
  - implied rules: "Diet/Lite" implies Low Fat (taken from dataset row 23), and "Naturally Sweetened" implies No Added Sugar

## Tests

```bash
.venv\Scripts\python tests\validate_dataset.py
```

```bash
.venv\Scripts\python tests\test_app.py
```

```bash
.venv\Scripts\python tests\test_llm.py
```

`test_llm.py` tests the Groq path offline with a fake client: success, model fallback, and the 401,
rate-limit and offline fallbacks. It also makes one real Groq call when a valid key is configured.

`validate_dataset.py` compares the engine with the team's labels. Current result: **12 agree, 1
disagrees, 12 not decidable** by Phase-1 rules. The disagreement is Saffola Masala Oats, whose
protein is 9.5 g against a High Protein threshold of 10 g.

## Known limitations (Phase 1)

- Thresholds are per 100 g / 100 ml. Per-serving panels raise a warning but are not converted.
- The parser reads the first numeric column of the nutrition table, which is assumed to be per 100 g/ml.
- The veg/non-veg symbol and the FSSAI licence number are not checked yet.
- Claim types such as Multigrain, Trans Fat, Cholesterol and "20g Protein" have no Phase-1 rule.

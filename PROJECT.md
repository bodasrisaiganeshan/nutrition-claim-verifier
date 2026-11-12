# PROJECT.md  
**Nutrition Claim Verifier – URE Implementation Phase**

---

## 1. Project Title
**Do the Claims Match the Contents?**  
An Audit of Nutrition Claims on Packaged Foods Sold in India

---

## 2. Project Goal

Build a web application that allows a user to:

1. Enter or select a front-of-pack nutrition/health claim (e.g. “No Added Sugar”, “High Protein”, “100% Atta”, “Sugar Free”).
2. Upload a photo of the back-of-pack label (nutrition information panel + ingredients list).
3. The system extracts the text using OCR.
4. Checks the claim against official FSSAI rules.
5. Tells the user whether the claim is **technically compliant**.
6. Explains the **loophole or deceptive mechanism** (if any) in clear, simple language.
7. Shows similar real examples from a curated Indian product dataset.

The system must remain **grounded** — it should primarily use:
- Official FSSAI rules (provided as JSON)
- The user’s own curated dataset
- The OCR text of the product being checked

It should **not** freely search the web or rely on general external knowledge that can introduce bias.

---

## 3. Background Context

- This project is the **implementation phase** of a University Research Experience (URE) project.
- The survey paper has already been written and accepted (similarity < 10%).
- The survey focused on misleading nutrition claims, Front-of-Pack labelling issues, consumer deception, and regulatory gaps in India.
- The implementation turns the research findings into a practical tool that can detect claim–content mismatches.

---

## 4. Core Features (Phase 1)

| Feature | Description |
|---------|-------------|
| Claim Input | User types or selects the claim to verify |
| Image Upload | Photo of nutrition panel + ingredients |
| OCR Extraction | Extract text accurately from Indian packaging |
| Rule-based Verification | Check against FSSAI Advertising & Claims Regulations |
| Compliance Decision | Technically Compliant / Non-Compliant |
| Loophole Explanation | Clear explanation of why the claim is misleading (even if technically legal) |
| Similar Examples | Show 2–3 related products from the dataset |
| Clean UI | Simple, presentation-ready interface |

---

## 5. Recommended Tech Stack (Free)

| Component | Technology | Reason |
|-----------|------------|--------|
| Development Environment | TRAECode | User’s preferred AI coding IDE |
| Frontend + Backend | Streamlit (preferred) or FastAPI | Fastest for student demo |
| OCR | PaddleOCR (PP-OCRv4) | Best free performance on Indian labels |
| Rule Engine | Python + `fssai_phase1_rules.json` | Deterministic and reliable |
| Dataset | `fmcg_label_audit_dataset.csv` | Grounded examples |
| LLM (Explanation) | Groq free tier (Qwen / gpt-oss models) or DeepSeek free | Completely free + good reasoning |
| Hosting | Streamlit Cloud / Hugging Face Spaces | Free deployment for demo |

---

## 6. Required Project Structure

```text
nutrition-claim-verifier/
├── PROJECT.md                          # This file
├── README.md                           # Short project introduction
├── requirements.txt
├── app.py                              # Main Streamlit application
├── ocr_utils.py                        # PaddleOCR functions
├── rule_engine.py                      # FSSAI rule checking logic
├── dataset_utils.py                    # Search & retrieve from CSV
├── llm_utils.py                        # Groq / free LLM call with grounded prompt
├── fssai_phase1_rules.json             # Simplified high-priority FSSAI rules
├── fmcg_label_audit_dataset.csv        # 25 real Indian products dataset
├── assets/                             # Optional images / logos
└── tests/                              # Optional test scripts
```

---

## 7. Key Files Explained

### `fssai_phase1_rules.json`
Contains the most important FSSAI rules for Phase 1:
- High Protein / Source of Protein (RDA thresholds)
- Sugar Free (≤ 0.5g / 100g)
- Low Sugar
- No Added Sugar (strict conditions + mandatory disclaimer)
- High Fibre / Source of Fibre
- Low Fat
- List of prohibited / high-risk keywords (“100% Pure”, “Healthy”, “Prevents”, “Cures”, “Diabetic Friendly”, etc.)

### `fmcg_label_audit_dataset.csv`
25 real Indian packaged food products with:
- Product name & category
- Front-of-pack claim
- Full ingredients list
- Nutrition values (energy, protein, sugars, fibre, fat, sodium, etc.)
- `is_technically_compliant` (True/False)
- `compliance_clause`
- `deceptive_mechanism`
- `severity_level`

This dataset is the primary source of truth for examples and loophole patterns.

---

## 8. System Flow

```
User enters claim + uploads label image
        ↓
OCR extracts ingredients + nutrition text
        ↓
Rule Engine checks claim against FSSAI JSON rules
        ↓
Dataset is searched for similar products
        ↓
Free LLM receives:
   - OCR text
   - Rule decision
   - Similar examples
        ↓
LLM generates clear explanation (grounded only in the above)
        ↓
Results shown to user
```

---

## 9. LLM Grounding Rules (Very Important)

The LLM must be instructed with a strict system prompt:

- Only use the provided FSSAI rules
- Only use the OCR text of the current product
- Only use similar examples from the dataset
- Do **not** use external knowledge, brand reputation, or general assumptions
- If data is insufficient, clearly say so

This prevents bias and keeps results consistent with the research.

---

## 10. Success Criteria for Phase 1 Demo

- Correctly extracts text from clear product photos
- Accurately classifies claims as Compliant / Non-Compliant according to FSSAI rules
- Clearly explains the loophole or deceptive mechanism
- Shows relevant similar products from the dataset
- Runs completely free
- UI is clean and suitable for university presentation
- Works reliably on the 25 products in the dataset

---

## 11. Current Status

**Completed:**
- Survey paper written and accepted
- FSSAI rules extracted and converted to JSON
- 25-product dataset created and labelled
- Architecture and free tech stack decided
- Grounding strategy decided

**To Be Built:**
- Full project structure
- OCR module
- Rule engine
- Dataset search module
- LLM explanation module
- Streamlit frontend
- End-to-end testing

---

## 12. Development Guidelines for TRAECode / Future Developers

- Keep code simple, readable, and well-commented (student project)
- Prefer clarity over complex architecture
- Always keep the LLM grounded
- Add basic error handling (blurry image, missing values, unsupported claims)
- Make the interface presentation-ready
- Log intermediate steps for easy debugging

---

## 13. Future Possible Extensions (After Phase 1)

- Support more claim types
- Expand dataset to 100+ products
- Mobile-friendly version
- Batch checking of multiple products
- Simple report generation (PDF)
- Comparison between two products

---

**This file is the single source of truth for the project.**  
All development should follow the decisions and constraints described above.

"""
app.py
------
Nutrition Claim Verifier: Streamlit front end.
Includes:
- Dashboard with live analytics
- Product verification (dataset & custom)
- Food label photo upload & OCR extraction (RapidOCR / PaddleOCR)
- FSSAI rule engine compliance checking
- Separate misleading-risk assessment
- Groq AI explanation with template fallback
- Dataset Explorer with search & filters
- Auditor authentication / role toggle

Run:  streamlit run app.py
"""

import logging
import io

import pandas as pd
import streamlit as st
from PIL import Image

from rule_engine import (
    verify_claim, supported_claims,
    V_NON_COMPLIANT, V_MISLEADING, V_COMPLIANT, V_VAGUE, V_NO_DATA, V_OUT_OF_SCOPE,
)
from dataset_utils import load_dataset, row_nutrients, row_form, find_similar, NUTRIENT_COLUMNS
from llm_utils import generate_explanation
import llm_utils
import ocr_utils

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

st.set_page_config(page_title="Nutrition Claim Verifier", page_icon="🔍", layout="wide")

VERDICT_STYLE = {
    V_NON_COMPLIANT: ("#c0392b", "❌"),
    V_MISLEADING: ("#d68910", "⚠️"),
    V_COMPLIANT: ("#1e8449", "✅"),
    V_VAGUE: ("#7d6608", "❓"),
    V_NO_DATA: ("#566573", "ℹ️"),
    V_OUT_OF_SCOPE: ("#566573", "ℹ️"),
}
STATUS_ICON = {
    "pass": "✅",
    "fail": "❌",
    "misleading": "⚠️",
    "prohibited": "🚫",
    "vague": "❓",
    "insufficient_data": "ℹ️",
}
NUTRIENT_LABELS = {
    "energy_kcal": "Energy (kcal)",
    "protein_g": "Protein (g)",
    "carbohydrates_g": "Carbohydrate (g)",
    "total_sugars_g": "Total sugars (g)",
    "added_sugars_g": "Added sugars (g)",
    "dietary_fibre_g": "Dietary fibre (g)",
    "total_fat_g": "Total fat (g)",
    "saturated_fat_g": "Saturated fat (g)",
    "sodium_mg": "Sodium (mg)",
}


@st.cache_data
def get_dataset():
    return load_dataset()


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


@st.cache_data(show_spinner=False)
def _cached_groq_explanation(_verdict, product, similar, cache_key):
    """Cache by a string key so repeated demo clicks are instant and free."""
    text, source = generate_explanation(_verdict, product, similar)
    if source != "groq":
        raise _NotCached(text)  # never cache a fallback, so a later retry can reach Groq
    return text, source, llm_utils.last_status.get("model")


class _NotCached(Exception):
    pass


def cached_explanation(verdict, product, similar, cache_key):
    """Return (text, source, detail). detail = model name or fallback reason."""
    try:
        return _cached_groq_explanation(verdict, product, similar, cache_key)
    except _NotCached as fallback:
        return str(fallback), "template", llm_utils.last_status.get("reason")


# ----------------------------------------------------------------------------
# Result rendering (shared by both modes)
# ----------------------------------------------------------------------------
def render_result(claim, ingredients, nutrients, form, basis, category=None,
                  product_id=None, product_extra=None, full_text=None):
    df = get_dataset()
    verdict = verify_claim(claim, ingredients, nutrients, form, basis, full_text)
    similar_df = find_similar(df, claim, category=category, exclude_id=product_id, k=3)
    risk = compute_misleading_risk(verdict, product_extra)

    color, icon = VERDICT_STYLE[verdict.verdict]

    # Dual Assessment Banner
    b_col1, b_col2 = st.columns([1.2, 1])
    with b_col1:
        st.markdown(
            f"""<div style="border-left:8px solid {color};background:{color}15;padding:14px 18px;border-radius:6px">
            <div style="font-size:0.85rem;color:#555">Regulatory Check · FSSAI Phase-1</div>
            <div style="font-size:1.5rem;font-weight:700;color:{color}">{icon} {verdict.verdict}</div>
            <div style="font-size:0.85rem;color:#444;margin-top:4px">Claim checked: <b>{claim}</b> &nbsp;·&nbsp; form: {form}</div>
            </div>""",
            unsafe_allow_html=True,
        )
    with b_col2:
        st.markdown(
            f"""<div style="border-left:8px solid {risk['color']};background:{risk['color']}15;padding:14px 18px;border-radius:6px">
            <div style="font-size:0.85rem;color:#555">Separate Misleading-Risk Assessment</div>
            <div style="font-size:1.5rem;font-weight:700;color:{risk['color']}">{risk['badge']} {risk['level']}</div>
            <div style="font-size:0.85rem;color:#444;margin-top:4px">{risk['reason']}</div>
            </div>""",
            unsafe_allow_html=True,
        )

    for w in verdict.warnings:
        st.warning(w)

    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)
    col1, col2 = st.columns([1.1, 1])
    with col1:
        st.subheader("Deterministic Rule Checks")
        if not verdict.checks:
            st.info("No Phase-1 FSSAI rule matches this claim. It cannot be verified from the label.")
        for c in verdict.checks:
            with st.container(border=True):
                st.markdown(f"{STATUS_ICON.get(c.status, '•')} **{c.claim_name}** · `{c.rule_id}`")
                st.write(c.message)
                for e in c.evidence:
                    st.caption(e)

    product = {"claim": claim, "ingredients": ingredients, "nutrients_per_100": nutrients, "form": form}
    if product_extra:
        product.update(product_extra)
    similar = [
        {k: r[k] for k in ("product_name", "front_claim", "is_technically_compliant",
                           "deceptive_mechanism", "severity_level")}
        for _, r in similar_df.iterrows()
    ]
    for s in similar:
        s["is_technically_compliant"] = bool(s["is_technically_compliant"])

    with col2:
        st.subheader("Plain-Language AI Explanation")
        key = f"{claim}|{ingredients}|{sorted(nutrients.items())}|{form}|{basis}"
        with st.spinner("Generating grounded explanation..."):
            text, source, detail = cached_explanation(verdict, product, similar, key)
        st.markdown(text)
        if source == "groq":
            st.caption(f"Source: Groq LLM ({detail}), strictly grounded in rule engine facts and dataset")
        else:
            st.caption(f"Source: Rule-based template (Groq fallback: {detail or 'LLM not configured'})")

    st.subheader("Similar Products from Dataset")
    if similar_df.empty:
        st.info("No similar products found in the dataset.")
    else:
        cols = st.columns(len(similar_df))
        for col, (_, r) in zip(cols, similar_df.iterrows()):
            with col, st.container(border=True):
                st.markdown(f"**{r['product_name']}**")
                st.caption(f"{r['category']} · matched by {r['match_reason']}")
                st.write(f"Claim: *{r['front_claim']}*")
                legal = "✅ Technically compliant" if r["is_technically_compliant"] else "❌ Non-compliant"
                st.write(f"{legal} · Severity: **{r['severity_level']}**")
                st.caption(r["deceptive_mechanism"])


def nutrient_editor(defaults, key_prefix):
    """Editable nutrient inputs; empty fields are treated as 'not on label'."""
    values = {}
    cols = st.columns(3)
    for i, col_name in enumerate(NUTRIENT_COLUMNS):
        default = defaults.get(col_name)
        with cols[i % 3]:
            txt = st.text_input(NUTRIENT_LABELS[col_name], value="" if default is None else f"{default:g}",
                                key=f"{key_prefix}_{col_name}")
        try:
            if txt.strip():
                values[col_name] = float(txt.replace(",", "."))
        except ValueError:
            st.error(f"'{txt}' is not a number ({NUTRIENT_LABELS[col_name]})")
    return values


# ----------------------------------------------------------------------------
# Sidebar & Authentication Header
# ----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 🔐 User Session & Auth")
    auth_mode = st.radio("Access Level", ["Auditor (Full Access)", "Consumer (Public Mode)"], index=0)
    if auth_mode == "Auditor (Full Access)":
        st.success("Signed in as **Academic Auditor**")
        st.caption("Access to raw OCR, threshold debugging & dataset export")
    else:
        st.info("Browsing as **Guest Consumer**")

    st.divider()
    st.header("How It Works")
    st.markdown(
        "1. **Select or Upload**: Pick an audited product or upload a packaging photo\n"
        "2. **OCR Parsing**: Ingredients & nutrition panel extracted\n"
        "3. **FSSAI Rule Engine**: Deterministic threshold compliance\n"
        "4. **Misleading-Risk Scoring**: Scored separately from legality\n"
        "5. **Groq AI Explanation**: Strictly grounded explanation of loopholes"
    )

    st.header("Regulatory Meanings")
    st.markdown(
        f"- {VERDICT_STYLE[V_NON_COMPLIANT][1]} **{V_NON_COMPLIANT}**: breaks a rule threshold\n"
        f"- {VERDICT_STYLE[V_MISLEADING][1]} **Technically Compliant but Misleading**: legal loophole\n"
        f"- {VERDICT_STYLE[V_COMPLIANT][1]} **{V_COMPLIANT}**: fully backed by label\n"
        f"- {VERDICT_STYLE[V_VAGUE][1]} **Unverifiable**: vague marketing term without threshold\n"
        "- ℹ️ **Insufficient Data / Outside Phase-1**"
    )
    st.caption("FSSAI (Advertising & Claims) Regulations, 2018 · Labelling & Display, 2020")


# ----------------------------------------------------------------------------
# Main Page Title & Tabs
# ----------------------------------------------------------------------------
st.title("🔍 Nutrition Claim Verifier")
st.markdown("**Do the claims match the contents?** An audit of front-of-pack nutrition claims on "
            "packaged foods sold in India, verified against FSSAI Phase-1 standards.")

tab_dash, tab_dataset, tab_photo, tab_explorer = st.tabs([
    "📈 Dashboard",
    "📦 Verify Product",
    "📷 Check Label Photo (OCR)",
    "📊 Dataset Explorer",
])

# ============================================================================
# TAB 1: DASHBOARD
# ============================================================================
with tab_dash:
    df = get_dataset()
    total_products = len(df)
    compliant_count = int(df["is_technically_compliant"].sum())
    non_compliant_count = total_products - compliant_count
    high_risk_count = int((df["severity_level"].astype(str).str.lower() == "high").sum())

    # Stat Cards
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("Products Audited", total_products, "+25 FMCG Brands")
    with c2:
        st.metric("Technically Compliant", compliant_count, f"{round((compliant_count/total_products)*100, 1)}%")
    with c3:
        st.metric("Non-Compliant / Flagged", non_compliant_count, f"{round((non_compliant_count/total_products)*100, 1)}%")
    with c4:
        st.metric("High-Risk Loopholes", high_risk_count, "Deceptive Marketing")

    st.divider()

    d_col1, d_col2 = st.columns([1.2, 1])
    with d_col1:
        st.subheader("Compliance by Category")
        cat_df = df.groupby(["category", "is_technically_compliant"]).size().unstack(fill_value=0)
        cat_df.columns = ["Non-Compliant" if col is False else "Compliant" for col in cat_df.columns]
        st.bar_chart(cat_df, height=300)

    with d_col2:
        st.subheader("Severity & Risk Distribution")
        sev_counts = df["severity_level"].value_counts()
        st.dataframe(
            pd.DataFrame({"Count": sev_counts, "% of Total": (sev_counts / total_products * 100).round(1)}),
            width="stretch",
        )

    st.subheader("Recent Audited Products in Dataset")
    st.dataframe(
        df[["id", "product_name", "category", "front_claim", "is_technically_compliant", "severity_level", "deceptive_mechanism"]],
        width="stretch",
        hide_index=True,
    )


# ============================================================================
# TAB 2: CHECK A DATASET PRODUCT
# ============================================================================
with tab_dataset:
    df = get_dataset()
    names = df["product_name"].tolist()
    choice = st.selectbox("Select a Product to Audit", names, index=None, placeholder="Choose one of the 25 products...")
    if choice:
        row = df[df["product_name"] == choice].iloc[0]
        c1, c2 = st.columns([2, 1])
        with c1:
            st.markdown(f"**Front-of-pack claim:** {row['front_claim']}")
            st.markdown(f"**Category:** {row['category']}")
            st.markdown(f"**Ingredients:** {row['ingredients']}")
        with c2:
            st.dataframe(
                pd.DataFrame({"per 100 g/ml": [row[c] for c in NUTRIENT_COLUMNS]},
                             index=[NUTRIENT_LABELS[c] for c in NUTRIENT_COLUMNS]),
                width="stretch",
            )
        if st.button("Run Verification", type="primary", key="verify_dataset"):
            st.divider()
            render_result(
                claim=row["front_claim"], ingredients=row["ingredients"], nutrients=row_nutrients(row),
                form=row_form(row), basis="per_100", category=row["category"], product_id=row["id"],
                product_extra={"product_name": row["product_name"], "category": row["category"],
                               "deceptive_mechanism": row["deceptive_mechanism"],
                               "severity_level": row["severity_level"]},
            )


# ============================================================================
# TAB 3: CHECK LABEL PHOTO (OCR)
# ============================================================================
with tab_photo:
    st.markdown("Upload a photo of the **back of pack** (ingredients list and nutrition information table). "
                "The OCR extraction extracts nutrition facts and ingredients automatically.")
    c1, c2 = st.columns([1, 1])
    with c1:
        preset = st.selectbox("Front-of-Pack Claim", ["(type your own)"] + supported_claims())
        claim_text = st.text_input("Claim Text", value="" if preset == "(type your own)" else preset,
                                   placeholder="e.g. No Added Sugar / High Protein")
        upload = st.file_uploader("Upload Label Photo", type=["jpg", "jpeg", "png", "webp"])
    with c2:
        if upload:
            st.image(upload, width="stretch")

    if upload and st.button("Extract Text with OCR", key="run_ocr"):
        try:
            with st.spinner("Extracting text with OCR engine..."):
                lines, engine = ocr_utils.extract_text(Image.open(upload))
            st.session_state["ocr_lines"] = lines
            st.session_state["ocr_engine"] = engine
            st.session_state["parsed"] = ocr_utils.parse_label(lines)
            st.success(f"Extracted {len(lines)} lines using {engine}")
        except ocr_utils.OCRUnavailable as exc:
            st.error(str(exc) + " You can paste the label text below instead.")
        except Exception as exc:
            st.error(f"OCR failed: {exc}. Try pasting the text below.")

    with st.expander("Or Paste Label Text Directly (Manual Entry)"):
        pasted = st.text_area("Label Text", height=150, key="pasted_text")
        if st.button("Parse Pasted Text", key="use_pasted") and pasted.strip():
            lines = pasted.splitlines()
            st.session_state["ocr_lines"] = lines
            st.session_state["ocr_engine"] = "Pasted Text"
            st.session_state["parsed"] = ocr_utils.parse_label(lines)
            st.success("Label text parsed successfully!")

    parsed = st.session_state.get("parsed")
    if parsed:
        st.divider()
        st.subheader("Step 2: Review & Confirm Extracted Values")
        st.caption(f"Source: {st.session_state.get('ocr_engine')}. Verify or edit values before checking.")
        with st.expander("Raw Extracted Lines"):
            st.text("\n".join(st.session_state.get("ocr_lines", [])))

        ingredients = st.text_area("Ingredients List", value=parsed["ingredients"], height=100)
        nutrients = nutrient_editor(parsed["nutrients"], "ocr")
        b1, b2 = st.columns(2)
        with b1:
            form = st.radio("Product Physical Form", ["solid", "liquid"], horizontal=True,
                            index=0 if parsed["form"] == "solid" else 1)
        with b2:
            basis_options = {"per_100": "Per 100 g / 100 ml", "per_serving": "Per serving"}
            basis = st.radio("Values are Given", list(basis_options), format_func=basis_options.get, horizontal=True,
                             index=1 if parsed["basis"] == "per_serving" else 0)
            if parsed["basis"] == "unknown":
                st.caption("Basis not clearly detected on the label. Please confirm.")

        if st.button("Verify Claim Against FSSAI", type="primary", key="verify_photo"):
            if not claim_text.strip():
                st.error("Please enter or select a front-of-pack claim first.")
            else:
                st.divider()
                render_result(claim=claim_text, ingredients=ingredients, nutrients=nutrients, form=form,
                              basis=basis, full_text=parsed["full_text"])


# ============================================================================
# TAB 4: DATASET EXPLORER
# ============================================================================
with tab_explorer:
    st.subheader("Explore the 25-Product FMCG Label Audit Dataset")
    df = get_dataset()

    f1, f2, f3 = st.columns(3)
    with f1:
        cat_filter = st.selectbox("Filter by Category", ["All Categories"] + sorted(df["category"].unique().tolist()))
    with f2:
        comp_filter = st.selectbox("Filter by Compliance", ["All", "Technically Compliant", "Non-Compliant"])
    with f3:
        search_query = st.text_input("Search Product Name or Claim", placeholder="e.g. Atta, Sugar, Oats...")

    filtered_df = df.copy()
    if cat_filter != "All Categories":
        filtered_df = filtered_df[filtered_df["category"] == cat_filter]
    if comp_filter == "Technically Compliant":
        filtered_df = filtered_df[filtered_df["is_technically_compliant"] == True]
    elif comp_filter == "Non-Compliant":
        filtered_df = filtered_df[filtered_df["is_technically_compliant"] == False]
    if search_query.strip():
        q = search_query.strip().lower()
        filtered_df = filtered_df[
            filtered_df["product_name"].str.lower().str.contains(q) |
            filtered_df["front_claim"].str.lower().str.contains(q)
        ]

    st.markdown(f"Showing **{len(filtered_df)}** of {len(df)} products:")
    st.dataframe(
        filtered_df[["id", "product_name", "category", "front_claim", "is_technically_compliant", "severity_level", "deceptive_mechanism"]],
        width="stretch",
        hide_index=True,
    )

    # Export button
    csv_data = filtered_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="📥 Download Filtered Dataset as CSV",
        data=csv_data,
        file_name="fmcg_nutrition_claim_audit.csv",
        mime="text/csv",
    )

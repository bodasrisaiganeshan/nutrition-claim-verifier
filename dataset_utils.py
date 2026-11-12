"""
dataset_utils.py
----------------
Loads the curated 25-product dataset and finds similar products.
Similarity is deliberately simple and explainable:
  same matched claim rule  > same category > shared claim words.
"""

from pathlib import Path
import pandas as pd

from rule_engine import match_rules, normalize, detect_form

DATASET_PATH = Path(__file__).parent / "fmcg_label_audit_dataset.csv"

NUTRIENT_COLUMNS = [
    "energy_kcal", "protein_g", "carbohydrates_g", "total_sugars_g", "added_sugars_g",
    "dietary_fibre_g", "total_fat_g", "saturated_fat_g", "sodium_mg",
]


def load_dataset():
    df = pd.read_csv(DATASET_PATH)
    df["is_technically_compliant"] = df["is_technically_compliant"].astype(str).str.lower() == "true"
    return df


def row_nutrients(row):
    """Nutrient dict for the rule engine, skipping missing values."""
    return {c: float(row[c]) for c in NUTRIENT_COLUMNS if pd.notna(row.get(c))}


def row_form(row):
    return detect_form(row.get("category", ""), row.get("product_name", ""))


def find_similar(df, claim, category=None, exclude_id=None, k=3):
    """Return up to k similar products as a DataFrame with a 'match_reason' column."""
    claim_rules = {r["canonical"] for r in match_rules(claim)}
    claim_words = {w for w in normalize(claim).replace("/", " ").split() if len(w) > 3}

    scored = []
    for _, row in df.iterrows():
        if exclude_id is not None and row["id"] == exclude_id:
            continue
        row_rules = {r["canonical"] for r in match_rules(row["front_claim"])}
        score, reasons = 0, []
        shared = claim_rules & row_rules
        if shared:
            score += 10
            reasons.append("same claim type")
        if category and row["category"] == category:
            score += 4
            reasons.append("same category")
        common = claim_words & set(normalize(row["front_claim"]).replace("/", " ").split())
        if common:
            score += len(common)
            if not shared:
                reasons.append("similar claim wording")
        if score > 0:
            scored.append((score, row["id"], ", ".join(reasons)))

    scored.sort(key=lambda t: (-t[0], t[1]))
    top = scored[:k]
    if not top:
        return df.iloc[0:0].assign(match_reason=[])
    ids = [t[1] for t in top]
    reasons = {t[1]: t[2] for t in top}
    result = df[df["id"].isin(ids)].copy()
    result["match_reason"] = result["id"].map(reasons)
    result["_order"] = result["id"].map({i: n for n, i in enumerate(ids)})
    return result.sort_values("_order").drop(columns="_order")

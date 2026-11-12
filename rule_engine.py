"""
rule_engine.py
--------------
Deterministic FSSAI claim checker for the Nutrition Claim Verifier.

Inputs : a front-of-pack claim (text) + product facts (ingredients text,
         nutrient values per 100 g / 100 ml, physical form).
Outputs: one CheckResult per detected sub-claim and an overall verdict.

No LLM is used here. Every decision can be traced to a rule_id in
fssai_phase1_rules.json or rules_supplement.json.
"""

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path

BASE_DIR = Path(__file__).parent
RULES_PATH = BASE_DIR / "fssai_phase1_rules.json"
SUPPLEMENT_PATH = BASE_DIR / "rules_supplement.json"

# --- Team decision (documented) ---------------------------------------------
# A "soft-deny" ingredient (fruit concentrate, maltodextrin, fructose, dried
# fruit ...) does not make a claim illegal by itself, but it undermines it.
# True  -> soft-deny gives "Technically Compliant but Misleading"
# False -> soft-deny gives "Non-Compliant"
SOFT_DENY_IS_MISLEADING = True

# --- Statuses for individual checks -----------------------------------------
PASS = "pass"
FAIL = "fail"
MISLEADING = "misleading"
PROHIBITED = "prohibited"
VAGUE = "vague"
NO_DATA = "insufficient_data"

# --- Overall verdicts --------------------------------------------------------
V_NON_COMPLIANT = "Non-Compliant"
V_MISLEADING = "Technically Compliant but Misleading"
V_COMPLIANT = "Compliant"
V_VAGUE = "Unverifiable Claim (Potentially Misleading)"
V_NO_DATA = "Insufficient Data"
V_OUT_OF_SCOPE = "Outside Phase-1 Rule Coverage"

QUALIFIER_WORDS = ("high", "rich", "source", "low", "free", "zero", "no ", "reduced", "100%")


@dataclass
class CheckResult:
    rule_id: str
    claim_name: str
    status: str
    message: str
    evidence: list = field(default_factory=list)


@dataclass
class Verdict:
    verdict: str
    claim: str
    form: str
    checks: list
    warnings: list

    def to_dict(self):
        d = asdict(self)
        return d


# ----------------------------------------------------------------------------
# Loading
# ----------------------------------------------------------------------------
def load_rules():
    with open(RULES_PATH, encoding="utf-8") as f:
        rules = json.load(f)
    with open(SUPPLEMENT_PATH, encoding="utf-8") as f:
        supplement = json.load(f)
    return rules, supplement


RULES, SUPPLEMENT = load_rules()


# ----------------------------------------------------------------------------
# Text helpers
# ----------------------------------------------------------------------------
def normalize(text):
    """Lower-case, unify quotes and collapse whitespace."""
    text = (text or "").lower()
    text = text.replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text).strip()


def contains_term(text, term):
    """Whole-word / whole-phrase match, so 'sugar' does not hit 'sugars free'
    inside unrelated words, and 'heal' does not hit 'healthy'."""
    pattern = r"(?<![a-z])" + re.escape(term) + r"(?![a-z])"
    return re.search(pattern, text) is not None


def contains_stem(text, stem):
    """Match a verb stem with common suffixes: prevent(s|ed|ion|ive...)."""
    pattern = r"(?<![a-z])" + re.escape(stem) + r"(s|es|d|ed|ing|ion|ions|ive|ative)?(?![a-z])"
    return re.search(pattern, text) is not None


def split_claim(claim):
    """Split a compound claim such as 'High Fibre & Protein / Heart Healthy'
    into sub-claims. A bare nutrient after '&' inherits the qualifier of the
    previous part ('High Fibre & Protein' -> 'High Fibre', 'High Protein')."""
    parts = []
    for chunk in re.split(r"[/,|;]", normalize(claim)):
        sub = [s.strip() for s in re.split(r"\s*&\s*|\s+and\s+|\s*\+\s*", chunk) if s.strip()]
        prefix = None
        for s in sub:
            qualifier = next((q for q in QUALIFIER_WORDS if s.startswith(q)), None)
            if qualifier:
                prefix = s.split()[0]
            elif prefix:
                s = f"{prefix} {s}"
            parts.append(s)
    return parts


def detect_form(category="", product_name=""):
    """Guess solid vs liquid from category/product name (dataset mode)."""
    text = normalize(f"{category} {product_name}")
    # Whole-word matching ('classic' must not match 'lassi'); allow plural 's'.
    has = lambda h: re.search(r"(?<![a-z])" + re.escape(h) + r"s?(?![a-z])", text) is not None
    if any(has(h) for h in SUPPLEMENT["solid_override_hints"]):
        return "solid"
    if any(has(h) for h in SUPPLEMENT["liquid_category_hints"]):
        return "liquid"
    return RULES["meta"].get("default_form", "solid")


# ----------------------------------------------------------------------------
# Claim matching
# ----------------------------------------------------------------------------
def match_rules(claim):
    """Return the list of claim rules triggered by the claim text (deduplicated).
    Longest alias wins inside each sub-claim, so 'no added sugar' is not
    mistaken for 'no sugar'."""
    matched, seen = [], set()
    for part in split_claim(claim):
        best, best_len = None, 0
        for rule in RULES["claims"]:
            for alias in rule["aliases"]:
                if contains_term(part, alias) and len(alias) > best_len:
                    best, best_len = rule, len(alias)
        if best and best["canonical"] not in seen:
            seen.add(best["canonical"])
            matched.append(best)
    return matched


def find_prohibited(claim):
    text = normalize(claim)
    hits = []
    for kw in RULES["prohibited_terms"]["keywords"]:
        is_phrase = (" " in kw) or ("%" in kw) or ("-" in kw)
        found = contains_term(text, kw) if is_phrase else contains_stem(text, kw)
        if found:
            hits.append(kw)
    return hits


def find_vague(claim):
    text = normalize(claim)
    hits = [kw for kw in SUPPLEMENT["vague_terms"]["keywords"] if contains_term(text, kw)]
    # Drop shorter terms already covered by a longer hit ('healthy' inside 'heart healthy').
    return [h for h in hits if not any(h != o and h in o for o in hits)]


# ----------------------------------------------------------------------------
# Individual checks
# ----------------------------------------------------------------------------
def _compare(value, comparator, threshold):
    return value >= threshold if comparator == ">=" else value <= threshold


def check_numeric(rule, nutrients, form):
    nutrient = rule["nutrient"]
    value = nutrients.get(nutrient)
    threshold = rule["thresholds"][form]
    if value is None:
        return CheckResult(rule["rule_id"], rule["display_name"], NO_DATA,
                           f"No value for '{nutrient}' was found on the label, so the claim cannot be checked.")
    ok = _compare(float(value), rule["comparator"], threshold)
    unit = "ml" if form == "liquid" else "g"
    evidence = [f"{nutrient} = {value} per 100 {unit}  (required {rule['comparator']} {threshold})"]
    return CheckResult(rule["rule_id"], rule["display_name"], PASS if ok else FAIL,
                       rule["pass_text"] if ok else rule["fail_text"], evidence)


def check_ingredients(rule, ingredients, nutrients, form, full_text=None):
    text = normalize(ingredients)
    if not text:
        return CheckResult(rule["rule_id"], rule["display_name"], NO_DATA,
                           "No ingredients list was found, so the claim cannot be checked.")

    hard_list = list(rule.get("hard_deny_list", []))
    hard_list += SUPPLEMENT["extra_hard_deny"].get(rule["canonical"], [])
    hard_hits = sorted({t for t in hard_list if contains_term(text, t)})
    soft_hits = sorted({t for t in rule.get("soft_deny_list", []) if contains_term(text, t)})
    # Avoid listing 'sugar' and 'invert sugar syrup' twice for the same ingredient.
    hard_hits = [h for h in hard_hits if not any(h != o and h in o for o in hard_hits)]

    evidence = []
    if hard_hits:
        evidence.append("Added / refined ingredient found: " + ", ".join(hard_hits))
        return CheckResult(rule["rule_id"], rule["display_name"], FAIL, rule["fail_text"], evidence)

    # Numeric part (e.g. added sugars <= 0.5 g) when the rule has a nutrient.
    if rule.get("nutrient"):
        value = nutrients.get(rule["nutrient"])
        if value is not None:
            threshold = rule["thresholds"][form]
            evidence.append(f"{rule['nutrient']} = {value}  (required {rule['comparator']} {threshold})")
            if not _compare(float(value), rule["comparator"], threshold):
                return CheckResult(rule["rule_id"], rule["display_name"], FAIL,
                                   f"Declared {rule['nutrient']} exceeds the limit.", evidence)

    if soft_hits:
        evidence.append("Sugar substitute / hidden-sugar or masking ingredient found: " + ", ".join(soft_hits))
        status = MISLEADING if SOFT_DENY_IS_MISLEADING else FAIL
        note = rule.get("deceptive_note",
                        "The claim is literally satisfied, but these ingredients undermine what consumers expect.")
        return CheckResult(rule["rule_id"], rule["display_name"], status, note, evidence)

    # Mandatory disclaimer (only checkable when the full label text is available).
    disclaimer = rule.get("requires_disclaimer")
    total_sugars = nutrients.get("total_sugars_g")
    if disclaimer and full_text is not None and total_sugars and float(total_sugars) > 0.5:
        if "naturally occurring sugar" not in normalize(full_text):
            evidence.append(f"Total sugars = {total_sugars} g but '{disclaimer}' was not found on the label.")
            return CheckResult(rule["rule_id"], rule["display_name"], MISLEADING,
                               "Mandatory disclaimer for naturally occurring sugars is missing.", evidence)

    checked = ", ".join(hard_list + rule.get("soft_deny_list", []))
    evidence.append(f"None of these ingredients were found: {checked}")
    return CheckResult(rule["rule_id"], rule["display_name"], PASS, rule["pass_text"], evidence)


def implied_rules(claim, already):
    """Vague words that imply a measurable criterion (e.g. 'Lite' -> Low Fat)."""
    text = normalize(claim)
    by_name = {r["canonical"]: r for r in RULES["claims"]}
    out = []
    for word, canonical in SUPPLEMENT["implied_rules"]["map"].items():
        if contains_term(text, word) and canonical not in already and canonical in by_name:
            already.add(canonical)
            out.append((word, by_name[canonical]))
    return out


# ----------------------------------------------------------------------------
# Main entry point
# ----------------------------------------------------------------------------
def verify_claim(claim, ingredients="", nutrients=None, form="solid",
                 basis="per_100", full_text=None):
    """Check one front-of-pack claim.

    claim       : front-of-pack claim text
    ingredients : ingredients list text
    nutrients   : dict with keys like protein_g, total_sugars_g, added_sugars_g,
                  dietary_fibre_g, total_fat_g (values per 100 g / 100 ml)
    form        : 'solid' or 'liquid'
    basis       : 'per_100' or 'per_serving'
    full_text   : full OCR text (enables the disclaimer check), optional
    """
    nutrients = nutrients or {}
    checks, warnings = [], []

    if basis != "per_100":
        warnings.append("The nutrition values are per serving, not per 100 g/ml. "
                        "FSSAI thresholds are per 100 g/ml, so please convert or verify manually.")

    for kw in find_prohibited(claim):
        checks.append(CheckResult(RULES["prohibited_terms"]["rule_id"], f"Prohibited term: '{kw}'",
                                  PROHIBITED, RULES["prohibited_terms"]["message"], [f"Claim text contains '{kw}'"]))

    matched = match_rules(claim)
    for rule in matched:
        if rule["type"] == "numeric":
            checks.append(check_numeric(rule, nutrients, form))
        else:
            checks.append(check_ingredients(rule, ingredients, nutrients, form, full_text))

    for word, rule in implied_rules(claim, {r["canonical"] for r in matched}):
        if rule["type"] == "numeric":
            result = check_numeric(rule, nutrients, form)
        else:
            result = check_ingredients(rule, ingredients, nutrients, form, full_text)
        result.rule_id = f"{SUPPLEMENT['implied_rules']['rule_id']} -> {rule['rule_id']}"
        result.claim_name = f"'{word.title()}' implies {rule['display_name']}"
        checks.append(result)

    for kw in find_vague(claim):
        checks.append(CheckResult(SUPPLEMENT["vague_terms"]["rule_id"], f"Vague term: '{kw}'",
                                  VAGUE, SUPPLEMENT["vague_terms"]["message"], [f"Claim text contains '{kw}'"]))

    statuses = {c.status for c in checks}
    if statuses & {FAIL, PROHIBITED}:
        verdict = V_NON_COMPLIANT
    elif MISLEADING in statuses:
        verdict = V_MISLEADING
    elif NO_DATA in statuses:
        verdict = V_NO_DATA
    elif PASS in statuses and VAGUE in statuses:
        verdict = V_MISLEADING
    elif PASS in statuses:
        verdict = V_COMPLIANT
    elif VAGUE in statuses:
        verdict = V_VAGUE
    else:
        verdict = V_OUT_OF_SCOPE

    return Verdict(verdict, claim, form, checks, warnings)


def supported_claims():
    """Display names for the claim dropdown in the UI."""
    return [r["display_name"] for r in RULES["claims"]]


if __name__ == "__main__":
    demo = verify_claim("100% Atta / Brown Bread",
                        ingredients="Whole Wheat Flour (Atta) (52%), Refined Wheat Flour (Maida) (10%), Sugar",
                        nutrients={"protein_g": 8.5})
    print(demo.verdict)
    for c in demo.checks:
        print(" -", c.status, c.claim_name, c.evidence)

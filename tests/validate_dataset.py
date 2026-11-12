"""
tests/validate_dataset.py
-------------------------
Runs the rule engine on all 25 dataset products and compares the engine's
verdict with the team's manual label (is_technically_compliant).

Run:  python tests/validate_dataset.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rule_engine import verify_claim, V_NON_COMPLIANT, V_COMPLIANT, V_MISLEADING  # noqa: E402
from dataset_utils import load_dataset, row_nutrients, row_form  # noqa: E402


def main():
    df = load_dataset()
    agree = disagree = other = 0
    for _, row in df.iterrows():
        v = verify_claim(row["front_claim"], row["ingredients"], row_nutrients(row), row_form(row))
        label = "Compliant" if row["is_technically_compliant"] else "Non-Compliant"
        if v.verdict in (V_COMPLIANT, V_MISLEADING):
            engine_legal = True
        elif v.verdict == V_NON_COMPLIANT:
            engine_legal = False
        else:
            engine_legal = None

        if engine_legal is None:
            mark, other = "  ?", other + 1
        elif engine_legal == row["is_technically_compliant"]:
            mark, agree = " OK", agree + 1
        else:
            mark, disagree = "!!!", disagree + 1

        print(f"{mark} #{row['id']:>2} {row['product_name'][:42]:<42} | label={label:<13} | engine={v.verdict}")
        for c in v.checks:
            print(f"        - [{c.status}] {c.claim_name}: {'; '.join(c.evidence)}")
    print(f"\nAgree: {agree}   Disagree: {disagree}   Not decidable by Phase-1 rules: {other}")


if __name__ == "__main__":
    main()

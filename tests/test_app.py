"""
tests/test_app.py
-----------------
Headless end-to-end checks of the Streamlit app and the full pipeline.
Run:  python tests/test_app.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from streamlit.testing.v1 import AppTest  # noqa: E402

from rule_engine import verify_claim  # noqa: E402
from ocr_utils import parse_label  # noqa: E402

DEMO = {
    "Harvest Gold 100% Atta Bread": "Non-Compliant",
    "Bagrry's No Added Sugar Muesli": "Technically Compliant but Misleading",
    "Raw Pressery Tender Coconut Water": "Non-Compliant",
    "Kellogg's Special K Protein & Fiber": "Technically Compliant but Misleading",
    "Bikaji Diet / Lite Mixture (Chivda)": "Non-Compliant",
}


def test_dataset_mode():
    for product, expected in DEMO.items():
        at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=60)
        at.run()
        at.selectbox[0].select(product).run()
        at.button(key="verify_dataset").click().run()
        assert not at.exception, at.exception
        html = " ".join(m.value for m in at.markdown)
        assert expected in html, f"{product}: expected '{expected}'"
        print(f"PASS dataset mode: {product} -> {expected}")


def test_pasted_label_mode():
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=60)
    at.run()
    at.text_input[0].set_value("No Added Sugar").run()
    at.text_area(key="pasted_text").set_value(
        "Ingredients: Rolled Oats, Raisins, Apple Juice Concentrate, Almonds\n"
        "Nutrition Information per 100 g\nEnergy 390 kcal\nProtein 11.5 g\n"
        "Total Sugars 14.5 g\nAdded Sugars 0 g\nDietary Fibre 10.2 g\nTotal Fat 6.5 g"
    ).run()
    at.button(key="use_pasted").click().run()
    at.button(key="verify_photo").click().run()
    assert not at.exception, at.exception
    html = " ".join(m.value for m in at.markdown)
    assert "Technically Compliant but Misleading" in html
    print("PASS pasted-label mode -> Technically Compliant but Misleading")


def test_engine_edge_cases():
    cases = [
        ("Sugar Free", "Sorbitol, Wheat flour", {"total_sugars_g": 2.0}, "Non-Compliant"),
        ("High Protein", "Milk", {"protein_g": 6.0}, "Compliant", "liquid"),
        ("High Protein", "Milk", {}, "Insufficient Data"),
        ("Boosts Immunity", "Herbs", {}, "Non-Compliant"),
        ("Tastes great", "Anything", {}, "Outside Phase-1 Rule Coverage"),
    ]
    for case in cases:
        claim, ing, nut, expected = case[:4]
        form = case[4] if len(case) > 4 else "solid"
        got = verify_claim(claim, ing, nut, form).verdict
        assert got == expected, f"{claim}: got {got}, expected {expected}"
        print(f"PASS engine: '{claim}' -> {got}")
    v = verify_claim("High Protein", "Milk", {"protein_g": 6}, basis="per_serving")
    assert v.warnings, "per-serving warning missing"
    print("PASS engine: per-serving warning shown")


def test_parser_messy_ocr():
    lines = ["NUTRITION INFORMATION", "Per 100g  Per Serve (30g)", "Energy (kcal)  468  140",
             "Protein (g)  8.2  2.5", "Total Sugars (g)  0.5  0.2", "Total Fat (g)  18.5",
             "Saturated Fat (g) 8.9", "INGREDIENTS: Refined Wheat Flour (Maida), Maltodextrin, Salt"]
    p = parse_label(lines)
    assert p["nutrients"]["protein_g"] == 8.2
    assert p["nutrients"]["total_fat_g"] == 18.5 and p["nutrients"]["saturated_fat_g"] == 8.9
    assert "Maltodextrin" in p["ingredients"] and p["basis"] == "per_100"
    print("PASS parser: two-column panel read as per-100g column")


def test_explanation_caption():
    """The UI must say which source wrote the explanation (and why Groq was not used)."""
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=60)
    at.run()
    at.selectbox[0].select("Bagrry's No Added Sugar Muesli").run()
    at.button(key="verify_dataset").click().run()
    assert not at.exception, at.exception
    captions = " ".join(c.value for c in at.caption)
    assert "Source: Groq LLM (" in captions or "Groq not used:" in captions, captions
    print("PASS explanation caption shows source:",
          "groq" if "Source: Groq LLM (" in captions else "template with reason")


if __name__ == "__main__":
    test_engine_edge_cases()
    test_parser_messy_ocr()
    test_dataset_mode()
    test_pasted_label_mode()
    test_explanation_caption()
    print("\nAll tests passed.")

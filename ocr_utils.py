"""
ocr_utils.py
------------
1. extract_text(image)  -> raw OCR lines
   Backend order: PaddleOCR (PP-OCR) -> RapidOCR (same PP-OCR models on
   ONNX Runtime). If neither is installed, a clear error is raised and the
   UI lets the user paste the label text instead.
2. parse_label(text)    -> ingredients text + nutrient values + basis hints
   The parser is pure Python and works on any text (OCR or pasted).
"""

import logging
import re

import numpy as np

log = logging.getLogger("ocr_utils")

_ENGINE = None
_ENGINE_NAME = None


class OCRUnavailable(RuntimeError):
    pass


# ----------------------------------------------------------------------------
# OCR backends
# ----------------------------------------------------------------------------
def _load_engine():
    global _ENGINE, _ENGINE_NAME
    if _ENGINE is not None:
        return _ENGINE, _ENGINE_NAME
    try:
        from paddleocr import PaddleOCR
        _ENGINE = PaddleOCR(lang="en", use_doc_orientation_classify=False,
                            use_doc_unwarping=False, use_textline_orientation=True)
        _ENGINE_NAME = "PaddleOCR"
    except Exception as exc:
        log.info("PaddleOCR unavailable (%s); trying RapidOCR", exc)
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ENGINE = RapidOCR()
            _ENGINE_NAME = "RapidOCR (PP-OCR models)"
        except Exception as exc2:
            raise OCRUnavailable(
                "No OCR engine is installed. Install paddleocr (Python <= 3.12) or rapidocr_onnxruntime."
            ) from exc2
    log.info("OCR engine loaded: %s", _ENGINE_NAME)
    return _ENGINE, _ENGINE_NAME


def ocr_engine_name():
    try:
        return _load_engine()[1]
    except OCRUnavailable:
        return None


def _sort_reading_order(items):
    """items: list of (box, text). Sort top-to-bottom, then left-to-right,
    and merge boxes on the same visual row into one line (keeps 'Protein  11.5 g'
    together even when OCR returns them as two boxes)."""
    if not items:
        return []
    rows = []
    for box, text in items:
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        rows.append({"y": sum(ys) / len(ys), "h": max(ys) - min(ys) or 1, "x": min(xs), "text": text})
    rows.sort(key=lambda r: r["y"])
    lines, current = [], [rows[0]]
    for r in rows[1:]:
        if abs(r["y"] - current[-1]["y"]) < 0.6 * max(r["h"], current[-1]["h"]):
            current.append(r)
        else:
            lines.append(current)
            current = [r]
    lines.append(current)
    return ["  ".join(r["text"] for r in sorted(line, key=lambda r: r["x"])) for line in lines]


def extract_text(image):
    """image: PIL.Image. Returns (list_of_lines, engine_name)."""
    engine, name = _load_engine()
    arr = np.array(image.convert("RGB"))
    items = []
    if name == "PaddleOCR":
        result = engine.predict(arr[:, :, ::-1])  # PaddleOCR expects BGR
        for page in result or []:
            data = page.json.get("res", page.json) if hasattr(page, "json") else page
            for box, text in zip(data.get("rec_polys", []), data.get("rec_texts", [])):
                items.append((np.asarray(box).tolist(), text))
    else:
        result, _ = engine(arr)
        for box, text, _score in result or []:
            items.append((box, text))
    lines = _sort_reading_order(items)
    log.info("OCR (%s) returned %d lines", name, len(lines))
    return lines, name


# ----------------------------------------------------------------------------
# Label parser
# ----------------------------------------------------------------------------
# Each nutrient: regex for the label line. 'added' is matched before 'total'.
NUTRIENT_PATTERNS = {
    "energy_kcal": r"energy",
    "protein_g": r"protein",
    "carbohydrates_g": r"carbo\s*hydrate",
    "added_sugars_g": r"added\s+sugars?",
    "total_sugars_g": r"(total\s+)?sugars?",
    "dietary_fibre_g": r"(dietary\s+)?fib(re|er)",
    "saturated_fat_g": r"saturated\s+(fat|fatty)",
    "trans_fat_g": r"trans\s+(fat|fatty)",
    "total_fat_g": r"(total\s+)?fat",
    "sodium_mg": r"sodium",
}
NUMBER = r"(\d+(?:[.,]\d+)?)"


def _first_number(text, prefer_kcal=False):
    text = text.replace("O", "0") if re.search(r"\dO|O\d", text) else text
    if prefer_kcal:
        m = re.search(NUMBER + r"\s*kcal", text, re.I)
        if m:
            return float(m.group(1).replace(",", "."))
    m = re.search(NUMBER, text)
    return float(m.group(1).replace(",", ".")) if m else None


def parse_nutrients(lines):
    """Return dict nutrient -> value (first column, assumed per 100 g/ml)."""
    found = {}
    for raw in lines:
        line = raw.lower()
        for key, pattern in NUTRIENT_PATTERNS.items():
            if key in found:
                continue
            m = re.search(r"(?<![a-z])" + pattern + r"(?![a-z])", line)
            if not m:
                continue
            # Guard: plain 'sugar' line must not be the added-sugar line, 'fat'
            # must not be saturated/trans, etc.
            if key == "total_sugars_g" and re.search(r"added\s+sugar", line):
                continue
            if key == "total_fat_g" and re.search(r"(saturated|trans|mono|poly)", line):
                continue
            tail = raw[m.end():]
            value = _first_number(tail, prefer_kcal=(key == "energy_kcal"))
            if value is not None:
                found[key] = value
            break  # one nutrient per line
    return found


def parse_ingredients(text):
    """Text after 'Ingredients:' until a nutrition/allergen/storage heading."""
    m = re.search(r"ingredients?\s*[:\-]?\s*(.+)", text, re.I | re.S)
    if not m:
        return ""
    body = m.group(1)
    stop = re.search(r"(nutrition(al)?\s+(information|facts|value)|allergen|contains\s*:|"
                     r"storage|best before|mfd|manufactured|net\s+(wt|weight|quantity)|fssai|"
                     r"approx|per\s+100)", body, re.I)
    if stop:
        body = body[:stop.start()]
    return re.sub(r"\s+", " ", body).strip(" .;:")


def detect_basis(text):
    t = text.lower()
    has_100 = bool(re.search(r"per\s*100\s*(g|ml|gm)|/\s*100\s*(g|ml)|100\s*(g|ml)\b", t))
    has_serv = bool(re.search(r"per\s*serv", t))
    if has_100:
        return "per_100"
    if has_serv:
        return "per_serving"
    return "unknown"


def detect_form_from_text(text):
    return "liquid" if re.search(r"100\s*ml|per\s*100\s*ml", text.lower()) else "solid"


def parse_label(lines):
    text = "\n".join(lines)
    return {
        "ingredients": parse_ingredients(text),
        "nutrients": parse_nutrients(lines),
        "basis": detect_basis(text),
        "form": detect_form_from_text(text),
        "full_text": text,
    }


if __name__ == "__main__":
    sample = """INGREDIENTS: Whole Wheat Flour (Atta) (52%), Water, Refined Wheat Flour (Maida) (10%),
Sugar, Yeast, Iodized Salt
NUTRITIONAL INFORMATION (Approx.) Per 100 g
Energy  245 kcal
Protein  8.5 g
Carbohydrate  48.0 g
Total Sugars  4.8 g
Added Sugars  3.5 g
Dietary Fibre  6.2 g
Total Fat  2.1 g
Saturated Fat  0.5 g
Sodium  430 mg"""
    print(parse_label(sample.splitlines()))

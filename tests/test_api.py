"""
tests/test_api.py
-----------------
Tests for FastAPI backend (api.py).
Validates health, dataset, claims, verify, and similar products endpoints.

Run: python tests/test_api.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api import health, get_claims, get_dataset_route, verify, get_similar, VerifyRequest


def test_health():
    data = health()
    assert data["status"] == "ok"
    assert data["dataset_products"] == 25
    assert data["supported_claims"] > 0
    print("PASS: /api/health returned 200 with 25 products")


def test_claims():
    data = get_claims()
    assert "claims" in data
    assert len(data["claims"]) > 0
    print(f"PASS: /api/claims returned {len(data['claims'])} claims")


def test_dataset():
    data = get_dataset_route()
    assert data["total"] == 25
    assert len(data["products"]) == 25
    sample = data["products"][0]
    assert "product_name" in sample
    assert "front_claim" in sample
    assert "nutrients" in sample
    print("PASS: /api/dataset returned full 25-product catalogue")


def test_dataset_filter():
    data = get_dataset_route(compliant=True)
    assert all(p["is_technically_compliant"] is True for p in data["products"])
    print(f"PASS: /api/dataset?compliant=true returned {data['total']} compliant products")


def test_verify_non_compliant():
    req = VerifyRequest(
        claim="100% Atta / Brown Bread",
        ingredients="Whole Wheat Flour (Atta) (52%), Refined Wheat Flour (Maida) (10%), Sugar",
        nutrients={"protein_g": 8.5},
        form="solid",
        basis="per_100",
    )
    data = verify(req)
    assert data["verdict"] == "Non-Compliant"
    assert data["verdict_color"] == "red"
    assert len(data["checks"]) > 0
    assert "explanation" in data
    assert data["explanation_source"] in ("groq", "template")
    assert len(data["similar_products"]) > 0
    print(f"PASS: /api/verify correctly flagged Non-Compliant (explanation source: {data['explanation_source']})")


def test_verify_misleading():
    req = VerifyRequest(
        claim="No Added Sugar",
        ingredients="Rolled Oats, Apple Juice Concentrate, Almonds",
        nutrients={"added_sugars_g": 0.0, "total_sugars_g": 14.5},
        form="solid",
        basis="per_100",
    )
    data = verify(req)
    assert data["verdict"] == "Technically Compliant but Misleading"
    assert data["verdict_color"] == "amber"
    print("PASS: /api/verify correctly flagged Technically Compliant but Misleading")


def test_similar():
    data = get_similar(claim="No Added Sugar")
    assert "similar_products" in data
    assert len(data["similar_products"]) > 0
    print(f"PASS: /api/similar returned {len(data['similar_products'])} matched products")


def test_stats():
    from api import get_dashboard_stats
    data = get_dashboard_stats()
    assert data["products_analysed"] == 25
    assert data["compliant_count"] > 0
    assert "categories" in data
    assert "recent_analyses" in data
    print("PASS: /api/stats returned dynamic dashboard metrics from dataset")


if __name__ == "__main__":
    test_health()
    test_claims()
    test_dataset()
    test_dataset_filter()
    test_verify_non_compliant()
    test_verify_misleading()
    test_similar()
    test_stats()
    print("\nAll FastAPI backend tests passed successfully!")

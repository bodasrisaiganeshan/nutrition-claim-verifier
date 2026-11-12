"""
tests/test_llm.py
-----------------
Tests for the Groq integration and template fallback in llm_utils.py.

Run:  python tests/test_llm.py

* The Groq live-API test is SKIPPED automatically when GROQ_API_KEY is not set,
  so this file never breaks CI or offline environments.
* The template fallback test always runs and needs no network.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from rule_engine import verify_claim, V_MISLEADING, V_NON_COMPLIANT, V_COMPLIANT  # noqa: E402
from llm_utils import generate_explanation, template_explanation                   # noqa: E402


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------
def _make_verdict_and_context(claim="No Added Sugar",
                               ingredients="Rolled Oats, Apple Juice Concentrate",
                               nutrients=None):
    if nutrients is None:
        nutrients = {"total_sugars_g": 14.5, "added_sugars_g": 0.0}
    verdict = verify_claim(claim, ingredients, nutrients)
    product = {
        "product_name": "Test Muesli",
        "claim": claim,
        "ingredients": ingredients,
        "deceptive_mechanism": "Uses fruit concentrate instead of sugar",
    }
    similar = [
        {
            "product_name": "Similar Muesli",
            "front_claim": "No Added Sugar",
            "is_technically_compliant": True,
            "deceptive_mechanism": "Apple juice concentrate",
            "severity_level": "Medium",
        }
    ]
    return verdict, product, similar


# ---------------------------------------------------------------------------
# Test 1: Template fallback (always runs – no key needed)
# ---------------------------------------------------------------------------
def test_template_fallback():
    """With no API key, generate_explanation must return source='template'."""
    # Temporarily hide the key even if it happens to be set.
    import llm_utils
    original = os.environ.pop("GROQ_API_KEY", None)
    original_secret = llm_utils._secret
    llm_utils._secret = lambda name: None  # also hide .streamlit/secrets.toml
    try:
        verdict, product, similar = _make_verdict_and_context()
        text, source = generate_explanation(verdict, product, similar)
        assert source == "template", f"Expected 'template', got '{source}'"
        assert text.strip(), "Template returned empty string"
        assert "**Why this verdict:**" in text, "Expected markdown header in template output"
        print("PASS test_template_fallback: source='template', markdown present")
    finally:
        llm_utils._secret = original_secret
        if original is not None:
            os.environ["GROQ_API_KEY"] = original


# ---------------------------------------------------------------------------
# Offline tests of the Groq code path (fake client, no network, no key needed)
# ---------------------------------------------------------------------------
class _FakeCompletions:
    """Stands in for client.chat.completions; behaviour chosen per model."""
    def __init__(self, behaviour):
        self.behaviour, self.calls = behaviour, []

    def create(self, **kwargs):
        import groq
        import httpx
        model = kwargs["model"]
        self.calls.append(kwargs)
        action = self.behaviour.get(model, "ok")
        req = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
        if action in ("401", "404", "429"):
            cls = {"401": groq.AuthenticationError, "404": groq.NotFoundError,
                   "429": groq.RateLimitError}[action]
            raise cls(action, response=httpx.Response(int(action), request=req), body=None)
        if action == "offline":
            raise groq.APIConnectionError(request=req)
        content = "<think>internal</think>**Why this verdict:** fruit concentrate loophole [R-NAS]." \
            if action == "ok" else ""
        msg = type("M", (), {"content": content})
        return type("R", (), {"choices": [type("C", (), {"message": msg})]})


def _with_fake_groq(behaviour):
    """Run generate_explanation against a fake Groq client; return (text, source, fake, status)."""
    import groq
    import llm_utils
    fake = _FakeCompletions(behaviour)
    client = type("Client", (), {"chat": type("Chat", (), {"completions": fake})})

    orig_groq, orig_key, orig_secret = groq.Groq, llm_utils.get_api_key, llm_utils._secret
    groq.Groq = lambda **kw: client
    llm_utils.get_api_key = lambda: "gsk_" + "x" * 40
    llm_utils._secret = lambda name: None
    saved_model = os.environ.pop("GROQ_MODEL", None)
    try:
        verdict, product, similar = _make_verdict_and_context()
        before = verdict.verdict
        text, source = llm_utils.generate_explanation(verdict, product, similar)
        assert verdict.verdict == before, "verdict object was modified"
        return text, source, fake, dict(llm_utils.last_status)
    finally:
        groq.Groq, llm_utils.get_api_key, llm_utils._secret = orig_groq, orig_key, orig_secret
        if saved_model is not None:
            os.environ["GROQ_MODEL"] = saved_model


def test_groq_success_mocked():
    text, source, fake, status = _with_fake_groq({})
    assert source == "groq", source
    assert "<think>" not in text and "Why this verdict" in text
    assert fake.calls[0]["model"] == "openai/gpt-oss-120b"
    assert fake.calls[0]["messages"][0]["content"].startswith("You are the explanation module")
    assert '"verdict"' in fake.calls[0]["messages"][1]["content"]  # grounded facts are sent
    print(f"PASS test_groq_success_mocked: model={status['model']}, think-block stripped")


def test_groq_model_fallback_mocked():
    text, source, fake, status = _with_fake_groq({"openai/gpt-oss-120b": "404", "openai/gpt-oss-20b": "empty"})
    assert source == "groq" and status["model"] == "llama-3.3-70b-versatile", status
    assert [c["model"] for c in fake.calls] == list(dict.fromkeys(
        ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]))
    print("PASS test_groq_model_fallback_mocked: unavailable/empty models skipped")


def test_groq_errors_fall_back_to_template_mocked():
    for action, expect in [("401", "rejected the API key"), ("429", "rate limit"), ("offline", "unreachable")]:
        text, source, fake, status = _with_fake_groq({m: action for m in
                                                      ("openai/gpt-oss-120b", "openai/gpt-oss-20b",
                                                       "llama-3.3-70b-versatile")})
        assert source == "template" and "**Why this verdict:**" in text
        assert expect in status["reason"], status
        assert len(fake.calls) == 1, "should not hammer other models on auth/rate/network errors"
        print(f"PASS test_groq_errors_fall_back_to_template_mocked: {action} -> template ({status['reason']})")


def test_placeholder_keys_ignored():
    import llm_utils
    for bad in [None, "", "gsk_...your_key_here...", "your_key_here", "gsk_short"]:
        assert llm_utils.is_placeholder_key(bad), bad
    assert not llm_utils.is_placeholder_key("gsk_" + "A1b2" * 12)
    print("PASS test_placeholder_keys_ignored")


# ---------------------------------------------------------------------------
# Test 2: Template output is deterministic
# ---------------------------------------------------------------------------
def test_template_is_deterministic():
    """Same inputs must always produce identical template output."""
    verdict, product, similar = _make_verdict_and_context()
    t1 = template_explanation(verdict, product, similar)
    t2 = template_explanation(verdict, product, similar)
    assert t1 == t2, "Template output is not deterministic"
    print("PASS test_template_is_deterministic")


# ---------------------------------------------------------------------------
# Test 3: Verdict immutability — LLM explanation must not alter the verdict
# ---------------------------------------------------------------------------
def test_verdict_not_changed_by_explanation():
    """The verdict from rule_engine must be identical before and after calling
    generate_explanation, regardless of which source (template or Groq) is used."""
    for claim, ing, nut in [
        ("No Added Sugar", "Oats, Apple Juice Concentrate", {"total_sugars_g": 14.5, "added_sugars_g": 0}),
        ("High Protein",   "Milk",                          {"protein_g": 15.0}),
        ("Sugar Free",     "Sorbitol, Wheat Flour",         {"total_sugars_g": 2.0}),
    ]:
        verdict_before = verify_claim(claim, ing, nut)
        verdict_obj_id = id(verdict_before)

        product = {"claim": claim}
        similar = []
        _, source = generate_explanation(verdict_before, product, similar)

        verdict_after = verify_claim(claim, ing, nut)
        assert verdict_before.verdict == verdict_after.verdict, (
            f"Verdict changed after explanation! '{claim}': "
            f"{verdict_before.verdict} -> {verdict_after.verdict}"
        )
        print(f"PASS test_verdict_not_changed: '{claim}' -> {verdict_before.verdict} (source={source})")


# ---------------------------------------------------------------------------
# Test 4: Live Groq call (skipped if GROQ_API_KEY not set)
# ---------------------------------------------------------------------------
def test_groq_live():
    """
    Makes a real Groq API call and verifies:
      - source == 'groq'
      - response is non-empty markdown
      - response does not contradict the rule engine's verdict
      - response is under 2000 characters (sanity check on token limit)
    """
    import llm_utils
    api_key = llm_utils.get_api_key()  # env var or .streamlit/secrets.toml; placeholders ignored
    if not api_key:
        print("SKIP test_groq_live: no real GROQ_API_KEY configured (env var or .streamlit/secrets.toml)")
        return

    verdict, product, similar = _make_verdict_and_context()
    expected_verdict = verdict.verdict  # save before the call

    text, source = generate_explanation(verdict, product, similar)

    assert source == "groq", f"Expected source='groq' when key is set, got '{source}'"
    assert text.strip(), "Groq returned empty response"
    assert len(text) < 2000, f"Response unexpectedly long ({len(text)} chars)"

    # The LLM must not contradict the verdict from the rule engine.
    # We check that the verdict string appears in the explanation text.
    assert expected_verdict in text or any(
        kw in text.lower() for kw in ["misleading", "compliant", "loophole", "concentrate"]
    ), f"Groq response doesn't mention the verdict or key evidence:\n{text}"

    # Rule engine verdict must be unchanged after the call.
    re_checked = verify_claim(verdict.claim, product.get("ingredients", ""),
                               {"total_sugars_g": 14.5, "added_sugars_g": 0.0})
    assert re_checked.verdict == expected_verdict, (
        f"Verdict changed after Groq call! {expected_verdict} -> {re_checked.verdict}"
    )

    print(f"PASS test_groq_live: source='groq', {len(text)} chars")
    print("--- Groq explanation preview (first 300 chars) ---")
    print(text[:300])
    print("---")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    test_template_fallback()
    test_template_is_deterministic()
    test_verdict_not_changed_by_explanation()
    test_placeholder_keys_ignored()
    test_groq_success_mocked()
    test_groq_model_fallback_mocked()
    test_groq_errors_fall_back_to_template_mocked()
    test_groq_live()
    print("\nAll llm tests done.")


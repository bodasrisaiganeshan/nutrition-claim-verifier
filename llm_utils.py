"""
llm_utils.py
------------
Generates the plain-language loophole explanation.

1. If GROQ_API_KEY is set and the 'groq' package is installed, a Groq model
   writes the explanation using ONLY the facts we pass in (strict grounding).
2. Otherwise (no key, no internet, API error) a deterministic template built
   from the rule results and the dataset is returned. The demo never breaks.
"""

import json
import logging
import os
import re

log = logging.getLogger("llm_utils")

# Models tried in order. GROQ_MODEL (env var or secrets.toml) is tried first.
# gpt-oss models are available on Groq's free developer plan; llama-3.3 is kept
# as a last resort for older keys that still have access to it.
DEFAULT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]
GROQ_MODEL = os.environ.get("GROQ_MODEL", DEFAULT_MODELS[0])  # kept for backwards compatibility

# Last outcome of generate_explanation, for the UI caption ("why template?").
last_status = {"model": None, "reason": None}

SYSTEM_PROMPT = """You are the explanation module of a research tool that audits nutrition claims on Indian packaged foods.

STRICT GROUNDING RULES:
- Use ONLY the facts in the user message: the rule-engine results, the product's label data, and the similar products from the curated dataset.
- Do NOT use outside knowledge, brand reputation, health advice, or assumptions.
- Do NOT change the verdict. The rule engine's verdict is final.
- If the data is insufficient to explain something, say so plainly.
- Quote numbers exactly as given. Mention the rule IDs you rely on.

OUTPUT (markdown, under 170 words, simple language for a general audience):
**Why this verdict:** 2-3 sentences.
**The loophole / deceptive mechanism:** 2-3 sentences (write "None identified from the data." if none).
**What a shopper should check:** 1-2 bullet points.
**Similar pattern in our dataset:** 1 sentence referring to the similar products, if any."""


def _facts(verdict, product, similar):
    """Compact JSON payload of everything the LLM is allowed to use."""
    return {
        "claim": verdict.claim,
        "verdict": verdict.verdict,
        "physical_form": verdict.form,
        "rule_checks": [
            {"rule_id": c.rule_id, "check": c.claim_name, "status": c.status,
             "message": c.message, "evidence": c.evidence}
            for c in verdict.checks
        ],
        "warnings": verdict.warnings,
        "product_label": product,
        "similar_products_from_dataset": similar,
    }


def template_explanation(verdict, product, similar):
    """Deterministic fallback explanation (no LLM)."""
    lines = ["**Why this verdict:**"]
    if not verdict.checks:
        lines.append("The claim does not match any Phase-1 FSSAI rule, so it cannot be verified from the label.")
    for c in verdict.checks:
        ev = f" ({'; '.join(c.evidence)})" if c.evidence else ""
        lines.append(f"- *{c.claim_name}* [{c.rule_id}]: {c.message}{ev}")

    lines.append("\n**The loophole / deceptive mechanism:**")
    mechanism = product.get("deceptive_mechanism")
    flagged = [c for c in verdict.checks if c.status in ("misleading", "vague")]
    if mechanism:
        lines.append(mechanism)
    elif flagged:
        lines.append(" ".join(c.message for c in flagged))
    else:
        lines.append("None identified from the available data.")

    if similar:
        names = ", ".join(s["product_name"] for s in similar)
        lines.append(f"\n**Similar pattern in our dataset:** {names}.")
    for w in verdict.warnings:
        lines.append(f"\n> Note: {w}")
    return "\n".join(lines)


def is_placeholder_key(key):
    """True for empty keys or the example value shipped in .env.example / secrets.toml."""
    if not key or not key.strip():
        return True
    k = key.strip()
    return ("..." in k or "your" in k.lower() or "here" in k.lower()
            or not k.startswith("gsk_") or len(k) < 30)


def _secret(name):
    """Read a value from .streamlit/secrets.toml when running under Streamlit."""
    try:
        import streamlit as st
        return st.secrets.get(name) or None
    except Exception:
        return None  # running outside Streamlit (tests, CLI) – that's fine


def get_api_key():
    """Key resolution: GROQ_API_KEY env var, then secrets.toml. Placeholders count as missing."""
    for key in (os.environ.get("GROQ_API_KEY"), _secret("GROQ_API_KEY")):
        if not is_placeholder_key(key):
            return key.strip()
    return None


def _model_candidates():
    preferred = os.environ.get("GROQ_MODEL") or _secret("GROQ_MODEL")
    models = ([preferred] if preferred else []) + DEFAULT_MODELS
    return list(dict.fromkeys(models))  # de-duplicate, keep order


def _clean(text):
    """Remove any <think>…</think> reasoning block a model may emit."""
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def _fallback(verdict, product, similar, reason):
    last_status.update(model=None, reason=reason)
    log.warning("Using template explanation: %s", reason)
    return template_explanation(verdict, product, similar), "template"


def generate_explanation(verdict, product, similar):
    """Return (markdown_text, source) where source is 'groq' or 'template'.

    Key resolution order:
      1. GROQ_API_KEY environment variable  (production / CI)
      2. GROQ_API_KEY in .streamlit/secrets.toml  (local dev)
      3. Template fallback  (no real key configured, or API unreachable)
    Models are tried in order (see _model_candidates); a model that is
    unavailable to this key is skipped. The verdict is never modified.
    """
    api_key = get_api_key()
    if not api_key:
        return _fallback(verdict, product, similar, "no valid GROQ_API_KEY configured")
    try:
        import groq
    except ImportError:
        return _fallback(verdict, product, similar, "'groq' package not installed")

    client = groq.Groq(api_key=api_key, timeout=20, max_retries=1)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "FACTS (JSON):\n" + json.dumps(_facts(verdict, product, similar),
                                                                  ensure_ascii=False, indent=1, default=str)},
    ]
    reason = "unknown error"
    for model in _model_candidates():
        kwargs = dict(model=model, temperature=0.2, max_completion_tokens=1500, messages=messages)
        if model.startswith("openai/gpt-oss"):
            kwargs["reasoning_effort"] = "low"  # keep reasoning short so the answer fits
        try:
            response = client.chat.completions.create(**kwargs)
            text = _clean(response.choices[0].message.content)
            if not text:
                reason = f"{model} returned an empty answer"
                log.warning(reason)
                continue
            last_status.update(model=model, reason=None)
            log.info("Groq explanation generated with %s (%d chars)", model, len(text))
            return text, "groq"
        except groq.AuthenticationError:
            return _fallback(verdict, product, similar, "Groq rejected the API key (401 invalid key)")
        except (groq.NotFoundError, groq.PermissionDeniedError, groq.BadRequestError) as exc:
            reason = f"model {model} unavailable ({type(exc).__name__})"
            log.warning(reason)
            continue  # try the next model
        except groq.RateLimitError:
            return _fallback(verdict, product, similar, "Groq rate limit reached")
        except (groq.APIConnectionError, groq.APITimeoutError):
            return _fallback(verdict, product, similar, "Groq unreachable (no internet or timeout)")
        except Exception as exc:  # anything else: never break the demo
            return _fallback(verdict, product, similar, f"Groq error: {exc}")
    return _fallback(verdict, product, similar, reason)

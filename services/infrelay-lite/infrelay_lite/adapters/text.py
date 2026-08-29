"""OpenRouter text (LLM). Ported from the full gateway's OpenRouterText.

OpenRouter speaks the OpenAI chat-completions shape. Returns the reply text plus a usage dict
(model, requested_model, tokens, finish_reason) the caller reads for trace and cut-off detection.
"""

from __future__ import annotations

from typing import Any

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.models import MediaKind

OPENROUTER_BASE = "https://openrouter.ai/api/v1"


def _message_text(resp: Any) -> str:
    try:
        return (resp.choices[0].message.content or "").strip()
    except (AttributeError, IndexError, TypeError):
        return ""


class OpenRouterText(Adapter):
    provider = "openrouter"
    kind = MediaKind.TEXT

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("OpenRouter needs an API key")
        model = (params.get("model") or "").strip()
        if not model:
            raise AdapterError("OpenRouter text needs a model id")
        user = (params.get("user") or "").strip()
        if not user:
            raise AdapterError("user prompt required")
        system = params.get("system") or ""
        temperature = float(params.get("temperature", 0.85))
        max_tokens = int(params.get("max_tokens", 3000))
        try:
            from openai import OpenAI
        except ImportError as e:
            raise AdapterError("OpenRouter needs 'pip install openai'") from e

        client = OpenAI(base_url=OPENROUTER_BASE, api_key=token)
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as e:
            raise AdapterError(f"OpenRouter error: {e}") from e

        choice = resp.choices[0]
        usage = getattr(resp, "usage", None)
        actual_model = str(getattr(resp, "model", "") or model).strip() or model
        meta = {
            "model": actual_model,
            "requested_model": model,
            "input_tokens": getattr(usage, "prompt_tokens", 0) or 0,
            "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
            "finish_reason": getattr(choice, "finish_reason", "") or "",
        }
        return Output(type="text", value=_message_text(resp), meta=meta)

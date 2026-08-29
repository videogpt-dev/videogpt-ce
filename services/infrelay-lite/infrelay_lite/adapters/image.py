"""Image adapters. Ported from the full gateway's FalImage + OpenRouterImage.

fal returns an asset URL; OpenRouter returns an image URL through the chat modalities
extension. The gateway hands the URL back and Kinoforge downloads it.
"""

from __future__ import annotations

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.adapters.util import fal_subscribe, first_media_url, run_optional_negative
from infrelay_lite.models import MediaKind

OPENROUTER_BASE = "https://openrouter.ai/api/v1"


class FalImage(Adapter):
    provider = "fal"
    kind = MediaKind.IMAGE

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("fal.ai needs an API key")
        model = (params.get("model") or "").strip()
        if not model:
            raise AdapterError("fal.ai image needs a model id")
        prompt = (params.get("prompt") or "").strip()
        if not prompt:
            raise AdapterError("prompt required")
        args: dict = {"prompt": prompt, "aspect_ratio": params.get("aspect_ratio") or "9:16"}
        if params.get("seed") is not None:
            args["seed"] = int(params["seed"])
        if params.get("reference_b64"):
            args["image_url"] = f"data:image/png;base64,{params['reference_b64']}"
        negative = params.get("negative") or ""
        result = run_optional_negative(lambda a: fal_subscribe(model, a, token), args, negative)
        url = first_media_url(result)
        if not url:
            raise AdapterError("fal.ai returned no image")
        return Output(type="url", value=url)


class OpenRouterImage(Adapter):
    provider = "openrouter"
    kind = MediaKind.IMAGE

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("OpenRouter needs an API key")
        model = (params.get("model") or "").strip()
        if not model:
            raise AdapterError("OpenRouter image needs a model id")
        prompt = (params.get("prompt") or "").strip()
        if not prompt:
            raise AdapterError("prompt required")
        try:
            from openai import OpenAI
        except ImportError as e:
            raise AdapterError("OpenRouter needs 'pip install openai'") from e

        content: list = [{"type": "text", "text": prompt}]
        if params.get("reference_b64"):
            ref = f"data:image/png;base64,{params['reference_b64']}"
            content.append({"type": "image_url", "image_url": {"url": ref}})
        client = OpenAI(base_url=OPENROUTER_BASE, api_key=token)
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": content}],
                extra_body={"modalities": ["image", "text"]},
            )
        except Exception as e:
            raise AdapterError(f"OpenRouter error: {e}") from e

        images = getattr(resp.choices[0].message, "images", None) or []
        for img in images:
            url = (img.get("image_url") or {}).get("url") if isinstance(img, dict) else None
            if url:
                return Output(type="url", value=url)
        raise AdapterError("OpenRouter returned no image (model may not support image output)")

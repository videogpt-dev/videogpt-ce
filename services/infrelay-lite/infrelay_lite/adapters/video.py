"""fal video. Ported from the full gateway's FalVideo.

Text-to-video, or image-to-video when a reference frame is given. Returns the asset URL.
"""

from __future__ import annotations

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.adapters.util import fal_subscribe, first_media_url
from infrelay_lite.models import MediaKind


def _duration(seconds) -> int:
    try:
        value = float(seconds)
    except (TypeError, ValueError) as exc:
        raise AdapterError("video duration must be positive") from exc
    if value <= 0:
        raise AdapterError("video duration must be positive")
    return max(1, int(round(value)))


def _res_label(resolution) -> str:
    try:
        return "1080p" if int(resolution) >= 1080 else "720p"
    except (TypeError, ValueError):
        return "720p"


class FalVideo(Adapter):
    provider = "fal"
    kind = MediaKind.VIDEO

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("fal.ai needs an API key")
        model = (params.get("model") or "").strip()
        if not model:
            raise AdapterError("fal.ai video needs a model id")
        prompt = (params.get("prompt") or "").strip()
        if not prompt:
            raise AdapterError("prompt required")
        args: dict = {
            "prompt": prompt,
            "duration": _duration(params.get("seconds") or 5),
            "resolution": _res_label(params.get("resolution") or 720),
        }
        if params.get("reference_b64"):
            args["image_url"] = f"data:image/png;base64,{params['reference_b64']}"
        url = first_media_url(fal_subscribe(model, args, token))
        if not url:
            raise AdapterError("fal.ai returned no video")
        return Output(type="url", value=url)

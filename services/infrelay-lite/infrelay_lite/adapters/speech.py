"""fal speech (kind=audio). Ported from the full gateway's FalSpeech.

Runs a TTS model and returns the audio URL. Models disagree on the text key (prompt vs text),
so both are sent.
"""

from __future__ import annotations

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.adapters.util import fal_subscribe, first_media_url
from infrelay_lite.models import MediaKind


class FalSpeech(Adapter):
    provider = "fal"
    kind = MediaKind.AUDIO

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("fal.ai needs an API key")
        model = (params.get("model") or "").strip()
        if not model:
            raise AdapterError("fal.ai speech needs a model id")
        text = (params.get("text") or params.get("prompt") or "").strip()
        if not text:
            raise AdapterError("text required")
        args: dict = {"prompt": text, "text": text}
        if params.get("voice"):
            args["voice"] = params["voice"]
        url = first_media_url(fal_subscribe(model, args, token))
        if not url:
            raise AdapterError("fal.ai returned no audio")
        return Output(type="url", value=url)

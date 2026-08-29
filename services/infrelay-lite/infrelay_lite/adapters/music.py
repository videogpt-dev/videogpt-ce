"""fal music. Ported from the full gateway's FalMusic.

Music models disagree on the duration key (duration vs seconds_total), so both are sent —
the model reads whichever it expects. Returns the asset URL.
"""

from __future__ import annotations

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.adapters.util import fal_subscribe, first_media_url
from infrelay_lite.models import MediaKind


class FalMusic(Adapter):
    provider = "fal"
    kind = MediaKind.MUSIC

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("fal.ai needs an API key")
        model = (params.get("model") or "").strip()
        if not model:
            raise AdapterError("fal.ai music needs a model id")
        prompt = (params.get("prompt") or "").strip()
        if not prompt:
            raise AdapterError("prompt required")
        seconds = max(5, int(params.get("seconds") or 30))
        args = {"prompt": prompt, "duration": seconds, "seconds_total": seconds}
        url = first_media_url(fal_subscribe(model, args, token))
        if not url:
            raise AdapterError("fal.ai returned no audio")
        return Output(type="url", value=url)

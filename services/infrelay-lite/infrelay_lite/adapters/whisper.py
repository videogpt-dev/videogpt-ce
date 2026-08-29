"""Local faster-whisper transcription. Keyless: runs on-box, no provider account."""

from __future__ import annotations

import base64
import os
import tempfile

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.models import MediaKind

_MODELS: dict[str, object] = {}


def _model(size: str):
    cached = _MODELS.get(size)
    if cached is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise AdapterError("faster-whisper is not installed") from exc
        cached = WhisperModel(size, device="cpu", compute_type="int8")
        _MODELS[size] = cached
    return cached


class LocalWhisper(Adapter):
    provider = "whisper"
    kind = MediaKind.TRANSCRIBE

    def run(self, params: dict, token: str, options: dict) -> Output:
        audio_b64 = params.get("audio_b64")
        if not audio_b64:
            raise AdapterError("audio_b64 required")
        size = (params.get("model") or "base").strip()
        language = params.get("language") or None
        word_ts = bool(params.get("word_timestamps"))
        model = _model(size)

        data = base64.b64decode(audio_b64)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(data)
            path = tmp.name
        try:
            segments, info = model.transcribe(path, language=language, word_timestamps=word_ts)
            out: list[dict] = []
            for seg in segments:
                item: dict = {"start": float(seg.start), "end": float(seg.end), "text": seg.text}
                if word_ts and seg.words:
                    item["words"] = [
                        {"start": float(w.start), "end": float(w.end), "word": w.word}
                        for w in seg.words
                    ]
                out.append(item)
        finally:
            os.unlink(path)

        return Output(
            type="transcript",
            value="",
            meta={"segments": out, "language": info.language},
        )

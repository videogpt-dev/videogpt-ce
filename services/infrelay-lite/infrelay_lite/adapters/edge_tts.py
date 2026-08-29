"""Local Edge TTS narration. Keyless: runs on-box, no provider account. Returns the mp3
inline plus per-word timing (from Edge WordBoundary events) so the caller can burn captions."""

from __future__ import annotations

import asyncio
import base64

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.models import MediaKind

_DEFAULT_VOICE = "en-US-AriaNeural"
_TICKS_PER_SECOND = 1e7


async def _synthesize(text: str, voice: str) -> tuple[bytes, list[dict]]:
    try:
        import edge_tts
    except ImportError as exc:
        raise AdapterError("edge-tts is not installed") from exc

    audio = bytearray()
    words: list[dict] = []
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = float(chunk["offset"]) / _TICKS_PER_SECOND
            end = start + float(chunk["duration"]) / _TICKS_PER_SECOND
            words.append({"word": chunk["text"], "start": start, "end": end})
    if not audio:
        raise AdapterError("edge-tts returned no audio")
    return bytes(audio), words


class EdgeSpeech(Adapter):
    provider = "edge"
    kind = MediaKind.AUDIO

    def run(self, params: dict, token: str, options: dict) -> Output:
        text = (params.get("text") or params.get("prompt") or "").strip()
        if not text:
            raise AdapterError("text required")
        voice = (params.get("voice") or _DEFAULT_VOICE).strip()
        audio, words = asyncio.run(_synthesize(text, voice))
        duration = words[-1]["end"] if words else 0.0
        return Output(
            type="b64",
            value=base64.b64encode(audio).decode("ascii"),
            mime="audio/mpeg",
            meta={"words": words, "duration": duration},
        )

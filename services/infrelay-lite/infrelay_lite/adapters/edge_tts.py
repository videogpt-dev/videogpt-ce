"""Local Edge TTS narration. Keyless: runs on-box, no provider account. Returns the mp3
inline plus per-word timing (from Edge WordBoundary events) so the caller can burn captions."""

from __future__ import annotations

import asyncio
import base64

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.models import MediaKind

_DEFAULT_VOICE = "en-US-AriaNeural"
_TICKS_PER_SECOND = 1e7

# Non-Latin scripts an English voice cannot speak, with one example Edge voice to suggest. Only
# for a clearer error message, not a config list the pipeline selects from.
_SCRIPTS: tuple[tuple[int, int, str, str], ...] = (
    (0x0900, 0x097F, "Hindi", "hi-IN-SwaraNeural"),
    (0x0600, 0x06FF, "Arabic", "ar-EG-SalmaNeural"),
    (0x0400, 0x04FF, "Russian", "ru-RU-SvetlanaNeural"),
    (0x3040, 0x30FF, "Japanese", "ja-JP-NanamiNeural"),
    (0xAC00, 0xD7A3, "Korean", "ko-KR-SunHiNeural"),
    (0x4E00, 0x9FFF, "Chinese", "zh-CN-XiaoxiaoNeural"))


def _language_hint(text: str) -> str:
    """Name the likely language of `text` from its script and suggest a matching voice, for a
    clear error when the configured voice cannot speak it. Empty when it looks like plain Latin."""
    for ch in text:
        code = ord(ch)
        for lo, hi, name, voice in _SCRIPTS:
            if lo <= code <= hi:
                return f" The narration looks like {name}; set STORY_TTS_VOICE to a {name} voice such as {voice!r}."
    return ""


_MAX_ATTEMPTS = 3


async def _synthesize(text: str, voice: str) -> tuple[bytes, list[dict]]:
    try:
        import edge_tts
    except ImportError as exc:
        raise AdapterError("edge-tts is not installed") from exc

    # Edge hits Microsoft's online endpoint, which intermittently returns no audio for valid
    # text, so retry before giving up. Persistent failure is almost always a real voice/language
    # mismatch (e.g. an en-US voice on Hindi text), surfaced with a clear, actionable message.
    for attempt in range(_MAX_ATTEMPTS):
        audio = bytearray()
        words: list[dict] = []
        try:
            communicate = edge_tts.Communicate(text, voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    start = float(chunk["offset"]) / _TICKS_PER_SECOND
                    end = start + float(chunk["duration"]) / _TICKS_PER_SECOND
                    words.append({"word": chunk["text"], "start": start, "end": end})
        except edge_tts.exceptions.NoAudioReceived:
            audio = bytearray()
        if audio:
            return bytes(audio), words
        if attempt < _MAX_ATTEMPTS - 1:
            await asyncio.sleep(0.75 * (attempt + 1))

    raise AdapterError(
        f"Voiceover failed: the voice {voice!r} produced no audio after {_MAX_ATTEMPTS} "
        f"attempts, which happens when its language does not match the narration."
        f"{_language_hint(text)}"
    )


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
            meta={"words": words, "duration": duration})

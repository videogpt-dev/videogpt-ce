import base64
from pathlib import Path
from typing import Any

import httpx

from core.config import settings

_ASPECT_DIMS = {
    "9:16": (1080, 1920),
    "16:9": (1920, 1080),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


def dimensions(aspect: str) -> tuple[int, int]:
    return _ASPECT_DIMS.get(aspect, (1080, 1920))


async def generate(
    kind: str, provider: str, model: str, input_: dict[str, Any]
) -> dict[str, Any]:
    body = {"kind": kind, "provider": provider, "model": model, "input": input_}
    async with httpx.AsyncClient(timeout=None) as client:
        resp = await client.post(f"{settings.infrelay_url}/v1/generate", json=body)
    resp.raise_for_status()
    return resp.json().get("output") or {}


async def _bytes_from_output(output: dict[str, Any]) -> bytes:
    kind = output.get("type")
    value = output.get("value") or ""
    if kind == "b64":
        return base64.b64decode(value)
    if kind == "url":
        async with httpx.AsyncClient(timeout=None) as client:
            resp = await client.get(value)
        resp.raise_for_status()
        return resp.content
    raise RuntimeError(f"unexpected media output type: {kind}")


def _scene_dir(pid: str) -> Path:
    d = settings.output_dir / pid
    d.mkdir(parents=True, exist_ok=True)
    return d


async def save_image(pid: str, index: int, prompt: str, aspect: str) -> str:
    output = await generate(
        "image",
        settings.image_provider,
        settings.image_model,
        {"prompt": prompt, "aspect_ratio": aspect},
    )
    data = await _bytes_from_output(output)
    name = f"scene-{index}.png"
    (_scene_dir(pid) / name).write_bytes(data)
    return f"{pid}/{name}"


async def save_voice(pid: str, index: int, text: str, voice: str) -> dict[str, Any]:
    output = await generate(
        "audio", settings.tts_provider, "", {"text": text, "voice": voice}
    )
    data = await _bytes_from_output(output)
    name = f"scene-{index}.mp3"
    (_scene_dir(pid) / name).write_bytes(data)
    meta = output.get("meta") or {}
    return {
        "rel": f"{pid}/{name}",
        "words": meta.get("words") or [],
        "duration": float(meta.get("duration") or 0.0),
    }


async def save_music(pid: str, prompt: str, seconds: int) -> str:
    output = await generate(
        "music",
        settings.music_provider,
        settings.music_model,
        {"prompt": prompt, "seconds": seconds},
    )
    data = await _bytes_from_output(output)
    name = "music.mp3"
    (_scene_dir(pid) / name).write_bytes(data)
    return f"{pid}/{name}"

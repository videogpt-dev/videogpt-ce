from typing import Any

import httpx

from core import media
from core.config import settings


def _scene_seconds(narration: str, duration: float) -> float:
    if duration > 0:
        return round(duration + 0.4, 2)
    words = len((narration or "").split())
    return max(2.0, round(words / 2.5, 2))


async def render_story(
    pid: str,
    story: dict[str, Any],
    aspect: str = "9:16",
    report: Any = None,
) -> dict[str, Any]:
    scenes = story.get("scenes") or []
    if not scenes:
        return {"ok": False, "error": "story has no scenes to render"}
    style = (story.get("style") or "").strip()
    total = len(scenes)
    # Reserve one extra step for the assemble phase so it does not read 100% while the
    # (longest) render is still running.
    steps = total + 1

    built: list[dict[str, Any]] = []
    for i, scene in enumerate(scenes):
        prompt = (scene.get("prompt") or "").strip()
        if style:
            # Lead with the style: image models weight the opening tokens most, so a trailing
            # "Visual style: ..." clause barely shifts the look, while prepending it drives it.
            prompt = f"{style}. {prompt}"
        if report:
            report.phase(f"scene {i + 1}/{total}: image", step=i, total=steps)
        image_rel = await media.save_image(pid, i, prompt, aspect)
        if report:
            report.phase(f"scene {i + 1}/{total}: narration", step=i, total=steps)
        voice = await media.save_voice(pid, i, scene.get("narration") or "", settings.tts_voice)
        built.append(
            {
                "image": image_rel,
                "audio": voice["rel"],
                "seconds": _scene_seconds(scene.get("narration") or "", voice["duration"]),
                "words": voice["words"],
            }
        )

    width, height = media.dimensions(aspect)
    has_words = any(s["words"] for s in built)
    body = {
        "pid": pid,
        "width": width,
        "height": height,
        "fps": settings.story_fps,
        "showCaptions": has_words,
        "sceneGap": 0.5,
        "out": "video.mp4",
        "out_dir": pid,
        "scenes": built,
    }
    if report:
        report.phase("assembling video", step=total, total=steps)
    async with httpx.AsyncClient(timeout=None) as client:
        resp = await client.post(f"{settings.editor_url}/render-story", json=body)
    resp.raise_for_status()
    result = resp.json()
    if not result.get("ok"):
        return {"ok": False, "error": result.get("error") or "render failed"}
    return {"ok": True, "file": result.get("file"), "scenes": len(built)}

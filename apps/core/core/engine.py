import uuid
from typing import Any

import httpx

from core.config import settings
from core import story_defaults


def _empty_definitions() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "id": "self-hosted-offline",
        "version": "sha256:offline",
        "engine": {"minimum": "0.1.0"},
        "definitions": [],
    }


def build_clips_request(
    project_id: str,
    video_rel: str | None,
    options: dict[str, Any],
    *,
    audio_path: str | None = None,
    preset_moments: list[dict[str, Any]] | None = None,
    pretranscript: list[dict[str, Any]] | None = None,
    analyze_only: bool | None = None,
) -> dict[str, Any]:
    """A kinoforge clips request. Source-light adds three optional inputs:

    - `audio_path`: run the find stages on audio alone (no video). Used with analyze_only.
    - `analyze_only`: find and return moments, render nothing.
    - `preset_moments` + `pretranscript`: skip discovery and render exactly these moments from
      `video_rel` (a fetched segment), captioning them from the sliced transcript.
    """
    opts = {
        "clip_count": int(options.get("clip_count", 10)),
        "min_length": float(options.get("min_length", 20)),
        "max_length": float(options.get("max_length", 60)),
        "formats": options.get("formats") or ["9:16"],
        "quality": options.get("quality", "high"),
        "generate_captions": bool(options.get("generate_captions", True)),
        "subtitle_font_size": int(options.get("subtitle_font_size", 14)),
        "analyze_only": bool(options.get("analyze_only", False))
        if analyze_only is None
        else analyze_only,
        "min_interest_score": float(options.get("min_interest_score", 0.3)),
        "moment_route": {},
    }
    # Moment finder: "ai" routes discovery through a text model (via infrelay), "offline"
    # (default) uses the on-box energy/transcript heuristics. AI needs a provider + model.
    moment_route: dict[str, Any] = {}
    if str(options.get("moment_finder") or "offline") == "ai":
        provider = str(options.get("moment_provider") or "").strip()
        model = str(options.get("moment_model") or "").strip()
        if provider and model:
            moment_route = {"provider": provider, "model": model}
    context_window = int(options.get("context_window") or 1_000_000)
    config: dict[str, Any] = {
        "transcription": {
            "model": options.get("whisper_model") or "base",
            "device": "cpu",
            "compute_type": "int8",
        },
        "scoring": {},
        "limits": {},
        "moment_route": moment_route,
        "context_window": context_window,
        "output_dir": str(settings.output_dir),
        "slug": project_id,
        "min_length": opts["min_length"],
        "max_length": opts["max_length"],
        "clip_count": opts["clip_count"],
        "quality": opts["quality"],
        "formats": opts["formats"],
        "verbose": False,
        "generate_captions": opts["generate_captions"],
        "processing": {"max_workers": 2, "use_gpu": False},
        "rendering": {
            "burn_subtitles": opts["generate_captions"],
            "mute_output": False,
            "subtitle_font_size": opts["subtitle_font_size"],
        },
    }
    if preset_moments is not None:
        config["preset_moments"] = preset_moments
    if pretranscript is not None:
        config["pretranscript"] = pretranscript

    if audio_path:
        input_block: dict[str, Any] = {"audio_path": str(audio_path)}
    else:
        input_block = {"video_path": str(settings.output_dir / (video_rel or ""))}

    return {
        "job_id": uuid.uuid4().hex,
        "project_id": project_id,
        "owner": "",
        "workspace": str(settings.output_dir / project_id),
        "input": input_block,
        "options": opts,
        "config": config,
        "definitions": _empty_definitions(),
        "state": {},
    }


async def run_clips(request: dict[str, Any]) -> dict[str, Any]:
    return await _post("/v1/segments/clips/execute", request)


def _pick() -> dict[str, str]:
    return {"provider": settings.story_provider, "model": settings.story_model}


def _budget_config() -> dict[str, Any]:
    return {"budgets": {"story": settings.story_token_budget}}


def build_story_request(project_id: str, title: str, options: dict[str, Any]) -> dict[str, Any]:
    context = {
        "title": title,
        "description": str(options.get("description") or ""),
        "scene_count": int(options.get("scene_count", 8)),
        "aspect_ratio": options.get("aspect_ratio") or "9:16",
        "language": str(options.get("language") or ""),
        "genre": str(options.get("genre") or ""),
        "cast": options.get("cast") or [],
        "premise": str(options.get("premise") or ""),
        "series_name": str(options.get("series_name") or ""),
        "series_episodes": options.get("series_episodes") or [],
        "series_position": int(options.get("series_position", 0)),
        "mature": bool(options.get("mature", False)),
    }
    return {
        "job_id": uuid.uuid4().hex,
        "project_id": project_id,
        "owner": "",
        "context": context,
        "agent": story_defaults.SCREENWRITER,
        "pick": _pick(),
        "config": _budget_config(),
        "definitions": story_defaults.story_bundle(),
    }


def build_series_request(project_id: str, name: str, options: dict[str, Any]) -> dict[str, Any]:
    series = {
        "name": name,
        "premise": str(options.get("premise") or ""),
        "style": str(options.get("style") or ""),
        "aspect_ratio": options.get("aspect_ratio") or "9:16",
        "cast": options.get("cast") or [],
        "episodes": options.get("episodes") or [],
    }
    return {
        "job_id": uuid.uuid4().hex,
        "project_id": project_id,
        "owner": "",
        "series": series,
        "count": int(options.get("count", 6)),
        "pick": _pick(),
        "config": _budget_config(),
        "definitions": story_defaults.series_bundle(),
    }


async def run_story(request: dict[str, Any]) -> dict[str, Any]:
    return await _post("/v1/segments/story/write", request)


async def run_series(request: dict[str, Any]) -> dict[str, Any]:
    return await _post("/v1/segments/series/plan", request)


async def _post(path: str, request: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.kinoforge_url}{path}"
    headers = {"content-type": "application/json"}
    async with httpx.AsyncClient(timeout=None) as client:
        resp = await client.post(url, json=request, headers=headers)
    if resp.is_error:
        raise RuntimeError(f"kinoforge {resp.status_code}: {_error_detail(resp)}")
    return resp.json()


def _error_detail(resp: httpx.Response) -> str:
    try:
        detail = resp.json().get("detail")
    except ValueError:
        return resp.text.strip() or resp.reason_phrase
    if isinstance(detail, list):
        return "; ".join(
            f"{'.'.join(str(p) for p in item.get('loc', [])[1:])}: {item.get('msg', '')}".strip(": ")
            for item in detail
        )
    return str(detail) if detail else resp.reason_phrase

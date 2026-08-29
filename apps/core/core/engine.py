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


def build_clips_request(project_id: str, video_rel: str, options: dict[str, Any]) -> dict[str, Any]:
    opts = {
        "clip_count": int(options.get("clip_count", 10)),
        "min_length": float(options.get("min_length", 20)),
        "max_length": float(options.get("max_length", 60)),
        "formats": options.get("formats") or ["9:16"],
        "quality": options.get("quality", "high"),
        "generate_captions": bool(options.get("generate_captions", True)),
        "analyze_only": bool(options.get("analyze_only", False)),
        "min_interest_score": float(options.get("min_interest_score", 0.3)),
        "moment_route": {},
    }
    config = {
        "transcription": {
            "model": options.get("whisper_model") or "base",
            "device": "cpu",
            "compute_type": "int8",
        },
        "scoring": {},
        "limits": {},
        "moment_route": {},
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
            "subtitle_font_size": 24,
        },
    }
    workspace = str(settings.output_dir / project_id)
    video_abs = str(settings.output_dir / video_rel)
    return {
        "job_id": uuid.uuid4().hex,
        "project_id": project_id,
        "owner": "",
        "workspace": workspace,
        "input": {"video_path": video_abs},
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
    resp.raise_for_status()
    return resp.json()

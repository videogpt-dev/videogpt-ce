import asyncio
import re
import shutil
from pathlib import Path

import httpx
from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core import engine, jobs, kinoforge, store, story_pipeline
from core.config import settings

app = FastAPI(title="self-hosted-core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProjectIn(BaseModel):
    title: str
    kind: str = "clip"


class SourceUrlIn(BaseModel):
    url: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": settings.kinoforge_url}


@app.get("/api/inference/providers")
async def inference_providers(kind: str = "text") -> dict:
    headers = {}
    if settings.infrelay_service_token:
        headers["Authorization"] = f"Bearer {settings.infrelay_service_token}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{settings.infrelay_url}/v1/models",
                params={"kind": kind},
                headers=headers,
            )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="infrelay provider catalog unavailable") from exc

    providers = sorted(
        {
            str(item.get("provider") or "").strip()
            for item in payload.get("items", [])
            if str(item.get("provider") or "").strip()
        }
    )
    return {
        "items": [{"provider": provider, "kind": kind} for provider in providers],
        "total": len(providers),
    }


@app.get("/api/projects")
def projects() -> list[dict]:
    return store.list_projects()


@app.post("/api/projects")
def new_project(body: ProjectIn) -> dict:
    return store.create_project(body.title, body.kind)


@app.get("/api/projects/{project_id}")
def one_project(project_id: str) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return project


@app.delete("/api/projects/{project_id}")
def remove_project(project_id: str) -> dict:
    if not store.delete_project(project_id):
        raise HTTPException(status_code=404, detail="project not found")
    return {"ok": True}


@app.post("/api/projects/{project_id}/source")
async def upload_source(project_id: str, file: UploadFile = File(...)) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    ext = Path(file.filename or "source.mp4").suffix or ".mp4"
    dest_dir = settings.output_dir / project_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"source{ext}"
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)
    project["source"] = f"{project_id}/source{ext}"
    store.save_project(project)
    return {"ok": True, "source": project["source"]}


@app.post("/api/projects/{project_id}/source-url")
async def source_from_url(project_id: str, body: SourceUrlIn) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    # Source-light: just record the URL. Nothing is downloaded here — the clips run fetches audio
    # to find moments, then only the chosen ranges to render.
    project["source_url"] = url
    project["source_kind"] = "url"
    project.pop("source", None)
    store.save_project(project)
    return {"ok": True, "source_url": url}


async def _run_ytdlp(args: list[str], rep: jobs.Reporter) -> int:
    proc = await asyncio.create_subprocess_exec(
        "yt-dlp",
        "--newline",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    assert proc.stdout is not None
    pending = b""
    while chunk := await proc.stdout.read(65536):
        *lines, pending = re.split(rb"[\r\n]", pending + chunk)
        for line in lines:
            if line.strip():
                rep.log(line.decode(errors="replace"))
    if pending.strip():
        rep.log(pending.decode(errors="replace"))
    return await proc.wait()


async def _fetch_audio(url: str, dest_dir: Path, rep: jobs.Reporter) -> Path:
    """Audio only (bestaudio) for finding moments — no video downloaded."""
    for old in dest_dir.glob("audio.*"):
        old.unlink()
    code = await _run_ytdlp(
        ["-f", "bestaudio/best", "-o", str(dest_dir / "audio.%(ext)s"), url], rep
    )
    files = list(dest_dir.glob("audio.*"))
    if code != 0 or not files:
        raise RuntimeError("audio fetch failed")
    return files[0]


async def _fetch_range(url: str, start: float, end: float, dest_dir: Path,
                       rep: jobs.Reporter) -> Path:
    """Exactly the [start, end] slice, keyframe-forced so it starts on the frame we asked for.
    A slice already fetched into dest_dir is reused."""
    cached = dest_dir / "segment.mp4"
    if cached.exists() and cached.stat().st_size:
        rep.log(f"reusing fetched segment [{start:.1f}-{end:.1f}]")
        return cached
    for old in dest_dir.glob("segment.*"):
        old.unlink()
    code = await _run_ytdlp(
        [
            "-f", "bestvideo*[height<=1080]+bestaudio/best[height<=1080]/best",
            "--merge-output-format", "mp4",
            "--download-sections", f"*{start}-{end}",
            "--force-keyframes-at-cuts",
            "-o", str(dest_dir / "segment.%(ext)s"),
            url,
        ],
        rep,
    )
    files = list(dest_dir.glob("segment.*"))
    if code != 0 or not files:
        raise RuntimeError(f"segment fetch failed [{start:.1f}-{end:.1f}]")
    mp4 = [p for p in files if p.suffix == ".mp4"]
    segment = mp4[0] if mp4 else files[0]
    if segment.stat().st_size == 0:
        raise RuntimeError(f"segment fetch produced 0 bytes [{start:.1f}-{end:.1f}]")
    return segment


async def _ffmpeg_concat(segments: list[Path], out: Path) -> None:
    """Concatenate the fetched clip segments into one compact video (stream copy)."""
    listing = out.with_suffix(".txt")
    listing.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in segments))
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
        "-c", "copy", "-movflags", "+faststart", str(out),
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
    )
    _, err = await proc.communicate()
    listing.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"concat failed: {err.decode(errors='replace')[-300:]}")


def _slice_transcript(transcript: list[dict], start: float, end: float,
                      offset: float) -> list[dict]:
    """Transcript segments overlapping [start,end], rebased to the segment then shifted by
    `offset` (its position in the concatenated compact video)."""
    out = []
    for seg in transcript or []:
        s = float(seg.get("start") or 0)
        e = float(seg.get("end") or 0)
        if e <= start or s >= end:
            continue
        out.append({
            **seg,
            "start": max(0.0, s - start) + offset,
            "end": max(0.0, min(e, end) - start) + offset,
        })
    return out


def _emit_kino_logs(rep: jobs.Reporter, response: dict) -> None:
    """Surface kinoforge's own per-stage log lines in the job log so the engine's work is visible."""
    for entry in response.get("logs") or []:
        level = str(entry.get("level") or "").lower()
        mark = {"warning": "! ", "error": "x "}.get(level, "")
        rep.log(f"  kino: {mark}{entry.get('text') or ''}")


def _relativize_artifacts(res: dict) -> None:
    for art in res.get("artifacts", []):
        try:
            art["rel"] = str(Path(art.get("path", "")).resolve().relative_to(settings.output_dir))
        except ValueError:
            art["rel"] = art.get("path", "")


async def _ensure_audio(project: dict, url: str, rep: jobs.Reporter) -> Path:
    """Audio for a URL source, cached across runs (it never changes; download it at most once)."""
    work = settings.output_dir / project["id"] / "_srclight"
    work.mkdir(parents=True, exist_ok=True)
    audio = next(iter(work.glob("audio.*")), None)
    if audio is None:
        rep.phase("fetching audio")
        return await _fetch_audio(url, work, rep)
    rep.phase("audio ready")
    return audio


async def _find_clips(project: dict, options: dict, rep: jobs.Reporter) -> dict:
    """Phase 1: find moments only, render nothing. A URL source finds on its audio (never the
    whole video); a local source finds on the uploaded file. The moments + transcript are stored
    on the project so the UI can preview each one before anything is rendered."""
    project_id = project["id"]
    url = project.get("source_url")
    # A prior find on this same project already transcribed this audio; resume it instead of
    # paying for Whisper again (dropped when options["force"] asks for a clean re-run). The
    # find workspace itself is thrown away below, so this is the only thing that survives.
    resume_transcript = project.get("source_transcript") or None
    if url and not project.get("source"):
        audio = await _ensure_audio(project, url, rep)
        find_req = engine.build_clips_request(
            f"{project_id}__find", None, options, audio_path=str(audio),
            resume_transcript=resume_transcript, analyze_only=True,
        )
    else:
        find_req = engine.build_clips_request(
            f"{project_id}__find", project["source"], options,
            resume_transcript=resume_transcript, analyze_only=True,
        )
    # Find on a throwaway slug so the analyze pass's pool writes never touch the project.
    rep.phase("engine: transcribe + find moments")
    find_full = await engine.run_clips(find_req)
    _emit_kino_logs(rep, find_full)
    shutil.rmtree(settings.output_dir / f"{project_id}__find", ignore_errors=True)
    data = find_full.get("result", {}).get("data") or {}
    moments = data.get("used_moments") or data.get("moments") or []
    project["moments"] = moments
    project["source_transcript"] = data.get("transcript") or []
    project["last_result"] = None
    store.save_project(project)
    rep.phase(f"{len(moments)} moments found")
    return {"moments": moments}


async def _render_clips(project: dict, indices: list[int], rep: jobs.Reporter) -> dict:
    """Phase 2: render only the approved moments. A URL source fetches each chosen range and
    renders from those bytes; a local source renders the ranges straight from the uploaded file."""
    options = project.get("clip_options") or {}
    moments_all = project.get("moments") or []
    chosen = (
        [moments_all[i] for i in indices if 0 <= i < len(moments_all)] if indices
        else list(moments_all)
    )
    if not chosen:
        raise RuntimeError("no moments selected to render")
    transcript = project.get("source_transcript") or []
    url = project.get("source_url")
    if url and not project.get("source"):
        res = await _render_source_light(project, url, chosen, transcript, options, rep)
    else:
        rep.phase("engine: render clips")
        render_req = engine.build_clips_request(
            project["id"], project["source"], options,
            preset_moments=chosen, pretranscript=transcript, analyze_only=False,
        )
        render_full = await engine.run_clips(render_req)
        _emit_kino_logs(rep, render_full)
        res = render_full.get("result", {})
        _relativize_artifacts(res)
    project["last_result"] = res
    store.save_project(project)
    rep.phase(f"{len(res.get('artifacts', []))} clips")
    return res


async def _render_source_light(project: dict, url: str, moments: list[dict],
                               transcript: list[dict], options: dict,
                               rep: jobs.Reporter) -> dict:
    """Fetch each chosen moment's exact range, concatenate into one compact video, then render all
    of them in a single pass (captions from the sliced transcript). The full source is never
    downloaded; only the approved clips' ranges land on disk, kept per range so a retry or
    re-render reuses them."""
    project_id = project["id"]
    segdir = settings.output_dir / project_id / "_srclight" / "segments"
    segdir.mkdir(parents=True, exist_ok=True)
    used: set[str] = set()
    try:
        segments: list[Path] = []
        preset: list[dict] = []
        pretranscript: list[dict] = []
        offset = 0.0
        for i, moment in enumerate(moments, 1):
            start = float(moment.get("start") or 0)
            end = float(moment.get("end") or 0)
            if end <= start:
                continue
            rep.phase(f"fetching clip {i}/{len(moments)}")
            key = f"{start:.3f}-{end:.3f}"
            used.add(key)
            seg = await _fetch_range(url, start, end, segdir / key, rep)
            segments.append(seg)
            duration = end - start
            preset.append({**moment, "start": offset, "end": offset + duration})
            pretranscript.extend(_slice_transcript(transcript, start, end, offset))
            offset += duration
        if not segments:
            return {"artifacts": []}

        compact = settings.output_dir / project_id / "source_compact.mp4"
        await _ffmpeg_concat(segments, compact)
        compact_rel = str(compact.resolve().relative_to(settings.output_dir))

        rep.phase("engine: render clips")
        render_req = engine.build_clips_request(
            project_id, compact_rel, options,
            preset_moments=preset, pretranscript=pretranscript, analyze_only=False,
        )
        render_full = await engine.run_clips(render_req)
        _emit_kino_logs(rep, render_full)
        res = render_full.get("result", {})
        _relativize_artifacts(res)
        return res
    finally:
        # Keep the audio and this render's segments for re-runs; drop other ranges and the
        # compact video.
        for old in segdir.iterdir():
            if old.name not in used:
                shutil.rmtree(old, ignore_errors=True)
        (settings.output_dir / project_id / "source_compact.mp4").unlink(missing_ok=True)


@app.post("/api/projects/{project_id}/clips")
async def run_project_clips(project_id: str, options: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    if not project.get("source") and not project.get("source_url"):
        raise HTTPException(status_code=400, detail="add a source video or URL first")
    clip_options = options or {}
    project["clip_options"] = clip_options
    store.save_project(project)
    job = jobs.start(project_id, "clips", lambda rep: _find_clips(project, clip_options, rep))
    return {"job_id": job["id"]}


@app.post("/api/projects/{project_id}/clips/render")
async def render_project_clips(project_id: str, body: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    if not project.get("moments"):
        raise HTTPException(status_code=400, detail="find moments before rendering")
    indices = [int(i) for i in (body or {}).get("indices") or []]
    job = jobs.start(project_id, "clips", lambda rep: _render_clips(project, indices, rep))
    return {"job_id": job["id"]}


async def _write_story(project: dict, options: dict, rep: jobs.Reporter) -> dict:
    request = engine.build_story_request(project["id"], project.get("title", ""), options)
    rep.phase("writing script")
    result = await engine.run_story(request)
    res = result.get("result", {})
    # A chosen visual-style preset overrides the writer's style; story_pipeline appends it to
    # every scene's image prompt as "Visual style: <style>".
    style = str(options.get("style") or "").strip()
    if style and isinstance(res.get("story"), dict):
        res["story"]["style"] = style
    project["last_story"] = res
    store.save_project(project)
    if res.get("error"):
        return res
    rep.phase(f"{len(res.get('story', {}).get('scenes', []))} scenes")
    return res


@app.post("/api/projects/{project_id}/story")
async def write_project_story(project_id: str, options: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    story_brief = options or {}
    project["story_brief"] = story_brief
    store.save_project(project)
    job = jobs.start(project_id, "story", lambda rep: _write_story(project, story_brief, rep))
    return {"job_id": job["id"]}


async def _render_story(project: dict, rep: jobs.Reporter) -> dict:
    story = (project.get("last_story") or {}).get("story")
    if not story:
        return {"ok": False, "error": "write the story first"}
    result = await story_pipeline.render_story(project["id"], story, report=rep)
    project["last_render"] = result
    store.save_project(project)
    return result


@app.post("/api/projects/{project_id}/story/render")
async def render_project_story(project_id: str) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    job = jobs.start(project_id, "render", lambda rep: _render_story(project, rep))
    return {"job_id": job["id"]}


async def _plan_series(project: dict, options: dict, rep: jobs.Reporter) -> dict:
    request = engine.build_series_request(project["id"], project.get("title", ""), options)
    rep.phase("planning episodes")
    result = await engine.run_series(request)
    res = result.get("result", {})
    project["last_series"] = res
    store.save_project(project)
    if res.get("error"):
        return res
    rep.phase(f"{len(res.get('episodes', []))} episodes")
    return res


@app.post("/api/projects/{project_id}/series")
async def plan_project_series(project_id: str, options: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    series_brief = options or {}
    project["series_brief"] = series_brief
    store.save_project(project)
    job = jobs.start(project_id, "series", lambda rep: _plan_series(project, series_brief, rep))
    return {"job_id": job["id"]}


async def _episode_story(project: dict, index: int, rep: jobs.Reporter) -> dict:
    """Write and store an episode's script (scenes) so it can be reviewed before rendering."""
    episode = ((project.get("last_series") or {}).get("episodes") or [])[index]
    episode_pid = f"{project['id']}-ep{index}"
    options = {
        "description": episode.get("description") or "",
        "series_name": project.get("title", ""),
        "series_position": index,
    }
    rep.phase(f"episode {index + 1}: writing script")
    write_req = engine.build_story_request(episode_pid, episode.get("title") or "", options)
    written = await engine.run_story(write_req)
    res = written.get("result") or {}
    story = res.get("story")
    if not story:
        return {"_error": res.get("error") or "story write failed"}
    project.setdefault("episode_stories", {})[str(index)] = story
    store.save_project(project)
    return story


async def _write_episode(project: dict, index: int, rep: jobs.Reporter) -> dict:
    story = await _episode_story(project, index, rep)
    if story.get("_error"):
        return {"ok": False, "error": story["_error"]}
    rep.phase(f"{len(story.get('scenes', []))} scenes")
    return {"ok": True}


async def _render_episode(project: dict, index: int, rep: jobs.Reporter) -> dict:
    episode = ((project.get("last_series") or {}).get("episodes") or [])[index]
    episode_pid = f"{project['id']}-ep{index}"
    # Reuse the reviewed script if it was written; otherwise write it now (one-shot fallback).
    story = (project.get("episode_stories") or {}).get(str(index))
    if not story:
        story = await _episode_story(project, index, rep)
        if story.get("_error"):
            return {"ok": False, "error": story["_error"]}
    rendered = await story_pipeline.render_story(episode_pid, story, report=rep)
    renders = project.setdefault("episode_renders", {})
    renders[str(index)] = {"title": episode.get("title"), "render": rendered}
    store.save_project(project)
    return rendered


def _episode_or_404(project_id: str, index: int) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    episodes = (project.get("last_series") or {}).get("episodes") or []
    if index < 0 or index >= len(episodes):
        raise HTTPException(status_code=404, detail="episode not found")
    return project


@app.post("/api/projects/{project_id}/series/episodes/{index}/write")
async def write_series_episode(project_id: str, index: int) -> dict:
    project = _episode_or_404(project_id, index)
    job = jobs.start(
        project_id, f"episode-write:{index}", lambda rep: _write_episode(project, index, rep)
    )
    return {"job_id": job["id"]}


@app.post("/api/projects/{project_id}/series/episodes/{index}/render")
async def render_series_episode(project_id: str, index: int) -> dict:
    project = _episode_or_404(project_id, index)
    job = jobs.start(
        project_id, f"episode:{index}", lambda rep: _render_episode(project, index, rep)
    )
    return {"job_id": job["id"]}


@app.post("/api/projects/{project_id}/series/episodes/{index}/style")
def set_episode_style(project_id: str, index: int, body: dict | None = None) -> dict:
    """Edit an episode's visual style; it leads every scene's image prompt on the next render."""
    project = _episode_or_404(project_id, index)
    story = (project.get("episode_stories") or {}).get(str(index))
    if not isinstance(story, dict):
        raise HTTPException(status_code=409, detail="write the episode script first")
    story["style"] = str((body or {}).get("style") or "").strip()
    store.save_project(project)
    return {"ok": True}


@app.post("/api/projects/{project_id}/series/episodes")
def add_series_episode(project_id: str, body: dict | None = None) -> dict:
    """Append a hand-written episode to the series plan; its script is written on demand."""
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    data = body or {}
    series = project.setdefault("last_series", {"ok": True, "episodes": []})
    episodes = series.setdefault("episodes", [])
    episodes.append(
        {
            "title": (str(data.get("title") or "").strip() or f"Episode {len(episodes) + 1}"),
            "description": str(data.get("description") or "").strip(),
        }
    )
    store.save_project(project)
    return {"ok": True, "index": len(episodes) - 1}


@app.get("/api/jobs/{job_id}")
def one_job(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.get("/api/projects/{project_id}/jobs")
def project_jobs(project_id: str) -> list[dict]:
    return jobs.list_for_project(project_id)


@app.api_route("/api/engine/{path:path}", methods=["GET", "POST"])
async def engine_proxy(path: str, request: Request) -> Response:
    upstream = await kinoforge.proxy(
        request.method,
        path,
        content=await request.body(),
        params=request.query_params,
        headers={"content-type": request.headers.get("content-type", "application/json")},
    )
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )


settings.output_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(settings.output_dir)), name="files")
jobs.sweep_orphans()

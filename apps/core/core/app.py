import subprocess
from pathlib import Path

import httpx
from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.config import settings
from core import engine, story_pipeline, store

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
def source_from_url(project_id: str, body: SourceUrlIn) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    dest_dir = settings.output_dir / project_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    for old in dest_dir.glob("source.*"):
        old.unlink()
    proc = subprocess.run(
        [
            "yt-dlp",
            "-f",
            "bestvideo*+bestaudio/best",
            "--merge-output-format",
            "mp4",
            "-o",
            str(dest_dir / "source.%(ext)s"),
            url,
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise HTTPException(status_code=502, detail=(proc.stderr or "download failed")[-500:])
    files = list(dest_dir.glob("source.*"))
    if not files:
        raise HTTPException(status_code=502, detail="no file downloaded")
    project["source"] = f"{project_id}/{files[0].name}"
    project["source_url"] = url
    store.save_project(project)
    return {"ok": True, "source": project["source"]}


@app.post("/api/projects/{project_id}/clips")
async def run_project_clips(project_id: str, options: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    source = project.get("source")
    if not source:
        raise HTTPException(status_code=400, detail="upload a source video first")
    request = engine.build_clips_request(project_id, source, options or {})
    try:
        result = await engine.run_clips(request)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text[:500]) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"engine unreachable: {exc}") from exc
    res = result.get("result", {})
    for art in res.get("artifacts", []):
        try:
            art["rel"] = str(Path(art.get("path", "")).resolve().relative_to(settings.output_dir))
        except ValueError:
            art["rel"] = art.get("path", "")
    project["last_result"] = res
    store.save_project(project)
    return result


@app.post("/api/projects/{project_id}/story")
async def write_project_story(project_id: str, options: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    request = engine.build_story_request(project_id, project.get("title", ""), options or {})
    try:
        result = await engine.run_story(request)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text[:500]) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"engine unreachable: {exc}") from exc
    res = result.get("result", {})
    project["last_story"] = res
    store.save_project(project)
    return result


@app.post("/api/projects/{project_id}/story/render")
async def render_project_story(project_id: str) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    story = (project.get("last_story") or {}).get("story")
    if not story:
        raise HTTPException(status_code=400, detail="write the story first")
    try:
        result = await story_pipeline.render_story(project_id, story)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text[:500]) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"render service unreachable: {exc}") from exc
    project["last_render"] = result
    store.save_project(project)
    return result


@app.post("/api/projects/{project_id}/series")
async def plan_project_series(project_id: str, options: dict | None = None) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    request = engine.build_series_request(project_id, project.get("title", ""), options or {})
    try:
        result = await engine.run_series(request)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text[:500]) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"engine unreachable: {exc}") from exc
    res = result.get("result", {})
    project["last_series"] = res
    store.save_project(project)
    return result


@app.post("/api/projects/{project_id}/series/episodes/{index}/render")
async def render_series_episode(project_id: str, index: int) -> dict:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    episodes = (project.get("last_series") or {}).get("episodes") or []
    if index < 0 or index >= len(episodes):
        raise HTTPException(status_code=404, detail="episode not found")
    episode = episodes[index]
    episode_pid = f"{project_id}-ep{index}"
    options = {
        "description": episode.get("description") or "",
        "series_name": project.get("title", ""),
        "series_position": index,
    }
    write_req = engine.build_story_request(episode_pid, episode.get("title") or "", options)
    try:
        written = await engine.run_story(write_req)
        story = (written.get("result") or {}).get("story")
        if not story:
            error = (written.get("result") or {}).get("error") or "story write failed"
            raise HTTPException(status_code=502, detail=error)
        rendered = await story_pipeline.render_story(episode_pid, story)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=exc.response.text[:500]) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"engine unreachable: {exc}") from exc
    renders = project.setdefault("episode_renders", {})
    renders[str(index)] = {"title": episode.get("title"), "render": rendered}
    store.save_project(project)
    return rendered


@app.api_route("/api/engine/{path:path}", methods=["GET", "POST"])
async def engine_proxy(path: str, request: Request) -> Response:
    url = f"{settings.kinoforge_url}/v1/{path}"
    body = await request.body()
    headers = {"content-type": request.headers.get("content-type", "application/json")}
    async with httpx.AsyncClient(timeout=None) as client:
        upstream = await client.request(
            request.method,
            url,
            content=body,
            params=request.query_params,
            headers=headers,
        )
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )


settings.output_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(settings.output_dir)), name="files")

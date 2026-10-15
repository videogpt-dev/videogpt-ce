"""infrelay-lite entrypoint. Run: uvicorn infrelay_lite.app:app --port 8090

A tiny self-host inference gateway for Kinoforge: the same POST /v1/inference/{task} contract
the full gateway serves (a task, a pick of model and provider or `auto`, fallbacks), but with
its own small provider set, keys and routes from the environment, and no database, credits,
pooling, queue or metering. Self-host can instead point Kinoforge at the paid cloud gateway by
swapping INFRELAY_URL.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, FastAPI, HTTPException, Query

from infrelay_lite import runner
from infrelay_lite.adapters.base import AdapterError
from infrelay_lite.adapters.registry import providers_for
from infrelay_lite.auth import require_service
from infrelay_lite.config import settings
from infrelay_lite.models import (
    GenerationResponse,
    HealthResponse,
    InferenceRequest,
    MediaKind,
    ModelsResponse,
    TasksResponse,
)
from infrelay_lite.tasks import AITask, Tasks

app = FastAPI(
    title="Infrelay Lite API",
    summary="Self-host inference gateway for Kinoforge (OpenRouter + fal)",
    description=(
        "The self-host tier of the inference gateway. Serves the same POST /v1/inference/{task} "
        "contract Kinoforge calls, with environment keys and routes and no database, credits, "
        "pooling, queue or metering. Protected endpoints require ServiceToken when "
        "INFRELAY_SERVICE_TOKEN is configured."
    ),
    version="0.1.0",
    openapi_tags=[
        {"name": "Service", "description": "Health and service metadata."},
        {"name": "Runtime API", "description": "Unified inference and model listing."},
    ],
)


@app.get("/health", tags=["Service"], summary="Service health", response_model=HealthResponse)
def health() -> dict:
    return {"ok": True, "service": "infrelay-lite", "env": settings().infrelay_env}


@app.get(
    "/v1/models/{scope}",
    tags=["Runtime API"],
    summary="List servable providers of a kind, or all",
    description=(
        "Lite ships no model catalog: pass the provider's own model id. This lists which "
        "providers can serve each media kind."
    ),
    dependencies=[Depends(require_service)],
    response_model=ModelsResponse,
)
def list_models(scope: str, page: int = Query(1, ge=1), per_page: int | None = None) -> dict:
    if scope == "all":
        kinds = list(MediaKind)
    else:
        try:
            kinds = [MediaKind(scope)]
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=f"unknown kind {scope!r}") from exc
    items = [{"provider": p, "kind": k.value} for k in kinds for p in providers_for(k)]
    size = min(per_page or settings().max_page_size, settings().max_page_size)
    start = (page - 1) * size
    return {
        "items": items[start : start + size],
        "total": len(items),
        "page": page,
        "per_page": size,
    }


@app.get(
    "/v1/tasks",
    tags=["Runtime API"],
    summary="List AI tasks",
    description="Every task POST /v1/inference/{task} accepts, with its kind.",
    dependencies=[Depends(require_service)],
    response_model=TasksResponse,
)
def list_tasks() -> dict:
    items = [
        {"task": task.value, "kind": Tasks.kind(task).value, "group": Tasks.group(task)}
        for task in AITask
    ]
    return {"items": items, "total": len(items)}


@app.post(
    "/v1/inference/{task}",
    tags=["Runtime API"],
    summary="Run an AI task",
    description=(
        "`inference` is `auto` (the task's route from INFRELAY_ROUTES, moving on when a step "
        "fails), a model id (any provider lite can run that serves it), or {model, provider, "
        "fallback}. Output is a URL, inline b64, or text; the caller downloads or stores it."
    ),
    dependencies=[Depends(require_service)],
    response_model=GenerationResponse,
)
def infer(task: AITask, req: InferenceRequest) -> dict:
    if req.callback_url:
        raise HTTPException(status_code=400, detail="infrelay-lite answers directly: no queue")
    if len(req.inference.fallback) > settings().max_fallbacks:
        detail = f"at most {settings().max_fallbacks} fallbacks per call"
        raise HTTPException(status_code=422, detail=detail)
    steps = runner.plan(task, req.inference, req.credential)
    if not steps:
        raise HTTPException(status_code=404, detail=f"nothing can run {task.value}")
    try:
        output, byok, served = runner.run_first(task, steps, dict(req.input), req.credential)
    except AdapterError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "request_id": str(uuid.uuid4()),
        "task": task.value,
        "kind": Tasks.kind(task).value,
        "provider": served.provider,
        "model": served.model,
        "output": output.as_dict(),
        # Lite has no credit accounting; usage reports only whether a BYOK key was used.
        "usage": {"source_cost": None, "currency": None, "unit": None, "credits": 0, "byok": byok},
    }

"""infrelay-lite entrypoint. Run: uvicorn infrelay_lite.app:app --port 8090

A tiny self-host inference gateway for Kinoforge: the same POST /v1/generate contract the
full gateway serves, but OpenRouter + fal only, keys from the environment, and no database,
credits, pooling, or metering. Self-host can instead point Kinoforge at the paid cloud
gateway by swapping INFRELAY_URL.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, FastAPI, HTTPException

from infrelay_lite import runner
from infrelay_lite.adapters.base import AdapterError
from infrelay_lite.adapters.registry import providers_for
from infrelay_lite.auth import require_service
from infrelay_lite.config import settings
from infrelay_lite.models import (
    GenerateRequest,
    GenerationResponse,
    HealthResponse,
    MediaKind,
    ModelsResponse,
)

app = FastAPI(
    title="Infrelay Lite API",
    summary="Self-host inference gateway for Kinoforge (OpenRouter + fal)",
    description=(
        "The self-host tier of the inference gateway. Serves the same POST /v1/generate contract "
        "Kinoforge calls, restricted to OpenRouter + fal with environment keys and no database, "
        "credits, pooling, or metering. Protected endpoints require ServiceToken when "
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
    "/v1/models",
    tags=["Runtime API"],
    summary="List servable providers per kind",
    description=(
        "Lite ships no model catalog: pass the provider's own model id straight to /v1/generate. "
        "This lists which providers can serve each media kind."
    ),
    dependencies=[Depends(require_service)],
    response_model=ModelsResponse,
)
def list_models(kind: MediaKind | None = None) -> dict:
    kinds = [kind] if kind is not None else list(MediaKind)
    items = [
        {"provider": provider, "kind": k.value}
        for k in kinds
        for provider in providers_for(k)
    ]
    return {"items": items, "total": len(items)}


@app.post(
    "/v1/generate",
    tags=["Runtime API"],
    summary="Generate one media output",
    description=(
        "One explicit (provider, model). Provider key comes from the environment unless the "
        "request injects a credential. Output is a URL, inline b64, or text; the caller "
        "downloads or stores it."
    ),
    dependencies=[Depends(require_service)],
    response_model=GenerationResponse,
)
def generate(req: GenerateRequest) -> dict:
    try:
        output, byok = runner.run(
            req.kind, req.provider, req.model, dict(req.input), req.credential, req.options
        )
    except AdapterError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "request_id": str(uuid.uuid4()),
        "kind": req.kind.value,
        "provider": req.provider,
        "model": req.model,
        "output": output.as_dict(),
        # Lite has no credit accounting; usage reports only whether a BYOK key was used.
        "usage": {"source_cost": None, "currency": None, "unit": None, "credits": 0, "byok": byok},
    }

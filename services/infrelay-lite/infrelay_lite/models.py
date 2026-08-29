"""Request and response shapes. A minimal subset of the full gateway's /v1 contract, kept
byte-identical where Kinoforge reads it (output.type / output.value / output.meta)."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class MediaKind(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    MUSIC = "music"
    AUDIO = "audio"
    TRANSCRIBE = "transcribe"


class Credential(BaseModel):
    api_key: str | None = Field(default=None, description="Per-request BYOK API key.")
    base_url: str | None = Field(default=None, description="Optional custom provider base URL.")
    extra: dict = Field(default_factory=dict, description="Provider-specific extra fields.")


class GenerateRequest(BaseModel):
    kind: MediaKind = Field(description="Media type to generate.")
    provider: str = Field(description="Provider slug: fal or openrouter.")
    model: str = Field(default="", description="Provider model id.")
    input: dict = Field(default_factory=dict, description="Provider input (prompt, etc.).")
    tenant_id: str | None = Field(default=None, description="Ignored by lite (single-user).")
    credential: Credential | None = Field(
        default=None,
        description="Injected BYOK credential. Omit to use the platform env key.",
    )
    options: dict = Field(default_factory=dict, description="Execution options for adapters.")


class OutputResponse(BaseModel):
    type: str = Field(description="Output transport: text, url, or b64.")
    value: str
    mime: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class UsageResponse(BaseModel):
    source_cost: float | None = None
    currency: str | None = None
    unit: str | None = None
    credits: int = 0
    byok: bool = False


class GenerationResponse(BaseModel):
    request_id: str
    kind: MediaKind
    provider: str
    model: str
    output: OutputResponse
    usage: UsageResponse


class ModelsResponse(BaseModel):
    items: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0


class HealthResponse(BaseModel):
    ok: bool
    service: str
    env: str

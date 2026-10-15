"""Request and response shapes. A minimal subset of the full gateway's /v1 contract, kept
byte-identical where Kinoforge reads it (output.type / output.value / output.meta)."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


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


AUTO = "auto"


class Pick(BaseModel):
    model: str = Field(default=AUTO, description="A provider model id, or `auto` for the route.")
    provider: str = Field(default=AUTO, description="A provider slug, or `auto` for any.")

    @field_validator("model", "provider", mode="before")
    @classmethod
    def _blank_is_auto(cls, value: Any) -> str:
        return str(value or "").strip() or AUTO

    @property
    def auto_model(self) -> bool:
        return self.model.lower() == AUTO

    @property
    def any_provider(self) -> bool:
        return self.provider.lower() == AUTO


class Choice(Pick):
    fallback: list[Pick] = Field(default_factory=list, description="Picks tried after this one.")

    @field_validator("fallback", mode="before")
    @classmethod
    def _one_or_many(cls, value: Any) -> list:
        if value is None:
            return []
        items = value if isinstance(value, list) else [value]
        return [{"model": item} if isinstance(item, str) else item for item in items]

    def picks(self) -> list[Pick]:
        return [Pick(model=self.model, provider=self.provider), *self.fallback]


class InferenceRequest(BaseModel):
    inference: Choice = Field(
        default_factory=Choice, description="`auto`, a model id, or {model, provider, fallback}."
    )
    input: dict = Field(default_factory=dict, description="Provider input (prompt, etc.).")
    tenant_id: str | None = Field(default=None, description="Ignored by lite (single-user).")
    credential: Credential | None = Field(
        default=None,
        description="An own key for the named provider. Omit to use the env key.",
    )
    callback_url: str | None = Field(
        default=None, description="Not served by lite, which answers every call directly."
    )

    @field_validator("inference", mode="before")
    @classmethod
    def _shorthand(cls, value: Any) -> Any:
        if value is None:
            return {}
        return {"model": value} if isinstance(value, str) else value


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
    task: str
    kind: MediaKind
    provider: str
    model: str
    output: OutputResponse
    usage: UsageResponse


class ModelsResponse(BaseModel):
    items: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    per_page: int = 0


class TasksResponse(BaseModel):
    items: list[dict[str, str]] = Field(default_factory=list)
    total: int = 0


class HealthResponse(BaseModel):
    ok: bool
    service: str
    env: str

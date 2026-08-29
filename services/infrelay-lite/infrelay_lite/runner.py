"""Resolve the provider key and run one adapter. No pooling, no metering, no fallback."""

from __future__ import annotations

from infrelay_lite.adapters.base import AdapterError, Output
from infrelay_lite.adapters.registry import find, providers_for
from infrelay_lite.config import settings
from infrelay_lite.models import Credential, MediaKind

# The only two keyed providers lite ships. Key comes from this env var unless a request injects one.
_PROVIDER_ENV: dict[str, str] = {
    "fal": "FAL_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}

# On-box providers that need no account key.
_LOCAL_PROVIDERS: set[str] = {"whisper"}


def _platform_key(provider: str) -> str:
    if provider == "fal":
        return settings().fal_key
    if provider == "openrouter":
        return settings().openrouter_api_key
    return ""


def resolve_token(provider: str, credential: Credential | None) -> tuple[str, bool]:
    """The key to run with, and whether it came from the request (BYOK). Injected wins."""
    if credential and credential.api_key:
        return credential.api_key, True
    return _platform_key(provider), False


def run(
    kind: MediaKind,
    provider: str,
    model: str,
    params: dict,
    credential: Credential | None,
    options: dict,
) -> tuple[Output, bool]:
    provider = (provider or "").strip().lower()
    if provider not in _PROVIDER_ENV and provider not in _LOCAL_PROVIDERS:
        allowed = sorted(_PROVIDER_ENV) + sorted(_LOCAL_PROVIDERS)
        raise AdapterError(f"infrelay-lite serves only {', '.join(allowed)}; got {provider!r}")
    adapter = find(provider, kind)
    if adapter is None:
        available = providers_for(kind)
        raise AdapterError(
            f"{provider} has no {kind.value} adapter in lite"
            + (f" (try: {', '.join(available)})" if available else "")
        )
    if provider in _LOCAL_PROVIDERS:
        token, byok = "", False
    else:
        token, byok = resolve_token(provider, credential)
    call_params = dict(params)
    if model:
        call_params.setdefault("model", model)
    return adapter.run(call_params, token, options or {}), byok

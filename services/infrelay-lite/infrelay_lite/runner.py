"""Plan a task's candidates and run them in turn until one answers. Keys come from the
environment (or the request); no pooling, no metering."""

from __future__ import annotations

from infrelay_lite.adapters.base import AdapterError, Output
from infrelay_lite.adapters.registry import find, providers_for
from infrelay_lite.adapters.videogpt import PROVIDER as VIDEOGPT
from infrelay_lite.config import settings
from infrelay_lite.models import Choice, Credential, MediaKind, Pick
from infrelay_lite.tasks import AITask, Step, Tasks

# Keyed providers lite ships. Key comes from this env var unless a request injects one.
# "videogpt" is the hosted videogpt.dev gateway, keyed by the user's dashboard-minted API key.
_PROVIDER_ENV: dict[str, str] = {
    "fal": "FAL_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    VIDEOGPT: "VIDEOGPT_API_KEY",
}

# On-box providers that need no account key.
_LOCAL_PROVIDERS: set[str] = {"whisper", "edge"}


def _platform_key(provider: str) -> str:
    if provider == "fal":
        return settings().fal_key
    if provider == "openrouter":
        return settings().openrouter_api_key
    if provider == VIDEOGPT:
        return settings().videogpt_api_key
    return ""


def resolve_token(provider: str, credential: Credential | None) -> tuple[str, bool]:
    """The key to run with, and whether it came from the request (BYOK). Injected wins."""
    if credential and credential.api_key:
        return credential.api_key, True
    return _platform_key(provider), False


def ready(provider: str, credential: Credential | None) -> bool:
    """On-box, or there is a key for it."""
    return provider in _LOCAL_PROVIDERS or bool(resolve_token(provider, credential)[0])


def plan(task: AITask, choice: Choice, credential: Credential | None) -> list[Step]:
    """The candidates a pick and its fallbacks resolve to, each pair once. An exact pick runs as
    given; a route step or a named model is left out when lite cannot run it."""
    kind = Tasks.kind(task)
    out: list[Step] = []
    for pick in choice.picks():
        exact = not (pick.auto_model or pick.any_provider)
        for step in [Step(pick.provider, pick.model)] if exact else _found(task, kind, pick):
            if step in out or choice.excludes(step.provider, step.model):
                continue
            if exact or (find(step.provider, kind) and ready(step.provider, credential)):
                out.append(step)
    return out


def _found(task: AITask, kind: MediaKind, pick: Pick) -> list[Step]:
    if pick.auto_model:
        steps = Tasks.route(task)
        if pick.any_provider:
            return steps
        # A named provider runs its steps of the route, else its own default (videogpt.dev
        # routes `auto` itself; edge and whisper have one voice or model).
        return [s for s in steps if s.provider == pick.provider] or [Step(pick.provider, "")]
    return [Step(provider, pick.model) for provider in providers_for(kind)]


def run_first(
    task: AITask, steps: list[Step], params: dict, credential: Credential | None
) -> tuple[Output, bool, Step]:
    """The first step that answers; when every one fails, the last error."""
    last: AdapterError | None = None
    for step in steps:
        try:
            output, byok = run(
                Tasks.kind(task),
                step.provider,
                step.model,
                params,
                credential,
                {"task": task.value},
            )
        except AdapterError as exc:
            last = exc
            continue
        return output, byok, step
    raise last or AdapterError("nothing to run")


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

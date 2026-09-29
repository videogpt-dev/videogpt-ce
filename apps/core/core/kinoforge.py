"""Single choke point for every core -> kinoforge HTTP call.

All requests to the kinoforge API pass through here so cross-cutting concerns live in one
place: it stamps the per-request `log_level` (from KINOFORGE_LOG_LEVEL) onto JSON bodies,
logs the outbound call, and normalizes error detail. Both the typed segment calls
(engine._post) and the raw dashboard passthrough (app.engine_proxy) route through it."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Mapping, Optional

import httpx

from core.config import settings

log = logging.getLogger("core.kinoforge")


def request_log_level() -> Optional[str]:
    """The console verbosity core asks kinoforge to log this request at, or None (engine default)."""
    return (os.getenv("KINOFORGE_LOG_LEVEL") or "").strip() or None


def _stamp(body: dict[str, Any]) -> dict[str, Any]:
    level = request_log_level()
    if level and not body.get("log_level"):
        return {**body, "log_level": level}
    return body


def error_detail(resp: httpx.Response) -> str:
    try:
        detail = resp.json().get("detail")
    except ValueError:
        return resp.text.strip() or resp.reason_phrase
    if isinstance(detail, list):
        return "; ".join(
            f"{'.'.join(str(p) for p in item.get('loc', [])[1:])}: {item.get('msg', '')}".strip(": ")
            for item in detail
        )
    return str(detail) if detail else (resp.text.strip() or resp.reason_phrase)


async def post(path: str, body: dict[str, Any]) -> dict[str, Any]:
    """A typed JSON kinoforge call: stamp log_level, POST, raise on error, return the JSON."""
    payload = _stamp(body)
    url = f"{settings.kinoforge_url}{path}"
    log.debug("kinoforge POST %s (log_level=%s)", path, payload.get("log_level"))
    async with httpx.AsyncClient(timeout=None) as client:
        resp = await client.post(url, json=payload, headers={"content-type": "application/json"})
    if resp.is_error:
        raise RuntimeError(f"kinoforge {resp.status_code}: {error_detail(resp)}")
    return resp.json()


async def proxy(
    method: str,
    path: str,
    *,
    content: bytes,
    params: Mapping[str, str],
    headers: Mapping[str, str],
) -> httpx.Response:
    """The raw dashboard passthrough (/api/engine/{path}): stamp log_level into a JSON POST body
    when present, forward the request unchanged otherwise, and return the upstream response."""
    body = content
    if method.upper() == "POST" and content:
        try:
            parsed = json.loads(content)
        except (ValueError, TypeError):
            parsed = None
        if isinstance(parsed, dict):
            body = json.dumps(_stamp(parsed)).encode()
    url = f"{settings.kinoforge_url}/v1/{path}"
    log.debug("kinoforge %s /v1/%s", method, path)
    async with httpx.AsyncClient(timeout=None) as client:
        return await client.request(method, url, content=body, params=params, headers=headers)

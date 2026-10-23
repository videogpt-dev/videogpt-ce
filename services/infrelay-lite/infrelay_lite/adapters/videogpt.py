"""videogpt.dev as a lite provider.

Picking provider `videogpt` forwards the call to the hosted gateway's POST /v1/inference/{task}
with model `auto` (or the model named), so a self-host user gets the full hosted roster and
routing without holding any provider key. Auth is the user's own API key (VIDEOGPT_API_KEY),
minted in the dashboard; videogpt.dev pins usage to that key's tenant and spends its credits. The
/v1 contract is byte-identical (output.type / value / mime / meta), so this is a pass-through
with no translation.
"""

from __future__ import annotations

import time

import httpx

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.config import settings
from infrelay_lite.models import MediaKind

PROVIDER = "videogpt"


class VideoGPTGateway(Adapter):
    provider = PROVIDER
    # A call, a late answer included, ends by then (kinoforge's longest wait).
    DEADLINE_SECONDS = 1800.0
    # Seconds between reads of a late answer when videogpt.dev does not say (Retry-After).
    READ_EVERY = 2.0
    # The only links a late answer is read at, so the key goes nowhere else.
    LATE_LINK = "/v1/requests/"

    def __init__(self, kind: MediaKind) -> None:
        self.kind = kind

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("videogpt provider needs VIDEOGPT_API_KEY")
        base = settings().videogpt_cloud_url.rstrip("/")
        if not base:
            raise AdapterError("videogpt provider needs VIDEOGPT_CLOUD_URL")
        # The model picked for `videogpt` is a model name there (blank: its route).
        name = str(params.pop("model", "") or "").strip()
        task = str(options.get("task") or self.kind.value)
        body = {"inference": {"model": name or "auto"}, "input": params}
        headers = {"Authorization": f"Bearer {token}"}
        deadline = time.monotonic() + self.DEADLINE_SECONDS
        try:
            resp = httpx.post(
                f"{base}/v1/inference/{task}", headers=headers, json=body, timeout=300.0
            )
        except httpx.HTTPError as exc:
            raise AdapterError(f"videogpt.dev unreachable: {exc}") from exc
        if resp.status_code == 504 and "retry_url" in resp.text:
            resp = self._late(base, str(resp.json().get("retry_url")), headers, deadline)
        if resp.status_code >= 400:
            raise AdapterError(f"videogpt.dev failed ({resp.status_code}): {resp.text[:300]}")
        out = resp.json().get("output") or {}
        return Output(
            type=out.get("type", ""),
            value=out.get("value", ""),
            mime=out.get("mime", ""),
            meta=out.get("meta") or {},
        )

    def _late(self, base: str, link: str, headers: dict, deadline: float) -> httpx.Response:
        """A call past videogpt.dev's direct timeout keeps running there: its answer is read at
        the link the 504 named until it ends or the deadline passes."""
        if not link.startswith(self.LATE_LINK) or "@" in link:
            raise AdapterError(f"videogpt.dev named an unexpected answer link: {link[:100]}")
        while True:
            try:
                resp = httpx.get(f"{base}{link}", headers=headers, timeout=60.0)
            except httpx.HTTPError as exc:
                raise AdapterError(f"videogpt.dev unreachable reading {link}: {exc}") from exc
            if resp.status_code not in (202, 429):
                return resp
            wait = float(resp.headers.get("Retry-After") or self.READ_EVERY)
            if time.monotonic() + wait > deadline:
                raise AdapterError(f"videogpt.dev did not answer {link} in time")
            time.sleep(wait)

"""Managed cloud gateway as a lite provider.

Picking provider `cloud` forwards the call to the hosted infrelay's POST /v1/inference/{task}
with model `auto` (or the model named), so a self-host user gets the full cloud roster and
routing without holding any provider key. Auth is the user's own API key (VIDEOGPT_API_KEY),
minted in the dashboard; the cloud pins usage to that key's tenant and spends its credits. The
/v1 contract is byte-identical (output.type / value / mime / meta), so this is a pass-through
with no translation.
"""

from __future__ import annotations

import httpx

from infrelay_lite.adapters.base import Adapter, AdapterError, Output
from infrelay_lite.config import settings
from infrelay_lite.models import MediaKind

PROVIDER = "cloud"


class CloudGateway(Adapter):
    provider = PROVIDER

    def __init__(self, kind: MediaKind) -> None:
        self.kind = kind

    def run(self, params: dict, token: str, options: dict) -> Output:
        if not token:
            raise AdapterError("cloud provider needs VIDEOGPT_API_KEY")
        base = settings().videogpt_cloud_url.rstrip("/")
        if not base:
            raise AdapterError("cloud provider needs VIDEOGPT_CLOUD_URL")
        # The model picked for `cloud` is a model name on the cloud (blank: its route).
        name = str(params.pop("model", "") or "").strip()
        task = str(options.get("task") or self.kind.value)
        body = {"inference": {"model": name or "auto"}, "input": params}
        try:
            resp = httpx.post(
                f"{base}/v1/inference/{task}",
                headers={"Authorization": f"Bearer {token}"},
                json=body,
                timeout=300.0,
            )
        except httpx.HTTPError as exc:
            raise AdapterError(f"cloud gateway unreachable: {exc}") from exc
        if resp.status_code >= 400:
            raise AdapterError(f"cloud gateway failed ({resp.status_code}): {resp.text[:300]}")
        out = resp.json().get("output") or {}
        return Output(
            type=out.get("type", ""),
            value=out.get("value", ""),
            mime=out.get("mime", ""),
            meta=out.get("meta") or {},
        )

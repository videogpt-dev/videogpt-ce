"""Managed cloud gateway as a lite provider.

Picking provider `cloud` forwards the generation to the hosted infrelay via its `/v1/auto`
autorouter, so a self-host user gets the full cloud roster and routing without holding any
provider key. Auth is the user's own API key (VIDEOGPT_API_KEY), minted in the dashboard; the
cloud pins usage to that key's tenant and spends its credits. The /v1 contract is byte-identical
(output.type / value / mime / meta), so this is a pass-through with no translation.
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
        # A configured STORY_*_MODEL arrives as params["model"]; it is a catalog NAME here, not a
        # provider model id. Pull it out of the generation input and pass it as the pin `name`
        # (blank/'auto' = the cloud default route). See GET /v1/catalog for valid names.
        name = str(params.pop("model", "") or "").strip()
        body = {"kind": self.kind.value, "input": params}
        if name and name.lower() != "auto":
            body["name"] = name
        try:
            resp = httpx.post(
                f"{base}/v1/auto",
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

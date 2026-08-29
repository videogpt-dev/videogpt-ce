"""Shared-secret gate for /v1/*, matching the full gateway.

Kinoforge (or the self-host thin runtime) sends the service token. An unset token serves only
in dev; in any other env an unset token is a misconfiguration and the route refuses (503)
rather than run open.
"""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from infrelay_lite.config import settings

service_token = HTTPBearer(
    auto_error=False,
    scheme_name="ServiceToken",
    bearerFormat="shared secret",
    description="Caller-to-Infrelay service token from INFRELAY_SERVICE_TOKEN.",
)


def require_service(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(service_token)],
) -> None:
    presented = credentials.credentials if credentials else ""
    expected = settings().infrelay_service_token
    if not expected:
        if settings().is_dev:
            return
        raise HTTPException(status_code=503, detail="infrelay-lite: service token not configured")
    if not hmac.compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail="infrelay-lite: invalid service token")

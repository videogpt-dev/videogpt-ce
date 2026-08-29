"""Helpers shared by the adapters. Ported from the full gateway's media_util + sdk."""

from __future__ import annotations

import contextlib
import os
from collections.abc import Iterator
from typing import Any, Callable

from infrelay_lite.adapters.base import AdapterError


def first_media_url(result: Any) -> str | None:
    """A URL out of a bare string, a list, or a dict keyed by images/audio/video/url."""

    def _url(v: Any) -> str | None:
        if isinstance(v, str) and v.startswith(("http", "data:")):
            return v
        if isinstance(v, dict) and isinstance(v.get("url"), str):
            return v["url"]
        if hasattr(v, "url") and isinstance(v.url, str):
            return v.url
        return None

    direct = _url(result)
    if direct:
        return direct
    if isinstance(result, (list, tuple)):
        for item in result:
            if (u := _url(item)):
                return u
    if isinstance(result, dict):
        for key in ("images", "audio", "video", "image", "output", "url"):
            val = result.get(key)
            if isinstance(val, list):
                for item in val:
                    if (u := _url(item)):
                        return u
            elif (u := _url(val)):
                return u
    return None


def _rejects_key(err: Exception, key: str) -> bool:
    msg = str(err).lower()
    return key in msg and any(
        w in msg
        for w in ("unexpected", "unknown", "additional", "not permitted", "not allowed",
                  "invalid", "no such", "422")
    )


def run_optional_negative(call: Callable[[dict], Any], args: dict, negative: str) -> Any:
    """Run call(args) with negative_prompt, dropping it and retrying if unaccepted."""
    if not negative:
        return call(args)
    try:
        return call({**args, "negative_prompt": negative})
    except Exception as e:
        if not _rejects_key(e, "negative_prompt"):
            raise
        return call(args)


@contextlib.contextmanager
def env(name: str, value: str) -> Iterator[None]:
    """Temporarily set an env var (fal_client reads its key from the environment)."""
    prior = os.environ.get(name)
    if value:
        os.environ[name] = value
    try:
        yield
    finally:
        if prior is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = prior


def fal_subscribe(model: str, args: dict, token: str) -> Any:
    try:
        import fal_client
    except ImportError as e:
        raise AdapterError("fal.ai needs 'pip install fal-client'") from e
    with env("FAL_KEY", token):
        try:
            return fal_client.subscribe(model, arguments=args, with_logs=False)
        except Exception as e:
            raise AdapterError(f"fal.ai error: {e}") from e

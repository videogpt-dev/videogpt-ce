"""Adapter contract: run one (provider, kind) and return a uniform Output.

The gateway executes inference and hands the result back; it does not store bytes (Kinoforge
persists them). So an adapter returns either an addressable `url`, inline `b64` bytes, or
`text`. Ported from the full gateway's adapters/base.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from infrelay_lite.models import MediaKind


class AdapterError(RuntimeError):
    """A generation failed for a reason worth showing the caller."""


@dataclass
class Output:
    type: str  # "url" | "b64" | "text"
    value: str
    mime: str = ""
    meta: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {"type": self.type, "value": self.value, "mime": self.mime, "meta": self.meta}


class Adapter:
    provider: str = ""
    kind: MediaKind

    def run(self, params: dict, token: str, options: dict) -> Output:
        raise NotImplementedError

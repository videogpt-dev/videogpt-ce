"""The (provider, kind) -> adapter table. OpenRouter + fal only, by design."""

from __future__ import annotations

from infrelay_lite.adapters.base import Adapter
from infrelay_lite.adapters.image import FalImage, OpenRouterImage
from infrelay_lite.adapters.music import FalMusic
from infrelay_lite.adapters.edge_tts import EdgeSpeech
from infrelay_lite.adapters.speech import FalSpeech
from infrelay_lite.adapters.text import OpenRouterText
from infrelay_lite.adapters.video import FalVideo
from infrelay_lite.adapters.whisper import LocalWhisper
from infrelay_lite.models import MediaKind

_ADAPTERS: list[Adapter] = [
    OpenRouterText(),
    OpenRouterImage(),
    FalImage(),
    FalVideo(),
    FalMusic(),
    FalSpeech(),
    EdgeSpeech(),
    LocalWhisper(),
]

REGISTRY: dict[tuple[str, MediaKind], Adapter] = {
    (adapter.provider, adapter.kind): adapter for adapter in _ADAPTERS
}


def find(provider: str, kind: MediaKind) -> Adapter | None:
    return REGISTRY.get((provider, kind))


def providers_for(kind: MediaKind) -> list[str]:
    return sorted({p for (p, k) in REGISTRY if k is kind})

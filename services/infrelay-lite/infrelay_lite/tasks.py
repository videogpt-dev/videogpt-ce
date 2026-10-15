"""AI tasks and their routes, the same contract as the cloud gateway's POST /v1/inference/{task}.

Every task belongs to one media kind; the kinds themselves are the general-purpose tasks. Lite
keeps no database: a task's route comes from INFRELAY_ROUTES, a JSON object of task (or kind)
to its ordered steps, each "provider/model" (the model may hold slashes) or {provider, model}.
A task without steps of its own runs its kind's.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from infrelay_lite.config import settings
from infrelay_lite.models import MediaKind


class AITask(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    MUSIC = "music"
    TRANSCRIBE = "transcribe"
    VIRAL_CLIP_TRANSCRIBE = "viralClip.transcribe"
    VIRAL_CLIP_FIND = "viralClip.find"
    STORY_WRITE = "story.write"
    STORY_IDEAS = "story.ideas"
    STORY_SUGGEST = "story.suggest"
    STORY_DIRECT = "story.direct"
    STORY_TRANSLATE = "story.translate"
    STORY_CAST = "story.cast"
    STORY_IMAGE = "story.image"
    STORY_VIDEO = "story.video"
    STORY_VOICE = "story.voice"
    STORY_MUSIC = "story.music"
    STORY_CAPTIONS = "story.captions"


@dataclass(frozen=True)
class Step:
    provider: str
    model: str = ""


class Tasks:
    KINDS: dict[AITask, MediaKind] = {
        AITask.TEXT: MediaKind.TEXT,
        AITask.IMAGE: MediaKind.IMAGE,
        AITask.AUDIO: MediaKind.AUDIO,
        AITask.VIDEO: MediaKind.VIDEO,
        AITask.MUSIC: MediaKind.MUSIC,
        AITask.TRANSCRIBE: MediaKind.TRANSCRIBE,
        AITask.VIRAL_CLIP_TRANSCRIBE: MediaKind.TRANSCRIBE,
        AITask.VIRAL_CLIP_FIND: MediaKind.TEXT,
        AITask.STORY_WRITE: MediaKind.TEXT,
        AITask.STORY_IDEAS: MediaKind.TEXT,
        AITask.STORY_SUGGEST: MediaKind.TEXT,
        AITask.STORY_DIRECT: MediaKind.TEXT,
        AITask.STORY_TRANSLATE: MediaKind.TEXT,
        AITask.STORY_CAST: MediaKind.IMAGE,
        AITask.STORY_IMAGE: MediaKind.IMAGE,
        AITask.STORY_VIDEO: MediaKind.VIDEO,
        AITask.STORY_VOICE: MediaKind.AUDIO,
        AITask.STORY_MUSIC: MediaKind.MUSIC,
        AITask.STORY_CAPTIONS: MediaKind.TRANSCRIBE,
    }

    @classmethod
    def kind(cls, task: AITask) -> MediaKind:
        return cls.KINDS[task]

    @staticmethod
    def group(task: AITask) -> str:
        """viralClip or story; a kind is a general task."""
        family, dot, _ = task.value.partition(".")
        return family if dot else "general"

    @classmethod
    def route(cls, task: AITask) -> list[Step]:
        """The task's own steps, else its kind's."""
        routes = cls._routes()
        return routes.get(task.value) or routes.get(cls.kind(task).value) or []

    @staticmethod
    def _routes() -> dict[str, list[Step]]:
        raw = settings().infrelay_routes.strip()
        if not raw:
            return {}
        try:
            doc = json.loads(raw)
        except ValueError as exc:
            raise ValueError(f"INFRELAY_ROUTES is not JSON: {exc}") from exc
        return {
            str(task): [Tasks._step(item) for item in steps or []] for task, steps in doc.items()
        }

    @staticmethod
    def _step(item: Any) -> Step:
        if isinstance(item, dict):
            return Step(
                str(item.get("provider") or "").strip(), str(item.get("model") or "").strip()
            )
        provider, _, model = str(item).strip().partition("/")
        return Step(provider, model)

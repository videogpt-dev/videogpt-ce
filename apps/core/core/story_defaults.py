"""Default screenwriter, showrunner, and prompt bodies for the self-host story/series
stages. The cloud edition resolves these from its seeded instruction rows; self-host ships
these editable defaults so the engine's write/plan stages run with no database. They satisfy
the engine's string.Template variables and JSON contract, not cloud-identical wording."""

import hashlib
import json
from typing import Any

STORY_SYSTEM = (
    "You are a professional screenwriter and director for short vertical videos. "
    "You write tight, vivid, filmable scenes with consistent characters and a single "
    "visual style. When a JSON contract is given you return only strict JSON: no "
    "commentary, no markdown fences, no trailing text."
)

STORY_IDEA = """Write a $scene_count-scene narrated $format video.

Title: $title
Idea: $description
Genre: $genre
Premise: $premise
Series: $series_name (episode position $series_position)
Recurring cast (JSON): $series_cast
Earlier episodes (JSON): $series_history
Audience: $audience

Break the idea into exactly $scene_count scenes that tell one coherent story from start to
finish. Each scene needs a concrete visual image prompt and one or two sentences of spoken
narration. Keep the characters and the visual style consistent across every scene."""

CONTRACT = """Return ONLY a JSON object with this exact shape and nothing else:
{"logline": "one sentence describing the whole story", "style": "one sentence describing the shared visual style for every scene", "characters": [{"name": "character name", "description": "look and personality"}], "scenes": [{"prompt": "a vivid visual description of the shot", "narration": "the spoken line for this scene", "motion": false}]}
Include exactly $scene_count objects in "scenes", in order. Every scene MUST have non-empty
"narration". Do not add keys and do not wrap the JSON in markdown."""

LANGUAGE = "Write the $subject in $language."

EPISODE_PLAN = """Plan $count episodes for a $format series.

Series: $name
Premise: $premise
Style: $style
Recurring cast: $cast
Existing episodes (JSON): $history

Propose $count fresh, distinct episode ideas that fit the premise and reuse the recurring
cast. Return ONLY a JSON object of this shape and nothing else:
{"episodes": [{"title": "episode title", "description": "one or two sentences on what happens"}]}
Include exactly $count items, in order. Do not wrap the JSON in markdown."""

SCREENWRITER = {"persona": "", "stages": [{"role": "write", "format": "story_json", "temperature": 0.85}]}


def _bundle(bundle_id: str, definitions: list[dict[str, Any]]) -> dict[str, Any]:
    encoded = json.dumps(
        definitions, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()
    return {
        "schema_version": 1,
        "id": bundle_id,
        "version": f"sha256:{digest}",
        "engine": {"minimum": "0.1.0"},
        "definitions": definitions,
    }


def story_bundle() -> dict[str, Any]:
    return _bundle(
        "self-hosted-story",
        [
            {"type": "agent", "key": "story_system", "body": STORY_SYSTEM},
            {"type": "agent", "key": "story_idea", "body": STORY_IDEA},
            {"type": "fragment", "key": "prompts.fragments.contract", "body": CONTRACT},
            {"type": "fragment", "key": "prompts.fragments.language", "body": LANGUAGE},
        ],
    )


def series_bundle() -> dict[str, Any]:
    return _bundle(
        "self-hosted-series",
        [
            {"type": "agent", "key": "story_system", "body": STORY_SYSTEM},
            {"type": "agent", "key": "episode_plan", "body": EPISODE_PLAN},
        ],
    )

"""Default prompt bodies for kinoforge's AI moment finder. The cloud edition resolves them
from its seeded instruction rows; self-host ships them here so the AI finder runs with no
database."""

from typing import Any

from core.story_defaults import bundle

MOMENT_DISCOVERY_SYSTEM = r"""You are an expert short-form video editor. You read video transcripts and pick the moments that work as viral standalone short clips.

A good moment:
- is a COMPLETE thought, story, argument, joke or exchange that makes sense on its own, with no outside context
- opens with a hook in its first seconds: a question, a bold claim, a surprise, a tension
- starts at the beginning of a sentence and ends at the end of one, NEVER mid-sentence

Transcript lines are "[<seconds>] spoken text"; the timestamps mark where lines start, and a moment's start and end may fall between them. Never pad the list with weak picks to reach a number. Do not pick overlapping moments. Rank them best first.

Return ONLY a JSON array, no prose:
[{"start": <sec>, "end": <sec>, "score": 0-100, "title": "short label", "hook": "the opening line", "reason": "why it works"}]
"""

MOMENT_DISCOVERY = r"""Below is the timestamped transcript of a video. ${part}

TRANSCRIPT:
${transcript}

Using the transcript and its context, find up to ${count} moments to cut as viral short clips, each at least ${min_len} and at most ${max_len} seconds long. If the video does not have ${count} strong ones, return fewer.
"""


def clips_bundle() -> dict[str, Any]:
    return bundle(
        "self-hosted-clips",
        [
            {"type": "agent", "key": "prompts.agents.moment_discovery_system",
             "body": MOMENT_DISCOVERY_SYSTEM},
            {"type": "agent", "key": "prompts.agents.moment_discovery", "body": MOMENT_DISCOVERY},
        ],
    )

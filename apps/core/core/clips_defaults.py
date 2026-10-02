"""Default prompt body for kinoforge's AI moment finder. The cloud edition resolves it
from its seeded instruction row; self-host ships it here so the AI finder runs with no
database."""

from typing import Any

from core.story_defaults import bundle

MOMENT_DISCOVERY = r"""You are an expert short-form video editor. Below is the timestamped transcript of a video. Each line is "[<seconds>] spoken text". ${part}

TRANSCRIPT:
${transcript}

Using the transcript and its context, find the best moments to cut as viral standalone short clips. A good moment:
- is a COMPLETE thought, story, argument, joke or exchange that makes sense on its own, with no outside context
- opens with a hook in its first seconds: a question, a bold claim, a surprise, a tension
- starts at the beginning of a sentence and ends at the end of one, NEVER mid-sentence
- lasts at least ${min_len} and at most ${max_len} seconds

Aim for ${count} moments. If the video does not have that many strong ones, return fewer; never pad the list with weak picks to reach the number. The timestamps mark where lines start; start and end may fall between them. Do not pick overlapping moments. Rank them best first.

Return ONLY a JSON array, no prose:
[{"start": <sec>, "end": <sec>, "score": 0-100, "title": "short label", "hook": "the opening line", "reason": "why it works"}]
"""


def clips_bundle() -> dict[str, Any]:
    return bundle(
        "self-hosted-clips",
        [{"type": "agent", "key": "prompts.agents.moment_discovery", "body": MOMENT_DISCOVERY}],
    )

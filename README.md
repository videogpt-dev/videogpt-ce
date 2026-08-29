<p align="center">
  <img src="assets/logo.png" alt="videogpt" width="104" height="104">
</p>

<h1 align="center">videogpt · Community Edition</h1>

<p align="center">
  Your own video studio, self-hosted.<br>
  Cut short clips out of long videos, and generate new videos from a prompt.
</p>

---

This is the self-host edition of [videogpt.dev](https://videogpt.dev). It runs the same engine
the cloud product uses, wired to a tiny local inference gateway, so everything happens on your
box. The engine has three parts:

- **Clips** — feed it a long video (a file or a URL), get back short vertical clips with
  burned-in captions.
- **Story** — turn a title and a prompt into a scene-by-scene script: logline, visual style,
  characters, and per-scene image prompt + narration.
- **Series** — plan connected episodes for a recurring show from a premise and a cast.

The paid cloud edition adds accounts, publishing to YouTube/TikTok/Instagram, a managed
inference roster, and storage. None of that is here, and none of it is needed to run the
engine yourself.

## Status

Clips is wired end to end and works today, keyless. Story writes a full scene-by-scene script
and Series proposes an episode slate — both need `OPENROUTER_API_KEY` (they call a text model).
Turning that script into a finished, assembled video (per-scene image/voice/music generation +
stitching) is not in this edition yet; that pipeline lives in the cloud product. So today Story
and Series give you the plan, and Clips gives you the finished cuts.

## What you get

- **Clips** from any long video: upload a file, or paste a URL (YouTube and anything else
  yt-dlp handles).
- **Runs keyless.** Transcription is local (faster-whisper), moment selection runs offline,
  render is ffmpeg. No API key required to make a clip.
- **Optional AI.** Add `FAL_KEY` / `OPENROUTER_API_KEY` to unlock AI moment scoring and the
  Story/Series text stages.
- **A small web UI** to manage projects and preview results.

## Run it

You need Docker and Docker Compose. Nothing else.

```sh
git clone --recurse-submodules git@github.com:videogpt-dev/videogpt-ce.git
cd videogpt-ce
cp .env.example .env          # optional: add provider keys for the AI features
docker compose up --build
```

Then open:

- Dashboard — http://localhost:5173
- Core API — http://localhost:8000

The first clip run downloads the whisper model into a named volume, so it is slow once and
fast after. Output and the model cache survive `docker compose down`.

## How it fits together

Four containers on a private network; only the dashboard and core are published.

| Path | Where it lives | Job |
|---|---|---|
| `apps/dashboard` | this repo | the web UI |
| `apps/core` | this repo | single-user host: projects, disk storage, drives the engine |
| `apps/kinoforge` | [submodule](https://github.com/videogpt-dev/kinoforge) | the engine: clips, story, series (transcribe, find moments, generate, render) |
| `services/infrelay-lite` | this repo | inference gateway (local whisper + OpenRouter + fal) |

`packages/videogpt-ui` and `packages/videogpt-catalog` are the shared UI and catalog
libraries, pulled in as submodules.

There are no service-to-service tokens to configure. On a single-user box the containers
trust each other on the internal network.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go to the
address in [SECURITY.md](SECURITY.md), not the public issue tracker.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free for personal
and other noncommercial use; running it as a commercial service is not permitted. For
commercial use, use [videogpt.dev](https://videogpt.dev).

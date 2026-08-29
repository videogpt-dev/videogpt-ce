# videogpt-self-hosted

Single-tenant self-host edition. Runs the open engine (**kinoforge**) against the tiny
self-host inference gateway (**infrelay-lite**) with keys from your own environment. No
database, no credits, no cloud core.

## Components

| Path | Repo | Role |
|---|---|---|
| `apps/kinoforge` | `videogpt-dev/kinoforge` | video engine + runtime (`kinoforge.service.app`) |
| `services/infrelay-lite` | in-repo | inference gateway (OpenRouter + fal) |
| `apps/core` | in-repo | thin single-user host: projects, disk storage, fronts kinoforge |
| `apps/dashboard` | in-repo | self-host UI |
| `packages/videogpt-ui`, `packages/videogpt-catalog` | | open UI + catalog libraries |

Asset storage is not bundled; the thin host writes to local disk and can point at the
cloud `vcs-assets` egress for space.

## Run

Docker + Docker Compose is all you need on the host. One command:

```sh
git clone --recurse-submodules git@github.com:videogpt-dev/videogpt-self-hosted.git
cd videogpt-self-hosted
cp .env.example .env            # optional: FAL_KEY / OPENROUTER_API_KEY for AI features
docker compose up --build
```

- dashboard → http://localhost:5173
- core API → http://localhost:8000

The stack (infrelay-lite, kinoforge, core, dashboard) runs on an internal network; only the
dashboard and core are published, and the services trust each other with no tokens to set.
Output and the whisper model persist in named volumes (`data`, `whisper-cache`).

Clips run fully keyless on-box: local faster-whisper transcription (the model auto-downloads
on the first clip run) + the offline moment engine + ffmpeg render. Provider keys
(`FAL_KEY`, `OPENROUTER_API_KEY`) are only needed for AI moment scoring and story/media.

## Cloud gateway instead

To use the paid cloud roster instead of the two lite providers, point kinoforge at
`vcs-infrelay` by setting `INFRELAY_URL` to its address. Kinoforge does not care which
gateway answers.

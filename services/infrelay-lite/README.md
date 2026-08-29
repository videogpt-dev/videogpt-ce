# infrelay-lite

The self-host tier of the inference gateway. It serves the same `POST /v1/generate` contract
that Kinoforge calls, but stripped to what a single-user self-host install needs:

- **OpenRouter + fal only** (the two providers that cover text, image, video, music, and TTS).
- **Keys from the environment** (`FAL_KEY`, `OPENROUTER_API_KEY`); a request may still inject
  its own key per call.
- **No database, no credits, no pooling, no metering.** Tiny, stateless, boots out of the box.

Self-host can instead point Kinoforge at the paid **cloud** gateway (`apps/vcs-infrelay`, full
provider roster + routing + credits) by swapping `INFRELAY_URL`. Kinoforge does not care which
one answers.

## Run

Normally started by the videogpt-ce `docker compose` stack (keys come from the root `.env`).
To run it on its own:

```sh
FAL_KEY=... OPENROUTER_API_KEY=... uvicorn infrelay_lite.app:app --port 8090
# or: docker build -t infrelay-lite . && docker run -p 8090:8090 -e FAL_KEY -e OPENROUTER_API_KEY infrelay-lite
```

## Wiring Kinoforge to it

Kinoforge reaches the gateway through one env var:

```sh
INFRELAY_URL=http://localhost:8090
```

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | open |
| GET | `/v1/models?kind=` | which providers serve a kind (lite ships no model catalog) |
| POST | `/v1/generate` | `{kind, provider, model, input, credential?}` -> `{output:{type,value,meta}, usage}` |

`kind` is one of `text`, `image`, `video`, `music`, `audio`, `transcribe`. Pass the provider's
own `model` id directly. `output.type` is `url`, `b64`, `text`, or `transcript`; the caller
downloads or stores it.

## Auth

No auth. It's meant to run on the single-user internal Docker network alongside the engine.
Don't expose it to the public internet.

## Transcription

The `transcribe` kind runs a local `faster-whisper` model in-process (`provider="whisper"`),
so clips work with no provider key. The model downloads on first use into `HF_HOME`
(a named volume in the stack).

## Not in lite

Extra providers, routing, key pooling, credits, and admin all live in the full cloud gateway.
Self-host installs that need those point `INFRELAY_URL` at the cloud one.

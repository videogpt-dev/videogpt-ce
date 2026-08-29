# Contributing

Thanks for taking the time. This repo is the self-host (Community) edition of videogpt.dev.
Bug reports, fixes, and improvements are all welcome.

## Before you start

- For a bug, open an issue with steps to reproduce, what you expected, and what happened.
- For a feature or a larger change, open an issue first so we can agree on the shape before you write code. It saves everyone a wasted afternoon.
- Security issues do **not** go in the tracker. See [SECURITY.md](SECURITY.md).

## Repo layout

This is a monorepo with submodules. After cloning:

```sh
git clone --recurse-submodules git@github.com:videogpt-dev/videogpt-ce.git
```

If you already cloned without `--recurse-submodules`:

```sh
git submodule update --init --recursive
```

The engine (`apps/kinoforge`) and the shared packages live in their own repos and are pulled
in as submodules. A change inside a submodule is a PR against that repo; this repo only tracks
which commit of each it points at.

## Running locally

The whole stack runs in Docker:

```sh
cp .env.example .env
docker compose up --build
```

Dashboard on http://localhost:5173, core API on http://localhost:8000.

## Pull requests

- Keep a PR to one thing. Small and focused gets reviewed fast.
- Match the style of the code around you.
- Describe what changed and why, and how you tested it.
- By opening a PR you agree your contribution is licensed under the repo's
  [LICENSE](LICENSE).

## What belongs here

This edition is single-user, local, and keyless by default. Things that need accounts,
billing, publishing OAuth, or the managed cloud roster live in the cloud product, not here.
If you're unsure whether something fits, ask in an issue.

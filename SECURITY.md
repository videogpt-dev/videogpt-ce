# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub's [private vulnerability reporting](https://github.com/videogpt-dev/videogpt-ce/security/advisories/new), or email **security@videogpt.dev**.

Include enough info to reproduce: affected version or commit, steps, and the impact you observed.
We'll acknowledge within a few days and keep you posted while we work on a fix.

## Scope

This repo is the self-host edition: it's meant to run on a single user's own machine on a trusted network. It ships with no authentication and the containers trust each other on the internal Docker network by design. Do not expose the core API or dashboard directly to the public internet without putting your own auth and TLS in front.

Issues in that self-host model (a container escape, a path-traversal in file handling, an injection in the download or render path) are in scope. "The API has no login" is not a vulnerability here, it's the documented design.

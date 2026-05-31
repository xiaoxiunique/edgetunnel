# Repository Guidelines

## Project Structure & Module Organization

This repository is a compact Cloudflare Workers/Pages project. The main runtime code lives in `_worker.js`, which exports the Worker `fetch` handler and contains routing, admin, subscription, proxy, and utility logic in one file. Cloudflare deployment settings are in `wrangler.toml`. User-facing documentation is in `README.md`, release notes are in `CHANGELOG`, licensing is in `LICENSE`, and `img.png` is the README/admin screenshot asset. GitHub automation lives under `.github/workflows/`.

## Build, Test, and Development Commands

There is no checked-in `package.json`, lockfile, or formal test script. Use Wrangler through `npx` or your global install:

```sh
npx wrangler dev
npx wrangler deploy
npx wrangler tail
```

`npx wrangler dev` runs the Worker locally using `wrangler.toml`. `npx wrangler deploy` publishes the Worker. `npx wrangler tail` streams production logs for deployed Workers. Before deployment, configure required Cloudflare variables such as `ADMIN` and the optional `KV` binding described in `README.md`.

## Coding Style & Naming Conventions

Keep changes surgical and match the existing single-file JavaScript style. `_worker.js` uses tabs for indentation, semicolons, Chinese identifiers/comments, and browser/Worker-native APIs such as `Request`, `Response`, `URL`, streams, WebSocket handling, and Cloudflare `env` bindings. Preserve existing variable naming when editing nearby code. Do not introduce build-only dependencies or broad rewrites unless the change explicitly requires them.

## Testing Guidelines

No automated test suite is currently present. Validate changes with the narrowest practical Worker checks: run `npx wrangler dev`, exercise affected routes such as `/login`, `/admin`, `/version?uuid=...`, or subscription endpoints, and inspect logs for thrown errors. For networking changes, verify both success and failure paths and document any Cloudflare-only behavior that cannot be reproduced locally.

## Commit & Pull Request Guidelines

Recent history uses short imperative messages, commonly Conventional Commit prefixes such as `fix:` and `feat:`, plus occasional `Update _worker.js`. Prefer concise subjects like `fix: handle empty TURN realm` or `feat: add preload race dial option`. Pull requests should describe the behavior change, list manual validation steps, mention required environment variables or KV changes, and include screenshots only when admin UI or README-visible output changes.

## Security & Configuration Tips

Never commit real `ADMIN`, `KEY`, API tokens, proxy credentials, or KV namespace IDs. Keep secrets in Cloudflare environment variables. Treat `wrangler.toml` as deploy configuration and avoid changing production names, compatibility dates, or bindings unless the PR specifically covers deployment behavior.

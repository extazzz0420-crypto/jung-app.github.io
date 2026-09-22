# Repository guide

## Purpose

This repository is the static landing site and Telegram Mini App frontend for Jung Bot, published through GitHub Pages.

## Source of truth

- `index.html`, `app.js`, and the linked styles own the Mini App.
- `landing.html`, `landing.js`, and landing styles own the public landing page.
- `root-redirect.js` owns root routing.
- `tests/` owns browserless smoke coverage.
- Product context lives in `/Users/ruslanfomin/HarnessWorkspaces/mindcoach/notes/jung-bot/`; workspace rules in `../AGENTS.md`.

## Rules

- Keep production API and Telegram bot identifiers centralized in the existing configuration path.
- Preserve safe root redirects, Telegram WebApp behavior, responsive layout, accessible names, and keyboard use.
- Never add credentials or private user data to this public repository.
- Preserve unrelated work in the dirty tree and make focused edits.
- Owner standing permission, 2026-09-18: push to `origin main` without asking. Finished,
  verified work gets committed and pushed as part of the task.
- Know what a push means here: GitHub Pages serves this repository, so pushing to `main`
  publishes to mindcoachbot.ru and to every open Mini App. `npm test` green is the
  precondition. Say in the reply that the push was a release, so the owner knows the
  change is already live.

## Verification

Run `npm test` after changes. For visible UI changes, also check the relevant page at a narrow mobile viewport with no console errors or horizontal overflow.

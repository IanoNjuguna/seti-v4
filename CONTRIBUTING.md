# Contributing to Seti

This document covers the development workflow for the Seti monorepo. For product and design context, see [README.md](./README.md). For package-specific setup, see [mobile/README.md](./mobile/README.md) and [backend/README.md](./backend/README.md).

---

## Branch conventions

- `main` — stable, reviewed state
- `feat/<name>` — feature branches
- Open pull requests for review before merging into `main`

---

## Verify before committing

From the repo root:

```bash
npm run verify     # typecheck + lint across backend, mobile, and web
```

Or per package:

```bash
npm run typecheck --workspace backend
npm run typecheck --workspace mobile
npm run typecheck --workspace web

npm run lint --workspace backend
npm run lint --workspace mobile
npm run lint --workspace web
```

`mobile` additionally has an Expo dependency/config health check:

```bash
npm exec --workspace mobile expo-doctor
```

All three type checks must pass before you consider a change done.

### Install

The repo is an npm workspace. Install once from the root:

```bash
npm install
```

Do not run `npm install` inside `backend/`, `mobile/`, or `web/` — that
creates a nested lockfile and defeats hoisting.

---

## Design system

Which doc is the source of truth depends on the surface: `design/revolut.md` for every web surface (`web/` — the landing page and the product app at `/app`), and `DESIGN.md` (Calm Finance) for `mobile/` until it migrates. The Revolut system is the repo's target; mixing the two vocabularies on one surface renders unstyled elements. Shared constraints:

- Semantic tokens only — no raw hex in components
- `font-tabular` on every monetary value
- Currency format: `KES 1,250.00`
- Calm, direct copy — no exclamation marks, no gamification
- Minimum 44×44 pt touch targets
- Light + dark mode parity for every surface/text pair

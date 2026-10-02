# AGENTS.md

## Project

A mobile neobank for emerging markets, built on **Tempo**. Users hold stablecoins (OUSD preferred), scan existing merchant QR codes, and the backend settles local fiat (KES) to merchant bank accounts via **Stripe + Bridge**.

- Primary surface: React Native + Expo mobile app.
- Onchain layer: Tempo (EVM-compatible payments chain).
- Backend: Node.js + PostgreSQL/Supabase.
- Stablecoin: OUSD (native Stripe/Bridge terms).
- Off-ramp: Stripe Payouts / Bridge to Kenyan bank accounts.

## UI code standards (enforced via skills)

This repo has project skills in `.agents/skills/` that govern all UI work. Load and follow them:

- **`modular-ui-authoring`** — when **writing new** React Native / Expo components, screens, or views. New UI must be modular from the start: typed hooks, `*.types.ts` / `*.constants.ts` files, <80-line component files, logic extracted to hooks.
- **`modular-ui-refactor`** — when **changing existing** UI structure. Zero behavior changes; public import paths and export styles are contracts.
- **`design-enforcement`** — for **all** styling. `DESIGN.md` is the single source of truth: semantic tokens only, light/dark pairs, no raw hex, compose from `components/ui/`.
- **`imagegen-frontend-mobile`** — for generating premium mobile app screen concepts and flows.
- **`image-to-code`** — for converting generated design images into web frontend when needed.
- **`brandkit`** — for brand-guidelines work and visual identity.
- **`redesign-existing-projects`** — for redesigning existing UI surfaces.
- **`full-output-enforcement`** — for tasks requiring exhaustive, unabridged code output.
- **`skill-gardening`** — for maintaining the skills themselves. When you make a mistake, the user corrects you, you discover an undocumented convention, or standards change, update the owning skill in the same session.

### Skill ownership (each rule lives in exactly one place)

| Concern | Owning skill |
| --- | --- |
| Structure of **new** UI code | `modular-ui-authoring` |
| Restructuring **existing** UI, behavior preservation | `modular-ui-refactor` |
| Styling, tokens, design system | `design-enforcement` (source of truth: `DESIGN.md`) |
| Mobile screen image generation | `imagegen-frontend-mobile` |
| Brand / visual identity | `brandkit` |
| Exhaustive code output | `full-output-enforcement` |
| How/when to edit skills | `skill-gardening` |

If a rule feels needed in two skills, put it in the owning skill and cross-reference it from the other. Keep each skill inside its stated concern — split rather than bloat.

## Repository layout

- `mobile/` — React Native + Expo app (planned location; create if missing).
- `backend/` — Node.js API service (planned location; create if missing).
- `.agents/skills/` — project-local agent skills.
- `DESIGN.md` — single source of truth for UI/UX.
- `tailwind.config.js` — NativeWind / Tailwind token configuration.
- `design.tokens.json` — machine-readable design tokens for Figma/style-dictionary pipelines.

## Tech stack

- **Mobile:** React Native, Expo, TypeScript, NativeWind (or project-chosen styling), React Navigation.
- **Backend:** Node.js, Express/Fastify, TypeScript, PostgreSQL/Supabase.
- **Onchain:** Tempo, Tempo TypeScript SDK, Tempo Accounts SDK, OUSD.
- **Fiat:** Stripe + Bridge for KES bank payouts.

## Verification gates

- `npx tsc --noEmit` must stay clean in the package being changed.
- Run the mobile type-check or Expo doctor after non-trivial UI changes, but **ask before starting a build or running the simulator**.
- Do not run `expo start` or device builds automatically.

## Blockchain & security guardrails

- Never request or store seed phrases, private keys, or raw passkey credentials.
- Wallet keys belong to the user via Privy / Tempo Accounts SDK; the backend never signs transactions on behalf of users without explicit authorization.
- Validate all onchain addresses and amounts before constructing transactions.
- Keep testnet and mainnet configs separate; never default to mainnet in development.

## Business logic guardrails

- Preserve the chosen stablecoin (OUSD) and chain (Tempo) unless the user explicitly asks to reconsider.
- Fee model: consumer 0%, merchant 2% + KES 50 minimum, FX markup embedded.
- Do not add features that require M-Pesa settlement unless the user changes that priority.

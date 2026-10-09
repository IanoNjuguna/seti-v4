# AGENTS.md

## Project

A mobile neobank for emerging markets, built on **Tempo**. Users hold stablecoins (OUSD and pathUSD), scan a Seti merchant QR code, and pay the merchant's own wallet directly. v1 settlement is **non-custodial**: the customer's stablecoins go straight to the merchant, and Seti never takes possession of the funds.

- Primary surface: React Native + Expo mobile app.
- Onchain layer: Tempo (EVM-compatible payments chain).
- Backend: Node.js + PostgreSQL/Supabase.
- Stablecoin: OUSD and pathUSD — Tempo-native, and the only two assets with deployed bytecode on both chains.
- Fee: a flat 2% attributed to the merchant but funded by the customer inside their own transfer (`backend/src/services/fees.ts` is the source of truth).
- Off-ramp: **none in v1.** There is no Stripe or Bridge integration in the code.

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
- **Onchain:** Tempo, viem, Privy (embedded wallets). Assets: pathUSD, OUSD.
- **Fiat:** none in v1 — settlement is non-custodial, straight to the merchant's wallet.

## Verification gates

- `npm run verify` from the repo root: typecheck + lint across all three
  packages, then the backend check suites (fees, payout, indexer cursor,
  reconciliation, indexer pass). This is the gate that must pass.
- Per package: `npm run typecheck --workspace <pkg>` / `npm run lint --workspace <pkg>`.
- Run the mobile type-check or Expo doctor after non-trivial UI changes, but **ask before starting a build or running the simulator**.
- Do not run `expo start` or device builds automatically.

## Blockchain & security guardrails

- Never request or store seed phrases, private keys, or raw passkey credentials.
- Wallet keys belong to the user via Privy embedded wallets; the backend never signs transactions on behalf of users without explicit authorization.
- Validate all onchain addresses and amounts before constructing transactions.
- Keep testnet and mainnet configs separate; never default to mainnet in development.
- **Never trust a client-supplied payment amount.** `recordPayment` reconciles
  the claimed gross against the on-chain receipt and fails closed on a missing
  payout address, an unverifiable receipt, or a mismatch beyond 1%. Do not add a
  path that records a payment without that check.

## Business logic guardrails

- Preserve the chosen stablecoins and chain (Tempo) unless the user explicitly
  asks to reconsider. v1 supports **pathUSD and OUSD only** — USDC.e, USDT0 and
  EURC.e have no deployed bytecode on either Tempo chain and were removed.
- Fee model: merchant 2% of the payment, no floor, no cap. v1 collects the fee
  inside the customer's transfer, so the **customer** funds it even though it is
  attributed to the merchant. `backend/src/services/fees.ts` is the single
  source of truth — never reintroduce a bare `Math.max(fiat * 0.02, 50)`, which
  charges small merchants half their ticket. Run `npm run check:fees` after any
  change to fee logic.
- Do not add features that require M-Pesa settlement unless the user changes that priority.

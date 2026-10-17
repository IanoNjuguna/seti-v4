# AGENTS.md

## Project

A mobile neobank for emerging markets, built on **Tempo**. Users hold stablecoins (OUSD, pathUSD, USDT0 and USDC.e), scan a Seti merchant QR code, and pay the merchant's own wallet directly. v1 settlement is **non-custodial**: the customer's stablecoins go straight to the merchant, and Seti never takes possession of the funds.

- Product surfaces: the React Native + Expo mobile app (`mobile/`), and the web app (`web/`) — a Next.js 16 App Router landing page plus the product app served at `/app`.
- Onchain layer: Tempo (EVM-compatible payments chain).
- Backend: Node.js + PostgreSQL/Supabase.
- Stablecoins: OUSD, pathUSD, USDT0 and USDC.e — all Tempo-native, all 6 decimals. USDT0
  and USDC.e are what a bridge delivers on arrival, so a bridged deposit simply works.
  Per-chain addresses come from Tempo's own registry, `https://tokenlist.tempo.xyz/list/{chainId}`.
- Fee: a flat 2% attributed to the merchant but funded by the customer inside their own transfer (`backend/src/services/fees.ts` is the source of truth).
- Off-ramp: **none in v1.** There is no Stripe or Bridge integration in the code.

## UI code standards (enforced via skills)

This repo has project skills in `.agents/skills/` that govern all UI work. Load and follow them:

- **`modular-ui-authoring`** — when **writing new** components, screens, or views — React Native / Expo **and** the web app. New UI must be modular from the start: typed hooks, `*.types.ts` / `*.constants.ts` files, <80-line component files, logic extracted to hooks.
- **`modular-ui-refactor`** — when **changing existing** UI structure. Zero behavior changes; public import paths and export styles are contracts.
- **`design-enforcement`** — for **all** styling. The surface decides the system: `design/revolut.md` governs every web surface, `DESIGN.md` (Calm Finance) still governs `mobile/` until it migrates. Semantic tokens only, no raw hex, no mixed vocabularies on one surface.
- **`apple-design`** — for **design judgment calls** where the system files are silent: hierarchy, rhythm and spacing steps, motion and whether it means anything, target sizes, contrast, and what to remove. When a call is a matter of taste rather than of tokens, this skill decides it, and the reasoning is recorded next to the code it changed. Where it conflicts with `design/revolut.md`, the repo's system wins on *tokens* and this skill wins on *judgment*.
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
| Styling, tokens, design system | `design-enforcement` (web: `design/revolut.md` · mobile: `DESIGN.md`) |
| Design judgment calls (hierarchy, rhythm, motion, target size, contrast, what to cut) | `apple-design` |
| Mobile screen image generation | `imagegen-frontend-mobile` |
| Brand / visual identity | `brandkit` |
| Exhaustive code output | `full-output-enforcement` |
| How/when to edit skills | `skill-gardening` |

If a rule feels needed in two skills, put it in the owning skill and cross-reference it from the other. Keep each skill inside its stated concern — split rather than bloat.

## Repository layout

- `design-kit/` — **the brand asset source of truth.** Per-brand folders (`Tempo/`, `Privy/`, `Bridge/`, `Stripe/`, `seti.live/`) holding each mark in its real variants (black, white, symbol, wordmark, lockups). **Look here BEFORE creating, recolouring or inverting any logo** — the variant usually already exists, and hand-recolouring a brand mark is how a kit ends up with three versions of one asset. `web/public/` holds only the copies the app actually serves; it is not where assets are authored.
- `web/` — Next.js 16 web app: the marketing landing page (`web/app/page.tsx`) and the product app (`web/app/app/*`, served at `/app`).
- `mobile/` — React Native + Expo app (planned location; create if missing).
- `backend/` — Node.js API service (planned location; create if missing).
- `.agents/skills/` — project-local agent skills.
- `design/revolut.md` — source of truth for every web surface, and the target system for the whole repo.
- `DESIGN.md` — Calm Finance. Still the source of truth for `mobile/`; legacy once mobile migrates to the Revolut system.
- `tailwind.config.js` — NativeWind / Tailwind token configuration.
- `design.tokens.json` — machine-readable design tokens for Figma/style-dictionary pipelines.

## Tech stack

- **Mobile:** React Native, Expo, TypeScript, NativeWind (or project-chosen styling), React Navigation.
- **Web:** Next.js 16 (App Router), TypeScript, Tailwind v4 `@theme` tokens. Design system: `design/revolut.md`.
- **Backend:** Node.js, Express/Fastify, TypeScript, PostgreSQL/Supabase.
- **Onchain:** Tempo, viem, Privy (embedded wallets). Assets: OUSD, pathUSD, USDT0, USDC.e.
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
  asks to reconsider. v1 supports **OUSD, pathUSD, USDT0 and USDC.e**. **EURC.e is
  NOT supported** — a currency decision, not an availability one: it is listed on both
  chains but is EUR-denominated, and every figure shown is KES, so a EUR balance could
  not be summed into a customer's balance.
  Addresses are Tempo's, from `https://tokenlist.tempo.xyz/list/{chainId}` (4217
  mainnet, 42431 practice) — Tempo lists 36 tokens on mainnet, all 6 decimals. An
  address belongs to a CHAIN: OUSD and pathUSD share one, bridged USDC does not.
  Supported is not listed: USDT0 is mainnet-only, so practice supports three.
  A previous version claimed USDC.e, USDT0 and EURC.e "have no deployed bytecode".
  That was false, and the check behind it was invalid: `eth_getCode` returns `0xef`
  for EVERY TIP-20 on Tempo, including OUSD and pathUSD. The real test is `balanceOf`.
- Fee model: merchant 2% of the payment, no floor, no cap. The **customer**
  funds it even though it is attributed to the merchant. The fee is **collected**
  when `FEE_ROUTING_MODE=batch` (the default): one atomic Tempo transaction
  carrying the principal to the recipient and the fee to
  `SETI_TREASURY_ADDRESS`. `backend/src/services/fees.ts` is the single source of
  truth — never reintroduce a bare `Math.max(fiat * 0.02, 50)`, which charges
  small merchants half their ticket. Run `npm run check:fees` after any change to
  fee logic.
- A send to a person is a payment with a different payee: same 2%, same two-leg
  batch, verified by `recordSend` against the receipt before anything is written
  to Activity. It is refused while the server is in `inside-transfer` mode, where
  the fee riding inside the single transfer would be paid *to the recipient*.
- The batch is signed through Privy's Tempo hook (`useSendTransaction`), never
  through an EIP-1193 provider: viem's RPC formatter drops `calls`, so a batch
  sent that way would silently carry none. `npm run prove:batch` proves the
  protocol path against Moderato; `npm run check:send` and `check:fee-batch` prove
  the reconciliation against real receipts.
- Do not add features that require M-Pesa settlement unless the user changes that priority.

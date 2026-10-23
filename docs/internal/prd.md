# Seti v4 — Product Requirements Document

> **Scope of this document:** `seti-v4` only. Every requirement below is either
> implemented in this tree, or explicitly marked as not built. Where a shipped
> file and a doc disagree, the file wins and the disagreement is recorded in
> §12. The section skeleton is borrowed from the superseded `seti-v3` PRD; the
> content is not — v3 was a WhatsApp/Telegram bot settling USDC/EURC on Arc.

---

## 1. Summary

Seti is a mobile neobank for Nairobi. A customer holds a stablecoin balance
(**OUSD** or **pathUSD**, on **Tempo**) inside a Privy embedded wallet, scans a
merchant QR code, and pays. Settlement is **non-custodial**: the customer signs
an ERC-20 `transfer` that lands in the merchant's own wallet address. Seti never
takes possession of the principal and holds no signing material.

The product is three packages in one npm workspace: `mobile/` (Expo 57 app),
`backend/` (Fastify 5 + Prisma + Postgres), `web/` (Next 16 marketing page plus
the Terms/Privacy/Cookie surface the app links to).

v1 has **no fiat off-ramp**. There is no Bridge call, no Stripe call, and no KES
bank payout anywhere in the code. The merchant receives stablecoins at their own
address; what they do with them afterwards is out of scope.

Two things make this harder than it looks, and both are load-bearing:

1. **The 2% platform fee is collected.** It is computed, persisted and audited,
   and taken as its own transfer to `SETI_TREASURY_ADDRESS` in the same atomic
   Tempo transaction as the principal, so Seti is paid without ever holding the
   principal (`FEE_ROUTING_MODE=batch`, the default). `FEE_ROUTING_MODE=inside-transfer`
   remains for comparison: there the fee rides inside the customer's single
   transfer, so the recipient gets it and Seti collects nothing. The batch path is
   proven on Moderato by `npm run prove:batch`.
2. **Every figure the client supplies is an input, not a measurement.** The
   backend verifies the claimed amount against the on-chain receipt and fails
   closed.

---

## 2. Problem Statement

Someone in Nairobi holding stablecoins cannot spend them where they live. Their
balance sits in an exchange or a wallet app with no merchant acceptance, while
everyday payments run through mobile money with its own settlement timing, cost
and cross-border friction. The repo's landing page frames the two pressures as
currency debasement and cross-border cost; the README frames the opportunity as
a market that is already mobile-first and QR-ready.

Seti's bet is that the missing piece is not a new payment rail but a thin,
trustworthy client over rails that already exist: the customer's stablecoin
balance on one side, the merchant's own wallet address on the other, and a
backend that proves what happened rather than trusting either party.

The product succeeds only if a non-technical merchant can accept a payment with
the same confidence as mobile money, **including** confidence that:

- the amount credited was the amount agreed, verified against the chain, not the
  client's claim;
- a failed or unverifiable payment never gets written down as a settled one; and
- the fee arrangement is stated honestly — including that the published "2%"
  is, in v1, a charge the *customer* funds even though it is attributed to the
  merchant.

---

## 3. Where the implementation stands

Status vocabulary: **Shipped** = in the tree, covered by a check or a live path;
**Partial** = implemented with a known hole; **Not built** = nothing in the tree.

| Area | Status | Anchor |
| --- | --- | --- |
| Privy email-OTP auth → local user + wallet registration | Shipped | `backend/src/routes/auth.ts`, `mobile/src/app/login.tsx` |
| Legal consent capture on onboarding | Shipped | `mobile/src/hooks/useLegalConsent.ts`, `lib/legal/` |
| Merchant QR parsing + resolution | Shipped (Seti-format only) | `backend/src/services/merchants.ts` |
| Payment preview: fee, FX, balance check | Shipped | `backend/src/services/payments.ts` |
| Customer-signed transfer to merchant | Shipped | `mobile/src/hooks/usePayMerchant.ts:313` |
| On-chain reconciliation, fail-closed | Shipped | `backend/src/services/transactions.ts:152` |
| Durable indexer (cursor, lock, TTL) | Shipped | `backend/src/services/indexer.ts`, `indexer-store.ts` |
| Transaction history + detail state | Shipped | `mobile/src/app/(tabs)/activity.tsx`, `routes/transactions.ts` |
| Support lookup for a failed payment (refusal audit trail, chain verdict) | Shipped | `backend/src/cli/support-payment.ts`, `services/payment-refusal.ts` |
| Stuck `processing` rows resolved against the chain | Shipped | `backend/src/services/stuck-transactions.ts` |
| Stuck-payment alerting (`GET /health/sweep` → 503) | Shipped | `backend/src/routes/health.ts` |
| Fee schedule (flat 2%, floor 0, cap 0) | Shipped | `backend/src/services/fees.ts` |
| **Fee *collection* to treasury** | **Collected** (default mode) | `FEE_ROUTING_MODE=batch` + `SETI_TREASURY_ADDRESS` |
| Atomic two-leg fee batch | Shipped, proven on Moderato | `npm run prove:batch`, `web/hooks/useTempoSender.ts` |
| Sending to a person (P2P) | Shipped: quoted, batched, recorded | `recordSend`, `previewSend`, `web/components/home/SendPanel.tsx` |
| Gas estimation in the preview | Shipped: measured gas × live gas price, display only | `estimateNetworkFee` — the balance check still reserves a flat floor |
| KYC / tiering | Not built | `profile.tsx` renders "Coming soon" |
| Fiat off-ramp (Stripe/Bridge) | Not built | schema fields only: `bankAccount`, `bridgeRecipientId` |
| Receive side of a P2P send to another Seti user | Not built | the indexer skips wallet→wallet transfers, so the recipient sees no row |
| Test runner | Does not exist | gates are `tsc` + `eslint` + `*.check.ts` |

---

## 4. Goals

- Let a customer pay a merchant from a stablecoin balance by scanning a QR code,
  in one confirmation, without the customer ever handling an address.
- Keep the merchant whole: they receive **the principal**, verified on-chain, at
  their own address.
- Make every number in the app traceable to a backend computation with
  provenance (FX rate, source, timestamp; fee; gross), never to client
  arithmetic.
- Structure the money path so that an unverifiable payment cannot be recorded as
  settled — fail closed, including for a merchant with no payout address.
- Collect the 2% merchant fee **without ever taking custody of the principal**,
  and prove it on testnet before mainnet.
- Keep the verification gate honest and executable, since there is no test
  runner: `npm run verify` must fail when money-path behaviour regresses.

---

## 5. Non-Goals (v1)

- **Fiat off-ramp.** No Stripe, no Bridge, no KES bank settlement. The
  `bankAccount` / `bridgeRecipientId` columns and the `offramp.initiate` audit
  action are future-feature shapes, not a settlement path.
- **M-Pesa.** Intentionally out of scope for this phase.
- **Assets beyond pathUSD and OUSD.** USDC.e, USDT0 and EURC.e were removed:
  none had deployed bytecode on either Tempo chain, and a transfer to a no-code
  address can succeed as a silent no-op rather than reverting.
- **Chains beyond Tempo mainnet (4217) and Moderato (42431).**
- **Custody.** Seti never holds keys or principal; no server-side signing on a
  user's behalf.
- **New merchant hardware.** Merchants display a QR code; the app already needs
  a dev build for camera and wallet modules.
- **A general-purpose QR standard.** See §7.1 — v1 parses Seti's own payloads.
- **P2P transfers, in-app top-up, virtual card.** Present in the design system
  and the schema, not in v1's shipped surface.

---

## 6. Users

- **Primary — the customer.** A smartphone user in Nairobi with a stablecoin
  balance who wants to pay a merchant. Comfortable with mobile money; likely has
  no mental model of wallets, gas or addresses.
- **Secondary — the merchant.** Displays a Seti QR code, receives stablecoins at
  their own wallet address. Onboarding a merchant is currently a database
  operation (`merchants` table / `prisma/seed.ts`), not a product surface.
- **Internal — support.** Who reads `audit_logs` and `transactions.metadata`
  when a customer says a payment did not land. There is still no admin UI: the
  answer today is `npm run support:payment -- <txHash>` plus the schema, and
  every refusal on the payment path is now written to `audit_logs` keyed by the
  hash the customer pasted — see §7.10. An admin dashboard is wanted and is an
  open decision (§13), not a shipped surface.

---

## 7. Functional Requirements

Each requirement is tagged **[Shipped]**, **[Partial]** or **[Not built]**.

### 7.1 Merchant resolution from a QR code — [Shipped, narrowing the claim]

The system must resolve a scanned payload to a merchant record and an optional
suggested amount. Accepted payload formats (`backend/src/services/merchants.ts`):

- `seti://pay?merchantId=<id>&amount=<n>` — the deep link
- `merchant:<id>`
- a bare merchant id matching `/^[a-zA-Z0-9_-]{3,64}$/`

Anything else is `unknown` and must produce a clear failure, not a guess. The
pay screen offers manual entry as a first-class path so a payment can be tested
without a camera.

**Open claim.** The landing page says "Scan a QR code" without saying whose, and
this repo's `README.md` / `AGENTS.md` previously claimed the customer scans
*existing* merchant QR codes with "no new hardware" (both corrected 2026-10-09).
The parser above accepts only Seti's own payloads, so a merchant must display a
Seti-issued code. Whether v1 should read an existing Kenyan QR standard (or a
printed merchant id) is a product decision, not an implementation detail — see
§12.3.

### 7.2 Payment preview — [Shipped]

Before signing, the client must request a server-computed preview from
`POST /transactions/preview` and display it. The preview must contain, at
minimum: principal in asset units, the fee in KES, the **gross the customer will
sign for** (principal + fee + network), the KES-equivalent, FX rate plus source
and staleness flag, and a boolean balance sufficiency.

- **The request is fiat-denominated.** The customer enters a figure in THEIR
  currency — the pay screen labels the field with it, and a merchant QR payload
  carries a local-currency amount — so the request field is `amountFiat` and the
  server converts it to the asset for signing. KES is the only currency enabled in
  v1; the field is named for the unit, not for one currency. Reading that figure as stablecoin units
  was a real unit bug: a customer typing 250 against a `KES` label signed a 250
  OUSD transfer, roughly 129× what they meant. Keep the contract KES-in /
  asset-out, and never let one number carry both meanings.
- The FX rate must come from the backend, never the client
  (`payments.ts` → `getFxQuote()`).
- Sufficient balance must be measured against the **gross**, not the principal,
  or a customer holding exactly the principal is told they can pay and then
  fails on-chain.
- When `FEE_ROUTING_MODE=batch`, the preview must return the fee amount in asset
  units (`feeInAsset`) as the exact second-leg amount, and the mode itself, so
  the client knows how many legs to sign.

**[Partial]** The preview returns fields the UI does not render: `feeCapped`,
`minimumTicketForFloor` and `fxRateStale` are typed in `mobile/src/lib/api/pay.types.ts`
and ignored by `pay.tsx`. `networkFee` is hardcoded `0` (`payments.ts:229`), so
the "network" component of the gross is not yet real.

### 7.3 Payment submission — [Shipped]

The customer's embedded wallet must sign and broadcast the transfer.

- `inside-transfer` (default): **one** ERC-20 `transfer` of the gross to the
  merchant's payout address.
- `batch`: one atomic batch — principal to the merchant, fee to
  `SETI_TREASURY_ADDRESS` — submitted via Privy's `wallet_sendCalls` (EIP-7702,
  no wallet-type migration, address unchanged). One transaction hash covers both
  legs.

The client must send the figure that matches the server's mode: the **principal**
in batch mode, the **gross** in inside-transfer mode. Getting this backwards must
fail loudly at reconciliation, which it does.

The client must read the preview from the local result of the fetch it just
awaited — never from component state captured before an `await`. A stale-closure
read here previously sent the principal instead of the gross on the first
payment, underpaying the merchant by the fee.

**[Partial]** The `batch` branch is implemented and unreached: no batched
transaction has ever been signed on Tempo, and EIP-7702 support on Tempo mainnet
is inferred from TIP-1047 rather than confirmed by RPC. Whether the Expo
embedded-wallet provider forwards `wallet_sendCalls` is likewise unconfirmed.

### 7.4 Reconciliation and recording — [Shipped]

`recordPayment` must treat `input.amount` as a claim and verify it against the
chain before writing anything:

1. **Refuse a merchant with no `payoutAddress`.** There is nothing to reconcile
   against, so the payment must be refused rather than recorded from the client's
   claim. (This path previously skipped verification entirely — a live
   under-reporting vector.)
2. Fetch the receipt and decode the ERC-20 `Transfer` log filtered to the
   expected token contract **and** the expected recipient.
3. Fail closed on: receipt unavailable, transaction reverted, or no matching
   `Transfer`.
4. Reject a claim that differs from the observed transfer by more than **1%** —
   tolerance for rounding, not for a materially different amount.
5. **The chain wins.** Derive the principal, fee and fiat figures from the
   observed value, not the claim.

In `batch` mode the same treatment applies to the **fee leg**: both the merchant
principal and the treasury fee must appear in the single receipt, or the payment
is refused. Recomputing `gross == principal + fee` as a residue keeps the
identity exact with no rounding shortfall.

### 7.5 Fee collection — [Partial; not collected in the default mode]

The fee schedule is a percentage → floor → cap pipeline
(`backend/src/services/fees.ts`), shipping as a **flat 2% with floor and cap at
0** (`MERCHANT_FEE_PERCENT=2`, `MERCHANT_FEE_MIN_KES=0`,
`MERCHANT_FEE_MAX_PERCENT=0`). The floor and cap are retained as configuration
for when an off-ramp lands; a flat percentage is what makes the published "2%"
true at every ticket size.

- The fee must never be reintroduced as `Math.max(fiat * 0.02, 50)`, which
  charges 50% of a KES 100 ticket. `npm run check:fees` is the executable spec.
- The fee is **fee-inclusive**: the customer signs principal + fee in one
  transfer and the merchant receives the principal, so
  `splitFeeInclusiveTotal()` inverts the schedule from the gross.
- **The 2% is attributed to the merchant but funded by the customer.** This is
  the honest description and the reason the fee must be visible in the preview.
- `SETI_TREASURY_ADDRESS` is validated as 20-byte hex at boot in **both**
  packages (`backend/src/config/env.ts`, `mobile/src/lib/chain.ts`), and mobile
  reads it through `app.config.js` → `Constants.expoConfig.extra`.

**The gap.** With the default `FEE_ROUTING_MODE=inside-transfer` there is no
transfer leg to the treasury at all — the only outbound paths in the codebase are
`usePayMerchant.ts:313` (single transfer to the merchant) and the batch branch at
`:300`. So the fee is computed, persisted (`feeAmount`, `merchantNetAmount`),
audited and **uncollected**; the merchant receives the gross. Closing this is
§12.1 and the single highest-value item in the repo.

### 7.6 Transaction lifecycle and history — [Shipped]

- A recorded payment is written `processing`, then advanced to `completed` or
  `failed` by receipt confirmation (`confirmTransactionByHash`). The **indexer
  only ever advances a row to `completed`** — it never marks one failed — so a
  row whose confirmation timed out is resolved by the stuck-transaction sweep
  instead (§7.10), which re-reads the chain and can mark one failed.
- Only rows in `processing` may be advanced; a terminal row is never rewritten.
- The app must show grouped history (Today / Yesterday / Earlier) with pull to
  refresh, and an explicit empty state.
- A payment failure must be classified, not just displayed. The classifier
  distinguishes **insufficient gas** from **insufficient funds** and must match
  the gas markers *before* the generic funds case — "insufficient funds for gas
  \* price + value" contains both substrings, and the wrong order tells the
  customer to top up their payment balance when they need fee headroom.
- A terminal failure state must not leave the primary action disabled: the
  busy/disabled derivation enumerates every terminal step, including
  `insufficient-gas`, so the customer can retry.

### 7.7 Identity, wallet and consent — [Shipped]

- Login is Privy email OTP; the app posts the Privy token to
  `POST /auth/verify`, which upserts the local user, registers the embedded
  wallet (address only) and writes a `user.login` audit row.
- `DEV_BYPASS_AUTH=true` is honoured **only** with `NODE_ENV=development` and is
  otherwise a 404. It must stay gated on both.
- One active wallet per `(userId, asset)`; addresses unique. The registry stores
  public addresses and, at most, an opaque `keyId` reference — never a key.
- Onboarding captures display name plus explicit acceptance of Terms and
  Privacy; acceptance is persisted before the user proceeds, and carries a
  version (`CONSENT_VERSION`) so a material document change re-prompts.

### 7.8 Indexer — [Shipped]

A periodic pass must scan `Transfer` logs for tracked wallet addresses and:

- **confirm** an existing `processing` row when an outbound transfer from a Seti
  wallet matches a known `txHash`; and
- **create** a `top_up` for an inbound transfer from an external address, when no
  row for that `txHash` exists.

[Shipped] Progress is durable (`IndexerCursor`, one row per chain key), the lock
is an atomic compare-and-set with a TTL for stale reclaim, and only the lock
owner may advance the cursor. The chain key is `network.name`
(`tempo-mainnet` / `tempo-testnet`), so switching networks cannot clobber the
other chain's cursor.

### 7.9 Legal and compliance surfaces — [Shipped, pending review]

- The website hosts the binding Terms, Privacy Policy and Cookie Notice
  (`web/app/legal/`); the app shows a plain-language summary plus a link.
- `LEGAL.company`, `address`, `contactEmail` and `legalBaseUrl` are
  **placeholders** (`mobile/src/lib/legal/legal.constants.ts`) and the file says
  so. The published documents are drafts and state that they have not been
  reviewed by a qualified Kenyan attorney.
- The Terms must state plainly that Seti is non-custodial, is not a bank, does
  not hold customer funds, and that the licensing question under the Payment
  Service Providers Act / Central Bank of Kenya Act is unsettled. They do.
- The footer publishes a donations address with a QR generated from
  `SETI_TREASURY_ADDRESS` by a committed script. **Which key controls that
  address, and what happens if it is rotated, is unanswered** (see §12.5).

### 7.10 Support lookup and refusal evidence — [Shipped]

The customer's transaction hash is the handle for every outcome, because it is
the only one that exists whether the payment was recorded, refused before any
row was written, or is still pending.

- Every refusal on the payment path is recorded in `audit_logs` as
  `payment.rejected` with a machine-readable `code` and, where the refusal is
  about an amount, the claimed and observed figures
  (`backend/src/services/payment-refusal.ts`). It is recorded *before* the
  refusal is thrown, so a payment that leaves no ledger row still leaves
  evidence.
- `audit_logs.txHash` is an indexed column, not a key inside `metadata`. The
  support query is one indexed lookup rather than a JSON scan across every
  event.
- `transactions.metadata` and `audit_logs.metadata` are evidence: caller-supplied
  keys live under `client`, so a client claim can never sit level with a value
  the backend derived.
- `npm run support:payment -- <txHash>` prints the database row (a claim), the
  audit trail (the record), and the receipt re-read live from the chain (the
  authority), then states whether they agree. `--user <email>` lists a
  customer's recent payments when the hash is not yet known.
- `/transactions/pay` answers a refusal with `422` and `{ error, code, txHash }`
  instead of a bare `500`.
- Read-only by construction: nothing in this surface writes to the chain or
  moves funds.
- Asserted by `check:reconcile`, which now proves a refusal writes an indexed,
  coded record while still writing no transaction row — including the property
  that *every* refusal carries a hash.

- A **stuck-transaction sweep** runs on the indexer's tick
  (`backend/src/services/stuck-transactions.ts`). A payment row is written only
  after a *successful* receipt has already been read, so a row left `processing`
  is almost always "the chain settled it and the database never heard": the
  sweep re-reads the receipt and advances the row to the state the chain
  reports. It is gated on age (`STUCK_TX_AGE_MINUTES`, default 10, which must
  stay above the 30s inline confirmation timeout so it cannot race a
  confirmation in flight) and bounded per pass (`STUCK_TX_SWEEP_LIMIT`, default
  25 receipt fetches).
- **Every sweep write is conditional** on the row still being `processing` — the
  same compare-and-set shape as the indexer cursor — so two replicas, or a sweep
  racing an inline confirmation, cannot both write the transition. The audit row
  is written only by the winner and carries `resolvedBy: 'stuck-sweep'`, so the
  trail shows *how* a row reached its terminal state.
- **No receipt means no write.** "No receipt" for a row that was only created
  after a successful one is a contradiction — a reorg, a wrong-chain hash, or an
  RPC disagreeing with the one that recorded it — so those rows are reported and
  never rewritten. Inventing a terminal state there would hide the thing a human
  needs to see.
- `npm run support:payment -- --stuck` lists what is currently in `processing`
  with its age and whether the chain shows it settled, so an operator can tell
  "the sweep is working" from "the sweep is not running".
- `check:stuck` asserts all of it, anchored on a real on-chain transfer.

- **`GET /health/sweep` is the alerting surface.** It answers two questions — is
  any row stuck or unresolved, and is the sweep still running — and returns
  **503** when either is true, so any uptime monitor, load balancer or
  orchestrator can act on it with no metrics stack. Counts only, never hashes:
  the probe is unauthenticated and does not need to publish *which* payments are
  stuck — use `support:payment --stuck` for those. `GET /health/` stays pure
  liveness and touches no database, so a database outage cannot make a healthy
  process look dead; it also names the Tempo network the process serves, so a
  client/API chain mismatch is one unauthenticated request away from being seen.
- The "sweep has stopped" case is covered deliberately. The sweep state is
  in-process, so `lastSweepAt` going stale (over 60s — four missed ticks) is
  itself reported as degraded. A dead sweep otherwise looks exactly like a quiet
  one, which is the failure that would let rows accumulate unnoticed.

**[Remaining gap]** The probe is per-process and in-process: it holds no history,
so there is no trend and no count over time. That is deliberate — a durable
sweep-statistics table would be the next step if anyone wants to alert on rate
rather than on state.

---

## 8. Non-Functional Requirements

### 8.1 Financial integrity — fail closed

No path may record a settled payment that was not verified against the chain. An
unverifiable receipt, a reverted transaction, a missing payout address, and a
mismatch beyond 1% must all refuse. Tolerance exists only for rounding. The chain
is authoritative for every derived figure, including when the claim is within
tolerance.

### 8.2 Key custody

Never request, store, transmit or log a seed phrase, private key or raw passkey
credential. Keys belong to the user through Privy embedded wallets. The backend
must not sign on a user's behalf. A client-supplied `wallet_sendCalls` batch is
authorised on-device or not at all.

### 8.3 Network safety gates

- Mainnet (`4217`) is refused unless `ALLOW_MAINNET=true`; the process
  hard-errors with an explicit message rather than defaulting.
- With no `TEMPO_CHAIN_ID`, development defaults to testnet (Moderato, `42431`)
  and **production throws**.
- Testnet and mainnet configuration must stay separate. Moderato is the proving
  ground for every money-path change, and `backend/.env` in this tree is
  **currently on Moderato** (`TEMPO_CHAIN_ID=42431`, `ALLOW_MAINNET=false`,
  `TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz`, `FEE_ROUTING_MODE=inside-transfer`).
  Mainnet is therefore one config edit away, not a separate build — which is
  precisely why the guard is a boot-time refusal rather than a convention.
- An explicit `TEMPO_RPC_URL` overrides the derived default, so a populated
  `ALCHEMY_API_KEY` does not mean Alchemy is being used (`networks.ts:143`).
- Every token address is a claim until checked. `pathUSD` and `OUSD` were
  verified by `eth_getCode` / `decimals()` / `symbol()` on **both** chains. Note
  `eth_getCode` returns `0xef` for these addresses (an EIP-7702 delegation
  designator), so "non-empty code" alone is not the test; and a probe at the
  `0x…0100` designator returns empty on every chain including Ethereum, so it
  cannot test 7702 support at all.

### 8.4 Idempotency

A `txHash` is unique in `transactions`; that constraint — not the indexer lock —
is what prevents a payment being recorded twice. The lock prevents duplicated
*work*, and must not be described as protecting money.

### 8.5 FX integrity and provenance

The KES/USD rate comes from a live provider (`open.er-api.com`), cached one hour,
with a 5s timeout, and **fails soft** to a configured fallback — a provider
outage must never 500 a preview or block recording a payment that already
settled. Every rate must be sanity-banded (50–500 KES/USD) before use, so a unit
slip cannot be persisted onto every row. `source`, `asOf` and a `stale` flag
(>36h, the provider's own cadence) must travel with the quote and be persisted on
the transaction row so a historical figure is always explainable.

### 8.6 Indexer durability

Progress must survive a restart (durable cursor, not process memory), two
replicas must not both scan the same range (atomic lock, TTL reclaim, owner-only
advance), and the bootstrap lookback must default to **0**. A non-zero lookback
on mainnet would write real historical transfers as new `top_up` rows —
fabricated ledger entries no payment produced. `0` means *start now*, not
*scan one block*.

### 8.7 Provider block-range caps differ per chain

A hosted RPC may cap `eth_getLogs` by block range, and the cap can differ between
testnet and mainnet for the same plan. Alchemy's free tier allows a **10-block**
range on Tempo mainnet while Moderato accepts far more, against an indexer
`MAX_RANGE` of 2,000. Probe the endpoint you will actually use. Do not lower
`MAX_RANGE` to the cap as a fix — that turns a bounded catch-up into thousands of
queries forever.

### 8.8 Privacy

Never display or log a recipient phone number in raw form where a lookup token
would be used. Transaction metadata is audit evidence and must not accumulate
secrets. Provider errors may embed the full RPC URL including an API key — never
print a raw viem/provider error; scrub it first.

### 8.9 Design conformance and accessibility

- Semantic tokens only; no raw hex in components, and every colour has a light
  and dark value (`DESIGN.md`, `tailwind.config.js`).
- Monetary values in tabular figures; currency format `KES 1,250.00`.
- Minimum 44×44 pt touch targets.
- Calm copy register: no exclamation marks, no gamification, no celebratory
  animation for routine actions.
- **[Gap]** Raw hex is present in shipped screens
  (`mobile/src/app/(tabs)/index.tsx`, `activity.tsx`, `(tabs)/_layout.tsx`),
  which contradicts the token rule these same files are subject to.

### 8.10 Verification gate

`npm run verify` from the root is the gate: three typechecks, three lints, and
the check suites (`check:fees`, `check:payout`, `check:indexer`, `check:cursor`,
`check:reconcile`, `check:indexer-pass`, `check:stuck`, `check:errors`).
`check:fee-batch` is
deliberately **outside** the gate — a mode-gated check whose default is to skip
trains you to ignore a `skip` line.

There is no test runner; the `*.check.ts` files are the executable specs and must
be read as such. A zero exit is necessary, not sufficient: the RPC-backed checks
print `skip` when they cannot find a suitable on-chain anchor, and a skip is
indistinguishable from a pass in the exit code. Two structural rules follow:

- A check that passes for the wrong reason is worse than no check. Anchor on a
  hash discovered dynamically from `getLogs`, and assert on the **reason** a
  refusal happened so the check cannot silently degrade to asserting "it failed".
- A pure-function check cannot cover orchestration. The "cursor never advances
  from 0" bug lived entirely in the caller. Assert at the layer where the bug
  lives.
- **The gate must not be run with a backend dev server up.** The dev server's
  own indexer ticks every 15s and writes the **live** `tempo-testnet` cursor row,
  while `check:indexer-pass` operates on that same live chain key
  (`withCursor()` uses `network.name`, not the `SAFE_PREFIX` its own header
  claims). A tick landing between the check's setup and its `indexOnce()` call
  makes that pass return `skipped: true` (`locked-by-other-replica`), so two
  assertions fail — `first pass is not reported as skipped` and `first pass is
  flagged as a bootstrap` — and the same check passes when run standalone. Stop
  the dev server and confirm the cursor stops moving before trusting a gate run.

---

## 9. Dependencies

- **Tempo** — stablecoin payments chain. Mainnet `4217`, testnet Moderato
  `42431`. Gas is paid in stablecoins and **the customer sponsors their own**;
  no bundler, no paymaster, no `sponsor: true`, no per-transaction operating cost
  for Seti.
- **Tempo Stablecoin DEX** — an enshrined singleton precompile at
  `0xdec0000000000000000000000000000000000000`, with an onchain orderbook
  (price-time priority; limit, flip and market orders). OUSD's quote token is
  pathUSD, so any USD stablecoin can route to and from OUSD. **Deliberately
  unused in v1:** a swap is not a split, so it does nothing for fee collection,
  and there is no asset mismatch to solve while the customer base holds OUSD.
  It becomes relevant only when a merchant wants settlement in a different
  stablecoin from the one the customer holds — and then the swap belongs in the
  customer's own wallet, to keep the flow non-custodial.
  - Probed 2026-10-09 with the repo's own viem (**2.57.2**, which already ships
    `tempo/actions/dex` — `getSellQuote`, `sellSync`, `buy`, `place`,
    `placeFlip`, `cancel`, `cancelStale`, `getOrderbook`, `getTickLevel`,
    `getBalance`, `withdraw`, `watchOrderFilled`), so adopting it needs no new
    dependency:
    - mainnet: `1 pathUSD → 0.999900 OUSD` (0.0100%, i.e. 1 bp), and the same
      spread at 100 and at 100,000 units, so the book has real depth.
    - Moderato: quotes 1 and 100 units at the same 1 bp, but reverts
      `InsufficientLiquidity` at 100,000 — the testnet book is thin, so testnet
      swap testing is size-limited.
    - `eth_getCode` returns `0xef` at the DEX address, exactly as the TIP-20
      tokens do, so contract presence is not a test here; only a live call is.
  - Not the same thing as the Fee AMM (`0xfeec…0000`), which converts
    transaction fees into validators' preferred tokens and is not a venue.
- **Privy** — embedded wallet creation and auth (`@privy-io/expo`,
  `@privy-io/server-auth`). Also the fee-route mechanism: `wallet_sendCalls`
  over EIP-7702.
- **PostgreSQL / Prisma** — users, wallets, merchants, transactions, audit log,
  indexer cursor. Docker Compose maps host `5433` (the system Postgres on `5432`
  still holds the older seti-v3 schema — confirm by table names, not `select 1`).
- **`open.er-api.com`** — live KES/USD rate.
- **An RPC endpoint for Tempo** — configured today as the public
  `https://rpc.moderato.tempo.xyz`. On mainnet, Alchemy's free tier cannot serve
  the indexer's scan range, so either a paid tier or the public mainnet endpoint
  is required (see §13).
- **Tempo Accounts SDK (`accounts`)** — installed, all peers satisfied,
  **nothing imports it**. It has no client-side batching primitive; its
  `feePayer` is for gas sponsorship and MPP charges customers per API call (the
  wrong direction for a merchant fee). Unwired deliberately.
- **Stripe / Bridge** — credentials are present in `.env` with no call site.
  A populated key is not evidence of an integration.

---

## 10. Success Metrics

- **Correctness (must be zero):** payments recorded as settled without a
  verified on-chain `Transfer`; double-recorded `txHash`; fee arithmetic
  disagreeing with `check:fees`.
- **Fee realisation:** the share of merchant payments whose fee actually reaches
  `SETI_TREASURY_ADDRESS`. Currently **0%** by construction in the default mode;
  this is the metric v1 has to move.
- **Verification coverage:** the reconciliation refusal rate attributable to real
  mismatches rather than the anchor-finding `skip` path — i.e. are the checks
  exercising the live chain or degrading quietly?
- **Payment latency:** p50/p95 from customer confirmation to the app showing
  `completed`.
- **Gas preconditions:** the ratio of failed payments classified as
  insufficient-gas. A high rate means the precondition is not being surfaced
  early enough.
- **FX staleness:** proportion of recorded payments whose rate was the fallback
  or older than 36h.
- **Indexer health:** cursor lag against chain head; skipped ticks caused by lock
  contention.
- **Stuck payments:** rows the sweep resolves, and rows it leaves `unresolved`.
  The unresolved count should be **zero** — a non-zero value means a reorg, a
  wrong-chain hash, or the RPC disagreeing with the one that recorded the
  payment, which is a chain or configuration problem and never rounding.

---

## 11. Risks

- **A money-path bug on mainnet moves real funds, and mainnet is one env edit
  away.** The tree is on Moderato today, but `ALLOW_MAINNET` and
  `TEMPO_CHAIN_ID` are the only things between the same code and live funds, and
  there is no staging step in between. Mitigation: prove every change on
  Moderato first and treat `backend/.env` as a live-money surface.
- **`HANDOVER.md` is stale on chain selection.** Its "Environment as it stands"
  section states `TEMPO_CHAIN_ID=4217` / `ALLOW_MAINNET=true`; the tree is on
  Moderato. Read the env, not the handover.
- **`backend/src/services/transactions.ts` is a reconstruction.** It was rebuilt
  from scratch after a scripted edit truncated it, with no git or backup copy;
  `readTransferredAmount`, `recordPayment` and `confirmTransactionByHash` are
  behaviourally re-derived from what the checks pin. They are reviewed by proxy
  only. Read them before trusting them, and never rewrite that file with a
  script.
- **The batch fee leg is unproven.** Atomicity is documented by Privy, not
  observed here; EIP-7702 on Tempo mainnet is inferred. If batching proves
  unreliable the fallback is two sequential transfers and a measured leak rate —
  never a server-held key.
- **A check can pass for the wrong reason.** A fabricated fixture made the batch
  guard green while untested; a real hash that did not touch the token under test
  made the amount comparison never execute. Fixtures must be discovered from the
  chain and assertions must name the refusal reason.
- **Doc drift is a live hazard.** `README.md` described settlement in KES through
  Stripe + Bridge, which contradicted the shipped non-custodial path, and
  `HANDOVER.md` pinned the env to mainnet while the tree ran on Moderato. Both
  were corrected on 2026-10-09, but the class of error recurs: a reader who
  trusts prose over the code builds the wrong thing. When a doc states a fact
  about the system, re-derive it from the code before acting on it.
- **Published numbers are claims about code.** "Merchants pay 2%" is true of the
  schedule and false about who funds it; it is also only true while the floor and
  cap stay 0. When site copy and implementation disagree, surface the mismatch as
  a decision — do not quietly edit whichever is easier.
- **Untracked money path.** The tree is dirty with nothing committed (98 entries
  at the time of writing); the last handover recorded 91. An untracked money path
  has no checkpoint to return to.
- **Legal placeholders are published.** `legal@seti.example` / `seti.example`
  ship in the app, and the entity details are unreplaced. Publishing a placeholder
  contact is worse than publishing none.

---

## 12. Resolved Questions

### 12.1 Which chain and assets does v1 support?

Tempo, and **pathUSD + OUSD only**, on both mainnet (`4217`) and Moderato
(`42431`). USDC.e, USDT0 and EURC.e were removed after `eth_getCode` showed no
deployed bytecode at their configured addresses on either chain. Both supported
tokens have decimals 6 and identical addresses on both chains. `SUPPORTED_ASSETS`
exists in **both** backend and mobile; narrowing an asset list means narrowing
every copy and letting the compiler find the leftovers.

### 12.2 Who sponsors gas?

The customer, in stablecoins. No bundler, no paymaster, no Seti operating cost
per transaction. Consequence: a customer must hold enough of a fee token
alongside their payment balance, which must surface as its own state
(insufficient gas) rather than a generic failure.

### 12.3 Does v1 read existing merchant QR codes?

Not today. The parser accepts Seti's own payloads only
(`backend/src/services/merchants.ts`). The landing page says "Scan a QR code"
without naming whose, and the repo docs used to claim *existing* merchant codes
(corrected 2026-10-09). Either the parser grows an existing-standard path or the
copy narrows to "merchants display a Seti code" — a product decision, unresolved.

### 12.4 What happens if the recipient is not a Seti user?

Not applicable in v1. Payments go from a Seti customer to a merchant's own wallet
address. Merchant wallets are not provisioned by Seti and there is no
claim/invite flow (unlike the superseded v3 design).

### 12.5 Which key controls the published donations address?

`SETI_TREASURY_ADDRESS` is published in the site footer with a QR generated from
it by `web/scripts/generate-treasury-qr.py`. It is validated as a 20-byte address
and is an EOA on both chains. **Which key holds it, and what happens on rotation
or restore from an old seed, is unanswered** — raised to Ian and still open. A
published address is only as trustworthy as the custody behind it, and getting
this wrong quietly contradicts the "we never hold your funds" claim every other
page makes.

---

## 13. Still Open

- **Admin dashboard, or script-only support?** `npm run support:payment`
  answers a ticket today (§7.10). An admin web app is wanted, but it needs an
  authorisation model the schema does not have (`User` carries no role or
  claim), and a decision on where it lives — inside `web/` beside the landing
  page, or its own package. Undecided; the script is the interim answer.
- **Fee routing sign-off.** Which mode ships: `batch` (collect the fee, requires
  proving EIP-7702 batching on Moderato first) or `inside-transfer` (keep the
  current behaviour and collect nothing). Requires a funded Moderato wallet and a
  **test** treasury address distinct from the mainnet one — two inputs, neither of
  which exists yet.
- **Surcharge or absorbed?** The site says the merchant pays 2%; the customer
  funds it. The separate fee leg makes it visible on-chain either way. App copy
  has not caught up.
- **Which Tempo fee token do customers hold?** The chain config names `TEMPO` as
  the native currency, but gas is paid in a fee token chosen at send time. Must
  be pinned down before the flow can check for it. Per the project docs skill,
  fee tokens come from the docs — never from memory.
- **One confirmation or two?** Affects `pay.tsx` copy; resolves with a real batch.
- **Gas estimation in the preview.** `networkFee` is `0`. Either estimate it or
  stop implying the gross includes it.
- **Does Tempo support EIP-7702 / parallel transactions on mainnet?** TIP-1047
  references 7702 delegations; a testnet batch is the only real proof.
- **`accounts` (Tempo Accounts SDK).** Installed, unused, 52 vulnerabilities, two
  native modules. Keep unwired, or remove? Current recommendation: keep unwired
  until something specific needs it.
- **Indexer vs hosted indexer.** Tempo publishes `/api/indexer-api`. Worth
  comparing against the hand-rolled indexer before investing further in it.
- **Mainnet RPC.** Alchemy's free tier cannot serve the indexer's range; the
  public RPC is the current answer. Decide whether to upgrade the tier or accept
  the public endpoint before launch.
- **Interim fallback if batching fails.** Two sequential transfers with a
  measured, accepted leak rate. Undecided, contingent on the testnet batch.
- **KYC tiering and spend limits.** The schema has `kycStatus`, `kycTier`,
  `dailyVolume`, `monthlyVolume`. Nothing reads them; the app says "Coming soon".
  Whether v1 needs any of it is a compliance question, not a code question.

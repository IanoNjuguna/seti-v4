# Handover — seti-v4

**Date:** 2026-10-04
**Branch:** `feat/mobile-scaffold` — **nothing committed this session**, 91 files dirty
**Gate:** `npm run verify` from repo root → exit 0 (3 typechecks, 3 lints, 7 check suites)

Read `docs/internal/prd.md` first — it is the current statement of product
requirements and implementation status. Then `docs/internal/fee-routing.md` for
the fee-route design.

---

## Start here: the one thing that matters

**The 2% merchant fee is not collected.** It is computed, persisted, and audited —
and then paid to the merchant. Seti's treasury (`0x48cb25f9d82aF721e71437feAfb295da627BA475`)
receives nothing.

`usePayMerchant.ts` signs one transfer to one recipient:

```ts
transfer(merchant.payoutAddress, grossAmount)   // merchant gets principal + fee
```

Everything else is built and verified. This is the gap.

---

## Immediate next step

Needs two inputs **from Ian** before it can start:

1. A funded **Moderato** (testnet, chainId 42431) wallet
2. A **test** treasury address — do not reuse the mainnet one

Then, in order:

1. Batch `transfer(merchant, principal)` + `transfer(treasury, fee)` on testnet
2. Update `recordPayment` to reconcile **both** legs, failing closed if either is missing
3. Only then mainnet, with a small funded wallet and a separate test treasury

Design and reasoning: `docs/internal/fee-routing.md`.

---

## First task in the new session: use the Tempo MCP

Two Tempo toolsets were installed at the very end of this session and **have not
been used yet**:

- **MCP `tempo`** → `https://mcp.tempo.xyz`, 4 tools (`search`, `find_pages`,
  `read_page`, `code`)
- **Skill** `.agents/skills/docs/SKILL.md` (symlinked into `.claude/skills/docs`)

The skill's routing table surfaced two things that may change the fee-routing plan:

| Building | Start with |
|---|---|
| Sponsored / gasless transactions | `/guide/payments/sponsor-user-fees`, `/api/fee-payer` |
| Stablecoin payments | `/guide/payments` — incl. **memos**, **parallel transactions** |

**Check "parallel transactions" first.** This session concluded — by grepping the
Tempo SDK source and finding nothing — that Tempo had no batching primitive, and
routed fee splitting through Privy's EIP-7702 instead. If Tempo supports parallel
transactions natively, that beats both the Privy route and the two-transaction
fallback. Verify before trusting the existing plan.

Also worth checking: `/api/indexer-api` (hosted indexer) versus the hand-rolled
`backend/src/services/indexer.ts` with its 10-block `getLogs` cap.

The skill also states fee tokens must be fetched from docs, never guessed. Ian
answered "fee token is OUSD or pathUSD" from memory — correct, but uncited.

---

## Environment as it stands

**Moderato, the testnet.** Corrected 2026-10-09: this section previously said
mainnet, which was true when it was written and is no longer what the tree
configures.

```
TEMPO_CHAIN_ID=42431
ALLOW_MAINNET=false
TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz
FEE_ROUTING_MODE=inside-transfer
SETI_TREASURY_ADDRESS=0x48cb25f9d82aF721e71437feAfb295da627BA475
```

Both `backend/.env` and `mobile/.env` carry these. Mainnet is one config edit
away (`TEMPO_CHAIN_ID=4217`, `ALLOW_MAINNET=true`), so read the env before
believing any statement about which chain is live — including this one.

**Why the public RPC, on mainnet:** Alchemy's free tier caps `eth_getLogs` at
**10 blocks** on Tempo mainnet. The indexer's `MAX_RANGE` is 2,000. Moderato is
unaffected. Do not switch back to Alchemy on mainnet without upgrading the tier.

**Assets: pathUSD and OUSD only.** Verified deployed on both chains, decimals 6.
`USDC.e`, `USDT0`, `EURC.E` were removed — none had bytecode on either chain. A
transfer to a no-code address can succeed as a silent no-op.

**Gas:** paid in stablecoins, customer sponsors their own. No bundler, no
paymaster, no `sponsor: true`.

---

## What was built this session

### Backend

- **Fee schedule** — `services/fees.ts`. Flat 2%, no floor, no cap. Fixed the
  original bug where `Math.max(fiat * 0.02, 50)` charged a KES 50 flat fee on a
  KES 100 payment (50% of the ticket). Floor/cap retained as config, defaulting
  to 0, for when an off-ramp lands.
- **Fee inversion** — `splitFeeInclusiveTotal()`. The customer signs principal +
  fee, so the backend receives a gross and recovers the principal.
- **Live FX** — `getFxQuote()` fetches from open.er-api.com, caches 1h, fails
  soft to 130. Sanity band 50–500 KES/USD. Persists `fxRate`/`fxRateSource`/
  `fxRateAsOf`. Live at time of writing: **129.538165**.
- **Chain reconciliation** — `recordPayment` verifies the client-claimed gross
  against the on-chain receipt and **fails closed**: no payout address,
  unverifiable receipt, or >1% mismatch all reject.
- **Durable indexer** — `IndexerCursor` model, atomic lock with TTL, block-window
  arithmetic in `indexer-cursor.ts`. Fixed underflow (negative `fromBlock` on a
  young chain) and a never-advancing cursor.
- **Migrations applied** to local Postgres: fee/FX columns, `indexer_cursors`.

### Mobile

- **Insufficient-gas state** — distinct `PayStep` plus `errorKind`. Gas markers
  are matched *before* the generic funds case, since "insufficient funds for gas"
  contains both substrings.
- **Treasury plumbing** — `getTreasuryAddress()` in `lib/chain.ts`, validated,
  fails closed rather than risking a `0x0` fee leg.

### Repo

- **npm workspace** at root, single lockfile, `npm run verify` gate.
- **Backend ESLint** — flat config, type-aware (was declared but not installed).
- **Asset narrowing** across backend, mobile, `app.config.js`, both `.env.example`.

---

## Check suites

All run from `npm run verify`. Each is an executable spec, readable as
documentation.

| Command | Covers |
|---|---|
| `check:fees` | Fee arithmetic, flat 2% at every size, inversion round-trip |
| `check:payout` | `recordPayment` persists fee + FX, anchored on a real on-chain transfer |
| `check:indexer` | Block-window maths: underflow, bounded ranges, lookback 0 |
| `check:cursor` | Lock mutual exclusion against live Postgres |
| `check:indexer-pass` | `indexOnce` orchestration — the layer pure-function tests missed |
| `check:reconcile` | Reconciliation rejects unverifiable/mismatched/unaddressed |
| `check:errors` | Gas-vs-funds error classification (mobile) |

Two of these regressed real bugs during the session and were kept because of it.

---

## Warnings for the next session

**`backend/src/services/transactions.ts` was rebuilt from scratch.** A scripted
edit truncated it and the recovery clobbered `recordPayment` and
`confirmTransactionByHash`. No git or backup copy existed. Both functions were
rewritten from behaviour the checks had pinned. They pass, but they are **a
reconstruction — read them before trusting them.** Don't rewrite that file with
regex/scripted edits; use targeted patches.

**91 files dirty, nothing committed.** There is no checkpoint to return to.

**`.env` backups contain live credentials** and are gitignored:
`backend/.env.bak-premainnet`, `backend/.env.bak-prerpc`,
`mobile/.env.bak-pretreasury`. Delete when convenient.

**An Alchemy API key leaked into this session's transcript three times** (once via
a viem error whose `metaMessages` embed the full URL). Gitignored and local, but
rotate it. Mainnet no longer needs it.

**Restart `expo start`.** The `accounts` install changed 641 packages and added
two native modules while the dev server was running.

---

## Decisions pending

**Surcharge or absorbed?** The site says "Merchants pay 2%" while the customer
signs `principal + fee`. The separate fee leg makes it visible on-chain either
way, but app copy hasn't caught up.

**What to do with `accounts`?** Installed with all 10 peers satisfied, **nothing
imports it**. Cost: 641 packages changed, 52 vulnerabilities (31 moderate, 21
high), two new native modules. No client-side batching was found in its source;
its `feePayer` is for *gas sponsorship*, and MPP charges customers per API call —
the wrong direction for a merchant fee. Recommendation: keep it unwired until
something specific needs it.

**Interim fallback.** If batching proves unreliable on Tempo: two sequential
transfers, accepting a measured leak rate. Undecided, contingent on the testnet
batch.

**Site copy vs repo.** Site says "Merchants pay 2%." The customer funds it. Both
`README.md` and `AGENTS.md` now say so explicitly; the site does not.

---

## Corrections made this session

Recorded because they were wrong and would mislead if repeated:

1. **Tempo's `feePayer`/MPP does not solve fee routing.** The client's own UI
   text in `examples/mpp`: *"The SDK signs and broadcasts a transfer; the server
   only releases the response after the transfer settles."* Money flows
   customer → server. Wrong direction, and the `account` is a server-held private
   key.

2. **Privy EOAs *can* batch atomically.** Privy uses EIP-7702 to delegate an
   existing EOA to a Kernel contract **without changing its address**. An earlier
   claim that a smart-wallet migration was required was wrong.

3. **`eth_getCode` cannot test EIP-7702 support.** The `0x…0100` designator
   returns empty on every chain including Ethereum mainnet. Precompiles carry no
   bytecode. An earlier "tempo does not support 7702" reading from that probe was
   invalid.

---

## Open questions

1. Confirmation count — one or two? Affects `pay.tsx` copy. Resolves with a real
   batched transaction.
2. Fee-token selection at send time — Tempo may auto-select a funded fee token.
   Unverified.
3. Does Tempo support EIP-7702 / parallel transactions on **mainnet**? TIP-1047
   references 7702 delegations, which implies yes. Unproven by RPC (see
   correction 3). A testnet batch is the real proof.
4. Tempo SDK vs Privy for the payment path going forward — `AGENTS.md` originally
   claimed Tempo Accounts; the code uses Privy + viem. AGENTS.md is now accurate.

---

## Reference

- `docs/internal/fee-routing.md` — the design, with reasoning and dead ends
- `DESIGN.md` — Calm Finance system; error copy register, no exclamation marks
- `AGENTS.md` — conventions, verification gates, business guardrails
- `CONTRIBUTING.md` — branch conventions, `npm run verify`
- MCP: `tempo` (4 tools), `privy-docs` (5), `pretium` (18, unused)
- Skills: `.agents/skills/docs` (Tempo), `.agents/skills/privy`

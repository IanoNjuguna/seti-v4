# Operations

How Seti is deployed, what must never reach production, and the parts of the
system whose loss is expensive. This is the runbook an operator reads; the
product/design documents are elsewhere (`internal/`).

The mainnet flip is a separate, owner-run procedure:
[`internal/mainnet-flip.md`](./internal/mainnet-flip.md).

---

## 1. Configuration that must never reach production

The backend parses its environment in `backend/src/config/env.ts` at module load,
so the first import of any module that reads config — the server, the indexer,
the auth middleware, the signed-token helper — runs the checks below. With
`NODE_ENV=production` the process **exits non-zero before it binds a port** and
names the offending variable(s) in a typed `InsecureProductionConfigError`. There
is deliberately **no override flag**: a deploy that carries an insecure value
fails loudly rather than serve an auth bypass or a broken quote key.

| Refused in production | Why |
| --- | --- |
| `DEV_BYPASS_AUTH=true` | The bypass attributes every request to one shared dev user, so the API would answer anyone, without a token, as that user. Not merely ignored — a boot refusal. |
| `QUOTE_SIGNING_SECRET` unset or under 16 characters | Each process would mint its own key, so a frozen quote dies on restart or is unreadable across instances — a payment fails mid-flight. Must be the same, strong value on every instance. |
| `JWT_SECRET` left as `change-me-in-production` | The shipped example placeholder is public, so it is not a secret. |
| `TEMPO_CHAIN_ID` unset | The server cannot choose a network for you. |
| Mainnet (`4217`) without `ALLOW_MAINNET=true` | Keeps mainnet opt-in — never default. |
| `INDEXER_BOOTSTRAP_LOOKBACK` > 0 on mainnet | A lookback window writes pre-existing chain history as new `top_up` rows: ledger entries no payment produced. Seed the cursor to head instead (§4). |

Development is unaffected: `DEV_BYPASS_AUTH=true` with `NODE_ENV=development`
still attaches the dev user, and an unset `QUOTE_SIGNING_SECRET` still falls back
to a random per-process key with one warning.

These rules are pinned by **`npm run check:env`** (part of `npm run verify`). It
spawns boot probes under `NODE_ENV=production` with each insecure value and
asserts the process refuses — and that the dev behaviour above still boots.

### The rest of the environment surface, audited

- **`ALLOW_MAINNET`** — stays opt-in. Defaults to `false`; `check:env` proves a
  mainnet chain id without it is refused.
- **`SETI_TREASURY_ADDRESS`** — already refuses the zero (burn) address at boot.
- **`MERCHANT_FEE_PERCENT` / `MIN_KES` / `MAX_PERCENT`** — no insecure default.
  Floor and cap `0` is the intended flat 2%, and the customer funds it.
- **`PRIVY_APP_ID` / `PRIVY_APP_SECRET`** — *reported, not changed.* Optional, so
  a development server boots without them. In production, a missing pair makes
  every token verification throw and every authenticated request 401 — it fails
  **closed**, so it is not a hole, but the API is unusable. Set both in
  production; consider making them a production requirement later.
- **`CORS_ALLOWED_ORIGINS`** — *reported, not changed.* Unset in production means
  no cross-origin access (`origin: false`), which is safe but silently breaks a
  deployed or tunnelled front end. Set it explicitly to your app's origin(s).
- **`QUOTE_TTL_SECONDS`, `STUCK_TX_*`, `PORT`/`HOST`** — no security default;
  the only wrong value is a functionally wrong one.

---

## 2. Managed Postgres

The database *is* the ledger: `Transaction` rows, the wallet registry, merchant
claims and handles, and the indexer cursor (§4). Lose it and the payments are
gone from Seti's view even though they are still on chain.

- Run a **managed** provider (Supabase or equivalent) with automated backups and
  point-in-time recovery enabled. A single self-hosted Postgres with no backups
  is not acceptable for money.
- Connect with `DATABASE_URL`, over TLS (`sslmode=require`). Use the provider's
  pooler for the application if connection count is a concern.
- **A backup you have never restored is a hope, not a backup.** Restore into a
  scratch database once and confirm the cursor row and recent `Transaction` rows
  are present.
- Keep migrations as the only way the schema changes (§3). Never hand-edit a
  production table.

---

## 3. Migrations in the deploy pipeline

This repo does **not** use `prisma migrate dev` against a deployed database.

**The pattern:** the SQL is hand-written into a new timestamped folder under
`backend/prisma/migrations/<timestamp>_<name>/migration.sql`, committed with the
code, and applied in the pipeline with:

```bash
npx prisma generate                 # client matches the schema, before build
npx prisma migrate deploy           # applies pending committed migrations, non-interactive
```

**Why not `migrate dev`:** it is interactive and is for *authoring*. It wants to
detect drift, generate migrations, and reach a shadow database, and in a
non-interactive pipeline it hangs or behaves unpredictably — the harness note
("`prisma migrate dev` is interactively-hostile here") is the same lesson. `migrate
deploy` only applies what is already committed and never generates anything.

**Ordering and compatibility:**

- Run `migrate deploy` as a release step **before** the new revision starts
  serving, and `prisma generate` before the build.
- During a rolling deploy the old and new code run at once, so a migration must
  be **backward compatible** with the previous revision — expand first (add
  column/table), migrate data, contract later. A migration that drops or renames
  a column the old revision still reads will fail the old pods mid-rollout.
- **Never edit an applied migration.** Add a new one.
- The same schema runs the check suites locally and in CI (§6), so a migration
  that breaks them fails the gate before it reaches production.

---

## 4. The indexer cursor is data

The indexer's position lives in the `indexer_cursors` table, one row per chain
(`tempo-mainnet`, `tempo-testnet`):

| Column | Means |
| --- | --- |
| `chain` (PK) | The chain this cursor is for. Switching networks gets its own row, never an inherited one. |
| `lastBlock` | Highest block whose logs have been fully processed. |
| `lockedBy` / `lockedAt` | Which replica is currently scanning, and when it took the lock (60s TTL, reclaimed if a replica dies). |
| `updatedAt` | Last write. |

**What it decides.** The next scan starts at `lastBlock + 1`. When there is no
cursor yet (or it is `0`, or ahead of head after a reorg), the indexer bootstraps
from `INDEXER_BOOTSTRAP_LOOKBACK`. With the production setting of `0`, a fresh
cursor scans **nothing** and starts from now. The row is also the single-writer
lock between replicas: whoever holds `lockedBy` scans, the others skip the tick.

**Why losing it matters.** With lookback `0`, a lost cursor means "start now" —
every inbound transfer that arrived while the cursor was missing is never
indexed, leaving a permanent hole in Activity that **no migration can
reconstruct**. The tempting fix — set a lookback to backfill — is worse on
mainnet: it writes pre-existing history as new `top_up` rows, fabricating ledger
entries no payment produced. That is exactly why a non-zero lookback on mainnet
is now a boot refusal (§1).

**It must be backed up with the database.** It is an ordinary table row, so any
`pg_dump` / point-in-time backup includes it: restore the database and the cursor
comes back with it. Do **not** treat it as a cache you can drop — dropping it is
the permanent-hole case above.

**First run on a new chain — seed to head, do not look back:**

```sql
-- chain is the primary key; updatedAt is not nullable, so supply it.
INSERT INTO indexer_cursors (chain, "lastBlock", "updatedAt")
VALUES ('tempo-mainnet', <current_head_block>, NOW());
```

Set `INDEXER_BOOTSTRAP_LOOKBACK=0` and let the cursor row carry the position.
Losing the *lock* (not the cursor) only costs one re-scan; the lock is
best-effort and self-healing.

---

## 5. Error tracking — the honest state today

**A failed payment is a log line, and nothing more.**

- Fastify's logger writes JSON to stdout (level `info` in production). Every
  handler error passes through the server's error handler.
- `recordPayment` / `recordSend` fail closed — a mismatch beyond 1%, an
  unverifiable receipt, or a missing payout address is refused with a message —
  and the indexer logs `[indexer] error` / `[sweep] error` on an RPC failure.
- There is **no aggregation, no alerting, and no correlation id.** A refusal or a
  crash produces one line in the process log, and if nobody is reading that
  stream, it is indistinguishable from nothing happening. A payment that fails
  mid-flight does not page anyone.

**First steps, in order, when this becomes the priority:**

1. Ship stdout to a log store with retention; never rely on the container's
   ephemeral buffer.
2. Alert on error rate, and on `processing` transactions older than
   `STUCK_TX_AGE_MINUTES` — that is a payment stuck for real.
3. Add a request id so one payment's lines can be found together.
4. Page on the refusal patterns from the reconciliation paths.

Until then: **the logs are the pager**, and silence is not success.

---

## 6. CI

`.github/workflows/verify.yml` runs the **same gate as local** — `npm run verify`
— on every push and pull request:

```
npm ci  →  prisma generate  →  prisma migrate deploy (throwaway Postgres)  →  npm run verify
```

**It needs no repository secrets.** That falls out of how the suites were built:

- The suites that reconcile against the chain read **pinned receipts by hash**
  (`PAYOUT_ANCHOR_TX`, `SEND_ANCHOR_TX`, `QUOTE_ANCHOR_TX`) over a **public RPC**
  (`https://rpc.moderato.tempo.xyz`). Read-only JSON-RPC — the same access a
  browser has. No API key.
- The suites that exercise signatures mint **throwaway keys at runtime**
  (viem's `generatePrivateKey()`); no real key is read from the environment.
- The database suites need a Postgres instance, not a credential: the workflow
  provisions a **throwaway container** with fixed local-only values, and every
  row those suites touch uses `check-*` keys.
- `check:env` needs nothing from the environment at all — it spawns its own
  probes in a temp directory.

So the only things CI requires are npm, a throwaway Postgres, and public internet
access to the Tempo RPC. If a future suite needs a secret, that is a signal to
reconsider the suite, not to add the secret.

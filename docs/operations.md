# Operations

How Seti is deployed, what must never reach production, and the parts of the
system whose loss is expensive. This is the runbook an operator reads; the
product/design documents are elsewhere (`internal/`).

The mainnet flip is a separate, owner-run procedure:
[`internal/mainnet-flip.md`](./internal/mainnet-flip.md).

The backend's host — the API, the indexer, Postgres and the nightly backup — has
its own runbook: [`deploy-oracle.md`](./deploy-oracle.md). It covers the free-tier
choices that are permanent, the two-firewall trap, exposing the API with
Cloudflare Tunnel, and the off-provider backup with its restore commands. The web
app's deploy is §7 below.

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
- **`DEFAULT_NETWORK`** — the network this deployment defaults to (`mainnet` |
  `testnet`). Optional; the **code** default is `testnet`, so a box that sets
  nothing cannot default to real money. A live deployment sets `mainnet`, but
  mainnet still needs `ALLOW_MAINNET=true` on top, and an unrecognised value is a
  boot refusal. It is only the fallback for the served network when no
  `TEMPO_CHAIN_ID` names one — an omitted per-row network always resolves to the
  network the deployment **serves**. Pinned by `check:env` and `check:network`.
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
  are present. The nightly job that makes the backup, and the exact restore
  commands, are in [`deploy-oracle.md`](./deploy-oracle.md) §8 and §9; the copy
  goes **off-provider** (Cloudflare R2), because a backup in the same account as
  the instance dies with the account.
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
- **Every request now carries a correlation id.** `server.ts` mints a UUID per
  request (`genReqId`), pino binds it to every line that request writes as
  `reqId`, and the server returns the same id on the `x-request-id` response
  header. An internal fault is answered with one stable code (`INTERNAL_ERROR`)
  and one plain sentence — never the driver's message or its `P2xxx` code — so
  the sentence a user reports names a request id that resolves to the full
  error, in the log, with the schema, the column and the SQL code intact.
- `recordPayment` / `recordSend` fail closed — a mismatch beyond 1%, an
  unverifiable receipt, or a missing payout address is refused with a message —
  and the indexer logs `[indexer] error` / `[sweep] error` on an RPC failure.
- There is still **no aggregation and no alerting.** The correlation id is what
  makes both possible — a single payment's lines can now be found together — but
  a refusal or a crash still produces log lines in the process log, and if
  nobody is reading that stream, it is indistinguishable from nothing
  happening. A payment that fails mid-flight does not page anyone.

**First steps, in order, when this becomes the priority:**

1. Ship stdout to a log store with retention; never rely on the container's
   ephemeral buffer.
2. Alert on error rate, and on `processing` transactions older than
   `STUCK_TX_AGE_MINUTES` — that is a payment stuck for real.
3. Page on the refusal patterns from the reconciliation paths.
4. Surface the `x-request-id` in the app's failure UI so a user can quote it.

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

---

## 7. Deploying the web app

**Only `web/` is in scope.** It is a client-rendered Next.js app with no
server-only APIs, so it fits Cloudflare's free tier. The **backend cannot move**
and stays on its own host: the indexer is a long-running loop (Workers have no
long-running processes; the free tier gives 5 cron triggers at 10 ms CPU each),
and Prisma + Postgres would need Hyperdrive **plus** a driver adapter — D1 is
SQLite, not Postgres. So the API keeps its host and the web app reaches it
directly over `NEXT_PUBLIC_API_URL`.

### 7.1 The adapter: `vinext`

Cloudflare's Next.js guide now recommends **`vinext`** — a Vite plugin that
reimplements the Next.js API surface — as the default way to run Next.js 16 on
Workers, and keeps **`@opennextjs/cloudflare`** documented for compatibility
gaps. This app takes the vinext path:

- `npx vinext check` reports **100% compatible** (0 unsupported): only
  `next/navigation`, `next/link`, `next/font/google`, App Router, Tailwind. No
  server-only APIs, no `next/image`.
- `vinext init` is non-destructive: `next dev` keeps working exactly as before,
  so the Cloudflare path is additive.

`web/wrangler.jsonc` is the Worker config — `main: vinext/server/fetch-handler`,
static assets from `dist/client`, and the **required** `nodejs_compat`
compatibility flag. The other config shape vinext can emit —
`cloudflare.config.ts`, the typed `cf/config` variant from its non-legacy init —
is **not used here**: nothing in this path reads it, and it is excluded in
`web/tsconfig.json` so a stray copy cannot fail `tsc` (a build config that
breaks the project's own gate is not deployable). If a future feature lands
outside vinext's support matrix, switch to `@opennextjs/cloudflare` and follow
its guide; nothing else here changes.

### 7.2 Commands

```bash
npm install                                   # from the repo root, once

npx vinext check                             # compatibility report (read-only, run inside web/)

# Build the Worker. NEXT_PUBLIC_API_URL MUST be the public API URL.
NEXT_PUBLIC_API_URL=https://api.seti.example npm run build:vinext --workspace web

npm run preview:worker --workspace web        # run the built Worker locally (wrangler dev, port 8787)

npm run deploy:vinext --workspace web         # OWNER ONLY — authenticated deploy
```

- **`build:vinext`** = the production build guard, then `vite build`, then
  `next typegen`. Output: `dist/client` (assets) and `dist/server` (the Worker).
  The last step is not padding: `vinext` and Next both write
  `.next/types/routes.d.ts`, and `tsconfig.json` includes `.next/types/**`
  (Next maintains that include), so a freshly built Worker would otherwise leave
  `tsc` reading Next's `validator.ts` against vinext's `routes.d.ts` — three
  "has no exported member" errors in the gate until the next `next dev` happened
  to regenerate it. The build restores Next's generated types so the tree is
  left consistent.
- **`preview:worker`** runs `wrangler dev` against the built output on **8787**
  (a spare port — 3000 and 4000 belong to the dev servers). This is the honest
  local test: it executes the app in the real `workerd` runtime, which is what
  the deploy will run.
- **`deploy:vinext`** is the only step that needs a Cloudflare login. It is the
  owner's to run; the gate and CI never invoke it.
- **The docs site is separate and static.** `docs-site/` is its own Docusaurus
  package; build it with `npm run build` in that directory and publish
  `docs-site/build/` as a **Cloudflare Pages** static site. There is no Worker,
  no adapter and no build-time secret in that path — Pages serves static files.

CI is unaffected: `npm run verify` builds nothing, so no Cloudflare credential
ever enters the pipeline.

### 7.3 The three traps

**1. `NEXT_PUBLIC_API_URL` is inlined at build time — a `vars` entry cannot fix
it.** Next replaces every `process.env.NEXT_PUBLIC_*` in the client bundle with a
literal at build time. Unset, `web/lib/api/api.constants.ts` falls back to
`http://localhost:4000`, so a careless production build ships an app that talks
to the developer's laptop and **nothing at runtime can correct it** — not a
Wrangler `vars` entry, not an environment variable, because the value is already
a string in the shipped JavaScript. (`web/dist/server/.dev.vars` shows the
trap: it can carry the value for a local preview, but the client bundle already
holds the literal.)

So the build refuses. **`web/scripts/guard-production-env.mjs`** runs first in
both `build` and `build:vinext` and **fails the build** when the variable is
unset or resolves to localhost / a private address, naming the variable, the
file it resolved from, and why it cannot be corrected after the build. It runs
only as a build step — a development server is never blocked — and
`npm run check:build-env` pins it (part of `npm run verify`). A bare
`vite build` that bypasses the npm script is covered too: `vite.config.ts`
registers the same guard as a build-only Vite plugin (`apply: "build"`, so
`vite dev` is untouched).

**2. `CORS_ALLOWED_ORIGINS` is mandatory in production.** The backend refuses to
boot without it (`backend/src/config/env.ts`), because in production that list
*is* the cross-origin policy: an empty one denies every browser origin and the
deploy boots healthy and then 403s every call from the web app as an opaque
browser CORS error. The deployed web app's origin — `https://<worker>.workers.dev`
or the custom domain — must be on the list, **before** it is exercised.
`npm run check:cors` proves the plumbing rather than trusting it: the real server
is booted and driven by real `Origin` headers, an origin in the list is allowed,
one missing from it is refused, changing the variable changes the verdict, and
the production boot refusal still fires when it is unset.

**3. `ALLOW_MAINNET` stays `false`.** This is a **practice deployment**: public,
on **testnet** (Tempo Moderato, chain `42431`), `ALLOW_MAINNET=false` and the web
app's `NEXT_PUBLIC_ALLOW_MAINNET=false`. A mainnet chain id without the flag is
refused at module load on both sides — never default to mainnet for a public
deploy, and treat the URL as a testnet sandbox, not a product launch. The flip is
its own owner-run procedure (`internal/mainnet-flip.md`).

### 7.4 What the free tier gives, and what to watch

Workers Free is 100k requests/day, 10 ms CPU per request, 128 MB memory, 5 cron
triggers at 10 ms CPU; Hyperdrive is included free; static assets from
`dist/client` do not run the Worker at all. Because the app is client-rendered,
per-request CPU is small — but **10 ms CPU** is the number to watch if SSR or a
server route is ever added to this deploy, and the daily request cap is the limit
to watch on a shared or spammed URL.

**The deploy step is unproven.** No authenticated Cloudflare action was taken —
the owner's account is not ours to touch — so what is proven is the build and the
Worker running locally (`wrangler dev`, as above). The first `deploy:vinext` is
the owner's, and it is the point at which the account, the Worker name and the
custom domain are actually confirmed.

---

## 8. Deploying the backend (API + indexer + database)

The backend **cannot** use the web app's serverless path: the indexer is a
long-running loop, and Prisma + Postgres would need Hyperdrive plus a driver
adapter (D1 is SQLite). It runs on a real host instead.

The full runbook — the Oracle Cloud Always Free walkthrough, the permanent
signup choices, the **two-firewall trap** (the VCN Security List *and* the
instance's own iptables, rules inserted ABOVE its REJECT line), exposing the API
with **Cloudflare Tunnel** so no inbound port is opened at all, and the
**$1 budget alert** — is [`deploy-oracle.md`](./deploy-oracle.md).

The same runbook covers the **AWS path** for when credits are the funding source:
[Lightsail recommended](./deploy-oracle.md#lightsail--the-recommendation-on-aws)
(2 GB bundle ~$12/mo: 2 vCPU, 2 GB RAM, 60 GB SSD, static IPv4, 3 TB transfer — a
single networking page instead of Oracle's two firewalls), with EC2 as the
fallback and one warning box that matters: **never create a NAT Gateway** (~$32.85
/month before it moves a byte). Credits are only usable on the **paid** plan, so
set a **spend limit** rather than a budget alert. The artefacts — `Dockerfile`,
`docker-compose.yml`, the systemd units, `pg-backup.sh` — are identical on every
provider; only host provisioning differs.

The shape is three services on one box (Postgres + API + indexer), in
`docker-compose.yml`, or two systemd units on the no-Docker path
(`deploy/systemd/`). The API and the indexer are separate processes: the API is
started with `INDEXER_ENABLED=false` and the indexer runs `dist/worker.js`, so a
redeploy of one never interrupts the other. The database is never published.

**Other hosts.** Nothing about the application changes on Northflank's free
Sandbox or a Railway Hobby plan — the `Dockerfile` and `docker-compose.yml` are
the contract. What changes is the *wiring*: Postgres becomes a managed addon, the
API and indexer become two platform services off the same image, and migrations
run as a pre-deploy step. The differences are spelled out in
[`deploy-oracle.md` → Other hosts](./deploy-oracle.md#other-hosts).

Nightly backups go **off-provider** (rclone → Cloudflare R2), driven by
`deploy/backup/pg-backup.sh` and `seti-backup.timer`, with the restore commands in
`deploy-oracle.md` §9.


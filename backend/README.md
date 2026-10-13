# Seti Backend

Node.js API service that powers the Seti mobile app. It handles user and wallet registry, merchant resolution, payment previews, on-chain reconciliation, transaction recording, on-chain balance reads, and the log indexer. v1 settles **non-custodially** — the customer's stablecoins go straight to the merchant's own wallet — and there is **no fiat off-ramp**: no Stripe or Bridge call exists in this code.

---

## What it does

- **Auth:** verifies Privy tokens; falls back to a development bypass when Privy credentials are absent.
- **Wallet registry:** tracks user wallets by asset and chain, storing only public addresses and opaque key references.
- **Merchant resolution:** parses QR payloads (`seti://pay`, `merchant:<id>`, plain IDs) and returns merchant details.
- **Payment preview:** computes merchant fees and checks the user's real on-chain balance for the selected stablecoin before a payment is signed.
- **Payment recording:** verifies the client-reported gross against the on-chain receipt, then stores a `processing` transaction. Fails closed: a missing payout address, an unverifiable receipt, or a mismatch beyond 1% are all refused.
- **Fee routing:** the merchant fee is computed and recorded, but with `FEE_ROUTING_MODE=inside-transfer` (the default) it is **not collected** — the merchant receives the gross. `FEE_ROUTING_MODE=batch` sends the fee to `SETI_TREASURY_ADDRESS` as a second leg of an atomic batch and requires both legs on-chain; it is implemented but has never been executed against a chain.
- **Indexer:** scans Transfer logs, confirms matching outbound payments, and records inbound transfers as `top_up`.
- **Off-ramp:** none. v1 settles non-custodially to the merchant's own wallet.

---

## Tech stack

- Node.js 20+
- Fastify + TypeScript
- Prisma + PostgreSQL
- viem (on-chain reads)
- @privy-io/server-auth (token verification)

---

## Prerequisites

- Node.js 20+ and npm
- Docker (for local Postgres) or a running Postgres instance on port `5433`

---

## Environment variables

Copy `.env.example` to `.env` and fill in the blanks:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` / `HOST` | API bind address |
| `NODE_ENV` | `development` enables debug logging and is one of the two gates on the dev auth bypass |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | Privy server auth |
| `DEV_BYPASS_AUTH` | `"true"` **with** `NODE_ENV=development` attaches a synthetic dev user. In production `"true"` is a **boot refusal**, not an ignored flag |
| `TEMPO_CHAIN_ID` | `4217` for mainnet, `42431` for testnet. Unset in production is a boot error |
| `ALCHEMY_API_KEY` | Optional Alchemy API key for Tempo RPC |
| `TEMPO_RPC_URL` | Optional custom RPC override; takes precedence over the Alchemy-derived endpoint |
| `TEMPO_TOKEN_PATHUSD` / `TEMPO_TOKEN_OUSD` | **Required.** The only two assets v1 supports — a missing address throws at boot |
| `SETI_TREASURY_ADDRESS` | **Required.** Validated as 20-byte hex at boot. Receives the merchant fee in `batch` mode |
| `FEE_ROUTING_MODE` | `inside-transfer` (default — fee recorded but **not collected**) or `batch` (atomic two-leg) |
| `MERCHANT_FEE_PERCENT` / `MERCHANT_FEE_MIN_KES` / `MERCHANT_FEE_MAX_PERCENT` | Fee schedule; ships as `2` / `0` / `0` — a flat 2% with no floor and no cap |
| `INDEXER_BOOTSTRAP_LOOKBACK` | Blocks to scan when no cursor exists yet. **Keep at 0 on mainnet** — a non-zero value there is a boot refusal (it would write pre-existing history as new `top_up` rows) |
| `ALLOW_MAINNET` | Must be `"true"` to use chain ID `4217`; stays opt-in |
| `QUOTE_SIGNING_SECRET` | HMAC key for signed rate quotes. **Required in production** (≥16 chars, same value on every instance) — unset is a boot refusal. Unset in development is fine: a random per-process key, warned once |
| `BRIDGE_API_KEY` / `STRIPE_SECRET_KEY` | Unused in v1 — no off-ramp call site exists |
| `JWT_SECRET` | Internal signing secret. **Required in production** — the `change-me-in-production` placeholder is a boot refusal |

---

## Setup

```bash
# Run from the repo root — the repo is an npm workspace, and a nested
# lockfile inside backend/ defeats hoisting.
cd ..
npm install
cp backend/.env.example backend/.env
```

### Start Postgres

The Docker container maps host port `5433` to Postgres port `5432` to avoid conflicts with a local Postgres.

```bash
docker compose up -d
```

### Set up the database

```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed
```

The seed creates a demo user, an OUSD wallet, and sample merchants including `merchant_java_house`.

### Start the API

```bash
npm run dev
```

The server runs at `http://localhost:4000` with hot reload via `tsx watch`.

#### Using Alchemy for RPC

Set `ALCHEMY_API_KEY` in `.env`. If `TEMPO_RPC_URL` is also set, it takes precedence. Verify the generated endpoint against your Alchemy dashboard if requests fail.

---

## Useful scripts

```bash
npm run dev          # start dev server
npm run typecheck    # tsc --noEmit
npm run build        # compile to dist/
npm run db:seed      # seed demo data
npx prisma migrate dev
npx prisma studio    # open Prisma Studio
```

---

## API endpoints

Every route except `/health` and `/auth/*` sits behind `authMiddleware` and needs
a Privy-issued bearer token.

- `GET /health`
- `POST /auth/verify` — verify a Privy token, upsert the local user, register the embedded wallet
- `POST /auth/dev` — development-only bypass; 404s unless `NODE_ENV=development` and `DEV_BYPASS_AUTH=true`
- `GET /users/:id`, `GET /users/:id/home`, `GET /users/:id/balance`
- `GET|POST /wallets/users/:id/wallets` — **note the doubled prefix.** `walletRoutes` declares `/users/:id/wallets` but is registered under a `/wallets` prefix, so the live path is `/wallets/users/:id/wallets`. This looks unintended and is flagged rather than documented as design.
- `GET /merchants/resolve?qr=:payload`
- `GET /transactions`, `POST /transactions` (non-payment types only)
- `POST /transactions/preview`
- `POST /transactions/pay`
- `GET /transactions/:id/status`

### Payment flow

1. Mobile scans a QR and calls `GET /merchants/resolve`.
2. Mobile calls `POST /transactions/preview` for the server-computed fee, FX rate, and balance check.
3. Mobile signs and broadcasts the transfer — in `inside-transfer` mode, one `transfer` of the gross to the merchant; in `batch` mode, an atomic two-leg batch (principal to the merchant, fee to the treasury).
4. Mobile reports the resulting `txHash` to `POST /transactions/pay`.
5. The backend verifies the claimed amount against the on-chain receipt before writing anything, stores the transaction as `processing`, and the indexer or receipt confirmation advances it to `completed`.

---

## Testing

Run type checks:

```bash
npm run typecheck
```

Smoke-test the API with curl. Every route below `/health` needs a bearer token;
with `DEV_BYPASS_AUTH=true` and `NODE_ENV=development`, get one from
`POST /auth/dev` first.

```bash
curl http://localhost:4000/health

TOKEN=$(curl -s -X POST http://localhost:4000/auth/dev | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:4000/merchants/resolve?qr=merchant:merchant_java_house'

curl -X POST http://localhost:4000/transactions/preview \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":"10","asset":"ousd","merchantId":"merchant_java_house"}'
```

---

## Notes

- The backend never signs transactions on behalf of users.
- Mainnet is gated by `ALLOW_MAINNET=true`.
- If the Tempo RPC is down, on-chain balance reads and indexing fail gracefully (returning zero balance and logging errors) while database-only endpoints keep working.

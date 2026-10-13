# Seti

**A neobank built for Nairobians.**

Pay a merchant by scanning their QR code. You keep a stablecoin balance, and the payment settles wallet-to-wallet on Tempo. No new hardware.

> **Current focus:** Nairobi, Kenya. v1 settles **non-custodially**: the customer's stablecoins go straight to the merchant's own wallet, and Seti never takes possession of the funds. There is **no fiat off-ramp** in this phase — no Stripe, no Bridge, no KES bank payout. M-Pesa settlement is intentionally out of scope.

---

## Running it locally

Two npm workspaces (`backend`, `web`) — there is **no mobile app**; v1 is the web app.
You need **Node 20+** and a **Postgres** database.

```bash
npm install                       # installs both workspaces
```

**1. A database.** Any Postgres works. The example config points at port `5433`:

```bash
# adapt to your machine; this is the shape, not a verified drop-in for every setup
docker run --name seti-postgres -e POSTGRES_USER=seti -e POSTGRES_PASSWORD=seti \
  -e POSTGRES_DB=seti -p 5433:5432 -d postgres:16
```

**2. Environment.** Both examples list every variable with a comment on what it is for:

```bash
cp backend/.env.example backend/.env
cp web/.env.example web/.env.local
```

The ones you must set yourself: `DATABASE_URL`, the Tempo token addresses
(`TEMPO_TOKEN_PATHUSD`, `TEMPO_TOKEN_OUSD`), and `SETI_TREASURY_ADDRESS` — the address
that receives the platform fee. For local development set `DEV_BYPASS_AUTH=true`, which
lets you sign in without a Privy app id.

**3. Migrations.**

```bash
cd backend && npx prisma migrate deploy
```

(`npm run db:migrate` also exists but opens Prisma's interactive flow; `deploy` just
applies what is in `prisma/migrations`.)

**4. Run both servers** — backend first, since the web app calls it:

```bash
npm run dev --workspace backend    # tsx watch; listens on PORT (4000 locally)
npm run dev --workspace web        # next dev; http://localhost:3000
```

Point `NEXT_PUBLIC_API_URL` in `web/.env.local` at the backend.

**5. Prove it works.** This is the gate we hold ourselves to — typecheck, lint, and
twelve check suites, several of which read real receipts off Tempo testnet:

```bash
npm run verify
```

### What it runs on

Tempo **testnet (Moderato, chain 42431)**. Nothing here defaults to mainnet:
`ALLOW_MAINNET` is false and must be set deliberately. Payments are non-custodial — the
customer's embedded wallet signs, the merchant's own address receives the principal, and
Seti's 2% platform fee is collected in the **same atomic transaction**. There is no
custody, no payout queue, and no relayer.

### Signing in without a Privy app id

`DEV_BYPASS_AUTH=true` exposes `POST /auth/dev`, which returns a dev token and a seeded
user so you can walk the app without wallet infrastructure:

```bash
curl -X POST http://localhost:4000/auth/dev
```

With a real `NEXT_PUBLIC_PRIVY_APP_ID` set, normal sign-in creates or uses an embedded
wallet — no seed phrase, and no wallet address for the customer to manage.

---

## Why Nairobi?

Nairobi is mobile-first, QR-ready, and underserved by calm, low-cost payment infrastructure. Merchants display QR codes; most consumers pay by phone. Seti connects that existing culture to stablecoin rails — so payments settle faster, cost less, and work across borders without changing how people move day-to-day.

## How it works

1. A customer scans or enters a merchant QR code in the Seti app.
2. They confirm the amount in KES; Seti previews the stablecoin total.
3. The customer signs a stablecoin transfer from their embedded wallet.
4. The backend verifies the transfer against the on-chain receipt and records the payment. The merchant already holds the funds; nothing is off-ramped.

We optimize for two things:

- **Speed:** a payment should feel as fast as tapping a card.
- **Privacy:** the customer controls their wallet keys through Privy; Seti never holds signing material.

---

## Repository layout

``` text
├── mobile/                 # React Native + Expo app
├── backend/                # Node.js + Fastify API service
├── web/                    # Next.js marketing landing page
├── docs/                   # PRD and fee-routing design
├── docs-site/              # Docusaurus site that renders docs/ (standalone package)
├── .agents/skills/         # Project agent skills
├── DESIGN.md               # Calm Finance design system
├── design.tokens.json      # Machine-readable design tokens
├── AGENTS.md               # Project conventions for agents
└── CONTRIBUTING.md         # Development workflow and branch conventions
```

For setup and technical details, see:

- **[docs/README.md](./docs/README.md)** — developer docs (quickstart, auth, payments, API reference, MCP server)
- **[docs/internal/prd.md](./docs/internal/prd.md)** — product requirements and current implementation status
- **[docs-site/README.md](./docs-site/README.md)** — how to run the docs site that renders `docs/`
- **[mobile/README.md](./mobile/README.md)**
- **[backend/README.md](./backend/README.md)**
- **[web/README.md](./web/README.md)**

The product design system is documented in **[DESIGN.md](./DESIGN.md)**.

---

## Fee model

- Merchant: 2% of the payment
- No floor, no cap
- No FX markup: the conversion uses the live provider rate as fetched

The fee is a flat 2%, with no minimum and no cap. Because the customer signs
principal + fee in one transfer, the fee adds to what they send rather than
being deducted from what the merchant receives:

| Merchant receives | Customer signs for | Fee |
| --- | --- | --- |
| KES 50.00 | KES 51.00 | KES 1.00 |
| KES 100.00 | KES 102.00 | KES 2.00 |
| KES 500.00 | KES 510.00 | KES 10.00 |
| KES 2,500.00 | KES 2,550.00 | KES 50.00 |

Those are the pre-conversion KES figures; the customer's balance is debited in
the payment asset at the live rate shown in the preview, so the stablecoin
amounts move with the exchange rate.

v1 settles non-custodially — the customer's stablecoins go straight to the
merchant's own wallet. With no fiat off-ramp there is no per-payout cost for the
fee to recover, so a floor would have nothing to justify it.

**Who pays it.** The 2% is attributed to the merchant, but in v1 it is collected
inside the customer's transfer: they sign for principal + fee, and the merchant's
wallet receives exactly the principal. The customer therefore funds the fee. A
floor (`MERCHANT_FEE_MIN_KES`) and a cap (`MERCHANT_FEE_MAX_PERCENT`) both
default to 0 and exist for when an off-ramp lands: a flat 2% on a KES 50 payment
would not cover a per-payout charge, and a floor large enough to cover one would
otherwise swallow small payments whole. Schedule lives in
`backend/src/services/fees.ts`; verify it with `npm run check:fees`.

---

## Security notes

- Never store seed phrases or private keys
- Wallet keys belong to the user, via Privy embedded wallets
- Backend never signs transactions on behalf of users without explicit authorization
- Keep testnet and mainnet configs separate; mainnet is gated by `ALLOW_MAINNET=true`

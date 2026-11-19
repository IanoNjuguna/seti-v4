# Seti

**A neobank built for Nairobians.**

Get paid in seconds. Customers pay you through your username or by scanning your QR code, from a stablecoin balance they hold themselves. The money settles wallet-to-wallet on Tempo, in the same block that carries it. No new hardware, no terminal, no bank account.

> **Current focus:** Nairobi, Kenya. v1 settles **non-custodially**: the customer's stablecoins go straight to the merchant's own wallet, and Seti never takes possession of the funds. There is **no fiat off-ramp** in this phase: no Stripe, no Bridge, no KES bank payout. M-Pesa settlement is intentionally out of scope.

**Live:** [seti.live](https://seti.live) is the marketing site, [app.seti.live](https://app.seti.live) is the product, `api.seti.live` is the API. Production runs on Tempo mainnet (chain 4217).

---

## What it does

Each of these is a real route in `web/app/(product)/app/`:

- **Get paid by name.** A merchant claims a username in onboarding and prints a QR code. A customer opens `/u/<handle>`, or scans the sticker and lands on `/m/<handle>`, without installing anything.
- **Send to a person.** Same 2%, same two-leg transfer, verified against the receipt before it reaches Activity.
- **Receive.** An address the customer's own wallet controls, and a balance that is theirs.
- **Swap.** Move between supported assets at the live rate.
- **Save.** A deposit into an ERC-4626 vault. The vault's own rate measured 0.0000% over seven days, so what is paid today is a campaign with an end date, and the card says which rate is which before anything is deposited.
- **Ask.** Request a payment from someone, by link.
- **Invite.** Referrals, with the inviter's handle on the invite.
- **Activity and receipts.** Every payment gets its own page at an opaque id. The receipt is a link a customer can keep.
- **Merchant app.** Charges, deliveries and payment tools for a business taking payments at scale.

---

## Running it locally

Two npm workspaces (`backend`, `web`). There is **no mobile app**; v1 is the web app.
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
(`TEMPO_TOKEN_PATHUSD`, `TEMPO_TOKEN_OUSD`), and `SETI_TREASURY_ADDRESS`, the address
that receives the platform fee. For local development set `DEV_BYPASS_AUTH=true`, which
lets you sign in without a Privy app id.

**3. Migrations.**

```bash
cd backend && npx prisma migrate deploy
```

(`npm run db:migrate` also exists but opens Prisma's interactive flow; `deploy` just
applies what is in `prisma/migrations`.)

**4. Run both servers.** Backend first, since the web app calls it:

```bash
npm run dev --workspace backend    # tsx watch; listens on PORT (4000 locally)
npm run dev --workspace web        # next dev; http://localhost:3000
```

Point `NEXT_PUBLIC_API_URL` in `web/.env.local` at the backend.

**5. Prove it works.** This is the gate we hold ourselves to: typecheck, lint, and 97
check suites, several of which read real receipts off Tempo:

```bash
npm run verify
```

The count is computed from `package.json`'s `verify` script, not remembered. If the
number here and the number there disagree, the script is right.

### What it runs on

- **Development and CI: Tempo practice, chain 42431 (Moderato).** This is the default. Nothing in a fresh checkout points at mainnet: `ALLOW_MAINNET` is false and has to be set deliberately.
- **Production: Tempo mainnet, chain 4217.** `seti.live` and `app.seti.live` serve this.

Payments are non-custodial on both. The customer's embedded wallet signs, the merchant's
own address receives the principal, and Seti's 2% is collected in the **same atomic
transaction**. There is no custody, no payout queue, and no relayer.

### Supported assets

Four, all Tempo-native, all 6 decimals. Addresses come from Tempo's own registry,
`https://tokenlist.tempo.xyz/list/{chainId}`, never from a hardcoded copy.

| Asset | Decimals | Chains |
| --- | --- | --- |
| OUSD | 6 | mainnet, practice |
| pathUSD | 6 | mainnet, practice |
| USDT0 | 6 | mainnet only |
| USDC.e | 6 | mainnet, practice (different address on each) |

USDT0 and USDC.e are what a bridge delivers on arrival, so a bridged deposit simply
works. Supported is not the same as listed: USDT0 is absent from the practice registry,
and an absent address is left absent rather than guessed. The table lives in
`backend/src/config/assets.ts`.

### Signing in without a Privy app id

`DEV_BYPASS_AUTH=true` exposes `POST /auth/dev`, which returns a dev token and a seeded
user so you can walk the app without wallet infrastructure:

```bash
curl -X POST http://localhost:4000/auth/dev
```

With a real `NEXT_PUBLIC_PRIVY_APP_ID` set, normal sign-in creates or uses an embedded
wallet: no seed phrase, and no wallet address for the customer to manage.

---

## Why Nairobi?

Nairobi is mobile-first and already QR-ready. Merchants display QR codes, most consumers
pay by phone, and the rails underneath are built for dollars rather than for shillings.
Seti connects that existing habit to stablecoin rails, so the money a merchant is paid
arrives in the currency they now hold, whole, with nobody holding it in between.

**We are not the cheaper way to take a shilling.** A Lipa na M-Pesa till keeps
KES 1,243.12 of a KES 1,250 payment: 0.55%, nothing on tickets up to KES 500, never more
than KES 200 (measured 2026-11-01). With Seti the merchant keeps the whole KES 1,250 and
the customer pays KES 1,275. What is being sold is the property, not the price: the money
arrives in dollars and nobody holds it in between. The comparison, in KES, is on
`/pricing`.

## How it works

1. A customer opens the merchant's name or scans their QR code.
2. They confirm the amount in KES; Seti previews the stablecoin total at the live rate.
3. Their embedded wallet signs one transfer carrying two legs: the principal to the merchant, the 2% to `SETI_TREASURY_ADDRESS`.
4. The backend verifies that transfer against the on-chain receipt and only then records the payment. The principal is compared at 1% tolerance, absorbing preview rounding; the fee is compared at no tolerance, because a fee reported as collected when it is short is the defect rather than a rounding. The merchant already holds the funds; nothing is off-ramped.

The batch is signed through Privy's Tempo hook (`useSendTransaction`), never through an
EIP-1193 provider: viem's RPC formatter drops `calls`, so a batch sent that way would
silently carry none.

We optimize for two things:

- **Speed:** one atomic transfer, so a payment lands in the block that carries it. Tempo blocks measured 525ms over 40 blocks on 2026-10-31. "In seconds" is the claim the measurement backs.
- **Privacy:** the customer controls their wallet keys through Privy; Seti never holds signing material.

---

## Repository layout

``` text
├── backend/                # Node.js + Fastify API, indexer, check suites (Prisma, Postgres)
├── web/                    # Next.js 16 app: seti.live landing, /app product, receipts
├── design/                 # revolut.md and motion.md, the design system for every surface
├── design-kit/             # brand assets, per-brand, in every real variant
├── docs/                   # PRD, payment and fee-routing docs, API reference
├── docs-site/              # Docusaurus site that renders docs/ (standalone package)
├── scripts/                # repo-level gates: routes, SEO, deploy chain
├── .agents/skills/         # Project agent skills
├── design.tokens.json      # Machine-readable design tokens
├── tailwind.config.js      # NativeWind / Tailwind token configuration
├── AGENTS.md               # Project conventions for agents
└── CONTRIBUTING.md         # Development workflow and branch conventions
```

For setup and technical details, see:

- **[docs/README.md](./docs/README.md)**: developer docs (quickstart, auth, payments, API reference, MCP server)
- **[docs/internal/prd.md](./docs/internal/prd.md)**: product requirements and current implementation status
- **[docs-site/README.md](./docs-site/README.md)**: how to run the docs site that renders `docs/`
- **[backend/README.md](./backend/README.md)**
- **[web/README.md](./web/README.md)**

Every surface, web or native, is styled from **[design/revolut.md](./design/revolut.md)**.

---

## Fee model

- Merchant: 2% of the payment
- No floor, no cap
- No FX markup: the conversion uses the live provider rate as fetched

Because the customer signs principal + fee, the fee adds to what they send rather than
being deducted from what the merchant receives:

| Merchant receives | Customer signs for | Fee |
| --- | --- | --- |
| KES 50.00 | KES 51.00 | KES 1.00 |
| KES 100.00 | KES 102.00 | KES 2.00 |
| KES 500.00 | KES 510.00 | KES 10.00 |
| KES 1,250.00 | KES 1,275.00 | KES 25.00 |
| KES 2,500.00 | KES 2,550.00 | KES 50.00 |

Those are the pre-conversion KES figures; the customer's balance is debited in the
payment asset at the live rate shown in the preview, so the stablecoin amounts move with
the exchange rate. A zero-amount payment yields a zero fee rather than the floor, so the
cap can never invert the result.

v1 settles non-custodially, so there is no per-payout cost for the fee to recover and a
floor would have nothing to justify it.

**Who pays it.** The 2% is attributed to the merchant, but the customer funds it: they
sign principal + fee in one atomic transaction, and the merchant's wallet receives
exactly the principal. In the default `batch` mode the fee is its own leg to
`SETI_TREASURY_ADDRESS`; in `inside-transfer` it rides in the merchant's transfer
instead, where Seti collects nothing and nothing may be reported as a collected fee. A
floor (`MERCHANT_FEE_MIN_KES`) and a cap (`MERCHANT_FEE_MAX_PERCENT`) both default to 0
and exist for when an off-ramp lands: a flat 2% on a KES 50 payment would not cover a
per-payout charge, and a floor large enough to cover one would otherwise swallow small
payments whole. The schedule lives in `backend/src/services/fees.ts`; verify it with
`npm run check:fees`.

---

## Security notes

- Never request or store seed phrases, private keys, or raw passkey credentials
- Wallet keys belong to the user, via Privy embedded wallets
- Backend never signs transactions on behalf of users without explicit authorization
- All onchain addresses and amounts are validated before a transaction is constructed
- Keep testnet and mainnet configs separate; mainnet is gated by `ALLOW_MAINNET=true`
- Never trust a client-supplied amount: `recordPayment` reconciles the claimed gross against the on-chain receipt and fails closed on a missing payout address, an unverifiable receipt, or a mismatch beyond 1%

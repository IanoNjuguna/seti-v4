# Seti

**A neobank built for Nairobians.**

Pay a merchant by scanning their QR code. You keep a stablecoin balance, and the payment settles wallet-to-wallet on Tempo. No new hardware.

> **Current focus:** Nairobi, Kenya. v1 settles **non-custodially**: the customer's stablecoins go straight to the merchant's own wallet, and Seti never takes possession of the funds. There is **no fiat off-ramp** in this phase — no Stripe, no Bridge, no KES bank payout. M-Pesa settlement is intentionally out of scope.

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
├── .agents/skills/         # Project agent skills
├── DESIGN.md               # Calm Finance design system
├── design.tokens.json      # Machine-readable design tokens
├── AGENTS.md               # Project conventions for agents
└── CONTRIBUTING.md         # Development workflow and branch conventions
```

For setup and technical details, see:

- **[docs/prd.md](./docs/prd.md)** — product requirements and current implementation status
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

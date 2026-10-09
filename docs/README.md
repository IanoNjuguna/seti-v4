# Seti — product documentation

Seti is a mobile neobank for Nairobi. A customer holds a stablecoin balance
(**OUSD** or **pathUSD**, on **Tempo**) in a wallet they control, scans a merchant
QR code, and pays. Settlement is **non-custodial**: the customer signs an ERC-20
transfer that lands in the merchant's own wallet. Seti never takes possession of
the principal and holds no signing material.

> **Current phase (v1).** No fiat off-ramp — no Stripe, no Bridge, no KES bank
> payout. The merchant receives stablecoins at their own address.

## Where to start

| Document | Read it for |
| --- | --- |
| [Product Requirements](prd.md) | Scope, a per-area implementation status table, non-functional requirements, risks, and what is still open |
| [Fee routing](fee-routing.md) | How the 2% merchant fee is meant to reach Seti's treasury, the options considered, and the dead ends |

## The five facts that shape everything below

1. **The 2% fee is attributed to the merchant but funded by the customer.** The
   customer signs principal + fee in one transfer and the merchant receives the
   principal. That is why the fee is invisible in a merchant's balance but real
   in a customer's.
2. **In the default mode the fee is not collected at all.** `FEE_ROUTING_MODE=inside-transfer`
   sends the whole gross to the merchant, so Seti retains nothing. The atomic
   two-leg alternative is implemented behind the flag and has never run on a
   chain.
3. **Every figure a client supplies is checked against the chain.** `recordPayment`
   verifies the claimed amount against the on-chain receipt and fails closed: a
   missing payout address, an unverifiable receipt, or a mismatch beyond 1% are
   all refused.
4. **v1 supports two assets only** — pathUSD and OUSD, the only two with deployed
   bytecode on both Tempo chains. USDC.e, USDT0 and EURC.e were removed for that
   reason.
5. **Mainnet is one config edit away.** The tree currently points at Moderato
   (testnet, `42431`); `TEMPO_CHAIN_ID` plus `ALLOW_MAINNET` are the only things
   between the same code and real funds.

## Living in the repository

This space only covers `docs/`. The rest of the project's written surface lives in
the repository, because a GitBook space can only read its own directory:

- [`README.md`](https://github.com/IanoNjuguna/seti-v4/blob/main/README.md) — the product overview and fee table
- `DESIGN.md` — the Calm Finance design system (the single source of truth for UI)
- `AGENTS.md` — conventions, guardrails and verification gates
- `CONTRIBUTING.md` — branch conventions and the `npm run verify` gate

The verification gate is `npm run verify` from the repository root: three
typechecks, three lints, and seven executable check suites. There is no test
runner — the `*.check.ts` files are the specs.

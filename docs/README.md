# Seti developer docs

Seti is a **non-custodial payments API on [Tempo](https://tempo.xyz)**. A customer
holds a stablecoin balance in a wallet they control, and pays a merchant's own
wallet directly. Seti never takes possession of the funds, and in v1 there is no
fiat off-ramp. The supported assets are **OUSD**, **pathUSD**, **USDT0** and
**USDC.e**; USDT0 is mainnet only.

## The three things Seti will not do

These are the limits the product is built around, not a roadmap. Each one is
checkable by using the API, and each one is what an integration rests on:

1. **Seti never holds your money.** There is no Seti balance, no escrow and no
   "Seti holds it until" state. A payment goes from the payer's wallet to the
   recipient's own wallet, and the balance the API reports is read from the
   chain at that wallet. The backend holds no key that can sign a transfer for a
   customer: settlement and conversion are priced and planned server-side, then
   signed by the customer's own wallet while they have the app open.
2. **You do not need an account to get paid.** The [charge API](./api-reference.md)
   asks for no session: the payee's wallet signs the charge and that signature is
   the credential, so a wallet address and a signature are enough. There is no API
   key to request and no account to open first.
3. **No cards, no bank rails in v1.** Stablecoins in, stablecoins out. There is
   no card acceptance, no card top-up, and no payout to a bank account. Two of
   the four marks on our site are captioned "Not in use yet" for exactly this
   reason: `STRIPE_SECRET_KEY` and `BRIDGE_API_KEY` are declared in the
   environment schema with no call site.

If any of those three stops being true, the docs and the marketing page are wrong
the same day. `npm run check:refusals --workspace web` tests each of them against
the backend source, so a rail or an account requirement landing without this
section being revisited fails the build rather than surprising a customer.

## Status: read before you plan

| | Today |
| --- | --- |
| Public API authentication | **Not available for the product API.** Every product route needs a Privy-issued bearer token, so integrating requires a Seti account. Three routes need none: the charge API (`/public/charges*`), where the payee's wallet signature is the credential; the public handle read (`/public/handles*`); and a shared receipt link (`/receipts/:id`), gated only by the token in the link. No API keys, no OAuth. |
| API versioning | **None.** No `/v1` prefix; treat fields as subject to change. |
| OpenAPI spec | **None.** The reference here is maintained by hand against `backend/src/routes/`. |
| Rate limits, webhooks | **Per route.** The charge API has per-address and per-source budgets and signed webhook deliveries. Elsewhere, poll `GET /transactions/:id/status`. |
| Credential-free tooling | **Yes** — the [MCP server](./mcp.md) has four tools that need no account: DEX quotes, TIP-20 balances, address inspection, and building unsigned payment calldata. |

If you want to build something today without a Seti account, the [charge
API](./api-reference.md) is how you get paid (a wallet signature, no key) and the
[MCP server](./mcp.md) is how you read and quote (no credential at all). The rest
of the product API still needs the auth story to move first.

## The payment flow

```
resolve merchant → preview (fee, FX, gross) → sign the transfer → report the hash
                → server verifies it against the chain → status
```

Two things make Seti's version of this worth reading rather than assuming:

1. **The server never trusts your amount.** It verifies the reported hash against
   the on-chain receipt and fails closed on a mismatch beyond 1%.
2. **The fee is inside the customer's transfer.** The customer signs
   `principal + fee`; the merchant receives the principal. In the default routing
   mode the fee is not collected by Seti at all.

## Where to go

| Page | For |
| --- | --- |
| [Quickstart](./quickstart.md) | Run the API locally and make your first call |
| [Authentication](./authentication.md) | What works today, and what an integration would need |
| [Payments](./payments.md) | Units, fee semantics, and the reconciliation contract |
| [API reference](./api-reference.md) | Every route that exists |
| [MCP server](./mcp.md) | Drive Seti from an AI agent |

## Trust and brand policy

Two plain-language documents about what a name on Seti means. They are written to
be shown to a merchant, a partner or a brand, not read as integration guides:

| Page | For |
| --- | --- |
| [Verification](./verification.md) | What the identity mark checks, who performs it, what it promises and does not, and what happens when it fails |
| [Brand policy](./brand-policy.md) | Reserved words, why nothing is pre-screened, and how to report a name that is not yours (hey@seti.live, first response within 72 hours) |

Both carry the same starting point: **a claimed name proves control of an address,
never identity**, and because settlement is non-custodial neither document implies
an escrow or a guarantee of the merchant.

## Not for integrators

The product requirements, the fee-route design, and the operations runbook are
engineering documents, kept in an internal section rather than mixed in here:

- [Product requirements](./internal/prd.md) — scope, implementation status, risks
- [Fee routing](./internal/fee-routing.md) — how the 2% is meant to reach the treasury
- [Operations](./operations.md) — deploy, migrations, the indexer cursor, and the CI gate
- [The mainnet flip](./internal/mainnet-flip.md) — the owner-run procedure to move to mainnet

The rest of the project's written surface lives in the repository:
[`README.md`](https://github.com/IanoNjuguna/seti-v4/blob/main/README.md),
`DESIGN.md` (the Calm Finance design system), `AGENTS.md` and `CONTRIBUTING.md`.

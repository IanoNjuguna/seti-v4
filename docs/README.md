# Seti developer docs

Seti is a **non-custodial payments API on [Tempo](https://tempo.xyz)**. A customer
holds a stablecoin balance — **OUSD** or **pathUSD** — in a wallet they control,
and pays a merchant's own wallet directly. Seti never takes possession of the
funds, and in v1 there is no fiat off-ramp.

## Status: read before you plan

| | Today |
| --- | --- |
| Public API authentication | **Not available.** Every route needs a Privy-issued bearer token, so integrating requires a Seti account. No API keys, no OAuth. |
| API versioning | **None.** No `/v1` prefix; treat fields as subject to change. |
| OpenAPI spec | **None.** The reference here is maintained by hand against `backend/src/routes/`. |
| Rate limits, webhooks | **None.** Poll `GET /transactions/:id/status`. |
| Credential-free tooling | **Yes** — the [MCP server](./mcp.md) has four tools that need no account: DEX quotes, TIP-20 balances, address inspection, and building unsigned payment calldata. |

If you want to build something today without a Seti account, start with the MCP
server. Everything else needs the auth story to move first.

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

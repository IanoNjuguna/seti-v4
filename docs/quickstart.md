---
sidebar_position: 1
---

# Quickstart

Seti is a non-custodial payments API on **Tempo**. A customer holds a stablecoin
balance (**OUSD** or **pathUSD**) in a wallet they control, and pays a merchant's
own wallet directly. Seti never takes possession of the funds.

## Read this first

**The Seti API has no public authentication today.** Every route except `/health`
requires a Privy-issued bearer token, so integrating requires a Seti account.
There are no API keys, no client credentials and no OAuth. This is not a
documentation gap — it is the current state of the API, and it is the first thing
to plan around.

Two consequences worth stating plainly:

- If you want to *run* something today without a Seti account, use the
  [MCP server](./mcp.md) — four of its tools need no credentials at all.
- The API is **unversioned** (no `/v1` prefix). Treat every field as subject to
  change until that changes.

## Run the API locally

```bash
git clone git@github.com:IanoNjuguna/seti-v4.git
cd seti-v4
npm install                       # from the ROOT — this is an npm workspace

cd backend
cp .env.example .env              # fill in DATABASE_URL, JWT_SECRET,
                                  # TEMPO_TOKEN_PATHUSD, TEMPO_TOKEN_OUSD,
                                  # SETI_TREASURY_ADDRESS
docker compose up -d              # Postgres on host port 5433
npx prisma migrate deploy
npm run db:seed                   # demo user + two merchants

cd ..
npm run dev:backend               # Fastify on :4000
```

Then, with `DEV_BYPASS_AUTH=true` and `NODE_ENV=development` set, mint a token
and make a call:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/dev | jq -r .token)

curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:4000/handles/resolve?q=merchant:merchant_java_house'
```

## The payment flow in one paragraph

Resolve a merchant → ask the server for a **preview** (it computes the fee, the
FX rate, and the gross you must sign for) → sign and broadcast an ERC-20 transfer
from the customer's wallet → report the transaction hash → the server verifies
that hash against the chain before it records anything. Details and the exact
contract: [Payments](./payments.md).

## Next

- [Authentication](./authentication.md) — what works today, and the gap.
- [Payments](./payments.md) — preview → sign → record, with the fee semantics.
- [API reference](./api-reference.md) — every route that exists.
- [MCP server](./mcp.md) — use Seti from an AI agent, no account required for
  the chain-side tools.

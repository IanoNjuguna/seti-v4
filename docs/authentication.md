---
sidebar_position: 2
---

# Authentication

## The honest summary

| Mechanism | Available? | Notes |
| --- | --- | --- |
| Privy-issued bearer token | **Yes** | What the mobile app uses. Requires a Privy account that maps to a Seti user. |
| API keys | **No** | Not implemented. |
| OAuth / client credentials | **No** | Not implemented. |
| Development bypass | Yes, locally only | `DEV_BYPASS_AUTH=true` **and** `NODE_ENV=development`. Returns a fixed dev user. |

Every route except `/health` and `/auth/*` sits behind the same middleware, so
there is exactly one way in: a token that the backend can verify with Privy.

## Using a bearer token

```bash
curl -s -H "Authorization: Bearer $SETI_API_TOKEN" \
  http://localhost:4000/users/<userId>/balance
```

The middleware rejects a malformed header with **401** and a missing local user
record with **401** as well. A token for a Privy account that has never called
`/auth/verify` will not resolve to a user.

## Local development bypass

```bash
# backend/.env
NODE_ENV=development
DEV_BYPASS_AUTH=true
```

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/dev | jq -r .token)
```

The bypass is gated on **both** variables, and the route returns `404` rather
than `403` when it is unavailable — so an enabled bypass is not discoverable by
probing in production.

## `/auth/verify`

The mobile app's entry point. It accepts a Privy token, upserts the local user,
registers the embedded wallet, and returns the user record:

```bash
curl -s -X POST http://localhost:4000/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"token":"<privy-issued token>"}'
```

If Privy did not supply a wallet, the backend creates one and returns `502` if it
cannot — it does not proceed with a user who has no address to be paid to or
paid from.

## What a real integration would need

Recorded here so it is not discovered mid-build:

1. **An API-key or OAuth mechanism**, plus scoping so a key cannot act as an
   arbitrary user. Today a token *is* a user identity.
2. **Versioning** before any of this is depended on.
3. **Rate limiting** — there is none.
4. **Webhooks or a polling contract** for settlement confirmation, rather than
   asking integrators to poll `GET /transactions/:id/status`.

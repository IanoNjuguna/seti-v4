---
sidebar_position: 2
---

# Authentication

## The honest summary

| Mechanism | Available? | Notes |
| --- | --- | --- |
| Privy-issued bearer token | **Yes** | What the mobile app uses. Requires a Privy account that maps to a Seti user. |
| Merchant app webhook secret | **Yes** | Issued once when a merchant app is created (`POST /merchant-apps`). HMAC-SHA256 over the delivery, rotatable by one signed call. It is **not** an API credential: it cannot create, read or move anything. |
| API keys | **No** | Not implemented, and nothing needs one: there is no resource a key would unlock that a session or a signature does not. |
| OAuth / client credentials | **No** | Not implemented, and there is nothing for an authorization server to grant — Seti holds no funds, so no credential here can move money. |
| Development bypass | Yes, locally only | `DEV_BYPASS_AUTH=true` **and** `NODE_ENV=development`. Returns a fixed dev user. |

Every route except `/health` and the public `/auth/*` entry points (`/auth/verify`,
`/auth/dev`, `/auth/register`) sits behind the same middleware, so there is exactly
one way in: a token that the backend can verify with Privy. `/auth/me` is an
`/auth/*` route that sits *behind* that middleware rather than in front of it — see
below.

Two things look like credentials and are not, which is worth stating plainly because
both are pasted into other people's code:

- **A merchant app's webhook secret** proves that a delivery Seti sends is Seti's. It
  is an HMAC key, so it is stored sealed rather than hashed (`lib/secret-box.ts`) and
  it is shown once, in the response that creates it. It authenticates **nothing** on
  this API: the app id it is paired with cannot create a charge or read one, and the
  secret cannot create, read or move a shilling. Losing it costs a merchant their
  trust in their own fulfilment logic; rotation is the fix and it is one signed call.
- **A charge's recipient signature** is how the charge API authenticates: an EIP-712
  signature by the wallet being paid, checked before a row is written. See
  `docs/api-reference.md`.

## Using a bearer token

```bash
curl -s -H "Authorization: Bearer $SETI_API_TOKEN" \
  http://localhost:4000/users/<userId>/balance
```

The middleware rejects a malformed header with **401** and a missing local user
record with **401** as well. A token for a Privy account that has never called
`/auth/verify` will not resolve to a user.

## How a session resolves

A bearer token is verified with Privy, and what it proves is a **subject** — the
Privy DID — fixed for the life of the account. The account that subject belongs to
is bound at `POST /auth/verify` (the moment a session is established) and stored
on the user row; every later request resolves the caller from **that binding**, and
the email attached to the request is the account's stored one, not whatever Privy
reports now.

The email is the *entry key at login* and a label on the account — it is never
what a live request is resolved by. Re-deriving the account from the email Privy
reports at request time is what let a later change re-point, or kill, a session
that had been established for a different identity. A session whose subject has no
binding — an account created before this column, or the dev bypass user — resolves
to no account and re-authenticates once through `/auth/verify`, which binds it.

See `backend/src/services/session-identity.ts` and `npm run check:session`.

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

## `/auth/me`

Who the caller's bearer token belongs to, as the server resolves it:

```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:4000/auth/me
# { "user": { "id": "...", "email": "...", "wallets": [ ... ] } }
```

It runs the **same** middleware as every other protected route
(`backend/src/middleware/auth.ts`), registered as a route-level `preHandler` so the
public `/auth/*` routes stay public. Reusing the one token flow is the point: this
endpoint cannot disagree with the rest of the API about who a token is, and the dev
bypass resolves here exactly as it does on `/transactions`. A token the middleware
refuses is a `401`.

This exists for the web app. The browser persists a token **and** the user it signed
in as (`seti-auth-token` / `seti-auth-user`); the user half is a cache, never an
identity claim. On every load the web session presents the stored token here and
adopts only what the server answers — a token the server refuses, or an answer that
names a different account than the stored user claimed, clears the stored pair and
leaves the app signed out, so a stale or hand-edited snapshot can never leave a
cached identity visible. See `web/lib/auth/session-bootstrap.ts`.

## What a real integration would need

Recorded here so it is not discovered mid-build:

1. **A scoped charge-signing key**, for a server-side integration that creates charges
   without a wallet in the loop. Today the recipient's wallet signs each charge, which
   is the honest model while Seti holds no funds. A key that could sign charges needs
   its own design: scope, revocation, and what it can never do (it must never move
   money, which is why the webhook secret issued today is deliberately not one).
2. **Versioning** before any of this is depended on.
3. **Rate limiting** — the charge API and the merchant app routes have their own
   buckets; nothing is metered per key yet, because there are no keys.
4. **Webhooks** exist for charges (`docs/receive.md`). A polling contract for anything
   else does not.

---
sidebar_position: 4
---

# API reference

**Unversioned.** There is no `/v1` prefix; paths below are the ones that exist.
Everything except `/health` and `/auth/*` requires a bearer token — see
[Authentication](./authentication.md).

Base URL in local development: `http://localhost:4000`.

## Health

### `GET /health`

Liveness. Touches nothing, so it answers even when the database is down.

```json
{ "status": "ok", "service": "seti-api", "version": "0.1.0" }
```

### `GET /health/sweep`

Readiness for the payment lifecycle: is any payment stuck, and is the sweep that
resolves them still running? **Unauthenticated** (it is a probe surface for
uptime monitors), and returns **503** when degraded, **200** otherwise.

```json
{ "degraded": false, "reasons": [] }
```

Counts only — deliberately no transaction hashes, because the endpoint is
unauthenticated and binding the ledger to public on-chain data is not needed for
the probe to work.

## Auth

### `POST /auth/verify`

Accepts a Privy-issued token; upserts the local user, registers the embedded
wallet, returns the user record. `503` if Privy is not configured, `400` if the
Privy account has no email, `502` if the wallet cannot be created.

```json
{ "token": "<privy token>" }
```

### `POST /auth/dev`

Development-only bypass. Returns `{ user, token: "dev-bypass-token" }`. Returns
**404** unless `NODE_ENV=development` **and** `DEV_BYPASS_AUTH=true`.

### `POST /auth/register`

Deprecated; kept for local seeding. `409` if the email exists.

## Merchants

### `GET /merchants/resolve?qr=<payload>`

Resolves a Seti merchant QR payload. Accepted forms:

- `seti://pay?merchantId=<id>&amount=<kes>`
- `merchant:<id>`
- a bare merchant id matching `/^[a-zA-Z0-9_-]{3,64}$/`

Anything else → `400 Unrecognized QR format`. Not found → `404`.

```json
{
  "merchant": { "id": "merchant_java_house", "name": "Java House", "category": "Dining", "payoutAddress": "0x…" },
  "suggestedAmount": "250"
}
```

**It does not read other QR standards.** If you are integrating, assume the
merchant displays a Seti-issued code — or generate the payload yourself.

## Transactions

### `POST /transactions/preview`

Request — note `amountKes`, in **KES**:

```json
{ "merchantId": "merchant_java_house", "amountKes": "250", "asset": "ousd" }
```

Response: `{ "preview": { … } }`, where the preview carries `amount` (principal,
asset units), `fee` (KES), `total` (asset units — **what you sign**), `fiatAmount`
(KES), `hasEnoughBalance`, `fxRate`/`fxRateSource`/`fxRateStale`,
`feeRoutingMode`, `feeInAsset`, and the resolved `merchant`. Field-by-field
meaning: [Payments](./payments.md).

### `POST /transactions/pay`

Record a payment you have already broadcast. The amount is a claim that the
server verifies against the chain and **fails closed** on.

```json
{
  "merchantId": "merchant_java_house",
  "amount": "51.00",
  "asset": "ousd",
  "txHash": "0x…",
  "description": "Payment to Java House"
}
```

`amount` must be the figure that actually moved: the **gross** in
`inside-transfer` mode, the **principal** in `batch` mode. Returns `201` with the
created transaction, or `500` with the refusal reason.

### `GET /transactions`

Query: `limit` (default 20), `offset` (default 0). Returns
`{ "transactions": [ … ] }` for the authenticated user, newest first.

### `GET /transactions/:id/status`

```json
{ "id": "…", "status": "processing", "txHash": "0x…", "settledAt": null, "failedAt": null }
```

Statuses: `pending`, `processing`, `completed`, `failed`, `reversed`.

### `POST /transactions`

Creates a non-payment transaction record (`p2p_send`, `p2p_receive`, `top_up`,
`withdrawal`, `fee`). Requires `userId` to equal the authenticated user, else
`403`. Payment recording does not go through this route.

## Users

### `GET /users/:id`

Returns the user with their wallets. `403` if `:id` is not the authenticated user.

### `GET /users/:id/home`

Home dashboard: `balance` (KES), `currency`, `monthToDateDelta`, and the ten most
recent transactions.

### `GET /users/:id/balance`

```json
{ "asset": "ousd", "balance": "0.00", "currency": "OUSD" }
```

A balance is read from the chain; if the read fails the API returns `0.00` rather
than an error, so **do not treat `0.00` as proof of an empty wallet**.

## Wallets

### `GET /users/:id/wallets`

Lists the registered wallets for the user.

### `POST /users/:id/wallets`

Registers a wallet. Body: `{ chain?, asset?, address, keyId? }`. The address must
match `/^0x[a-fA-F0-9]{40}$/` — a **regex only**, so a mixed-case address whose
EIP-55 checksum is wrong is accepted here and stored, even though a viem-based
client will refuse to build a transfer to it.

> Both wallet routes are declared as `/users/:id/wallets` inside a router that was
> once mounted under a `/wallets` prefix, producing `/wallets/users/:id/wallets`.
> The prefix was removed, so the paths above are correct. If you have code against
> the doubled path, it was relying on a bug.

## What is not here

No merchant CRUD, no webhooks, no refunds, no payouts, no fiat off-ramp, no
idempotency keys, no pagination cursors, no rate limiting, and no OpenAPI
document. This reference is maintained by hand against
`backend/src/routes/` — if it disagrees with the code, **the code is right**.

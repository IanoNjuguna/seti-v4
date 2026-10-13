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

Request — note `amountFiat`, in the **customer's currency** (KES in v1):

```json
{ "merchantId": "merchant_java_house", "amountFiat": "250", "asset": "ousd" }
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
created transaction, or `422` with the refusal reason and its machine-readable
`code` (see [Payments](./payments.md) and `payment-refusal.ts`).

### `POST /transactions/send/preview`

Quote a send to a person. Same arithmetic as a payment, different payee: the
typed figure is the **principal** the person receives, and the fee and the gas
reserve are added on top, funded by the sender.

```json
{ "amountFiat": "1000", "asset": "pathusd", "recipient": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" }
```

Response: `{ "preview": { … } }` — the same fields as a payment preview, plus
`recipient` (checksummed: sign this one, not the typed one), `treasuryAddress`
(where the fee leg must go) and `feeCollected`.

**Batch only.** Answers `422 { "code": "send-requires-batch" }` while
`FEE_ROUTING_MODE` is `inside-transfer`, because with no merchant in the path the
fee would be paid to the person being sent to.

### `POST /transactions/send`

Record a send you have already broadcast. `amount` is the **principal** the
recipient received, in asset units — not the gross, since the fee is its own leg.

```json
{
  "recipient": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  "amount": "7.70563862",
  "asset": "pathusd",
  "txHash": "0x…"
}
```

The server re-reads BOTH legs off the receipt — the recipient's principal and the
fee to the treasury — and refuses (`422`) if either is missing, if the claimed
amount is more than 1% away from what the chain recorded, if the recipient is
unusable (bad EIP-55 checksum), or if it is the sender's own wallet. Returns `201`
with the created `p2p_send` transaction, which is what appears in Activity.

### `GET /transactions`

Query: `limit` (default 20), `offset` (default 0). Returns
`{ "transactions": [ … ] }` for the authenticated user, newest first.

### `GET /transactions/:id/status`

```json
{ "id": "…", "status": "processing", "txHash": "0x…", "settledAt": null, "failedAt": null }
```

Statuses: `pending`, `processing`, `completed`, `failed`, `reversed`.

### `GET /transactions/:id/receipt`

The receipt for one of the caller's own rows. **Read from the chain, not from memory**:
the block, hash, timestamp and every token movement come from the on-chain receipt, and
only the fiat figures come from what we recorded. If the chain disagrees with our row,
the chain wins — which is the point of showing a receipt at all.

```json
{
  "hash": "0x…", "blockNumber": 39312435, "timestamp": "2026-10-12T19:33:49.000Z",
  "status": "confirmed", "from": "0x…",
  "legs": [
    { "index": 1, "role": "payment",      "label": "Recipient",    "asset": "pathusd", "amount": "10000",   "mine": true },
    { "index": 2, "role": "platform-fee", "label": "Platform fee", "asset": "pathusd", "amount": "200",     "mine": false },
    { "index": 3, "role": "gas",          "label": "Network fee",  "asset": "pathusd", "amount": "0.000027","mine": false }
  ],
  "networkFee": { "asset": "pathusd", "amount": "0.000027", "fiatAmount": "0.003503927619" },
  "total": { "asset": "pathusd", "amount": "10000", "fiatAmount": "1297750.97", "fiatCurrency": "KES" },
  "ledger": { "direction": "in", "fiatAmount": 1297750.97, "fiatCurrency": "KES", "platformFeeFiat": null, "fxRate": 129.775097, "fxRateSource": "open.er-api.com", "title": "Received" },
  "explorerUrl": "https://explore.testnet.tempo.xyz/receipt/0x…"
}
```

`role` is what makes the receipt honest. A transaction that pays its fee in a stablecoin
pays gas as an ordinary `Transfer` to Tempo's fee address (`FEE_AMM_ADDRESS` in
`services/chain.ts`), so without the classification the customer's own gas would be
listed as a payment to a stranger.

`mine` marks the legs that are the caller's own money in either direction, and
`total.amount` is the sum of those excluding gas — so an outbound receipt totals what
left the customer and an inbound one totals what reached them, with the sender's fee
shown but attributed to the sender.

`fiatAmount` on the row may be `null` for rows written before the currency was stored;
`fiatCurrency` is nullable for the same reason and a client must fall back to the user's
currency rather than invent one.

404 when the row is not the caller's, or has no on-chain hash — a receipt is never a way
to read someone else's transfer.

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

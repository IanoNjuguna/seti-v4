---
sidebar_position: 4
---

# API reference

**Unversioned.** There is no `/v1` prefix; paths below are the ones that exist.
Everything requires a bearer token — see [Authentication](./authentication.md) —
except the routes that exist to be opened signed out: `/health`, `/auth/*`,
`GET /receipts/:id`, and `GET /public/merchants/:handle`. Each of those is marked
**unauthenticated on purpose** in its own section below.

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

## Account

### `GET /account`

The caller's own handles and mode. No id in the path, so it always answers about
the BEARER TOKEN's account and can never be pointed at someone else's.

`onboarded` is **derived on every read** from whether the account holds a handle —
there is no `onboardedAt` column, so it cannot drift from the rows it summarises.
It is what `/app`'s client gate routes on: an account where it is `false` cannot
reach an app surface, by tab bar or by direct URL.

```json
{
  "intent": "personal",
  "handles": [
    {
      "id": "handle_…",
      "handle": "ianllc",
      "kind": "business",
      "name": "Ianllc",
      "address": "0xE2eF…5e28",
      "category": null,
      "verified": true,
      "purpose": "merchant-name",
      "merchantId": "cm…",
      "claimedAt": "2026-10-13T12:42:26.440Z"
    }
  ],
  "onboarded": true
}
```

`intent` is `personal` or `business` — the mode the account acts as, which is a
PREFERENCE and never a gate. `kind` on each handle is `person` or `business` — what
that name was claimed as, which decides the `purpose` its signature carries. An
account may hold both a person handle and a business handle at once: the intent
decides which one it presents, and switching it is how "try it personal, add a
business later" stays reversible.

### `POST /account/intent`

Record the mode the account is acting as. Body `{ "intent": "personal" | "business" }`;
answers with the same shape as `GET /account`. `400 { code: "invalid-intent" }` for
anything else.

No handle is required for the chosen mode, and none is affected: choosing `business`
before a business name exists is the normal order, and the claim that follows is what
creates the name. That is deliberate — refusing the switch until the name existed
would make the mode a one-way door.

## Merchants

**A name proves control of an address, never identity.** A claim is an EIP-712
signature by the key that controls the address, stored so anyone can re-verify the
binding later. `verified` is recomputed from that signature on every read, never
stored as a flag. Whether the business is really who it says it is — that this Java
House is *the* Java House — is the owner's job, checked in person or by KYB, out of
band. This API only ever answers: does this signature, over this name and this
address, come from the key that controls the address?

### `GET /merchants/resolve?qr=<payload>`

Resolves a Seti merchant payload. Accepted forms:

- `seti://pay?merchantId=<id>&amount=<kes>` — `amount` optional, returned as `suggestedAmount`
- `seti://merchant?name=<name>` — a claimed business name, which a URL path cannot carry
- `merchant:<id>`
- a bare token matching `/^[a-zA-Z0-9._-]{3,64}$/` — a platform merchant id **or a
  stored handle** (`.` is part of the shape, so `co.op` reaches the handle lookup)
- a bare claimed **name** (the name lookup runs last)

Looked up in that order: by id (`findUnique`), then by handle (`findUnique` on the
lowercased, unique, indexed `handle` column — **not** a reverse-derivation from names),
then by name (case-insensitive `findFirst`). Anything else → `400 Unrecognized QR
format`. Not found → `404 Merchant not found`.

```json
{
  "merchant": {
    "id": "merchant_java_house",
    "name": "Java House",
    "handle": "javahouse",
    "category": "Dining",
    "payoutAddress": "0x…",
    "verified": true,
    "claimedAt": "2026-10-12T09:14:03.000Z"
  },
  "suggestedAmount": "250"
}
```

`handle` is the `m/<handle>` of the link a customer scanned. `verified` is
**recomputed from the stored signature on every read** — a name whose signature no
longer recovers to its address comes back `verified: false`, so a tampered row can only
ever read as unverified, never as a verified name pointing somewhere new.

**It does not read other QR standards.** If you are integrating, assume the
merchant displays a Seti-issued code — or generate the payload yourself.

### `GET /merchants/handle?name=<name>`

The claim form's live preview, **before** the merchant signs: the handle a name would
get, and whether that link is free. Behind the same auth as the claim — a signed-in
merchant checking a name it is about to sign for, not anonymous enumeration.

```json
{ "status": { "name": "Java House", "handle": "javahouse", "problem": null, "takenBy": null } }
```

- `name` — the name as the rule would store it
- `handle` — the link's handle, `seti.live/m/<handle>`
- `problem` — a name- or handle-rule failure, or `null` when the name is usable
- `takenBy` — the NAME of the merchant already holding the handle, or `null` when free

It runs the claim path's own validation, so the preview can never call a link free that
the claim would then refuse. Only the holder's name is surfaced — no more than a
`handle-taken` refusal would already name.

### `POST /merchants/claim`

Claim a business name for an address. One-time per merchant, costs no gas, writes
nothing on chain: it stores a signature so anyone can re-verify the binding later. The
address always stays authoritative for the money path; the name is only a label beside
it. Requires a bearer token — that is what ties the claim to a user whose wallet
ownership can be checked.

The client signs EIP-712 typed data:

- **Domain** — `{ name: "Seti", version: "1", chainId: <Tempo chain id> }`. The chain
  id is read from the live network config, so a testnet claim cannot be replayed on
  mainnet.
- **primaryType** — `MerchantNameClaim`
- **Types** — `name: string`, `address: address`, `issuedAt: string`, `nonce: string`
- **Message** — the same four fields: the claimed `name`; the `address` the name is
  claimed **for** (must be the signer's own); the ISO 8601 `issuedAt` the signer chose
  and the server stores verbatim; and a one-time `nonce` so two claims are never the
  same signature.

Request — that message plus the signature over it:

```json
{
  "name": "Java House",
  "address": "0x1F9840a85d5aF5bf1D1762F925BDADdC4201F984",
  "issuedAt": "2026-10-12T09:12:00.000Z",
  "nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "signature": "0x…"
}
```

The server reads the signature once and asks two questions of it: viem's
`verifyTypedData` (does it verify *against the claimed address*?) and the recovered
signer (whom do we check ownership against?). Both must agree, and the recovered
address — never the address in the body — is what the wallet check uses.

`201` on success:

```json
{ "merchant": { "id": "…", "name": "Java House", "handle": "javahouse", "category": null, "payoutAddress": "0x1F98…F984", "verified": true, "claimedAt": "2026-10-12T09:14:03.000Z" } }
```

Every refusal is a typed code the UI branches on, in the envelope
`{ "error": "<message>", "code": "<code>" }`:

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid-merchant-name` | `400` | The name fails the name rule, or is valid but makes no link |
| `invalid-address` | `400` | Not a 20-byte address, or a checksum no client can build a transfer from |
| `invalid-issued-at` | `400` | `issuedAt` is not a parseable date |
| `invalid-signature` | `400` | The signature could not be read at all |
| `signature-mismatch` | `400` | Signed by a different key than the claimed address |
| `address-not-owned` | `403` | The recovered address is not a wallet this account holds (on either network) |
| `name-taken` | `409` | The name is already claimed (names are first-come) |
| `handle-taken` | `409` | A different name already reduces to the same link, or the name is held on the other network |

A missing or invalid token is `401` before any of that. The order is deliberate —
cheap local validation, then the signature, then ownership, then the collision — so a
bad name or a bad signature costs no query, and **a caller who does not control the
address is refused before anything is looked up about who else holds the name**, so a
failed claim cannot be used to probe which names exist. Ownership is checked through
the existing wallet registry: the signer must be a wallet this account holds, on the
claim's network **or** on the other one — a claim binds a name to an ADDRESS, and the
same key is the account's on both networks (`registerWallet` registers on the served
network, so an account that signed in on Practice has its embedded wallet registered
on Practice only, and that must not be a reason its first Live claim is refused).
The name-collision check matches the normalised name key **and** the raw name
case-insensitively, so a row written before claims existed still blocks its own name.
The two `409`s are decided by the unique indexes when two claims race: whichever index
(`nameKey` or `handle`) rejects the row decides the code.

#### The namespace rule — one username, two networks

- **A person's username is ONE name for ONE account on BOTH networks.** `handle` is
  globally unique for `kind = 'person'` (partial unique index
  `handles_person_handle_key`, migration `20261014140000_global_person_handles`), so a
  *different* account cannot claim it on the other network — that was the
  impersonation hole while the namespace was per network — and the same account does
  not re-claim or lose it when it switches: the single row resolves on both networks
  and `GET /account` lists it on both, so the onboarding gate does not re-trigger.
- **A business name stays PER NETWORK** (`handles_handle_<network>_key`), deliberately.
  When KYB lands, the real merchant carries a verified mark, so a squatter holding
  `kfc` is distinguishable from the real one on the page a customer pays from: the
  namespace is not the trust mechanism for a business, the badge is. What a practice
  business name should mean on live is an OPEN question, not something to settle in
  passing — so nothing here makes a business name global.
- The stored handle is always the LOWERCASED form (constraint
  `handles_handle_lowercase_check`: `handle = lower(handle)`), so `@Ianllc`, `@IANLLC`
  and `@ianllc` are one claim on one network and across networks, and the reserved list
  is matched on that same normalised value (`@Seti` is `seti` is reserved).

### `GET /public/merchants/:handle`

**Unauthenticated on purpose.** This is the route behind the public
`seti.live/m/<handle>` page: a customer opens a merchant's link signed out, so the
identity has to be readable before anyone has a session — requiring a token would make
the page ask a stranger to sign in before it would say who they are about to pay.
There is **no bearer token; none is expected and none is needed.**

It exposes only what the link is for — the same merchant identity view:

```json
{ "merchant": { "id": "…", "name": "Java House", "handle": "javahouse", "category": "Dining", "payoutAddress": "0x…", "verified": true, "claimedAt": "2026-10-12T09:14:03.000Z" } }
```

`verified` is recomputed from the stored signature here too. Unknown handle → `404
Merchant not found`. It is a lookup by the unique handle: **read-only** (nothing here is
writable), and it reaches **nothing about any customer** — no email, no user id, no
balance, no other rows. It lives in its own file with no auth hook at all, so this
unauthenticated route cannot leak an authenticated neighbour by accident.

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

### `POST /transactions/:id/receipt-link`

The owner's SHARE action: mints the link they can hand to the merchant on the other side.

```json
{ "path": "/r/x8C5v-9Oae8Avz61G6VM8L?t=eyJ0…", "expiresAt": "2026-10-14T07:50:07.966Z" }
```

Same precondition as the receipt above — the row must be the caller's and have something on
chain, else `404`. The body is a PATH, not an absolute URL: the browser knows its own origin,
so the link is composed there and works through a tunnel or a preview host without the server
guessing its own public name.

The `path` opens the receipt as its own page, `/r/<opaqueId>?t=<token>`, which reads
`GET /receipts/:id` below. That page shows the SAME proof card the modal shows — figure, payee,
date, status, one fee line, explorer link, plus a QR of this exact link — and it carries
`noindex`: a shared link is a capability, and it must never become a search result.

### `GET /receipts/:id?t=<token>`

**Unauthenticated on purpose.** This is the receipt behind a shared link, and the point of the
link is that a merchant with no Seti session can open it. The capability is the signed `t`
token, HMAC over (receipt id + scope + expiry) using the SAME primitive and secret as the price
quote (`QUOTE_SIGNING_SECRET`) — the scope (`receipt:read`) lives inside the signed payload,
never in a parameter a client could widen. Read-only, ~24h.

The response is exactly the `GET /transactions/:id/receipt` body (the receipt, never the
account: no email, no user id, no balance, no other rows).

The `id` is NOT the txHash. It is an opaque, keyed value (`HMAC(secret, "receipt:" + row id)`)
because a chain is public and enumerable: a page keyed by the hash would be a tidier mirror of
a public chain that also leaked our enrichment — the customer↔transfer link, the merchant's
name, the fiat figure and the rate.

**Every refusal is the same `404`** — an unknown id, a missing token, a forged one, an expired
one, a token bound to another receipt — so the endpoint can never be used to test whether a
guessed id exists:

```json
{ "error": "No receipt for that link." }
```

Rate-limited modestly by address (`429` beyond it).

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

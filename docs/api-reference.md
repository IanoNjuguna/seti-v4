---
sidebar_position: 4
---

# API reference

**Unversioned.** There is no `/v1` prefix; paths below are the ones that exist.
Everything requires a bearer token — see [Authentication](./authentication.md) —
except the routes that exist to be opened signed out: `/health`, `/auth/*`,
`GET /receipts/:id`, `/public/handles/:handle`, `GET /public/payees/:address`,
`GET /referrals/invite/:handle`, and the
charge routes below
(`/public/charges*`), where a wallet signature is the credential instead of an
account. Each of those is marked **unauthenticated on purpose** in its own section.

Base URL in local development: `http://localhost:4000`.

## Health

### `GET /health`

Liveness, plus the Tempo network this process serves. Touches nothing, so it
answers even when the database is down.

```json
{
  "status": "ok",
  "service": "seti-api",
  "version": "0.1.0",
  "network": "mainnet",
  "chainId": 4217,
  "networkLabel": "Live"
}
```

`network`, `chainId` and `networkLabel` name the chain this deployment serves —
`testnet` / `42431` / `Practice`, or `mainnet` / `4217` / `Live` — and come from
the same constant every route branches on, so they cannot disagree with the
running process.

They exist to be compared. The client is built with `NEXT_PUBLIC_TEMPO_CHAIN_ID`
and the API reads `TEMPO_CHAIN_ID` from its own environment: two settings, in two
places, that nothing compares for you. A Worker signing on one chain against an
API serving the other means every payment fails verification, and this is the one
request that shows it. Compare `chainId` against the chain the client was built
with; they must be equal.

Nothing secret is in the body: a chain id and a label are public, and the route
is unauthenticated.

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

## Names and claims

A **person's username** and a **business name** are two kinds over one string. Both
are claimed the same way, from the same route, with a signature over the same
fields; what differs is the `kind`, the `purpose` inside the signature, and the
namespace the string lives in (§ The namespace rule). A business handle still turns
on a merchant profile, which is what the money path pays.

**A name proves control of an address, never identity.** A claim is an EIP-712
signature by the key that controls the address, stored so anyone can re-verify the
binding later. `verified` is recomputed from that signature on every read, never
stored as a flag. Whether the business is really who it says it is — that this Java
House is *the* Java House — is the owner's job, checked in person or by KYB, out of
band. This API only ever answers: does this signature, over this name and this
address, come from the key that controls the address?

### `GET /handles/resolve?q=<payload>`

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
format`. Not found → `404 Handle not found`.

```json
{
  "handle": {
    "id": "…",
    "handle": "javahouse",
    "network": "testnet",
    "networkLabel": "Practice",
    "kind": "business",
    "name": "Java House",
    "address": "0x…",
    "category": "Dining",
    "verified": true,
    "purpose": "merchant-name",
    "merchantId": "merchant_java_house",
    "claimedAt": "2026-10-12T09:14:03.000Z"
  },
  "suggestedAmount": "250"
}
```

`address` is the authoritative field: a name is never used without it. `verified` and
`purpose` are recomputed from the stored signature on every read, and `network` is
the network the claim was MADE on (for a business name that is also its scope).

`handle` is the `m/<handle>` of the link a customer scanned, and it is unique
per network for a business and globally for a person. A name whose signature no longer
recovers to its address comes back `verified: false`, so a tampered row can only ever
read as unverified, never as a verified name pointing somewhere new.

**It does not read other QR standards.** If you are integrating, assume the
merchant displays a Seti-issued code — or generate the payload yourself.

### `GET /handles/status?name=<name>&kind=<kind>`

The claim form's live preview, **before** the claimer signs: the handle a name would
get, and whether that string is free. Behind the same auth as the claim — a signed-in
account checking a name it is about to sign for, not anonymous enumeration.

`kind` (`person` or `business`) decides WHICH namespace the answer comes from, so it
should be sent: the preview must apply the same rule the claim will. Omitted or
unrecognised, it falls back to the conservative union of both rules, which can say
"taken" about a string the specific claim would have allowed but never the reverse.

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

### `POST /handles/claim`

Claim a username or a business name for an address. One-time, costs no gas, writes
nothing on chain: it stores a signature so anyone can re-verify the binding later. The
address always stays authoritative for the money path; the name is only a label beside
it. Requires a bearer token — that is what ties the claim to a user whose wallet
ownership can be checked.

The client signs EIP-712 typed data:

- **Domain** — `{ name: "Seti", version: "1", chainId: <Tempo chain id> }`. The chain
  id is read from the live network config, so a testnet claim cannot be replayed on
  mainnet.
- **primaryType** — `HandleClaim`. Handles backfilled from claims made before
  `purpose` existed still re-verify under the older `MerchantNameClaim` type, which
  covers four fields and can never be produced again.
- **Types** — `name: string`, `address: address`, `purpose: string`, `issuedAt: string`,
  `nonce: string`
- **Message** — the claimed `name`; the `address` the name is claimed **for** (must be
  the signer's own); the `purpose`, which is `username` for `kind: "person"` and
  `merchant-name` for `kind: "business"`, so a signature for one cannot be replayed as
  the other; the ISO 8601 `issuedAt` the signer chose and the server stores verbatim;
  and a one-time `nonce` so two claims are never the same signature.

Request — that message plus the signature over it:

```json
{
  "kind": "business",
  "name": "Java House",
  "address": "0x1F9840a85d5aF5bf1D1762F925BDADdC4201F984",
  "issuedAt": "2026-10-12T09:12:00.000Z",
  "nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "signature": "0x…"
}
```

`kind` is required, and anything other than `person` or `business` is refused
`invalid-kind` (`400`). `rename` is optional and only means something for a person
claiming a DIFFERENT name from the one their account already holds: omitted, that
claim is refused `rename-required` and nothing is written, because a rename releases
a public name that other people are already using. A business may hold more than one
name, and an account's first person name is not a rename.

The server reads the signature once and asks two questions of it: viem's
`verifyTypedData` (does it verify *against the claimed address*?) and the recovered
signer (whom do we check ownership against?). Both must agree, and the recovered
address — never the address in the body — is what the wallet check uses.

`201` on success:

```json
{ "handle": { "id": "…", "handle": "javahouse", "network": "testnet", "networkLabel": "Practice", "kind": "business", "name": "Java House", "address": "0x1F98…F984", "category": null, "verified": true, "purpose": "merchant-name", "merchantId": "…", "claimedAt": "2026-10-12T09:14:03.000Z" } }
```

Every refusal is a typed code the UI branches on, in the envelope
`{ "error": "<message>", "code": "<code>" }`:

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid-handle-name` | `400` | The name fails the name rule, or is valid but makes no link |
| `reserved-handle` | `400` | The name reduces to a string Seti keeps for itself (see `docs/brand-policy.md`) |
| `invalid-kind` | `400` | `kind` is not `person` or `business` (refused by the route, before the claim runs) |
| `invalid-address` | `400` | Not a 20-byte address, or a checksum no client can build a transfer from |
| `invalid-issued-at` | `400` | `issuedAt` is not a parseable date |
| `invalid-signature` | `400` | The signature could not be read at all |
| `purpose-mismatch` | `400` | The signature was made for the other kind's purpose, so it cannot be replayed as this one |
| `signature-mismatch` | `400` | Signed by a different key than the claimed address |
| `address-not-owned` | `403` | The recovered address is not a wallet this account holds (on either network) |
| `handle-taken` | `409` | The string is spoken for: another account holds it, a different name reduces to it, it is held on the other network, it is still inside a rename hold, or the OTHER kind holds it (see § The namespace rule) |
| `rename-required` | `409` | The account already holds a person name and the claim is not marked `rename: true` |

Two more codes come back from the operator's takedown path rather than from a client
claim: `handle-not-found` (`404`) and, on a reassignment attempt, `evidence-required`
and `reason-required` (both `400`). A client cannot send them.

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
- **ONE string is ONE name, whichever kind claims it** (`#141`). The person and business
  namespaces are two indexes over one string, so a claim looks at BOTH: a person claim
  is refused by a person row on any network or a business row on ANY network, and a
  business claim is refused by a person row on any network or by a business row on the
  network being claimed on. The refusal is `handle-taken` and names the kind holding it.
  There is no exemption: not for the same account, not for the same wallet. What this
  does NOT change is the per-network scope of business names, so a practice `kfc` and a
  live `kfc` remain two allowed business claims.
- The stored handle is always the LOWERCASED form (constraint
  `handles_handle_lowercase_check`: `handle = lower(handle)`), so `@Ianllc`, `@IANLLC`
  and `@ianllc` are one claim on one network and across networks, and the reserved list
  is matched on that same normalised value (`@Seti` is `seti` is reserved).

### `GET /public/handles/:handle`

**Unauthenticated on purpose.** This is the route behind the public
`seti.live/m/<handle>` page: a customer opens a merchant's link signed out, so the
identity has to be readable before anyone has a session — requiring a token would make
the page ask a stranger to sign in before it would say who they are about to pay.
There is **no bearer token; none is expected and none is needed.**

It exposes only what the link is for — the same identity view the resolve route returns:

```json
{ "handle": { "id": "…", "handle": "javahouse", "network": "testnet", "networkLabel": "Practice", "kind": "business", "name": "Java House", "address": "0x…", "category": "Dining", "verified": true, "purpose": "merchant-name", "merchantId": "…", "claimedAt": "2026-10-12T09:14:03.000Z" } }
```

`verified` is recomputed from the stored signature here too. Unknown handle → `404
Handle not found`. A handle that is `reserved` (a first-refusal hold on the other
network) is not found here either: every resolver filters it out, so an unpublished
name is not reachable by typing it. It is a lookup by the unique handle: **read-only** (nothing here is
writable), and it reaches **nothing about any customer** — no email, no user id, no
balance, no other rows. It lives in its own file with no auth hook at all, so this
unauthenticated route cannot leak an authenticated neighbour by accident.

### `GET /public/payees/:address`

**Unauthenticated on purpose.** The route behind the verified tier of the public pay
page (#197): a charge names an address, and the payer opened a link rather than a
session, so the read has to answer before anyone has signed in. There is **no bearer
token; none is expected and none is needed.**

It answers a question, so a miss is a `200` with `payee: null` rather than a `404`: an
address with no Seti name is the common case, and the page draws its unverified tier for
it. A string that is not a 20-byte hex address gets the same answer.

```json
{ "payee": { "handle": "javahouse", "name": "Java House", "address": "0x…", "verified": true, "merchantVerifiedAt": "2026-10-02T09:00:00.000Z" } }
{ "payee": { "handle": "javahouse", "name": null, "address": "0x…", "verified": true, "merchantVerifiedAt": null } }
{ "payee": null }
```

`name` and `merchantVerifiedAt` are set **together or not at all**, and only when all
three of these hold:

1. a live claim (`reviewStatus = null`) is bound to this exact address, compared
   case-insensitively because a claim stores the EIP-55 checksummed form while a charge
   stores its recipient lowercased;
2. that claim's stored signature still recovers to the address, recomputed on this read
   (`verified`), never read from a flag;
3. the merchant record carries `verifiedAt` **and** `verifiedEvidence`.

Anything less returns the handle with `name: null`, which is a name, not a verified
merchant. `verifiedEvidence` (the case or reference a reviewer worked from) is **never
in this payload**: it is Seti's audit trail behind the badge. The response carries the
fact that a review exists and nothing about any account — no user, no wallet, no balance,
no other rows. Read-only: nothing here is writable, and the read is uncached, so a
withdrawn review (`verifiedAt` and `verifiedEvidence` cleared together) drops the name on
the next request.

## Referrals

An invite is one link and one row. The link is `seti.live/i/<handle>`; the row is
written when an account is **created**, never when a link is opened, so an open by a
stranger, a link unfurler or somebody reading a forwarded message attributes nobody.
One row per invitee, one invitee per row.

### `GET /referrals/invite/:handle`

**Unauthenticated on purpose.** A stranger following an invite has to be able to get
the code before signing in, or the link would ask them to sign up in order to be
invited.

```json
{ "code": "…" }
```

`code` is one opaque, signed string carrying the referrer's USER ID (not the handle,
which can be released and reissued) and its own expiry, so a forwarded link is not an
invite forever. Nothing about the account behind the handle is returned: no name, no
id, no count.

`{ "code": null }` is a normal answer, not an error. It is what an unknown handle, a
business name, a handle with no account behind it and a name that does not resolve all
get, and it is deliberately not a `404`: the page forwards to the app either way, and a
404 for an invitation is a stranger reading an error where they expected to be let in.

### `GET /referrals/me`

Requires a bearer token. What this account may know about its own invitations.

```json
{
  "handle": "ian",
  "link": "https://seti.live/i/ian",
  "count": 1,
  "joined": [{ "handle": "wanjiku", "joinedAt": "2026-10-21T09:12:00.000Z" }]
}
```

- `handle` and `link` are `null` for an account with no live username. Inviting
  requires a name, because the link has to point at something that exists.
- `joined` carries a handle (or `null` for an invitee who has not claimed a name yet)
  and the day they joined. No emails, no amounts, no other people's data.

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

The resolved `asset` is one that can fund `total` on this network. A preview that
cannot name one is refused with `422 { "code": "no-single-asset-covers" }`
**before anything is signed** — the `asset` you named cannot cover it while another
balance could, or no single balance can and only their sum does. `hasEnoughBalance:
false` is the different case, where the account cannot afford the amount at all and
the preview is still priced.

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

## Charges (receive, no account)

**Unauthenticated on purpose, and this is the point of the feature:** anyone with a
wallet can be paid without a Seti account. The credential is the recipient's EIP-712
signature over the charge — there is no API key, deliberately, because a key would
make Seti the custodian of the identifier.

The object is specified in `docs/internal/charge-object.md`; this section is how to
call it. Amounts are **decimal token units**, 6 decimals (`"250.000000"`), never a
number: a float is how an amount becomes a cent wrong.

### Signing a charge

EIP-712, domain `{ name: "Seti", version: "1", chainId }`, primary type `Charge`,
with exactly these seven fields (and nothing else — not `scope`, not `status`):

```
Charge { recipient, asset, amount, memo, id, expiresAt, nonce }
```

`id` is minted by the SIGNER (lower-case `[a-z0-9_-]`, 6–64 chars) and must appear
inside `memo`, because the id in the memo is what matches a transfer to the charge.
`expiresAt` is ISO-8601 and must be in the future. `scope` is reserved and unsigned.

### `POST /public/charges`

Body is the signed charge, plus an optional `webhookUrl` (not covered by the
signature in v1 — see `docs/internal/charge-api.md`).

```json
{
  "id": "ch_8f2c1a4e7b9d",
  "recipient": "0x8fad55b7c481bd76889fbf1eb719789f87db5113",
  "asset": "ousd",
  "amount": "250.000000",
  "memo": "October rent ch_8f2c1a4e7b9d",
  "expiresAt": "2026-10-23T12:00:00.000Z",
  "nonce": "9c1f…",
  "scope": null,
  "signature": "0x…",
  "webhookUrl": "https://shop.example/hooks/seti"
}
```

**`201`** with the charge, its `uri` (`seti://pay/<id>`, for a QR) and its `pageUrl`
(`https://seti.live/pay/<id>`, for a human):

```json
{
  "charge": {
    "id": "ch_8f2c1a4e7b9d",
    "status": "pending",
    "received": "0.000000",
    "txHash": null,
    "uri": "seti://pay/ch_8f2c1a4e7b9d",
    "pageUrl": "https://seti.live/pay/ch_8f2c1a4e7b9d",
    "statusCopy": { "label": "Awaiting payment", "headline": "…", "detail": "…" },
    "createdAt": "…", "updatedAt": "…", "settledAt": null, "cancelledAt": null,
    "network": "testnet", "chainId": 42431, "specVersion": "1"
  }
}
```

`Idempotency-Key: <opaque>` on create is honoured for **24 hours**. Sending the same
key twice returns **`200`** with the ORIGINAL body byte for byte (header
`idempotent-replay: true`); the same key with a different charge is `409
idempotency-key-reused`; after 24 hours the key may be reused.

Rate limits: **120 creates an hour per recipient address** (a merchant's hour) and
**20 a minute per source address** (a script's minute). Over either → `429` with
`code: "rate-limited"`.

### `GET /public/charges?recipient=0x…&limit=20`

A payee's OWN charges, newest first: `{ recipient, limit, count, charges }`, each row
the same `charge` object as below. This is the read an agent reconciling its invoices
needs, and it is the only call here that returns a SET.

A single charge is public by design — that is what a pay link is — but the set is not,
because `recipient` is a string anybody can type. So the listing is signed by the
payee, over a message that names the address and the page size:

```
ChargeList { recipient, limit, issuedAt, nonce }
```

```bash
curl "https://api.seti.live/public/charges?recipient=0xPayee…&limit=20" \
  -H "x-seti-signature: 0x…" \
  -H "x-seti-issued-at: 2026-10-22T12:00:00.000Z" \
  -H "x-seti-nonce: 6b2d…"
```

`limit` is 1 to 50 (default 20) and is part of the signed message, so a captured
header cannot be replayed to walk a different page size. Refusals: `403
charge-signature-invalid` (no signature, or one from another wallet), `403
charge-admin-stale` (issued more than 5 minutes from now), `422 recipient-invalid`
(the recipient is not an address), `429 rate-limited` (20 a minute per source). Rows
past their deadline are expired on read, exactly as `GET /public/charges/:id` does, so
a lapsed charge never comes back as `pending`.

### `GET /public/charges/:id`

The same `charge` object, one of `pending`, `paid`, `underpaid`, `overpaid`,
`expired`. Reading a charge past its deadline expires it on the spot, so the answer
does not depend on an indexer running. `404` for an unknown id; `422
charge-signature-invalid` when the STORED charge no longer verifies (a tampered link
is a refusal, not a dead link).

Two fields say whether the 2% was actually collected, separately from the status:

| Field | Meaning |
| --- | --- |
| `feeCollected` | `true` the fee reached the treasury, `false` it did not, `null` not decided yet (pending, cancelled, or a charge older than the column) |
| `feeUncollectedReason` | a code naming why not: `fee-not-observed`, `fee-inside-transfer`, `fee-leg-missing`, `fee-asset-mismatch`, `fee-short`, `fee-schedule-not-units` |

A `paid` charge with `feeCollected: false` is a real payment whose fee leg did not
arrive. The status stays `paid` on purpose: the money the payer sent to the
recipient is the payment, and the fee is a separate fact. See
`docs/internal/charge-api.md`.

### `POST /public/charges/:id/cancel`

Only from `pending`, and only by the recipient. The THREE headers carry a second
signature over a different message, so it cannot be replayed from a create
signature:

```
ChargeAdmin { chargeId, action: "cancel", issuedAt, nonce }
```

```
x-seti-signature: 0x…        # EIP-712 over ChargeAdmin, same domain
x-seti-issued-at: 2026-10-22T12:00:00.000Z
x-seti-nonce:     6b2d…
```

`issuedAt` must be within **5 minutes** of now (`403 charge-admin-stale` otherwise);
the signer must be the charge's `recipient` (`403 charge-signature-invalid`). A
cancel moves the charge to `expired` and sets `cancelledAt`; a second attempt is
`409 charge-not-pending`.

### `GET /public/charges/:id/deliveries`

The recipient's delivery log, read with the same three headers and `action:
"deliveries"`. One row per status change — attempts and backoff are columns, not
rows:

```json
{ "deliveries": [ { "event": "charge.paid", "state": "delivered", "attempts": 1,
                    "lastStatusCode": 200, "deliveredAt": "…" } ] }
```

### Webhooks

Sent to the charge's `webhookUrl` — or, when the charge declared none, to the
`webhookUrl` of the **merchant app** bound to its recipient — at most once per status
change, for `charge.paid`, `charge.underpaid` and `charge.expired`. `overpaid` is
delivered as `charge.paid` — money arrived at or above the ask — with `charge.status`
saying which.

```
POST https://shop.example/hooks/seti
X-Seti-Signature: t=1761130000,v1=<hex HMAC-SHA256>
X-Seti-Event: charge.paid
X-Seti-Delivery: <delivery id, stable across retries>
X-Seti-Charge: ch_8f2c1a4e7b9d
X-Seti-App: app_9f2c1a4e7b9d0e13
Content-Type: application/json
```

The signature is `HMAC-SHA256(<secret>, "<t>.<raw body>")`. Verify it against the
bytes you received, reject a `t` older than five minutes, and treat `X-Seti-Delivery`
as your dedupe key. Retries back off over roughly eight hours (1m, 5m, 15m, 1h, 6h)
and stop after six attempts; the row then says `failed` and the reason is visible in
the delivery log. `X-Seti-App` is present only when a merchant app signed the
delivery, and it is a label, not a credential.

**Which secret signs a delivery** (since #156):

| The charge's recipient... | Signed with |
| --- | --- |
| is the payout address of a live merchant app | that app's own secret, issued once when the app was created |
| is anything else — a bare address, a withdrawal, a charge older than the app | the deployment-wide `SETI_WEBHOOK_SECRET` |

So an app's secret verifies that app's events and nothing else, and a receiver on the
deployment key keeps working unchanged. Full guide, with the verification snippet:
`docs/receive.md`.

### Merchant apps (since #156)

An app record is a name, a website and a webhook URL, bound to the payout **address**
its charges are paid at, plus one secret Seti issues for it. Every route here needs
the caller's Privy **session**; the payout address also signs, with EIP-712 over
domain `{ name: "Seti", version: "1", chainId }`.

A merchant app is **not** an API credential. The app id is public and the secret
proves our webhooks are ours; neither can create a charge (that needs the recipient's
signature) and neither can move money.

#### `POST /merchant-apps`

Body: `{ name, payoutAddress, webhookUrl, website?, logoUrl?, issuedAt, nonce,
signature }`, where `signature` is over

```
MerchantApp { name, payoutAddress, webhookUrl, website, issuedAt, nonce }
```

Responds `201 { app, secret }`. **`secret` is returned here and nowhere else** — it is
`whsec_` plus 43 base64url characters, and every other response carries only
`secretHint` (its last four characters). `Cache-Control: no-store`.

Refusals: `merchant-app-signature-invalid`, `merchant-app-mismatch` (the signed and
submitted fields disagree, or the name is empty or over 64 characters),
`merchant-app-stale` (issuedAt more than five minutes from now, either direction),
`merchant-app-address-not-owned` (the payout address is not a wallet on the caller's
account), `merchant-app-webhook-invalid` (not https; `http://localhost` outside
production), `merchant-app-name-taken` (one name per account), `secret-box-unset`
(503 — the deployment has no `SETI_SECRET_BOX_KEY`, refused before any row is written).

```json
{
  "app": { "publicId": "app_9f2c1a4e7b9d0e13", "name": "…", "webhookUrl": "…",
           "payoutAddress": "0x…", "network": "testnet", "secretHint": "kQ7w",
           "secretIssuedAt": "2026-10-23T12:00:00.000Z", "secretRotations": 0,
           "bindingVerifies": true, "revokedAt": null, "createdAt": "…" },
  "secret": "whsec_…"
}
```

`bindingVerifies` is computed on every read: the stored signature is re-recovered
against the stored message, so a row edited by hand reports `false` and its secret
stops signing deliveries.

#### `GET /merchant-apps`, `GET /merchant-apps/:publicId`

The caller's apps on the network the session is served under, and one of them. No
secret in either; `404 merchant-app-not-found` for an id that does not exist **or is
not the caller's**, uniformly, so the answer never confirms another account's ids.

#### `POST /merchant-apps/:publicId/secret/rotate`

Body `{ issuedAt, nonce, signature }` over `MerchantAppAdmin { appId, action:
"rotate", issuedAt, nonce }`, signed by the app's payout address. Responds
`200 { app, secret }` with the NEW secret, shown once. The old one is dead the instant
this commits — one column write, so there is never a window with two live secrets —
and a **delivery attempted after the rotation verifies only against the new secret**.
`409 merchant-app-revoked` on a revoked app, `403 merchant-app-signature-invalid` from
any other address.

`POST /merchant-apps/:publicId/deliveries/:deliveryId/replay` re-sends one delivery
with a fresh timestamp and therefore a fresh signature; the body, delivery id and
event are the stored ones. `404 delivery-not-found` (not this app's),
`409 delivery-not-replayable` (already delivered, or its secret cannot be opened).

#### `POST /merchant-apps/:publicId/revoke`

Same body shape, `action: "revoke"`. The app signs nothing afterwards, its secret
cannot be read, and its delivery history stays. Charges are unaffected: a charge paid
to that address settles and is signed with the deployment-wide key again. This is the
rollback for a leaked secret that rotation alone does not satisfy.

#### `GET /merchant-apps/:publicId/deliveries`

`{ deliveries: [ { event, state, attempts, lastStatusCode, lastError,
nextAttemptAt, lastAttemptAt, deliveredAt, createdAt, updatedAt } ] }`, newest first,
scoped by the app whose secret signed each row — a merchant reads their own deliveries
and nobody else's.

### Refusals

Every refusal is `{ "error": "<one sentence>", "code": "<machine code>" }` and the
codes come from the shared taxonomy in `backend/src/services/payment-refusal.ts`.
Charge-specific ones: `charge-id-invalid`, `charge-id-taken`,
`idempotency-key-reused`, `charge-invalid`, `webhook-url-invalid`,
`charge-admin-stale`, `rate-limited`, plus the classifier's
`charge-signature-invalid`, `charge-expired`, `charge-not-pending`,
`recipient-mismatch`, `asset-mismatch`, `memo-missing-charge-id`,
`receipt-unavailable`, `amount-invalid`. Switch on `code`; `error` is for humans.

Merchant app ones (all listed beside the route above): `merchant-app-signature-invalid`,
`merchant-app-stale`, `merchant-app-mismatch`, `merchant-app-address-not-owned`,
`merchant-app-name-taken`, `merchant-app-webhook-invalid`, `merchant-app-not-found`,
`merchant-app-revoked`, `delivery-not-found`, `delivery-not-replayable`,
`secret-box-unset`.

## Arrivals (money with no charge)

### `GET /arrivals`

Money that reached the caller's own addresses with **no Seti charge behind it**.
Non-custody means a payer can always send straight to the address on the QR and
never open the charge page; the money is real, no charge was satisfied, and Seti
recorded no fee on it. This route is how the merchant sees that money instead of a
charge sitting `pending` forever with nothing said.

Scoped by the session, never by a query parameter: the addresses are resolved from
the account's own wallets and its live handle claims on the network the session is
served under.

```json
{
  "arrivals": [
    {
      "txHash": "0x…",
      "recipient": "0x8fad55b7c481bd76889fbf1eb719789f87db5113",
      "from": "0x2b1…",
      "asset": "ousd",
      "amount": "250.000000",
      "blockNumber": "4182231",
      "seenAt": "2026-10-23T09:14:02.000Z"
    }
  ],
  "hasMore": false,
  "summary": [{ "asset": "ousd", "count": 1, "amount": "250.000000" }],
  "copy": {
    "label": "No charge",
    "headline": "Money arrived with no Seti charge behind it",
    "detail": "A transfer reached your address that no Seti charge accounts for, so Seti recorded no fee on it. What the transfer was for is not something Seti can see."
  }
}
```

What a row deliberately does **not** have: a status, a charge id, or a fee verdict.
A transfer with no charge id in its memo cannot be told apart from an unrelated
transfer of the same amount to the same merchant, so attaching it to a charge would
be a guess — and a merchant told "paid" on that guess ships goods for somebody
else's money. A charge is `paid` only against a receipt the classifier accepted.

`limit` (1–50, default 20) and `offset` page the list; `summary` counts and values
the leak per asset, because one total across two tokens means nothing. The indexer
records these from a plain `Transfer` to an address Seti can prove belongs to a
merchant (a charge recipient, or a signed handle claim); a transaction a charge
already settled is refused as an arrival, so one payment is never counted twice.

This route is also the backstop for a charge payment whose wallet dropped the memo
argument. Seti's own transfer builder builds a charge payment as `transferWithMemo`
carrying the charge id and refuses to build one without it, but a wallet in someone
else's control can still leave the money here: visible to the merchant, attributed
to no charge, and never marked `paid`.

## Users

### `GET /users/:id`

Returns the user with their wallets. `403` if `:id` is not the authenticated user.

### `GET /users/:id/home`

The home card: one money figure, what that figure is made of, and the ten most
recent transactions. `403` if `:id` is not the authenticated user, `404` if the
user does not exist. Read on the **session's** network, never on one named in the
query or the body.

```json
{
  "balance": "129554.70",
  "currency": "KES",
  "assets": [
    { "asset": "usdt0", "symbol": "USDT0", "amount": "1000.0", "value": "129000.00" },
    { "asset": "ousd", "symbol": "OUSD", "amount": "4.3", "value": "554.70" },
    { "asset": "pathusd", "symbol": "pathUSD", "amount": "0.00", "value": "0.00" },
    { "asset": "usdc.e", "symbol": "USDC.e", "amount": "0.00", "value": "0.00" }
  ],
  "monthToDateDelta": 0,
  "recentTransactions": []
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `balance` | string, 2dp | the whole balance in `currency`. **The sum of every `assets[].value`**, not a second figure computed another way. |
| `currency` | string | the customer's own currency, `KES` in v1. Stated once, here, and implied for every `value`. |
| `assets` | array | what the balance is made of. One row per asset the network lists, and never an empty array. |
| `assets[].asset` | string | the label: `ousd`, `pathusd`, `usdt0`, `usdc.e` |
| `assets[].symbol` | string | the registry's spelling of that label: `OUSD`, `pathUSD`, `USDT0`, `USDC.e` |
| `assets[].amount` | string | the amount in the asset's own units, as the chain read reports it |
| `assets[].value` | string, 2dp | that amount in `currency`, at the same rate `balance` uses |
| `monthToDateDelta` | number | a fraction. Always `0` in the current build. |
| `recentTransactions` | array | the ten most recent, newest first, in the same row shape `GET /transactions` returns |

`monthToDateDelta` is a placeholder: the month-on-month comparison is not computed,
so the value is `0` rather than a stale figure. Do not render a trend from it yet.

#### One row per asset the NETWORK lists

The rows are the asset list of the chain the session is on, not the product's list
of supported assets, and the count is a property of the network rather than of the
customer:

| Network | Assets, in display order | Rows |
| --- | --- | --- |
| mainnet (chain 4217) | OUSD, pathUSD, USDT0, USDC.e | 4 |
| practice (chain 42431) | OUSD, pathUSD, USDC.e | 3 |

USDT0 is the difference. Tempo's registry does not list it on practice, so the
practice chain has no address for it and the payload does not claim one. Do not
assume four rows; render what arrives.

**Zeros are rows.** An asset the customer does not hold is still reported, with
`amount` and `value` at `0.00`. An account with no registered wallet yet gets one
row per listed asset, all zeros, and `balance` of `"0.00"`, never an empty array.
Rows come back largest `amount` first with the zeros last, and two equal balances keep
the display order above, so the ordering is predictable rather than incidental.

#### The sum rule

`balance` is the sum of the `value` strings that are in the same response, in one
currency at one rate. Three things follow, and none of them is optional:

1. **Every supported asset is 1:1 USD**, so the conversion is one multiplication
   by the rate on the same quote the pay screen uses. There is no per-asset price,
   and no second rate for the total.
2. **Each row is rounded to a cent first**, then the rows are added. That is why
   the figure on top can be reproduced by adding the breakdown under it. Adding
   the `amount` fields yourself and converting the total can land a cent away from
   `balance`, and `balance` is the correct one.
3. **A read that failed is `0.00`**, the same as a read that found nothing, so a
   zero row is not proof the customer holds none of that asset. `NaN` appears
   instead when a read returns something that is not a number; treat it as a fault
   to surface, never as zero, because counting it as zero hides real money.

Rows are reported, not converted. See
[Nothing converts a balance for you](./payments.md#nothing-converts-a-balance-for-you):
a balance that arrived as USDC.e stays USDC.e until the customer acts on it.

#### There is no separate balance route

`GET /users/:id/home` **is** the balance read. A `GET /users/:id/balance` used to be
documented here, with a sample response that set `"currency": "OUSD"` — `currency` is the
customer's fiat currency, and an asset is a different field. No such route is registered
in `backend/src/routes/users.ts`, so a request against it answers `404`; it was removed
from this reference and from the `docs/authentication.md` curl example rather than
implemented. The total and the breakdown arrive together, above; there is no second call
that reports only a number.

A balance is read from the chain; if the read fails the API reports `0.00` rather
than an error, so **do not treat `0.00` as proof of an empty wallet**.

## Wallets

### `GET /users/:id/wallets`

Lists the registered wallets for the user, as `{ wallets: [...] }`, scoped to the
session's network. A practice row and a live row are two addresses on two chains,
so a list read on one network says nothing about the other.

### `POST /users/:id/wallets`

Registers a wallet. Body: `{ chain?, asset?, address, keyId? }`. `chain` defaults
to `tempo`, `asset` defaults to the primary asset (OUSD today), and `keyId` is
optional and stored with the row. Answers `201 { wallet }`.

The address is validated on its **EIP-55 checksum**, not its shape: `viem.isAddress`,
whose acceptance set is exactly what a client's transfer encoder accepts. An
all-lowercase address is fine, because there is no checksum to be wrong. A mixed-case
address with a bad checksum is refused `400`, and the reason is the useful part: it
names the offending address, says the checksum failed, and offers the corrected form.

The row is registered on the **session's** network, and it becomes the account's
active wallet for that network: the previous active row on the same network stands
down, and the row on the other network is untouched.

#### If the account has no wallet row

An account can hold no wallet row at all, for instance a login that could not
register one or an account created before wallets were scoped per network. Every
balance then reads `0.00` per asset and the home rows are all zero, because there is
no address to ask the chain about. The repair is three calls, all of them the ones
above:

1. `GET /account` for the caller's own account. Each claimed handle carries the
   `address` it was claimed for, which is where the account's money arrives.
2. Make sure the address is one the customer's own wallet controls. Seti never
   creates or signs with a key, so a repair with an address the customer cannot sign
   for only moves the zero.
3. `POST /users/:id/wallets` with that `address`, and the home read reports that
   address's balances from the next request.

> Both wallet routes are declared as `/users/:id/wallets` inside a router that was
> once mounted under a `/wallets` prefix, producing `/wallets/users/:id/wallets`.
> The prefix was removed, so the paths above are correct. If you have code against
> the doubled path, it was relying on a bug.

## What is not here

No refunds, no payouts, no fiat off-ramp, no pagination cursors, and no OpenAPI
document. Webhooks, idempotency keys and rate limiting exist on the CHARGE path (above);
merchant apps and their webhook secrets are #156, and are documented here. There is no
**scoped charge-signing key** — a key that could create charges without a wallet in the
loop needs its own design — and no OAuth, because with no custody there is nothing for
an authorization server to grant. The MCP tools are #132. This reference is maintained
by hand against
`backend/src/routes/` — if it disagrees with the code, **the code is right**.

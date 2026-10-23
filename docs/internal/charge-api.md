# The charge API — how receive works, and what is still open

**Status:** shipped in #131. The object and the classifier are `backend/src/services/charge.ts`
(spec: `docs/internal/charge-object.md`); this document is about the SURFACES that render
it — the four routes, persistence, the webhook, and the match that flips a charge to paid.

**In one sentence:** a wallet signs a request for money, `POST /public/charges` stores it
with no Seti account involved, a transfer carrying the charge id in its TIP-20 memo makes
the existing classifier call it paid, and exactly one signed webhook tells the recipient.

## The files, and what each owns

| File | Owns |
| --- | --- |
| `services/charge.ts` | The object, the signed payload, the statuses, the classifier. **No I/O.** |
| `services/charge-store.ts` | The only place a charge row is written. Idempotency, transitions, expiry. |
| `services/charge-webhook.ts` | Signing, delivery, retries, the delivery log. |
| `services/charge-match.ts` | Turns observed transfers into decided charges. Thin on purpose. |
| `services/charge-admin.ts` | The `ChargeAdmin` signature that authorises cancel and the log read. |
| `routes/public-charges.ts` | HTTP: shapes, refusals, rate limits. No rules. |
| `prisma/migrations/20261022174848_charge_api` | Two tables and one enum. Additive. |

## No account, and that is the whole point

There is no API key on the receive path (issue #131's non-goals say so explicitly): a key
would make Seti the custodian of the identifier, which is the thing the send path already
avoids. The recipient's EIP-712 signature over the charge is the credential, verified by
`chargeVerifies` **before any row is written**, and re-verified from the stored bytes on
every read. There is no stored `verified` flag for a database write to flip.

Two consequences worth stating:

- `Charge` has no `userId`. A charge is not owned by an account, and adding one later
  would create a second, weaker answer to "who may manage this?".
- Cancelling and reading the delivery log use a SECOND signature (`ChargeAdmin { chargeId,
  action, issuedAt, nonce }`, same domain, ±5 minutes) because the create signature sits in
  the charge and is public to anyone holding the link. The used-nonce table that would make
  the admin signature strictly single-use is deliberately absent — cancel is already
  idempotent by state and the other action is a read. **A new state-changing admin action
  needs that table; this paragraph is where to start.**

## Idempotency, precisely

`Idempotency-Key` is stored as a SHA-256 scoped to the recipient, honoured for 24 hours.
The RESPONSE IS STORED (`Charge.responseBody`, as TEXT, not JSONB) and replayed byte for
byte — `jsonb` does not preserve key order, and "the same key returns the original body" is
a promise about bytes a client may hash. Same key + different signature (or a different
webhook URL) is `409 idempotency-key-reused`; the request digest is the signature itself,
since EIP-712 covers every signed field. After 24h the old row's key is RELEASED, not
deleted: the charge is real, only its key expires.

## Why the id must be lower-case

The classifier matches with a case-SENSITIVE `memo.includes(id)`. An id minted with capitals
could never be matched by a payer who typed what the page showed. `CHARGE_ID_PATTERN`
(`^[a-z0-9][a-z0-9_-]{5,63}$`) is enforced at create and mirrored in the web's
`charge.constants.ts`, so an id the API accepts is an id the page opens.

## How a transfer becomes a `paid` charge

TIP-20 carries a 32-byte memo (`transferWithMemo`), emitted as
`TransferWithMemo(from, to, amount, memo)`. The indexer's `scanWindow` already reads the
window's logs per token contract; it now ALSO asks for memo transfers **sent to the pending
charge recipients** (an RPC `to` filter, so this is a narrow query, not a network-wide
scan), and hands them to `matchChargeTransfers`.

That function does three things and nothing more: narrow by (recipient, asset) in SQL; skip
transfers whose memo does not mention the charge id; ask `classifyCharge`. Everything about
payee, token, memo, the 1% tolerance and confirmation stays in the classifier — one
definition of `paid`, and `npm run check:charge` pins it at the boundary.

The memo arrives as `bytes32`, so it is decoded as UTF-8 with the zero padding stripped
(`memoFromBytes32`). A plain `Transfer` has no memo at all and can never settle a charge —
correct rather than unfortunate: an anonymous transfer to a merchant's address is not this
charge's money.

**That money is recorded, not ignored.** A transfer to a charge's recipient that no charge
settled is filed as an arrival (`services/arrival.ts`, `GET /arrivals`) and read by the
merchant as money with no charge behind it: no status, no charge id, no fee verdict, and
never the word `paid`. Two paths produce it, and the second is the one #184 is about:

- a payer who deliberately paid straight to the address without opening the page, and
- a payer who used the page and whose wallet built a plain `transfer` anyway.

The page's own builder can no longer produce the second. `web/lib/pay/build-transfer.ts`
takes a `PaymentReference`, and `{ kind: 'charge' }` builds the principal as
`transferWithMemo(recipient, amount, bytes32(chargeId))`; a charge payment with no
reference, a blank id, or an id that cannot fit 32 bytes is refused before the wallet sees
anything (`ChargeMemoUnavailableError`). `npm run check:memo-always` decodes the calldata,
reads the id back through this file's own `memoFromBytes32`, and fails if the memo argument
is dropped. A third-party wallet is not ours to fix, which is why the arrival is the
backstop rather than an alternative.

**The status write is a conditional UPDATE** (`WHERE status = 'pending'`). Two indexer
replicas, a replayed transfer and a racing cancel cannot each move the charge; the loser
sees `count = 0` and reports nothing. Nothing here holds funds, so "the money arrived" is a
conclusion the transfer already made.

## The fee leg is a second fact, not a condition on `paid`

The 2% rides in the same atomic batch as the principal: one transaction, two transfers,
the fee to `SETI_TREASURY_ADDRESS`. The reconciliation used to compare only the principal
against 1%, so a transfer carrying the principal and NOT the fee produced exactly the same
decision as one carrying both. A fee Seti claims to collect could be missing with nothing
anywhere saying so.

Two questions, two answers:

- **Is the charge paid?** `classifyCharge`'s `status`, unchanged: recipient, asset, memo,
  confirmation, and the amount within 1%.
- **Did we get paid?** `decision.fee`, from `classifyFeeLeg`: the expectation is
  `merchantFeeUnits(charge amount, schedule)` — 2% of the SIGNED amount, integer arithmetic,
  floored — compared with the transfers to the treasury in that same receipt.

The fee comparison has **no** tolerance, and the asymmetry is deliberate. The principal's
1% absorbs a payer whose client rounded the figure they were shown: both sides of that
comparison came from outside Seti. The fee's expectation is exact arithmetic over the
charge's own signed amount, so a tolerance there would mean reporting a fee as collected
while being up to 1% short of it — the same defect, smaller. One base unit short is short;
over-payment is `excessUnits`, not a failure.

Nothing about the fee moves the status. A paid charge with an uncollected fee is `paid` and
the fee fact is recorded beside it:

| Column | Meaning |
| --- | --- |
| `charges.feeCollected` | `true` collected, `false` not, `NULL` not decided (pending, cancelled, or a row older than the column) |
| `charges.feeUncollectedReason` | one of `fee-not-observed`, `fee-inside-transfer`, `fee-leg-missing`, `fee-asset-mismatch`, `fee-short`, `fee-schedule-not-units` |

Both are written on the same conditional UPDATE as the status, so a charge can never carry a
fee verdict from a different transfer, and both are exposed on the charge read
(`GET /public/charges/:id`) so a receipt or a support tool can show them apart from `paid`.

`inside-transfer` mode is never collected by definition: the fee rides inside the transfer
to the recipient, so the recipient was paid it. That is the same reason a send to a person
is refused while the server is in that mode.

`npm run check:charge` pins the arithmetic (`npm run check:charge-fee` pins the receipt
decode: which log is a fee leg, and that a receipt without one yields uncollected).

## Exactly one webhook per status change

`ChargeWebhookDelivery` has a UNIQUE `(chargeId, status)`. That is the rule, expressed where
it cannot be bypassed. On top of it:

- the first attempt is awaited inside the transition, so a merchant watching their endpoint
  during onboarding sees the POST immediately;
- attempts and backoff are COLUMNS on the one row (1m, 5m, 15m, 1h, 6h; six attempts), so the
  delivery log says "delivered after 3 attempts" rather than growing rows;
- `attempts` is the CLAIM: two processes that pick up the same due row race on
  `UPDATE … WHERE attempts = <what I read>`, so a retry cannot become two POSTs, and a
  `sending` row abandoned by a crash is reclaimed after five minutes;
- `overpaid` is delivered as `charge.paid` (money arrived at or above the ask) with
  `charge.status` saying which — a merchant should not need a fourth event to learn that.

Signature: `X-Seti-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. The timestamp
is inside the signed string, so a captured header cannot be replayed against another instant.
A `3xx` is a failure, never followed: an endpoint that redirects is misconfigured, or is
pointing somewhere that should not be reachable from inside the network.

## THE SEAM: one shared webhook secret

**`SETI_WEBHOOK_SECRET` is ONE deployment-wide key.** Per-merchant app records, per-app
secrets and scoped signing keys are **#156**, and a charge has no account to attach a secret
to anyway. Everything that changes when #156 lands is behind two functions —
`webhookSecret()` (where the key comes from) and `buildWebhookPayload()` (what is signed) —
in `services/charge-webhook.ts`. Nothing else in the codebase reads the secret or signs a
body.

Unset is NOT a boot failure, and that is a decision: the charge API is useful without
notification, and refusing to start would take the whole receive path down for a webhook it
does not owe. Instead nothing is sent, each delivery row is `failed` with
`lastError: "webhook-signing-secret-unset"` (which the recipient reads in their own delivery
log), and the process logs one warning.

## The web page

`web/lib/charges/load-charge.ts` is the seam, and since #131 its default source is
`web/lib/charges/charge-source.ts`, which reads `GET /public/charges/:id`. The fixture
(`charge.fixture.ts`) is now a TEST DOUBLE reached only through an injected `deps.source` by
`npm run check:pay-charge` — structurally unreachable from a deployed build, which is
stronger than the `NODE_ENV` flag it replaces.

The page does not verify the signature: the backend does, and answers `422
charge-signature-invalid`, which the loader maps to its refusal state (`invalid`), NOT to a
404. "There is nothing here" is an untrue statement about a request that exists.

**Who the recipient IS comes from a second read (#197).** A charge names an address, so the
page resolves the payee through `GET /public/payees/:address`
(`backend/src/services/payee-directory.ts`), not through a handle. It returns a name only when
a live claim is bound to that exact address, the claim's signature still verifies, and the
merchant record carries `verifiedAt` together with `verifiedEvidence`; otherwise the page draws
`@handle` or the address in its unverified tier. `verifiedEvidence` never leaves the server.
Before this read existed the directory answered `null` for every address, so the verified tier
shipped in #154 was unreachable in production and the unverified tier was the only state.

**Amounts on the page are in `USD` (the token's unit), not KES.** The charge carries no fiat
figure and the signature covers token units; converting in the web app would price a payment
with a rate nobody signed. When a charge is denominated in KES the figure has to arrive ON
the charge.

## Rate limits

120 creates an hour **per recipient address** (a merchant who invoices all day) and 20 a
minute **per source address** (a script). In-memory, process-local (`lib/rate-limit.ts`),
so they are a per-instance courtesy cap rather than a global one — the honest limit for a
single unauthenticated write path that creates rows. Reads are capped per source too,
because the pay page reads through the same API. A global cap and a distributed store are
the follow-up if receive traffic makes a per-instance limit insufficient.

## What is NOT here (on purpose)

- No card or bank rails, no custody, no balance, no escrow, no payout state.
- No fee-collection flag on a charge (#151).
- No merchant app records, per-app webhook secrets, or scoped signing keys (#156).
- No refunds. `underpaid` is terminal; topping up is a second charge.
- No MCP tools (#132) — they render this API.
- No receipt for a charge: Seti holds nothing and issues none.

## Open questions for a human

1. **`webhookUrl` is outside the signature.** v1's signed set is frozen (adding a field is a
   spec version bump and touches four surfaces), so the URL is declared at create and never
   updated. Someone who posts a charge link elsewhere could register their own endpoint and
   receive status notifications for a charge they do not control. The exposure is a status,
   an amount and a txHash — no funds, no ability to pay or cancel. Binding the endpoint (the
   `scope` field plus a second signature) is the follow-up, and the objection is in
   `docs/internal/charge-object.md` §"Why `scope` is present and unsigned".
2. **There is no `cancelled` status.** A recipient's cancel moves the charge to `expired`
   and sets `cancelledAt`; the API response distinguishes them, the page's copy does not.
   Adding a status is a spec v2 change (enum + transition table + copy + the web's status
   union), and it was not worth reopening a frozen contract for #131.
3. **`SETI_WEBHOOK_SECRET` should probably be a production boot requirement** once a real
   merchant depends on webhooks. It is not today, because refusing to boot would break the
   deploy the moment this merges, before an operator has had a chance to set it.
4. **The per-instance rate limiter is not a global cap.** Two API replicas each allow 120 an
   hour per address. If receive traffic grows, the limiter needs a store.
5. **An address with no pending charge is not scanned for as a charge**, and a charge payment
   needs the id in the memo. Our own page's builder now always writes it (#184): it cannot
   build a charge payment without a memo, and refuses rather than send a plain `transfer`.
   A payer in somebody else's wallet that cannot set a TIP-20 memo still cannot pay a charge
   that way; the page shows the address and the reference, and their plain transfer lands as
   an arrival (`GET /arrivals`) with no charge attached.

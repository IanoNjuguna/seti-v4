# The charge object — spec v1

**Status:** frozen contract, no surface yet. The type, the canonical signing payload
and the classifier live in `backend/src/services/charge.ts`; the boundary fixtures are
`backend/src/services/charge.check.ts` (`npm run check:charge`).

**This document is versioned.** `v1` here, `CHARGE_SPEC_VERSION = '1'` in the module.
The version moves when the signed field set, the status enum or a classification rule
changes — i.e. when a stored signature or a stored row would mean something different.

## Why this exists before a page does

Seti's surfaces are payer-side: a merchant with an account scans a QR and is paid.
Nothing lets a stranger on the internet **be paid**. Three representations are coming —
a hosted page, a public API, an MCP tool — and each one that carries its own copy of
"what a charge is" and "when is it paid" ships its own slightly different idea of
`paid`. Discovered by a customer, not by us.

So the object is frozen first. No HTTP route, no webhook, no persistence, no Prisma
model in this change: #131 owns those, and they render what this decides.

## The object

| Field | Signed | Type | Meaning |
| --- | --- | --- | --- |
| `id` | **yes** | string | The charge's identity. Also the string `memo` carries. |
| `recipient` | **yes** | address | The payee. The only authority on where money goes. |
| `asset` | **yes** | string | Seti ledger label (`ousd`), not a token address. |
| `amount` | **yes** | string | Amount owed in token units, 6 decimals (`"250.000000"`). |
| `memo` | **yes** | string | Payer-visible text, and the field that carries `id`. |
| `expiresAt` | **yes** | string | ISO 8601. Past it the charge is inert. Default 24h. |
| `nonce` | **yes** | string | Single-use value: two charges never share a signature. |
| `scope` | no | string \| null | **Reserved and unsigned in v1.** See below. |
| `signature` | — | string | EIP-712 signature by `recipient`. |
| `status` | no | enum | `pending` \| `paid` \| `underpaid` \| `overpaid` \| `expired`. |
| `txHash` | no | string \| null | The transfer that settled it, once one has. |

`amount` is a **decimal string, never a number**: token units are 6 decimals, the ledger
stores decimal strings, and a float is how an amount becomes a cent wrong. A `uint256`
of base units was rejected because every surface in this product shows decimals and a
silent 1e6 error is the classic failure of that shape.

## The canonical signing payload

EIP-712, domain `{ name: "Seti", version: "1", chainId }`, primary type `Charge`:

```
Charge {
  recipient, asset, amount, memo, id, expiresAt, nonce
}
```

Exactly those seven. **No other field is signed** — not `scope`, not `signature`, not
`status`, not `txHash`. `chargeSigningPayload()` is the single producer of that message
and `CHARGE_SIGNED_FIELDS` is the single list of it; the check asserts the payload's
keys, the struct's declared fields and that tuple against each other, so a field added
to one and not the others fails the gate rather than reaching four surfaces.

**On field order.** EIP-712 hashes a struct's fields sorted **by name**
(`amount, asset, expiresAt, id, memo, nonce, recipient`), so the *declaration* order is
not what the digest depends on — the field **set** and each field's **type** are. The
check proves this: re-inserting the payload's keys in reverse produces the same digest,
and a field present in the message but absent from the types is not signed at all.
Order is still written down, in the issue's order, because it is the order a wallet
displays, an API returns and a log prints; that order is asserted too.

Two implementations can only disagree about a charge signature by disagreeing about
(a) the field set, (b) a field's type, or (c) the domain — which is why all three are
pinned here and asserted in `check:charge`.

## Why `scope` is present and unsigned

`scope` is the URL or route the charge is for: `GET /v1/report`,
`https://shop.example/checkout`. It exists now so the machine-payment adapter (HTTP 402,
MPP, x402) does not reopen this schema after three surfaces render the object, and it
stays outside the signature until there is a reason to bind it.

A field that is present and ignored costs nothing; a field added after three surfaces
render the object costs three migrations. When it does get signed the reason will be
narrow: a 402 `Challenge` is authenticated by the server's own URL and HMAC, while our
charge is authenticated by the payee's wallet. Bridging them means proving the merchant
controls the endpoint — that is `scope` plus one signature, not a new object.

## Statuses

```
pending ──▶ paid
        ├─▶ underpaid
        ├─▶ overpaid
        └─▶ expired
```

`pending` is the only state with outgoing edges; **nothing leaves a terminal state**.
A second transfer against a paid charge is a new charge, not a paid charge becoming
overpaid — the classifier refuses with `charge-not-pending`.

No `paid_out` and no refund state: Seti never holds the funds, so "the money reached the
merchant" is the same event as "the customer paid". No partial fills: `underpaid` is
terminal, and topping up is a second charge.

The customer-facing wording for all five lives in one place — `CHARGE_STATUS_COPY` — so
a page, an API response and an MCP tool cannot each invent their own sentence for
`underpaid`. The API sends the words; nothing else writes them.

## The classifier

`classifyCharge({ charge, transfer, chainId, now })` → the next status, or a refusal
code. No chain read, no database, no user, no clock of its own. Gates, in order:

1. **Undecided?** A terminal charge refuses (`charge-not-pending`).
2. **Signature verifies?** Otherwise `charge-signature-invalid` — nothing about a forged
   charge is worth classifying.
3. **Live?** Past `expiresAt`, or an expiry that cannot be read, refuses
   (`charge-expired`).
4. **Confirmed?** An unmined transfer decides nothing (`receipt-unavailable`).
5. **Right payee, right token?** `recipient-mismatch`, then `asset-mismatch`.
6. **Memo carries the id?** Otherwise `memo-missing-charge-id` — a TIP-20 transfer has no
   other identifier, so without it a reused link cannot be told from an unrelated
   transfer.
7. **How much, against 1%?** Within tolerance is `paid`; outside is `underpaid` or
   `overpaid`.

Refusals are **codes**, and they live in the one taxonomy
(`backend/src/services/payment-refusal.ts`), not a second vocabulary: a surface that
already renders a refusal code renders these too.

### The 1% tolerance

The same figure and the same direction `recordPayment` already applies:

```
|observed − charge.amount| > charge.amount × 1%   →  mismatch
```

- It is 1% **of the charge's amount**, not of what arrived, so the boundary does not move
  with the payment.
- The comparison is `>`, not `>=`: **exactly 1% under is accepted**, exactly 1% over is
  accepted.
- The arithmetic is done in **integer token units** at 6 decimals, with the tolerance
  floored to whole units. That makes the boundary exactly representable (so a fixture can
  assert it) and can only make the tolerance a hair *tighter* than 1%, never looser.
  Float subtraction puts the cent boundary at the mercy of binary rounding.

Fixtures at the boundary, in `check:charge` against a 100.000000 charge: `100.000000`
paid, `99.000000` (exactly 1% under) paid, `98.990000` (1.01% under) underpaid,
`101.000000` (exactly 1% over) paid, `101.010000` (1.01% over) overpaid, `0.000000`
underpaid — plus the same boundary at a 1.000000 charge, to prove it scales.

## Not in this document

- **#131** — the hosted page, the public API and the MCP tool, persistence, the webhook.
  Persistence is not required for the classifier to work; the module is pure TypeScript
  plus fixtures by design.
- **#151** — the fee-collection flag. A charge does not carry or collect a fee in v1.

## Open questions for a human

1. **Smart-account payees.** `chargeVerifies` uses viem's `verifyTypedData` with no
   `publicClient`, which covers ECDSA (EOA / embedded-wallet) signatures only. A payee
   whose address is a contract account (EIP-1271/6492) would be refused as
   `charge-signature-invalid`. Supporting one means the verification path needs a chain
   client — which stops it being pure. Decide when a merchant actually wants to receive
   at a smart account, before a page ships.
2. **Refusal copy for the six new codes** is not in `web/lib/api/refusal.constants.ts`
   yet. Nothing can emit them (no route exists), and that file's fallback is calm and
   safe, so the copy lands with #131 where the codes can first be rendered.
3. **`memo` matching is a case-sensitive substring** of the transfer's memo. That is
   deliberate (widening it to case-insensitive weakens matchability), but it presumes ids
   are emitted lower-case — worth stating wherever ids are minted in #131.

## Risk and rollback

The signature payload is the contract. A mistake here is a charge that cannot be paid,
not a wrong balance: settlement is still a transfer straight to the recipient, and the
on-chain receipt stays the authority.

Rollback: nothing depends on it yet. The type, the constants and the classifier drop out
without touching send, convert, settle or savings. No data migrates, because there is no
data.

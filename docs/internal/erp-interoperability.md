# ERP interoperability: what makes Seti usable inside a finance system

**Status:** scoping document, no code. Rough estimate: three of the seven items are
days, two are a week, one is three weeks. Written against `backend/src` as it stands
on the date below; re-read the referenced files before starting any of it.

Why this matters is in [product-model.md](./product-model.md): the payment run is the
sticky seat, because the bills, the approvals and the supplier list live in the
finance system and nothing gets removed from a payment run.

## What already exists and maps cleanly

Do not rebuild any of this.

| Capability | Where | Note |
| --- | --- | --- |
| Invoice-shaped object | `services/charge-store.ts`, `Charge` model | recipient-signed, `publicId`, `amount`, `memo`, `expiresAt`, `nonce`, `status` |
| Settlement evidence | `services/charge-match.ts` | `matchChargeTransfers`, `feeLegsFromReceipt`, `sweepExpiredCharges` |
| Idempotency | `services/charge-store.ts` | key hashed with sha256, unique on `(recipient, idempotencyKey)`, `CHARGE_IDEMPOTENCY_TTL_MS` is 24h, replay detection |
| Idempotency transport | `routes/public-charges.ts` | `idempotency-key` header, 200 character cap |
| Webhooks | `services/charge-webhook.ts` | `charge.paid`, `charge.underpaid`, `charge.expired`; HMAC signature; claim by `attempts`; six tries over roughly eight hours |
| Statement export | `services/statement-model.ts`, `statement-csv.ts`, `statement-xlsx.ts`, `statement-pdf.ts` | `csv`, `xlsx`, `pdf`, built on `StatementRow` |
| Per-app webhook secrets | `routes/merchant-apps.ts` | already used to sign deliveries |

What is missing is not engine. It is the vocabulary an accountant needs and the two
file formats a finance system eats.

## The seven surfaces

### 1. External reference on every money object

The ERP's document number, not ours. Today `memo` carries `publicId`, which is Seti's
identifier, so nothing in a finance system can join on it.

- `Charge.externalRef String?` with `@@index([recipient, externalRef])`
- the same field on outbound payment and payout records
- accepted in `POST /public/charges`, echoed in every webhook and statement row

Rules: max 64 characters, never signed, never authority, a label like `asset`. Not
globally unique, two merchants may use the same invoice number; uniqueness per
recipient only when the merchant asks for it.

### 2. camt.053 export

The highest-leverage item here. `camt.053` is the ISO 20022 bank statement and the
format mid-market ERPs import as a bank feed. Ship it and Seti looks like a bank
account to Odoo, NetSuite and Sage without being one.

- add `'camt053'` to `StatementFormat` in `services/statement-model.ts`
- new `services/statement-camt053.ts` rendering the same `StatementRow[]` the other
  three renderers already consume
- `msgId`, `creDtTm`, `stmt/id`, `acct/id` (the merchant's public handle), opening and
  closing `bal`, one `ntry` per row with `Amt`, `CdtDbtInd`, `BookgDt`, `ValDt`,
  `NtryDtls/TxDtls/Refs/AcctSvcrRef` (tx hash) and `Ustrd` (externalRef)
- six-decimal amounts through the existing `dataAmount`

Acceptance: validates against the published camt.053.001.08 XSD, and an Odoo import
of a real statement produces zero unmatched lines.

### 3. Statement line API and matching

What an accountant does all day is match lines to documents. Give them the verbs.

```
GET  /v1/accounts/:handle/statement?from&to&format=camt053|json
GET  /v1/accounts/:handle/unmatched
POST /v1/lines/:id/match      { externalRef, allowPartial: true }
POST /v1/lines/:id/unmatch
```

A line needs direction, amount, asset, value date, booking date, counterparty
(address and handle when known), tx hash, `externalRef`, `matchedRef` and `residual`.

Rules: a bill may be paid by many transfers and a transfer may cover many bills; a
match stores the residual and never rewrites the line amount; unmatched is a
first-class list, not an error state; tolerance is per merchant, default exact.

### 4. pain.001 in, pain.002 back

Only for the corporate end, and it comes after camt.053.

- `POST /v1/payment-files` accepts `pain.001.001.09`, validates against the XSD,
  resolves each `CdtTrfTxInf` to a recipient (address or handle), and creates a batch
  with one instruction per line
- the file's `MsgId`, each `PmtInfId` and each `EndToEndId` become the idempotency key
  and external reference, so a re-sent file cannot double-pay
- the response is `pain.002`: accepted, partially accepted, rejected, with a
  per-transaction reason mapped from the existing codes in `services/payment-refusal.ts`

Do not invent reason codes. Map the existing taxonomy to ISO `RjctRsn/Cd`.

### 5. Seats, roles, maker-checker

The instruction exists because a human approved a bill. Be able to prove it.

- roles: `owner`, `approver`, `operator`, `accountant` (read-only, and does not
  consume a paid seat, which is what inzi does and it is the right call)
- a payment run above a threshold needs a second signer
- every approval, match and file upload writes to `services/audit.ts` with actor,
  timestamp and instruction id

### 6. Quote pinning

`services/convert.ts` already quotes. Bind the quote to the instruction.

- `quoteId` on the instruction, `quoteExpiresAt` enforced at execution
- store `instructedAmount`, `instructedAsset`, `executedAmount`, `executedAsset` and
  the rate used
- an ERP books the instructed figure; the executed figure has to be visible beside
  it or the reconciliation is a lie

### 7. Journal export

One net line per payment is useless to a bookkeeper. Export the legs.

- settlement leg, platform fee leg, gas leg, each with its own account code
- per-merchant mapping: `settlementAccount`, `feeAccount`, `gasAccount`
- `GET /v1/journal?from&to&format=csv` keyed on the same rows as the statement

## Data model delta

```prisma
model Charge {
  // existing fields unchanged
  externalRef   String?
  quoteId       String?
  approvedBy    String?
  approvedAt    DateTime?
  @@index([recipient, externalRef])
}

model StatementLine {
  id            String   @id @default(cuid())
  merchant      String
  direction     String   // in | out
  asset         String
  amount        String   // decimal token units, as everywhere else
  txHash        String
  valueDate     DateTime
  bookingDate   DateTime
  counterparty  String?
  externalRef   String?
  matchedRef    String?
  residual      String   @default("0.000000")
  createdAt     DateTime @default(now())
  @@index([merchant, valueDate])
  @@index([merchant, matchedRef])
}

model MerchantAccountMap {
  merchant           String @id
  settlementAccount  String
  feeAccount         String
  gasAccount         String
}
```

`StatementLine` is derived from the same read path the CSV renderer uses, never a
second source of truth. If it disagrees with the chain, the chain wins, the same rule
`Charge.received` follows.

## Build order and effort

| # | Item | Effort | Unblocks |
| --- | --- | --- | --- |
| 1 | `externalRef` on charges and payments | 1 to 2 days | every reconciliation below |
| 2 | match and unmatch endpoints, unmatched list | 2 to 3 days | accountants on CSV |
| 3 | camt.053 renderer plus XSD test | about a week | Odoo, NetSuite, Sage as bank feeds |
| 4 | seats, roles, maker-checker | about a week, touches schema | finance teams, any payment run |
| 5 | quote pinning, instructed versus executed | 2 to 3 days | FX honesty in the ledger |
| 6 | journal export with account mapping | 3 to 4 days | bookkeeping, month end |
| 7 | pain.001 and pain.002 | about three weeks | corporates only, defer |

The first real connector after that: an Odoo addon registering a Seti journal and
payment method, posting on webhook. Odoo is open source and common among East African
distributors, and one working connector sells the format to everyone else.

## Two traps

**Partial payment.** Every matcher written naively assumes one bill, one payment. A
250 charge paid as 100 then 150 breaks it, and the accountant blames the product. The
line model has to allow many-to-one with tolerance and residual from the first commit.

**Idempotency across a re-run.** `CHARGE_IDEMPOTENCY_TTL_MS` is 24 hours. An ERP that
times out on a batch resends the same file, sometimes the next morning. Either make
the TTL per instruction type or make file-derived keys permanent. A duplicate supplier
payment is the one failure that ends the relationship.

## What this does not do

None of it requires a licence, because none of it touches fiat and none of it takes a
percentage of the payment. That property is fragile and worth protecting:

- no KES conversion inside the product
- no merchant balance held by Seti
- the platform fee stays a software charge, not a cut of the transfer

The moment an ERP user asks for the supplier paid in shillings, the answer is a
licensed partner or the CBK application, not a feature branch.

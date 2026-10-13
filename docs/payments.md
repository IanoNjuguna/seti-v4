---
sidebar_position: 3
---

# Payments

A Seti payment is one signed ERC-20 transfer. The interesting parts are the
**units**, the **fee semantics**, and the fact that the server verifies what
happened on-chain rather than trusting what you tell it.

## The flow

```
1. GET  /merchants/resolve?qr=…            → merchant + optional suggested amount
2. POST /transactions/preview              → fee, FX, and the GROSS to sign for
3. sign + broadcast the transfer locally   → txHash   (your wallet, not Seti)
4. POST /transactions/pay                  → server verifies txHash on-chain, records it
5. GET  /transactions/:id/status           → poll until completed / failed
```

## Units — the part that bites

**The preview request amount is in the customer's own currency, not in stablecoin
units.** The field is `amountFiat`: (KES is the only currency enabled in v1, so it
is KES today — the field is named for the unit, not for one currency.)

```bash
curl -s -X POST http://localhost:4000/transactions/preview \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"merchantId":"merchant_java_house","amountFiat":"250","asset":"ousd"}'
```

Every *response* field, by contrast, is in stablecoin units except the ones named
`*Fiat`, which are in the customer's currency (`fiatCurrency` says which):

| Field | Unit | Meaning |
| --- | --- | --- |
| `amount` | asset | principal — what the merchant receives; the batch's merchant leg |
| `feeFiat` | fiat | the platform fee |
| `total` | asset | **the gross you must sign for** (principal + fee + network) |
| `fiatAmount` | fiat | the principal — echo of `amountFiat` |
| `networkFeeFiat`, `totalFiat` | fiat | gas, and principal + fee + gas |
| `fxRate`, `fxRateSource`, `fxRateStale` | — | units of `fiatCurrency` per USD, its provenance, and whether it is stale |
| `feeInAsset` | asset | the fee as a transferable amount; `0` in inside-transfer mode |
| `feeRoutingMode` | — | `inside-transfer` or `batch` — decided by the server, never by you |
| `hasEnoughBalance` | — | measured against `total`, not `amount` |

Sign `total`. Signing `amount` underpays the merchant by the fee and the server
will reject it as an amount mismatch — which is the intended failure.

## Fee semantics

The fee is **attributed to the merchant but funded by the customer**: the customer
signs `principal + fee`, and the merchant receives exactly the principal.

- Schedule: a flat **2%**, with the floor and cap at `0` (`backend/src/services/fees.ts`).
- It is **fee-inclusive**, so the server inverts from the gross rather than
  recomputing from a schedule: `fee = gross - principal`.
- The published figure is "merchants pay 2%". What that means in practice is that
  2% is *attributed* to the merchant and *paid* by the customer. Both statements
  are in `README.md`; do not publish one without the other.

### The default mode does not collect the fee

With `FEE_ROUTING_MODE=inside-transfer` (the default), the single transfer goes to
the merchant for the **whole gross**, so Seti retains nothing. `batch` mode signs
two legs atomically — principal to the merchant, fee to the treasury — and the
server then requires **both** transfers in the receipt.

Read `feeRoutingMode` from the preview and sign accordingly; do not assume one.

## What the server does with your `txHash`

`POST /transactions/pay` treats your amount as a **claim**, not a measurement:

1. It fetches the receipt and decodes the ERC-20 `Transfer` log filtered to the
   expected token **and** the expected recipient.
2. It **fails closed** on: no receipt, a reverted transaction, no matching
   `Transfer`, or a merchant with no payout address.
3. It rejects a claim that differs from the observed transfer by more than **1%**
   — tolerance for rounding, not for a different amount.
4. **The chain wins.** Principal, fee and fiat figures are derived from what
   actually moved.

Consequences for an integrator:

- Reporting a hash that has not been mined yet returns an error. Broadcast,
  wait for inclusion, then report.
- You cannot under-report an amount to reduce the fee. On mainnet that would be a
  free pass, not a bug.
- A merchant with no payout address cannot take payments at all — the payment is
  refused rather than recorded unverified.

## Errors you will actually hit

| Symptom | Cause |
| --- | --- |
| `Amount must be a positive number` | `amountFiat` was zero, negative or non-numeric. |
| `Payment could not be verified on-chain: receipt not available yet` | Reported before the transaction was mined. |
| `Payment amount mismatch: client claimed … chain recorded …` | You signed the wrong figure — usually `amount` instead of `total`. |
| `Merchant has no payout address…` | The merchant cannot receive; nothing was recorded. |
| `HTTP 401` | Missing/expired bearer token, or a token with no local user. |

## Non-custodial, and what that means for you

Seti never holds the principal and never signs for the customer. In v1 there is
**no fiat off-ramp**: the merchant receives stablecoins at their own address and
converts them however they like. Do not build an integration that expects a KES
bank payout from Seti.

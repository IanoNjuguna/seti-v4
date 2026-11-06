# Product model: from a take rate to a subscription

**Status:** decision document, no code. Nothing here has been built and nothing here
changes what the product does today. The 2% fee, `FEE_ROUTING_MODE`, and the counter
flow are untouched (`fee-routing.md`).

This document exists because two questions keep being asked in the same breath, and
they are the same question: *must we have a free tier*, and *how does a merchant
move up when they grow*. Both are downstream of one decision that has not been made,
which is whether Seti keeps taking a percentage of the money that moves.

## The two facts that couple the licence question to the pricing page

`kenya-vasp-compliance` covers the regulator. The pricing consequence is narrower
and worth stating in this repo because it is a product fact, not a legal one:

1. **Converting between crypto and fiat inside the product.** Seti has no off-ramp
   in v1 (`AGENTS.md`, "Off-ramp: none in v1"). That is not an accident of scope.
2. **Taking a percentage of the transfer.** This is the sharp one. The 2% attributed
   to the merchant (`fee-routing.md`) is the clearest possible evidence, on a page a
   regulator reads before any code, that Seti is providing a payment service rather
   than selling software.

A take rate and a subscription cannot coexist on one invoice. If a merchant's
statement shows a percentage anywhere, the software-only posture is gone.

## Why a subscription is better at the bottom and worse at the top

The arithmetic, at the two ends of the merchant population we would actually serve:

| Merchant volume | 2% take | $49 plan | Which wins for Seti |
| --- | --- | --- | --- |
| $500 / month | $10 | $49 | subscription, by 5x |
| $5,000 / month | $100 | $49 | 2% |
| $50,000 / month | $1,000 | $49 | subscription, by 20x |

A subscription is a fixed rent on a small merchant and rounding error on a large
one. That is the whole trade: it makes the small merchant viable and makes the large
merchant cheap. A take rate does the opposite.

The honest consequence: choosing the subscription means the counter merchant becomes
the customer worth having here, and the large treasury business is the one who gets
the bargain.

## The ladder

One metered dimension: **monthly settled volume**. Not receiving addresses, not API
calls, not seats. Those are trivially countable and commercially meaningless, and a
merchant who hits an address limit at the moment they grow is churn with extra steps.

| Plan | Price | Volume included |
| --- | --- | --- |
| Free | $0 | $2,000 / month |
| Starter | $19 / month | $20,000 / month |
| Growth | $49 / month | $100,000 / month |
| Scale | contact sales | above $100,000 |

**Overage at 10 basis points** above the cap, billed monthly, capped by a spend limit
the owner approves once. 10 bps is the number that keeps the comparison automatic: a
merchant paying a 2% processor $1,000 on $50,000 pays $49 here, and the overage must
never drift back toward the percentage it replaced.

These are proposals, sized against the comparables below, not commitments.

## The three shapes of a free tier

"Free tier" alone hides a decision that changes support load, abuse surface and the
pricing anchor. Pick one and say which.

| Shape | What it is | Fits when | Costs |
| --- | --- | --- | --- |
| Capped free plan | A real plan with a volume ceiling | Merchants arrive self-serve, and the market has no card-on-file habit | You are buying the customer; the cost is server and support, not payments |
| Time-boxed trial | 14 to 30 days, then pay | Sales-led: you are standing in the shop and the conversation does the work | Nothing if conversion holds; the trial expires at the worst moment if it does not |
| Free software, paid hosting | Open source plus a managed instance | Developer buyers who will run a node | They pay in labour; you ship something you do not support |

The third shape is what BTCPay Server actually is, and it is worth being precise
about because it is routinely misread. The software is free; the hosting is not.
Voltage, the largest managed host, runs a seven-day trial and then $8.99 a month
($6.99 annual). LunaNode is roughly $10 to $16. Neither has a $0 plan, because
hosting costs money whether or not a payment is sent. The free option is running the
node yourself on a $5 VPS.

**Not decided.** Seti's choice depends on whether merchants arrive from a landing
page or from a conversation, which is a go-to-market question this document cannot
settle alone.

## How a merchant moves up

1. **Meter on the server.** One monthly rollup per merchant, volume only.
2. **Warn at 80%, prompt at 100%.** Never act by cutting them off.
3. **Never block inbound money on billing.** A payment that fails to land because a
   card expired is an on-chain fact that cannot be reversed and a support story that
   cannot be recovered. Degrade seat count or new-address issuance instead; the
   incoming transfer always lands.
4. **Upgrades prorate immediately, downgrades take effect at renewal.**
5. **Annual prepay is ten months for twelve.** Cash and churn fixed in the same move.
6. **Grandfather for twelve months.** In a market this size word travels faster than
   a price change, and the merchant who refers ten others is worth more than the
   delta.

## The collection problem, which is upstream of the free tier

A subscription is only a plan if it can be collected. In Kenya that means mobile
money billing through an aggregator, not a card on file. If collection is unsolved,
the first fifty subscriptions are invoices chased by hand, and that friction is the
real reason a free tier gets chosen by accident.

Decide the collection path before the ladder. It is the item most likely to make the
rest of this document moot.

## Distribution: the ERP, not the counter

The sticky seat is the payment run, because the bills, the approvals and the supplier
list live in the finance system and nothing gets removed from a payment run. Selling
into that seat is what makes a subscription renew on the accounting cycle rather than
on a founder's energy. What that costs to build is in
[erp-interoperability.md](./erp-interoperability.md).

## Comparables, read 2026-11-06

All figures read from the vendors' own pricing pages on 6 November 2026. Re-read
before repeating any of them; these ladders change.

| Product | Model | Numbers |
| --- | --- | --- |
| inzi (inzi.io) | 0% per transaction, self-custody treasury, flat plans | $0 up to $5,000 volume; $99 up to $50,000; $349 up to $250,000; $999 up to $1,000,000. Yearly is pay 10, get 12 |
| STRIX (strix.solutions) | 0% on payments, subscription only | 14-day trial, then 122 USDT per month (27% off annual), 20 wallets and 50 AML checks included |
| BTCPay Server, hosted | Free software, paid hosting | Voltage $8.99/month after a 7-day trial, $6.99 annual; LunaNode roughly $10 to $16 |
| Settlewise | Non-custodial, flat take rate | 1% per completed payment, no monthly fee |
| Payclave | Non-custodial, flat take rate | 0.7% per completed payment, no subscription |
| QBitFlow | Non-custodial, take rate | 0.99%, sliding to 0.5% with volume |

The pattern worth keeping: every take-rate competitor is between 0.5% and 1%. Seti's
current 2% is at least double the nearest comparable, and is priced for a market with
no alternative rather than for a market with three.

## What this document does not decide

- Whether the counter product survives, which is a VASP question (`kenya-vasp-compliance`).
- Which free-tier shape, per above.
- The collection aggregator.
- Any date for removing the 2%.

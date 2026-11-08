# Signing a charge without a key

**Decision: the merchant signs in a webview, and the bot relays.** Recorded here because the wall is
structural, not a missing route, and the next person to reach for "just add an API key" should find
this page first.

## The wall

`POST /public/charges` requires an EIP-712 signature from the **payee's own wallet**, over the id, the
amount, the memo and the expiry. The signature *is* the account: there is no API key, no session and
no other credential that can mint a charge.

    backend/src/routes/public-charges.ts:194   // The signature comes FIRST, before anything is
                                                // written and before any of the body's other
                                                // values are believed
    backend/src/routes/public-charges.ts:211   'charge-signature-invalid'

So a bot process holding no key has no way to create one. That is the same wall as a bot that
*spends* money, arriving from the other side, and it exists because the product is non-custodial: the
key never leaves the merchant's device, which is the whole guarantee.

What a process without a key CAN do today, and needs no Seti credential to do: read a balance, read a
DEX quote, inspect an address (the three `tempo_*` tools), build unsigned payment calldata, resolve a
pay link, read a charge by id, list the charges an address has issued against a `ChargeList`
signature, and look a payee up by address. `docs/mcp.md` is the list.

What it cannot do: mint a charge.

## The three candidates

### 1. The merchant signs in a webview, the bot relays — CHOSEN

Telegram Mini Apps and WhatsApp Flows both host a webview, so the merchant's existing Privy wallet
can sign a charge — or a short-lived set of them — on a phone screen the bot opens. The bot then
hands the resulting pay link back into the chat.

- **Preserves the guarantee exactly.** Nothing new is trusted; the signature is still the merchant's.
- **No new credential model.** There is no key to rotate, store, leak, or argue about with an auditor.
- **Cost:** a webview entry point per platform, and one more surface to keep working. The charge
  exists for minutes, so the relay is a link and a status, not a queue.

### 2. A pre-signed charge book — not chosen, but not wrong

The typed data binds `id`, `nonce`, `expiresAt`, the amount and the memo, so a merchant could sign N
charges in advance and a bot consume them one at a time until they expire. Still no key on the
server. Rejected for now because two constraints are real and hard to explain in a chat:

- **The amount is fixed at signing time**, so it only fits fixed-price goods. A shop that charges
  whatever the basket comes to cannot use it.
- **An unused pre-signed charge is a bearer instrument** sitting in a bot's database, and whoever
  reads that database can be paid. A webview signature has no such inventory.

It remains the right answer if a merchant genuinely cannot show a screen at the moment of sale.

### 3. The bot holds the merchant's key — rejected

This makes Seti a custodian of customer funds with no KYC. It contradicts the first of the three
things `docs/README.md` promises, and it changes the regulatory question rather than the engineering
one: the answer stops being "we never hold the money" and starts being a licensing argument nobody
has had.

## What this decision costs, in the product's own terms

- A merchant onboarding a bot flow needs a phone at least once, to sign. That is the same act as
  claiming a name.
- A webview that fails to load is a sale that cannot be completed, so the bot needs a sentence for
  that state rather than a spinner.
- Nothing about settlement changes: the charge is paid by the customer's own transfer, verified
  against the receipt, with the usual fee.

## What would change this decision

A merchant whose sales happen where no webview can open (a telephone order desk, a kiosk with no
browser) would need the pre-signed book. That is a product decision with a bearer-instrument
consequence, and it needs its own page rather than an entry in this one.

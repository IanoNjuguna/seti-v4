---
sidebar_position: 5
---

# Receiving webhooks

A charge tells you it was paid two ways: you can poll `GET /public/charges/:id`, or
you can let Seti POST to your server. This page is the second one, end to end: the app
you create, the one secret you are shown, and the twenty lines that make your endpoint
believe it.

Everything here is about **proving that a delivery is ours**. None of it can move
money. Seti is non-custodial: the payer's stablecoins go straight to your wallet, so
there is no balance here for a leaked credential to drain, and there is no credential
that could sign a transfer on your behalf.

## 1. Create an app

An app is a record with a name, where your events go, and the payout **address** your
charges are paid to. The record is owned by your Seti account (a normal signed-in
session); the address is bound by a **wallet signature**, so a session alone can never
point your name at somebody else's wallet.

```
MerchantApp { name, payoutAddress, webhookUrl, website, issuedAt, nonce }
```

Signed with EIP-712, domain `{ name: "Seti", version: "1", chainId }`, `issuedAt`
within five minutes of now. The name is normalised before it is signed: trim, and
collapse runs of whitespace to one space.

```bash
curl -s -X POST http://localhost:4000/merchant-apps \
  -H "Authorization: Bearer ***" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Java House Storefront",
    "payoutAddress": "0x8fad55b7c481bd76889fbf1eb719789f87db5113",
    "webhookUrl": "https://shop.example/hooks/seti",
    "website": "https://javahouse.example",
    "issuedAt": "2026-10-23T12:00:00.000Z",
    "nonce": "6b2d0b0e-1f4c-4a5b-9c8e-2a1d7f3e4b90",
    "signature": "0x…"
  }'
```

`payoutAddress` must be one of the wallets on your own account.

### What comes back, once

```json
{
  "app": {
    "publicId": "app_9f2c1a4e7b9d0e13",
    "name": "Java House Storefront",
    "webhookUrl": "https://shop.example/hooks/seti",
    "payoutAddress": "0x8fad55b7c481bd76889fbf1eb719789f87db5113",
    "secretHint": "kQ7w",
    "secretRotations": 0,
    "bindingVerifies": true,
    "revokedAt": null
  },
  "secret": "whsec_…"
}
```

**This is the only time the secret is ever readable.** Every later read
(`GET /merchant-apps`, `GET /merchant-apps/:id`) returns `secretHint` — the last four
characters, enough to tell two apps apart — and nothing else. Put it in your secret
store now; there is no "show secret again".

The secret is stored sealed (AES-256-GCM) rather than hashed, because signing a
delivery needs the key itself. What that buys you: a database dump alone does not
yield it.

## 2. Where deliveries go

A delivery is sent to the charge's own `webhookUrl` when it declared one, and
otherwise to the **app's** `webhookUrl` — the address your app is bound to is how Seti
knows which app a charge belongs to. So an app is enough to receive events for every
charge paid to that wallet; you do not have to repeat the URL on each charge.

```
POST https://shop.example/hooks/seti
X-Seti-Signature: t=1761130000,v1=<64 hex characters>
X-Seti-Event: charge.paid
X-Seti-Delivery: 2a7f…          # stable across retries; your dedupe key
X-Seti-Charge: ch_8f2c1a4e7b9d
X-Seti-App: app_9f2c1a4e7b9d0e13
Content-Type: application/json
```

`X-Seti-App` is your app's public id, and it is a **label**, not a credential: it lets
you tell two apps apart in your own logs and it is what support asks for on a ticket.
Authorise on the signature, never on that header.

## 3. Verify a delivery

The rules, in the order that matters:

1. **Sign `"<t>.<raw body>"`** — the timestamp, a dot, then the exact bytes you
   received. Not the re-serialised object: `JSON.stringify(req.body)` can produce
   different bytes than the ones that arrived (key order, whitespace, `1.0` vs `1`), and
   the MAC then covers something we never signed.
2. **Refuse a `t` more than 300 seconds from now**, in both directions. The timestamp is
   inside the signed string, so a captured header cannot be reused against a different
   instant — but it can be replayed against the same one forever unless you bound its
   age.
3. **Compare in constant time.** `timingSafeEqual`, never `===`.
4. **Dedupe on `X-Seti-Delivery`.** Retries reuse it, so one event delivered three times
   is still one event.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';

const app = express();
const SECRET = process.env.SETI_APP_WEBHOOK_SECRET; // the whsec_… you were shown once

// The RAW body is what you must hash, so this route takes a Buffer, not JSON.
app.post('/hooks/seti', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.get('x-seti-signature') ?? '';
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!match) return res.status(400).send('missing signature');

  const timestamp = Number(match[1]);
  const rawBody = req.body.toString('utf8');

  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
    return res.status(400).send('stale');
  }

  const expected = createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(match[2], 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).send('bad signature');
  }

  const event = JSON.parse(rawBody); // parse AFTER verifying
  // ... your fulfilment logic, keyed on event.event and event.charge.id
  res.sendStatus(200);
});
```

Answer `2xx` and Seti stops retrying. Anything else is retried with backoff over
roughly eight hours (1m, 5m, 15m, 1h, 6h), and after the sixth attempt the delivery is
marked `failed` — visibly, in your delivery log, with the status code or transport
error that ended it. A `5xx`, a timeout, a redirect: all retried the same way. Slow is
fine; we wait ten seconds.

The events are `charge.paid`, `charge.underpaid` and `charge.expired`. `overpaid` is
delivered as `charge.paid` (money arrived at or above the ask), with `charge.status`
and `charge.received` in the body saying which it was.

## 4. Put the app id in your page

The app id is public on purpose — it is safe in HTML, in a support ticket, in a log
line. Carry it wherever your own code needs to know which app a visitor came from:

```html
<a class="seti-pay"
   href="https://seti.live/u/java-house"
   data-seti-app="app_9f2c1a4e7b9d0e13">Pay with Seti</a>
```

It is how you, your analytics and Seti support refer to the same app. It grants
nothing: it cannot create a charge (that needs your wallet's signature) and it cannot
read one (same signature, or the charge id you already have).

## 5. Rotation, and revocation

**Rotate** when the secret leaks, or on a schedule. One signed call, and the old secret
is dead the instant it commits — there is never a window with two live secrets:

```bash
curl -s -X POST http://localhost:4000/merchant-apps/app_9f2c1a4e7b9d0e13/secret/rotate \
  -H "Authorization: Bearer ***" \
  -H 'Content-Type: application/json' \
  -d '{ "issuedAt": "2026-10-23T12:05:00.000Z", "nonce": "…", "signature": "0x…" }'
```

The signature is over a **different** message — `MerchantAppAdmin { appId, action,
issuedAt, nonce }`, same EIP-712 domain — signed by the app's payout address. Separate
from the create signature on purpose: the create signature sits in the row, so reusing
it would let anyone who can read the row rotate your secret. `action` is inside the
signed bytes, so a signature made to rotate cannot be used to revoke.

The response carries the new `secret`, once, exactly like creation. Then:

- deliveries that were already in flight fail their next attempt, visibly in the log;
- `POST /merchant-apps/:id/deliveries/:deliveryId/replay` re-sends one delivery, signed
  with the **current** secret and a fresh timestamp — that is how you recover an event
  whose retries died during a rotation. A delivery that already succeeded cannot be
  replayed: it would be a second POST for one event.

**Revoke** when you want the app gone: same signature, `action: "revoke"`. A revoked
app signs nothing, its secret cannot be read, and its delivery history stays where it
is. Charges are unaffected — a charge paid to that wallet still settles; it is simply
signed with the deployment-wide key instead of your app's.

## Refusals

Every failure is `{ "error": "<one sentence>", "code": "<machine code>" }`. Switch on
the code:

| Code | Status | What to do |
| --- | --- | --- |
| `merchant-app-signature-invalid` | 422 / 403 | The signature does not recover to the address you claim, or is not from the app's payout address |
| `merchant-app-stale` | 422 | `issuedAt` is more than five minutes from now. Sign again |
| `merchant-app-mismatch` | 422 | The signed fields and the submitted fields disagree (name, URL, address) |
| `merchant-app-address-not-owned` | 403 | `payoutAddress` is not a wallet on your account |
| `merchant-app-name-taken` | 409 | You already have an app with that name |
| `merchant-app-webhook-invalid` | 422 | Not an `https` URL (`http://localhost` is accepted outside production) |
| `merchant-app-not-found` | 404 | No such app on your account |
| `merchant-app-revoked` | 409 | The app was revoked; create a new one |
| `delivery-not-found` | 404 | That delivery id is not this app's |
| `delivery-not-replayable` | 409 | It already succeeded, or its secret can no longer be opened |
| `secret-box-unset` | 503 | This deployment has no secret key configured. Tell support; it is not something you can fix |

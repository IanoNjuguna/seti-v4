# Verification

What Seti's verification mark means, what it does not, and how a business is
checked before one is granted. Read this first section before the rest — the
scope is the part that is easy to overstate, and overstating it is the one
mistake this document exists to prevent.

---

## 1. What verification is, and is not

Verification at Seti is an **identity claim**: at the time of the check, Seti
confirmed that a business is the one it says it is, from documents and a visit.

It is deliberately **no more than that**:

- **Not creditworthiness.** Nothing in the process measures whether a business
  can pay its debts, how much it sells, or how it has treated customers before.
- **Not a guarantee of the merchant.** A verified business can still fail to
  deliver, close, change hands, or behave badly. The badge says *who they are*,
  not *how they will act*.
- **No escrow, and nothing that implies one.** Settlement is **non-custodial**:
  the customer's stablecoins go straight to the merchant's own wallet, and Seti
  never takes possession of the funds. So there is nothing for Seti to hold back,
  reverse, or refund if a verified merchant disappoints. Verification is not a
  payment guarantee, and it cannot be made into one without changing the money
  path itself.
- **Not a franchise, licence or endorsement.** See
  [`brand-policy.md`](./brand-policy.md): a name on Seti gives the holder no
  relationship with Seti beyond a label on an address.

The authoritative thing in every payment is the **address**, not the name beside
it. A name is a label; the address is where the money goes. Verification says
something about the business behind that label — and nothing at all about whether
a particular payment will end well.

---

## 2. What is checked

Three things, and a check that fails any of them does not pass:

1. **The business exists and is registered.** A business registration document,
   or a KRA PIN, in the business's own name.
2. **The shop is real, and is where the business says it is.** A Seti
   representative visits the physical location; the shop sign must be in frame.
3. **The owner is the person behind the business.** The owner's ID, checked
   against the owner and the business.

That is the whole list. It is short on purpose: the mark is a claim about
identity, and each item supports exactly that claim.

---

## 3. Who performs it

Seti performs it directly. The check is done by a **person on Seti's side** — not
an automated rules engine, and never the merchant's own account — so a refusal is
a judgement someone made and can explain, not a score that appeared.

It is not performed by the customer, and in v1 there is no third-party
verification provider in the path. The reviewer is independent of the merchant
being reviewed.

---

## 4. How long it takes

Seti has **not yet published a turnaround**, and this document does not invent
one. What can be said honestly today is the shape of the sequence, not its
duration:

- the documents are submitted and checked;
- a visit is arranged and made, with the shop sign in frame;
- the owner's ID is checked;
- the result is decided and, on a pass, the mark is granted.

A target has not been published, so a wait is currently **unpromised**: nothing
here should be read as a commitment to a number of days. Publishing a turnaround
is an owner decision, and the figure will be stated here when it exists rather
than guessed at now.

---

## 5. What evidence is retained

For a business that is checked, Seti retains the evidence the check produced:

- the **registration document or KRA PIN** supplied;
- the **visit photograph** (the shop sign in frame), which is evidence that a real
  shop exists at a real place;
- the result of the **owner ID check**.

The owner's ID is personal data and is handled under the Privacy Policy the app
links to (`web/app/legal/privacy`). **How long each item is kept is not yet
fixed.** The Privacy Policy leaves the retention
periods for the records Seti keeps open in its own right, and this document does
not fill that gap with a number that was never decided. Until a retention period
is published, the honest statement is: the evidence above is kept to support the
mark and to answer a dispute about it, and the period is an open decision.

On a **failed** check, the evidence gathered is retained the same way, for the
same reason — and is subject to the same undecided retention period.

---

## 6. What the badge promises — and explicitly does not

| The mark promises | The mark does **not** promise |
| --- | --- |
| Seti checked the three items in §2, for this business, at a point in time. | Creditworthiness, solvency, or ability to pay. |
| The business name matches a registration document or a KRA PIN. | That the merchant will deliver what was paid for, or honour a sale. |
| A real, physical shop was visited and its sign photographed in frame. | Escrow, refund, chargeback, or any recovery of funds. Settlement is direct and non-custodial. |
| The owner's identity was checked against an ID. | A licence, registration, or regulatory approval asserted by Seti. |
| Who the business is. | Quality, legality, safety, or tax compliance. |
| | Permanence: it is a point-in-time check, and a business can change hands or close afterwards. |
| | That a specific payment will be safe. |

A customer seeing the mark should read it as one sentence: *Seti checked who this
business is*. Nothing further.

---

## 7. Two things called "verified"

There are two different marks, and they must not be conflated:

- **"Name verified"** (the `verified` flag the app already shows) means the
  name-to-address binding is a valid signature from the key that controls the
  address (`backend/src/services/handle-claims.ts`, recomputed from the stored
  signature on every read — never a stored boolean). It proves **control of an
  address, and never identity**.
- **The identity verification described in this document** is a separate,
  human-run check of the business behind the name.

Where both exist, they are labelled so a customer can tell which is which: "this
name was signed by the address's key" is a different statement from "Seti checked
this business's papers". Neither stands in for the other.

---

## 8. What happens when it fails

- **The mark is not granted.** The business is told **which** of the three checks
  failed and what would fix it — a document that did not match, a visit that could
  not be made, an owner that did not match — rather than a bare refusal.
- **A failure can be retried.** Corrected documents, or a rebooked visit, start
  the check again. A failed attempt is not a permanent ban.
- **A failure does not, by itself, remove the ability to receive payments.**
  Payments run on non-custodial rails that do not depend on the mark; the mark is
  a claim about identity, not a gate on the money path. (A name that Seti has
  parked for a brand reason is a separate matter — see
  [`brand-policy.md`](./brand-policy.md).)
- **A mark already granted can be withdrawn** if the check is later shown to be
  false, and the withdrawal is recorded. A false document or a faked visit is a
  reason to remove the mark, not merely to decline a new one.

---

## 9. Where this stands today

Stated plainly, in the same spirit as
[`operations.md`](./operations.md), so no reader mistakes policy for a shipped
feature:

| Piece | Today |
| --- | --- |
| The name-to-address signature check (the "Name verified" flag) | **Shipped** — `handle-claims.ts`, recomputed on every read. |
| The identity verification process in §2–§5 and its mark | **Policy, not built.** No code performs a document check or a visit in this tree; this document describes the intended process and its bounds. |

The distinction matters to the same claim the legal surface already makes: it is
better to say a check has not been built than to imply one runs when it does not.

# Brand policy

How Seti handles names that belong to someone else: the strings Seti keeps for
itself, what happens when a well-known name is claimed by somebody with no right
to it, and the path a brand owner takes to have that name taken down. Read it with
[`verification.md`](./verification.md): the two answer different questions, and
neither is a franchise.

---

## 1. A name is not a franchise

Claiming a Seti name gives the claimant **no** relationship with Seti beyond a
label on an address. It is not a franchise, a licence, an endorsement, a
partnership, or an affiliation, with Seti or with anyone else.

Two consequences follow, and both are load-bearing:

- **A claimed name proves control of an address, and never identity.** The claim
  is a signature from the key that controls the wallet the name points at. It says
  "*this address's key chose this name*". It says nothing about who is behind the
  key.
- **The name is a label, not a grant of rights.** Holding a name on Seti gives no
  right to a trademark, no right to trade as a brand, and no permission from Seti
  to use any mark. A payment goes to the **address**; the name is only how a
  customer found it.

So a name being live on Seti is not evidence that Seti vetted, endorsed, or
licensed the business behind it. It is the opposite: the name is cheap to claim
by design, and the money path trusts the address.

---

## 2. Reserved words

The strings Seti keeps for itself. A name that reduces to one of these is refused
at claim time, with the refusal code `reserved-handle`, refused **before anything
is signed**, so no one can reserve the product's own names in the brief window
before a sticker is printed or a link is pasted into a chat.

The reserved list is:

```
seti  support  admin  help  pay  api  www  terms  privacy
```

These are compared against the **derived handle** (the name lowercased with
everything outside `[a-z0-9._-]` removed, `backend/src/lib/merchant-name.ts`), not
against the raw name a person typed. That is deliberate: `Seti`, `seti` and
`s e t i` all reduce to `seti`, the same string a customer would type into a link,
so all three are refused as the same one thing. The reservation is about the
**string**, not about who currently holds a row.

Reserved words are the one thing Seti decides about a name up front. Everything
else is decided after a claim lands, and only when somebody reports it, which is
§3.

---

## 3. Nothing is pre-screened, and that is the design

A name goes live and becomes payable the moment its signature verifies. There is
no held-brand list, no parking and no review queue in front of a claim: it is
either refused (reserved word, malformed, already held) or live.

That is a deliberate change from what this document used to describe. A list of
well-known brands decides in advance, and without evidence, that the person
claiming `kfc` is not entitled to it, when the brand's own employees, franchisees
and resellers are all legitimate claimants. It also only catches the spellings
somebody thought of: a changed letter, a look-alike character from another script,
or a brand nobody has heard of yet all slip past a list.

So the protection does not sit in front of the claim. It sits **behind** it, in a
takedown a person can ask for, and the honest consequences are these:

- **A name being live proves nothing.** Seti did not check who is behind it.
- **A name that looks like yours can be claimed today.** The way to stop it is to
  report it, not to expect a filter.
- **What a payer sees is the badge, not a clearance.** An unchecked name is shown
  with `Name not verified` on the pay page, because the name is a label and the
  address is where the money goes.

What protects a payer in the meantime is the address: it is printed under the name,
in mono, and it is what the money is sent to.

---

## 4. Reporting a name that is not yours

This is the path. It is one email, and it is the same path whether the name is
already live and being paid, or claimed yesterday and idle.

### Where to send it

**hey@seti.live**, with the handle in the subject. The pay page carries the same
route as a `Report this name` link under the unverified badge, so a payer looking
at a name Seti has not checked does not have to find this document first.

### What Seti commits to

**A first response within 72 hours.** A first response is a reply from a person
saying the report arrived and what happens next. It is not a decision and it is not
a takedown: reports are read by a person, not by a rule, and a report that needs
evidence takes longer than the reply.

### What to send

- **The handle**, and the name as it appears on Seti.
- **The brand or mark** you say is being used, and **evidence of authority** over
  it: that you are the brand, or that you act for it. A registry record, a licence,
  a franchise agreement or a letter of authority is enough to start. Seti is not a
  court and does not need a court file.
- **A way to reach you**, and the address or wallet you say is yours, if the point
  is that the name should point somewhere else.
- **What you want**: the name taken down, or the name transferred to you once you
  can sign for it.

### What Seti does

- **Looks, and replies within 72 hours.**
- **Takes the name down** when the evidence shows it belongs to somebody else.
  `refuseHandleClaim` releases the string: it stops resolving, the page that paid
  it stops existing, and the claim that held it is preserved in `handle_releases`
  with the reason and the signature, so what was removed stays readable.
- **Reassigns it** when the brand proves the name is its own and can sign for the
  address that will receive the payments. `reassignHandleClaim` requires the
  brand's own signature over the name, the evidence, and a reason for releasing the
  current holder, and it records the previous holder's claim before taking the
  string.
- **Says what happened, and why**, to whoever reported it.

### What Seti does NOT do

- **Does not decide who owns a trademark.** That is a registry's or a court's job,
  not a payments company's. Seti acts on evidence of authority; it does not
  arbitrate ownership.
- **Does not move, freeze, or return anyone's money.** Settlement is
  non-custodial: funds sit in the wallet they were sent to, and Seti has no ability
  to touch them. A takedown is about a name, never about funds.
- **Does not hand the existing claimant's address or funds to the brand.**
- **Does not put a name on an address it cannot verify is controlled by the
  claimant.** A takedown frees the string for a fresh signed claim; a reassignment
  attaches it to an address whose key signs for it. There is no path that moves a
  name onto an address with no signature behind it, no administrative override, on
  purpose.
- **Does not publish anyone's ID or personal documents.**
- **Does not act on an anonymous report alone.** A report opens a look; it does not
  decide the look.

---

## 5. What a report cannot fix

The mechanism is a person reading a report, so its limits are worth stating rather
than discovering:

- **A name nobody reports stays up.** There is no filter to catch it, so a takedown
  only ever happens because somebody wrote in.
- **Look-alikes are the hard case.** A changed letter, a homoglyph from another
  script, or a name written in another script is a judgement about intent, and
  intent is what evidence is for. A report that shows only "this looks like us"
  gives a person little to act on.
- **A takedown is per string.** It does not stop the same person claiming another
  name, though repeated conduct is a pattern Seti can see across reported names,
  which is another reason to report rather than to wait.
- **Money already sent is gone in the ordinary sense.** Seti never held it. That is
  the cost of a non-custodial product, and it is why the pay page leads a payer to
  the address rather than to the name.

---

## 6. Where this stands today

In the same spirit as [`operations.md`](./operations.md), so the policy is not
mistaken for something other than what it is:

| Piece | Today |
| --- | --- |
| Reserved words refused at claim time (`reserved-handle`) | **Shipped** — `RESERVED_HANDLES` in `backend/src/lib/merchant-name.ts`, refused in `handle-claims.ts`, pinned by `check:username` / `check:handle`. |
| A name going live and payable the moment it verifies | **Shipped** — there is no held list and no queue. `backend/src/lib/held-brands.ts` and the review flow are gone, and nothing replaced them in front of the claim. |
| The takedown itself (`refuseHandleClaim`, `reassignHandleClaim`) | **Shipped, operator-run** — both in `backend/src/services/handle-claims.ts`, both requiring evidence, both preserving the released claim in `handle_releases`. There is no admin UI and no route yet: they are run by the operator. |
| The report channel | **hey@seti.live**, first response within 72 hours. Stated here, and linked from the pay page's unverified state. |
| Who answers a report | **The operator** — one person, named as such rather than as a team, until reports justify more. |

A reviewer's decision is recorded, so a name does not go down or change hands
without a trace.

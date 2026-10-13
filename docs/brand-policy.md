# Brand policy

How Seti handles names that belong to someone else: the strings Seti keeps for
itself, the real-world brands it holds on a list, and the path a brand owner takes
to reclaim a name that is genuinely theirs. Read it with
[`verification.md`](./verification.md): the two answer different questions, and
neither is a franchise.

---

## 1. A name is not a franchise

Claiming a Seti name gives the claimant **no** relationship with Seti beyond a
label on an address. It is not a franchise, a licence, an endorsement, a
partnership, or an affiliation — with Seti or with anyone else.

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
at claim time, with the refusal code `reserved-handle` — refused **before anything
is signed**, so no one can reserve the product's own names in the brief window
before a sticker is printed or a link is pasted into a chat.

The reserved list is:

```
seti  support  admin  help  pay  api  www  terms  privacy
```

These are compared against the **derived handle** — the name lowercased with
everything outside `[a-z0-9._-]` removed (`backend/src/lib/merchant-name.ts`) —
not against the raw name a person typed. That is deliberate: `Seti`, `seti` and
`s e t i` all reduce to `seti`, the same string a customer would type into a link,
so all three are refused as the same one thing. The reservation is about the
**string**, not about who currently holds a row.

Reserved words are Seti's own names, kept for Seti's own surfaces. They are a
fixed list, not a brand list. A reserved word is **refused**; someone else's brand
is **held**, not refused — which is §3.

---

## 3. Held brands

A **held brand** is the name of a real-world brand that Seti knows of and keeps on
a list. When a new claim reduces to a held brand, the claim is **parked** — held
for human review — rather than refused outright.

**Why parked, and not refused:**

- **Refusing would be Seti deciding a claim is impersonation without evidence.**
  A name being well known does not by itself mean the claimant is not entitled to
  it — a brand's own employees, franchisees and authorised resellers are all real
  claimants. Parking accuses no one.
- **It keeps a well-known name from going live under a stranger's address** while
  the question is open — which is exactly the case that motivated this policy.
- **It does not lock the genuine brand owner out.** A parked claim is not a
  refusal; it is a pause.

A parked claim is **neither a rejection nor an approval**, and it is **not live**:
the row keeps its string, but every resolver filters a parked name out. A customer
who tries to pay it gets exactly what they get for a name that does not exist — no
page, no code, no payee. It never reads as verified while it is parked. A human
then decides it: approve it (the name goes live, §4) or refuse it (the string is
freed).

Two boundary rules keep parking honest:

- **Only a *new* claim on a *free* string is parked.** A name already held by
  another address is still `handle-taken` — parking cannot reserve one string
  twice. And a re-claim by the wallet that already holds the name does not
  retroactively park a binding that was already decided.
- **A held brand is not a reserved word.** A reserved word is refused before
  anyone signs; a held brand is parked *after* a valid signature, because parking
  is about a person looking, not about the name being unusable.

### A park does not last forever

A park is a **pause with a deadline**, not an indefinite hold. An undecided park
releases itself after **30 days**: the string is freed, and the claimer is told
(the sentence they were shown when it parked states the window). A park tells a
person to *wait*, so a park nobody ever decides would be a promise Seti cannot
keep — the expiry is what makes the wait honest. The claim path also releases a
stale park the moment someone tries to claim the string, so a name is never
blocked until some sweep happens to run.

### How a name is matched to a held brand

Matching is **stricter than the reserved-word rule**, because its job is to catch
the spellings a squatter reaches for. It works on the name's **stripped key** —
lowercase with *every* character that is not a letter or a digit removed — so
spacing, dots and hyphens all disappear. Two comparisons run on that form
(`backend/src/lib/held-brands.ts`):

1. **Token run** — the brand's words appear consecutively in the name's words.
2. **Key prefix** — the name's stripped key *starts with* the brand's.

So `KFC`, `K F C`, `K.F.C`, `kfc-kenya`, `KFC Karibu`, `Best KFC` and `KFCFood`
all reach the same held brand. It is deliberately imperfect — see §5.

---

## 4. Reclaiming a name that is really yours

If you are the brand, or you act for it, this is the path.

### What you send

- A **reclaim request** naming the handle and the brand you are reclaiming.
- **The evidence the held list names for that brand.** The proof is stated per
  brand, in plain words, because it differs: for one it is a franchise agreement
  or a letter authorising you to use the name; for another it is proof that you are
  the brand itself or an authorised dealer or franchisee. The claimer is shown the
  exact sentence for their brand while the claim is parked.
- **A way to reach you** so the review can be discussed.

Seti has **not yet published the address or channel** to send a reclaim request
to; until it does, the request goes where a claim does, and this document says so
rather than inventing a contact.

### What Seti does

- **Parks the claim and reviews your evidence.** A parked claim already carries
  the claimer's own signature — parking only withholds a binding; it does not
  discard it.
- **Approves**, if the evidence shows the claimer is the brand or acts for it. The
  name then goes live against **the address the claimer signed for**. Seti does
  not attach a name to an address it cannot point to a signer for; approval only
  stops withholding a binding that already verifies, and it is the point at which
  a business profile is minted so the name can be paid.
- **Refuses**, if the name belongs to a different party. Refusing **frees the
  string**, and the brand owner then claims it fresh by signing with the wallet
  that will receive the payments. A refusal's reason is recorded.
- **Tells the parties the outcome.**

### Reassignment on proof

A brand that **proves the name is its own** can take it **whatever state it is in**
— free, parked, or already claimed by someone else — through an explicit,
evidence-requiring action (`reassignHandleClaim`, driven by
`npm run review:brand -- reassign …`). This exists because the handle string is
unique: without it, a parked row (or a squatter's live row) would block the genuine
owner from claiming the name at all, and parking would protect the squatter.

It is never a silent overwrite. It requires:

- **the brand's own signature** — the name can only attach to an address whose key
  signs for it, exactly as for any claim (the same `verifyClaim` gate);
- **the evidence** that proves the caller is the brand; and
- **a reason** for releasing the current holder.

The previous holder's claim is preserved — signature and all — in
`handle_releases`, with the reason it was released, before the string is taken.

None of this touches money: the reviewer acts on a **name**, never on anyone's
funds.

### What Seti does NOT do

- **Does not decide who owns a trademark.** That is a registry's or a court's job,
  not a payments company's. Seti acts on evidence of authority; it does not
  arbitrate ownership.
- **Does not move, freeze, or return anyone's money.** Settlement is
  non-custodial: funds sit in the wallet they were sent to, and Seti has no ability
  to touch them. A reclaim is about a name, never about funds.
- **Does not hand the existing claimant's address or funds to the brand.**
- **Does not reassign a name to an address it cannot verify is controlled by the
  claimant.** Approval makes an existing signed binding live; refusal frees the
  string for a fresh signed claim; and even the reassignment in §4 only ever
  attaches the name to an address whose key signs for it. There is no path that
  moves a name onto an address with no signature behind it — no administrative
  override, on purpose.
- **Does not publish anyone's ID or personal documents.**
- **Does not act on an anonymous or unverified report alone.** A report opens a
  look; it does not decide the look.

---

## 5. Name matching cannot be perfect

Held-brand matching is applied in good faith and is **imperfect by nature**. The
list only catches what Seti knows of and what reduces to a known brand's letters.
It will miss things, and it is honest to say so:

- **Misspellings and typos.** A name that changes a letter (`KFG` for `KFC`)
  reduces to a different key and slips past.
- **Unicode look-alikes and other scripts.** The matcher keeps only `a–z` and
  `0–9`; a similar-looking character from another script, or a name written in one,
  leaves no matching letters behind and is not caught.
- **Brands that are not on the list**, including new brands and brands Seti simply
  has not heard of.

It can also catch names it should not: because one comparison is a **prefix on the
brand's letters**, an ordinary name that merely *begins* with a brand's letters
(for example `KFCluster`) is parked too. That is the mild cost of catching
`KFCFood`, and it is one more reason a park is **not** an accusation — a human
resolution clears it.

It follows that:

- **A name getting through is not evidence that Seti endorsed it.** Absence of a
  park means the matcher found nothing, not that there was nothing to find.
- **Seti can park or withdraw a name after the fact**, when a brand is brought to
  its attention that the list did not catch.

Parking is a best-effort safety net, applied consistently and stated plainly here
rather than implied to be complete.

---

## 6. Where this stands today

In the same spirit as [`operations.md`](./operations.md), so the policy is not
mistaken for something other than what it is:

| Piece | Today |
| --- | --- |
| Reserved words refused at claim time (`reserved-handle`) | **Shipped** — `backend/src/lib/merchant-name.ts`, pinned by `check:username` / `check:handle`. |
| Held brands and parked claims | **In the tree** — the editable list lives in `backend/src/lib/held-brands.ts`, a matching claim is parked in `backend/src/services/handle-claims.ts`, and a reviewer approves or refuses by script (there is no admin UI and no role in the schema yet). |
| A parked claim expires after 30 days and frees itself | **In the tree** — `PARK_EXPIRY_DAYS` in `backend/src/services/handle-claims.ts`; released lazily and in bulk. Pinned by `check:brand`. |
| Reassignment on proof (evidence + the brand's own signature) | **In the tree** — `reassignHandleClaim`; the released claim is preserved in `handle_releases` with the reason. Pinned by `check:brand`. |

The held list is one file: to hold another brand, an entry is added there and
nowhere else. The reviewer's decisions are recorded, so a name does not go live or
get freed without a trace.

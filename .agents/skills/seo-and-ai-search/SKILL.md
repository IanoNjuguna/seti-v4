---
name: seo-and-ai-search
description: Use when a page's copy or structure changes, or when search visibility is asked for. Keeps the on-page layer, structured data, and answer-engine readability in step with the site.
type: prompt
whenToUse: When editing copy, headings, metadata, a route, or the sitemap on any public surface; when adding a page or a blog post; when someone asks about SEO, SEM, keywords, rankings, or being found in AI assistants; and when a copy deletion or rewrite has shipped.
---

# The search layer

Wording has an owner (`seti-voice`), claims have an owner (`product-copy-integrity`), and
the docs have an owner (`surface-parity`). This skill owns the layer that decides whether a
finished page can be found at all: the head tags, the heading outline, structured data, the
sitemap, internal links, and whether an assistant reading the page can quote it.

## The one rule

**A copy or structure change is not done until the search layer moved with it.** The layer
and the page drift by default, and they drift in one direction: the page changes, the
metadata keeps the old sentence. That is not hypothetical here. Until #290, the site's
`metadata.description` still claimed "No hidden charges" a week after the heading that said
it was deleted.

If you change what the page says about what Seti is, who it is for, what it costs, or where
the money goes, you are changing facts that are repeated in the title, the description, the
FAQ, and the structured data. Change them together or the crawler and the assistant quote
the stale one.

## The numbers we hold, and where they came from

Measured 2026-10-31 on our page and three comparables (decaf.so, beansapp.com, spherepay.co)
with the same extraction script. `references/measuring-a-page.md` has the commands and the
full table. Read that file before quoting a range as if it were a standard.

| Field | Range that counts as healthy | Ours on 2026-10-31 | Where it lives |
| --- | --- | --- | --- |
| `title` | 45 to 60 characters, one primary term, brand last | 26 | `web/app/layout.tsx`, or a route's `metadata` |
| `description` | 140 to 155 characters, a fact, not an advert | 82 | same |
| H1 | exactly one, the page's promise | 1 | the page component |
| H2 | one per band, describing the band under it | 3 | `SectionHeader` |
| H3 | items inside a band, never empty, never nav labels | 6 | the item components |
| Words on an indexable page | 600 to 800 | 235 (682 by 2026-11-06) | the page |
| Structured data | Organization and WebSite global, FAQPage where an FAQ exists, BreadcrumbList on child pages | none | `layout.tsx` and child routes |
| Sitemap | generated at `/sitemap.xml` | 404 | `web/app/sitemap.ts` |
| robots.txt | directives, and a `Sitemap:` line | comment-only Cloudflare file, no directives | `web/app/robots.ts` |

The word range is a floor set by what the market ships (660 to 847 on the three comparables),
not a target for its own sake. Reach it by adding sections a merchant needs (who it is for,
how a payment works, what the customer needs, what it costs) and never by padding a
paragraph.

## Our name is the problem, and it decides the keyword plan

Searched 2026-11-01, and this bounds everything above. "seti" returns eight pages of the SETI
Institute, Britannica and Berkeley SETI. "seti payments app" returns four unrelated apps that
are actually called SETI or SETPay. "seti.live" returns eight results, all of them the SETI
Institute's livestream series of that name. We appear in none of them.

So we do not target the bare word, ever, and we do not spend on it. Two rules follow:

1. **Every title, H1, app store subtitle and schema description carries category plus country.**
   The one sentence is fixed and repeats verbatim: "Seti is a payments app for Kenyan shops and
   traders." A qualifier is what makes the query ours, and it is the sentence a model will quote.
2. **Entity separation is the work, not a trick.** `Organization` schema with `name`, `alternateName`,
   `areaServed` (Kenya), `description` and `sameAs` for profiles we actually run. App store listing
   name and subtitle carrying the qualifier. Third party citations that use the sentence. An
   assistant asked "what is Seti" answers with the space institute until third parties have written
   the other Seti down.

The domain is part of this and it is a decision, not a task: `seti.live` resolves to their
programme name in branded search. A domain that carries the category, redirected to the same app,
would do more for branded queries than any page work here. Also open, and not an SEO question: the
"SETI" mark is held in some classes, which is a lawyer's question before it is a listing's.

## The avatar is a remittance receiver, and it reorders everything

The person we are building for receives money from abroad: a family sender in the UK, the US or
the Gulf, or a customer paying a Kenyan business from outside. Not a shop owner taking a
shilling at the counter, which is who the page currently speaks to.

That decides three things, and two of them are uncomfortable.

1. **The queries that matter change.** "send money to Kenya" and "cheapest way to send money to
   Kenya" are bought by Wise, Remitly, WorldRemit and Western Union with real budgets, and a new
   domain will not take them. Winnable instead: "send USDC to Kenya", "receive dollars in Kenya",
   "pay a Kenyan supplier from abroad", "international payment to a Kenyan business". Lower
   volume, and the intent is already ours.
2. **The price claim is gone on both sides.** We are not cheaper than a till locally and not
   cheaper than Wise on the corridor. What we sell is that the money arrives in dollars, whole,
   with nobody holding it in between, against an average corridor cost of about 4.9%.
3. **The last mile is now the product's biggest hole.** A receiver who lands dollars and cannot
   turn them into rent money is worse off than one who gets shillings on a till, however cheap
   the send. Until there is a spend path (a card) or an off-ramp partner, the remittance avatar
   is a promise the product breaks on the day it is kept. This is a product decision, not a copy
   one, and it outranks every page here.

## The category we are bought against

Seti is a stablecoin neobank, and that is the word a buyer arrives with. Privy, whose wallets we
run on, publishes the category. Their solution page is titled "Stablecoin Banking" and opens
"Build global banking with stablecoins"; the March 2026 post `building-crypto-neobanks-with-privy`
names KAST, UGLYCASH, Avici and Brookwell as the cohort, and `/neobanks` carries Plasma One, Ramp
and Slash as case studies. Read 2026-11-03.

The shape all of them share, which is the loop we are building:

1. the wallet is the account, not a custodial ledger sitting behind one;
2. balances are US dollar-denominated stablecoins;
3. money comes in from an external bank account, and from crypto;
4. it settles in seconds, any hour, outside banking hours;
5. a card is how a dollar becomes rent;
6. idle balance earns, where the provider offers it.

Three of those six are live for us: the wallet as account, dollar-denominated balances, and
instant settlement on Tempo. The funding leg is not built, the spend leg does not exist, and
there is no yield product. That gap decides the copy, and it decides which queries are ours to
take today.

**The funding loop is not copy yet.** The landing page's Integrations band already marks Bridge
and Stripe as "Not in use yet" (`web/app/components/landing/PartnersSection.constants.ts`,
`state: 'soon'`), and `docs/internal/prd.md` records the reason: "schema fields only:
`bankAccount`, `bridgeRecipientId`", and "credentials are present in `.env` with no call site. A
populated key is not evidence of an integration." So a funded account, a US virtual account, an
ACH or SEPA deposit, a card and a yield balance cannot appear in a title, a description, an FAQ
answer or a schema field until the call site exists. This is the same rule as the section above,
applied to the one claim that is easiest to talk ourselves into.

**What it does to the keyword plan.** The funding leg carries the valuable terms: "USD account in
Kenya", "hold dollars in Kenya", "stablecoin account Kenya", "send dollars to Kenya", "fund a
Kenyan account from the US". Those outrank the QR terms on volume and on intent, and none of them
is winnable with a page whose product cannot take a bank deposit. A reader who lands on that
query and finds a scanner does not convert, they leave, and the bounce tells the crawler the page
is the wrong answer. So those terms belong to the page that ships with the rail, and until then
the site keeps the terms it can honour: "get paid by QR, Kenya", "accept dollar payments in
Kenya", "2% fee payments Kenya".

**What it does to the competitor work.** The category page is teardowned against the Privy cohort,
not against a till. `/for/shops-and-traders` and the fee argument stay against decaf, beans and
sphere, because that is who a Kenyan shop compares us to. Privy's pages are marketing for their
infrastructure and a description of what their customers built, never a feature list to copy into
ours.

**And it does not change the price argument.** Every one of these products is cheaper to fund
than we are to receive, and none of them is 2% to take a shilling at a counter. We still do not
claim the cheapest route on either side.

## The pages we are building toward

One primary term per URL, which is how the arithmetic gets fixed: one page cannot rank for a
cluster. Each child page links to `/pricing` and to signup, and the blog posts link to the page
they support.

| URL | Primary term | Words | State, 2026-11-06 |
| --- | --- | --- | --- |
| `/` | get paid by QR, Kenya | 600 to 800 | ships: 682 words, 9-question FAQ with `FAQPage` |
| `/receive-from-abroad` | receive money from abroad in dollars | 600 | to build, first, the avatar page |
| `/pricing` | 2% fee payments Kenya, M-Pesa alternative | 500 to 700 | ships (#306), `BreadcrumbList` |
| `/how-it-works` | how to accept dollar payments in Kenya | 600 | ships (#306), `BreadcrumbList` |
| `/for/shops-and-traders` | QR payments for shops in Kenya | 500 | to build |
| `/for/online-sellers` | accept payments online in Kenya | 500 | to build |
| `/learn` | dollar payments in Kenya (hub) | index | to build |
| `/learn/*` | is USDC legal in Kenya, how to accept USDC as a merchant, what a 2% fee avoids that a card and a transfer do not, what a stablecoin payment is | 1,000+ each | to build |

Ship the first two child pages before the rest. A segment page with no `/pricing` behind it has
nowhere to send the reader who is ready to decide.

## What to borrow, and what to ignore

From the 2026-10-31 teardown of three comparables. The mechanics transfer; their buyer does not,
because they sell payouts and APIs to treasury teams and we sell to a shop in Thika.

| Mechanic | Who ships it | Ours |
| --- | --- | --- |
| Organization and WebSite JSON-LD | all three | `layout.tsx`, once |
| FAQ accordion plus `FAQPage` | Decaf (6 questions), Sphere (schema) | the landing page, and the home the custody sentence lost |
| Numbered capability list | Decaf (01 to 08) | our three steps, numbered and expanded |
| Pain-question block | Sphere | "Losing 2% to mobile money?", "A customer abroad cannot pay you." |
| Segment list | Sphere ("Built for your business") | shops, online sellers |
| Before and after comparison | Beans | mobile money today against Seti |
| A content strip on the landing page | Sphere ("Latest from Sphere") | a "Latest" row pointing at `/learn` |
| Three H1s, all-caps headings, empty headings as layout | Beans, Sphere | never. Our outline is already cleaner than theirs |

## KES is the unit

Every price and every figure in copy, metadata, FAQ and schema is written in KES. Dollars are
what the money IS; KES is how it is quoted. The fee sentence reads "2% of a KES 1,250 payment
is KES 25", never "a 2% fee on your dollars". A search snippet, an FAQ answer or a schema
`price` that quotes a USD amount is wrong even when the product holds dollars, because the
reader we are ranking for prices things in shillings. Amounts that a person typed are KES
too: the receipt, the sticker, the FAQ example.

## Finding us in a browser, and in an assistant

Two audiences read the same page. One is a crawler that builds a list of results. The other is
a model that has to write one sentence about us from what it read.

For both, the page needs the same four things, in plain sentences, near the top:

1. **What it is and who it is for.** One paragraph a stranger could repeat: "Seti is a
   payments app for Kenyan shops and traders. A customer pays by the merchant's name or by
   scanning the code on the counter. The money goes straight to the merchant's own balance."
2. **What it costs, in KES**, with the two negatives that make the number complete: 2% per
   payment, no monthly fee, no minimum.
3. **Where the money goes.** The one claim a competitor cannot copy cheaply, in the words the
   voice skill allows.
4. **A question and a direct answer.** An FAQ item whose first sentence answers it, because
   that is the unit an assistant extracts.

Then keep those facts identical on every page. An assistant that reads two pages of ours with
two different fee sentences will quote neither.

Mechanically:

- Structured data in the page, not in an image and not built by JavaScript after hydration.
  `Organization` with `name`, `url`, `areaServed` (Kenya), `description`, and `sameAs` for the
  profiles we actually run. `WebSite` with the site name. `FAQPage` for the FAQ block.
  `BreadcrumbList` on child pages.
- `llms.txt` at the root names the pages worth reading and the facts that are true, and it is
  regenerated whenever a page or a fact changes. It is a list of pointers, never a second copy
  of the copy (a duplicate that goes stale is worse than no file).
- `robots.txt` states what is allowed. Ours is currently a comment-only Cloudflare file, so
  nothing is blocked and nothing points at a sitemap either. When it becomes `app/robots.ts`,
  it allows the assistant crawlers we want to be read by and names the sitemap.
- Facts arrive in text, tables and lists. A figure that only exists inside a client component
  that needs a session is invisible to both audiences.

## We are not the cheapest route, on either side of the bill

Measured 2026-11-01, and it changes the fee argument in both directions.

**Local shilling payments.** Safaricom cut merchant tariffs in 2026: a Lipa na M-Pesa Buy Goods
till is 0.55% to the merchant, capped at KES 200, and payments up to KES 500 are free. The cap
starts to bite around KES 36,363.

**Remittances to Kenya.** The average cost of sending is around 4.9% per USD 200, which is the
number the World Bank tracks, and it is where cash, cards and banks sit. The cheapest digital
routes are far below it: Wise delivers to M-PESA at roughly 0.87% all in on the comparisons
published for 2026. So 2% is not the cheapest remittance route to Kenya either.

Our fee is 2%, and the CUSTOMER or SENDER pays it, so the receiver keeps the whole ticket. On a
KES 1,250 payment the merchant nets KES 1,250 with us against KES 1,243.12 on a till, but their
customer pays KES 1,275 instead of KES 1,250, and under KES 500 M-Pesa costs the customer
nothing.

So the honest position, and the only one that can go on a page:

- **We are not the cheap way to take a local shilling payment.** M-Pesa is, and the page says so.
- **We are not the cheapest way to send money to Kenya.** Wise is, at about 1% to M-PESA, and a
  page that claims otherwise gets checked in thirty seconds by the diaspora reader.
- **What we sell is the property, not the price.** The money arrives as the sender's asset, in
  dollars, whole, and no intermediary holds it on the way. Against the 4.9% average that is a
  large win; against Wise's 0.87% it is a worse price for a different product, and we say which.
- **The merchant's or receiver's number is the one that moves**, because the fee sits on the
  paying side.

A "cheaper than M-Pesa" or "cheapest way to send to Kenya" headline is wrong on the arithmetic
and it is the first thing a Kenyan reader checks.



## SEM, in one paragraph

If we ever buy a click, the landing page must say the query back: one page per intent, one
primary action, no near-duplicate URLs behind tracking parameters, and a canonical on every
one. A page that argues with the ad that bought it wastes the click. The comparison page is
still worth writing, but against a card and an international transfer rather than against a
till, for the reason above, and the tariff it cites is dated and sourced.

## The sync checklist

Run this on every copy or structure change. Each line has caught a real defect here.

1. **Did the change alter a fact about Seti?** Then the `description`, the title, the entity
   paragraph, the FAQ and any schema field that repeats it move in the same commit.
2. **Is anything deleted still repeated elsewhere?** Metadata, Open Graph, FAQ, schema, docs,
   the MCP tool descriptions. Deletions are the ones that leave echoes.
3. **New band or section:** does it have an H2 that describes it, are its items H3s, and is no
   heading empty? A marker promoted to `h2` (see `seti-voice`) keeps the outline intact.
4. **New route:** added to `app/sitemap.ts`, linked from at least two existing pages, given one
   primary term, a title and a description.
5. **Prices or figures:** KES, and the same number everywhere it appears.
6. **Run the check suites.** `npm run typecheck`, `npm run lint`, and whichever `check:*` covers
   the surface you touched.

## What we refuse

- **Rank or volume claims we have not measured.** "Uncontested" means a competitor does not use
  the term. It does not mean nobody does.
- **A fee comparison published from memory.** Verify the tariff first, or say "cheaper than
  mobile money" and stop there.
- **Machine-translated locales.** One market, one language. A translated page that reads like a
  translation is a liability with a hreflang tag on it.
- **Three H1s, all-caps headings, headings used as layout hooks.** The comparables do all three
  and they lose outline signal for it.
- **A meta description at the truncation edge** (156 characters was the worst measured).
- **A roadmap capability in the present tense.** "Fund your account from your bank", "earn on
  your balance", "spend with your card" are all true of the category and false of this app. A
  page that ranks on one of them buys a visitor whose next click is back to the results.
- **Testimonials, logos and urgency** while there are no customers to name.

## The gate

`npm run check:seo` is the enforcement, and it is the last step of `npm run verify` (#299). Read
`scripts/check-seo.mjs` before changing a page: its docstring states what it checks and, more
usefully, what green does not mean.

It asserts, over the repository's own files, in eleven groups and 49 assertions (measured
2026-11-06 by running it; count them from `scripts/check-seo.mjs`, never from memory):

1. **Title and description** — the landing `title` is 45 to 60 characters and ends with the
   brand; the `description` is 140 to 155, names a place, and states `2%`.
2. **One `h1`** — the landing tree carries exactly one, and `app/page.tsx` has none of its own.
3. **Sitemap and robots** — `app/sitemap.ts` names exactly the six public paths and no private
   surface, every path it names is a route, and `app/robots.ts` names the sitemap.
4. **Structured data at the root** — `layout.tsx` renders a `ld+json` script and the
   structured-data module names `Organization` and `WebSite`.
5. **`public/llms.txt`** exists and says something.
6. **The five private surfaces** carry `index: false`.
7. **The claims the copy cut stay cut** — "No hidden charges", "Neo-Bank", "settles instantly".
8. **Enough copy to be quotable** — the landing ships 600 to 800 words of copy, from constants
   only (682 in 19 files today), not counting a component's own prose.
9. **The heading outline** — every band yields exactly one `h2`, each item is an `h3`, and
   nothing goes deeper than `h3`.
10. **The FAQ's structured data** — one `Question` node per question the band actually renders,
    built from the band's own constants, one copy of each answer, every answer rendered rather
    than hidden behind a control, and the `FAQPage` node published by the home page only.
11. **The trail a child page publishes** — `BreadcrumbList` with absolute `item` URLs built
    from `SITE_ORIGIN`, and `/pricing` and `/how-it-works` each publishing their own.

Two rules came out of the day that produced most of those groups, and both are the kind a
reviewer will not catch:

- **Structured data describes its own document.** The `FAQPage` node was on every route, so
  `/pricing` published a FAQ it does not show. A page's schema may only describe what that page
  contains: `FAQPage` on the home page, a `BreadcrumbList` per child page.
- **A sitemap entry must have a route behind it.** A path in `app/sitemap.ts` with no route is a
  promise to a crawler that answers 404. Assertion 3d exists because that is exactly what
  happened when `/pricing` and `/how-it-works` were planned before they were built.

Two properties of it are deliberate and worth keeping:

**It is source-level.** No build, no fetch, no server, so it runs in a second on every commit. It
therefore cannot see the merged `<head>` Next emits, cannot validate the JSON-LD against schema.org,
and cannot prove `/sitemap.xml` answers 200 on the deployed host. Those are a live fetch after a
deploy, not a check.

**It reads comment-stripped source.** The first version did not, and it flagged `FeesSection.tsx`
recording that "No hidden charges" was deleted, and `sitemap.ts` naming `/app` to say why it is
excluded. A check that punishes the page's own record of a decision teaches people to delete the
record.

**The word floor is asserted now, and only because the copy earned it.** Group 8 arrived with the
copy that reached it, not before, and was proved red first. That order is the rule for the next
assertion as well: add a gate with the change that satisfies it, and watch it fail once. A gate
nobody has seen red is a gate that is not running.

## Where the site stands, 2026-11-06

Every figure below was read on 2026-11-06: the copy counts from `npm run check:seo`'s own output,
the paths from `app/sitemap.ts`. It is a measurement with a date, not a promise, and it is wrong the
moment a page changes: re-run the gate before quoting it.

| Field | Now | Where |
| --- | --- | --- |
| `title` | 46, "Get paid in dollars by QR code in Kenya · Seti" | `web/app/layout.tsx` |
| `description` | 153, states the 2% and Thika | same |
| Public routes | six: `/`, `/pricing`, `/how-it-works`, `/privacy`, `/terms`, `/cookies` | `web/app/sitemap.ts` |
| robots.txt | generated, allows crawling, names the sitemap | `web/app/robots.ts` |
| Structured data | `Organization` and `WebSite` at the root; `BreadcrumbList` on `/pricing` and `/how-it-works`; `FAQPage` on the home page only | `web/lib/structured-data.ts`, `web/lib/faq-schema.ts`, `MarketingBreadcrumb.tsx` |
| `llms.txt` | exists, 1141 characters, pointers plus what Seti does not do | `web/public/llms.txt` |
| Words | 682, from constants only, across 19 files | `web/app/components/landing/*.constants.ts` |
| FAQ | 9 questions, one copy of each answer | `FaqSection.constants.ts` |
| Hidden from crawlers | `/app/*`, `/signin`, `/r/*`, `/pay/*`, `/u/*` — the five group 6 pins | `robots` in each route |
| Gate | 49 assertions in 11 groups | `scripts/check-seo.mjs` |

Two things this table deliberately records as gaps rather than as state:

- **`/m/[handle]` is indexable and not in the sitemap.** The merchant page a printed sticker opens
  publishes a title and description and no `robots` rule, so a search engine may index a per-merchant
  page that the sitemap does not enumerate and group 6 does not pin. It is a decision waiting to be
  made, not a fact that is settled.
- **`/app/swap` is inside the `/app` tree,** so it inherits `index: false` from that layout and adds
  its own; nothing about it is crawlable, and that is deliberate while it is a product screen.

An undated "where the site stands" that drifts is the defect this skill exists to prevent, applied
to itself: if you change a page, change the row, or delete the row.

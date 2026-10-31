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
| Words on an indexable page | 600 to 800 | 235 | the page |
| Structured data | Organization and WebSite global, FAQPage where an FAQ exists, BreadcrumbList on child pages | none | `layout.tsx` and child routes |
| Sitemap | generated at `/sitemap.xml` | 404 | `web/app/sitemap.ts` |
| robots.txt | directives, and a `Sitemap:` line | comment-only Cloudflare file, no directives | `web/app/robots.ts` |

The word range is a floor set by what the market ships (660 to 847 on the three comparables),
not a target for its own sake. Reach it by adding sections a merchant needs (who it is for,
how a payment works, what the customer needs, what it costs) and never by padding a
paragraph.

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

## SEM, in one paragraph

If we ever buy a click, the landing page must say the query back: one page per intent, one
primary action, no near-duplicate URLs behind tracking parameters, and a canonical on every
one. A page that argues with the ad that bought it wastes the click. The comparison page
("2% against M-Pesa") is the highest-intent page nobody in our market has written, and it
ships only after Safaricom's current tariff is verified in the same change, because a fee
comparison from memory is a claim we cannot back.

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
- **Testimonials, logos and urgency** while there are no customers to name.

## The gate (to build)

This skill is the rule. The check is the enforcement, and it does not exist yet. `check:seo`
belongs in the `verify` chain with these assertions, each of which fails on today's site:

- every route's `description` is 140 to 155 characters and contains a KES figure or a place;
- every route has exactly one `h1`;
- `app/sitemap.ts` exists, lists every static route, and the built `/sitemap.xml` responds 200;
- `app/robots.ts` responds with a `Sitemap:` line;
- `layout.tsx` renders `Organization` and `WebSite` JSON-LD;
- no heading on any page is empty;
- no rendered page repeats a deleted claim: assert the absence of the strings the copy cuts
  (the #288 and #290 cases both live here).

Add the assertion with the change that makes it pass, and prove it fails first. A gate nobody
has seen red is a gate that is not running.

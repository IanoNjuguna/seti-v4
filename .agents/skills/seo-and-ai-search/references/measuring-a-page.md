# Measuring a page, and the numbers this was calibrated on

The ranges in `SKILL.md` are only worth what the measurement behind them is worth. This file
is that measurement, so a later session can re-run it instead of trusting a remembered number.

## The procedure

Raw HTML first, because schema and head tags only exist there:

```bash
curl -sL -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36" \
  -m 45 https://seti.live/ -o seti.html
```

Then parse, not eyeball:

```python
import re, json, html as H
h = open('seti.html').read()
title = re.search(r'<title[^>]*>(.*?)</title>', h, re.S).group(1)
desc  = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', h, re.S).group(1)
heads = re.findall(r'<(h[1-6])[^>]*>(.*?)</\1>', h, re.S | re.I)   # keep the order and the tag
ld    = re.findall(r'application/ld\+json[^>]*>(.*?)</script>', h, re.S)  # walk nested dicts
```

Word count and density come from the RENDERED page, never from raw HTML. Client-rendered
sites answer 200 with a shell, and a shell has no words:

```javascript
document.body.innerText          // word count, and the prose an assistant would read
document.querySelectorAll('h1,h2,h3')   // the outline, in order, including empty ones
```

Density: lowercase, drop stopwords and tokens under three characters, count unigrams and
adjacent bigrams, and count the phrases that matter (the site's own primary term from its
title or H1, plus every term in our list). Report the length of the meta description next to
its text, because "128 characters" and "156 characters" are a judgment, not a number.

Inventory comes from the sitemap, and only for inventory:

```bash
curl -sL https://www.decaf.so/sitemap.xml | grep -oE "<loc>[^<]+</loc>" | sed 's/<[^>]*>//g'
```

## The table, measured 2026-10-31

| | Decaf | Beans App | SpherePay | Seti |
| --- | --- | --- | --- | --- |
| title length | 45 | 62 | 53 | 26 |
| description length | 128 | 128 | 156 | 82 |
| H1 count | 1 | 3 | 1 | 1 |
| H2 count | 8 | 11 | 6 | 3 |
| H3 count | 15 | 2 | 25 (15 empty) | 6 |
| visible words | 660 | 827 | 847 | 235 |
| JSON-LD types | Organization, WebSite | Organization, ContactPoint, ImageObject | Organization, WebSite, FAQPage, ImageObject, PostalAddress | none |
| hreflang tags | 5 | 2 | 10 | 0 |
| sitemap URLs | 221 | 93 | 221 | 404 (no sitemap) |

Sampled post lengths: Decaf 1,409 words, Beans 857, Sphere 824. Seti has no blog.

Terms none of the three uses on its landing page: get paid, QR payments, Kenya, Thika,
merchant. Terms all three use and Seti does not: stablecoin, cross-border, payout, API.

## What the table does not tell you

- Word counts include nav and footer chrome on every site, so they compare page weight, not
  body copy. Content-only estimates for the same day: Decaf ~506, Beans ~540, Sphere ~653,
  Seti ~190.
- No search volume and no ranking data were collected. "They do not use the term" is the only
  claim the measurement supports.
- One post per site. Blog conclusions from a sample are directional.
- The sample is three B2B and remittance players. They are not our buyer's alternative, and
  the useful part of their page is its scaffolding, not its positioning.

## Re-run before quoting

Any date above is a stamp, not a standing truth. Before a later change cites "660 to 847
words" or "128 characters", run the same three commands against the same hosts. A competitor
ships a new page and the floor moves.

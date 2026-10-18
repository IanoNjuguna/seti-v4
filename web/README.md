# Seti Landing Page

Next.js marketing site for Seti, and the home of the binding legal documents the
mobile app links to. Built with Next.js 16 (App Router), React 19, Tailwind CSS
v4, and the Calm Finance design system.

## What it does

One page (`app/page.tsx`) with four numbered sections:

- **Hero** — "Get paid.", with a live payment QR in the right half
  (see [Hero payment QR](#hero-payment-qr)) and `Open Seti` / `See how it works`
  anchors
- **01 — Hello, World.** — the problem framing (currency debasement, global trade)
- **02 — How** — scan / pay / settlement
- **03 — Rails** — infrastructure & partners: Tempo and Privy run today. Stripe and
  Bridge are listed as PLANNED and labelled as such on the tile — a roadmap the owner
  wants visible, written so it cannot be read as an integration this version has.
- **04 — Get started** — `Open Seti`

Plus:

- `/terms`, `/privacy`, `/cookies` — the binding legal documents, as plain-text
  data in `app/legal/*.content.ts` rendered by `app/legal/LegalDocument.tsx`
- `components/ScrollNavbar.tsx` with a ⌘K `SearchModal.tsx` index over the
  sections
- **The footer no longer publishes the treasury address.** It used to render a
  treasury block (its component has since been deleted) under a `#treasury`
  anchor the fee band linked to. Both are gone — the owner removed the treasury
  surface from the landing — so the page currently makes no claim a reader can
  verify independently, and the fee band states its 2% unbacked.

There is no waitlist form and no backend call anywhere on the site; every CTA is
an in-page anchor.

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- Plus Jakarta Sans, JetBrains Mono, Space Grotesk (via `next/font/google`)

## Getting started

The repo is an npm workspace — install once from the root, never inside `web/`
(a nested lockfile defeats hoisting).

```bash
npm install              # from the repo root
npm run dev:web          # or: npm run dev --workspace web
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

Run from the repo root, targeted at this workspace:

```bash
npm run dev        --workspace web   # start dev server
npm run build      --workspace web   # production build
npm run start      --workspace web   # start production server
npm run typecheck  --workspace web   # tsc --noEmit
npm run lint       --workspace web   # eslint
```

## Design tokens

Colors, typography, radii and shadows are CSS variables in `app/globals.css`,
mirroring the root `design.tokens.json`. The page is **dark-canvas by design**:
there is no `prefers-color-scheme` media query and no light-mode variant.

The landing's vertical rhythm comes from **one** token, `--band-pad-block`
(4rem / 5rem / 5.5rem at the three widths, stepped in `@layer base` because an
`@theme` block cannot hold a media query). Every band's top and bottom padding
reads it — `py-[var(--band-pad-block)]` — so no band can drift from its
neighbours and no band's bottom can exceed its top. The hero (a viewport-tall
centred box) and the footer (chrome) are the only two surfaces deliberately off
it.

The desktop step is `{spacing.section}` (88px), not `{spacing.band}` (120px):
`design/revolut.md` gives 120px to "the hero band and the closing planning
section" and 88px to the padding "between bands". Every band running at the
hero's number is what overflowed the how-it-works band on a laptop — 693px of
band against a 656px fold at 1280x720, 240px of it padding — and 88px brings
that band to 629px. The measured before/after table is in `app/globals.css`
above the ladder.

## Hero payment QR

The hero's right half is a **live payment link**, drawn as a QR — not an
illustration of one. It encodes a real merchant's public payment page, so
scanning it opens the thing the product actually does, signed out, the way a
customer meets a printed sticker.

- **The code** comes from `react-qr-code` (already a dependency of the receipt
  and the merchant surfaces) and is drawn as SVG, never as raster, which would be
  visibly soft at this size. The QR's
  own modules stay square; the plate around it is a real surface at `rounded-md`
  (12px) with `p-9`/`md:p-10`, which is both the slot's internal padding and the
  code's quiet zone (the spec wants ~14% of the code's width of clean field).
- **What it opens** — `HERO_PAYMENT_URL`, built by `merchantPaymentUrl()` in
  `lib/site.ts` from `NEXT_PUBLIC_SITE_ORIGIN` + `/m/<handle>`. Set
  `NEXT_PUBLIC_SITE_ORIGIN` to the origin a deployment is actually served from; it
  defaults to `https://seti.live`. It is **never** `window.location` and never a
  relative path: the page is prerendered at build time, where there is no
  `window`, and a code carrying the host that happened to serve a preview build
  ends up printed on a sticker where it cannot be corrected.
- **What it says** — the caption names the merchant and what the link is for, in
  the owner's own wording. Note what it does **not** do: it names no network. The
  sentence is picked by `NEXT_PUBLIC_TEMPO_CHAIN_ID` (practice by default), but
  the practice sentence is now network-agnostic — **and the closing band's
  "Runs on Tempo testnet — no real money yet." line has since been deleted — so
  nothing on the landing states which network it runs on.** On a testnet
  deployment that is a live money claim held up to visitors; it is recorded here
  and in `ClosingSection` rather than silently papered over. The `live` variant
  (mainnet) has not been reviewed by the owner. No imperative and no
  send-funds-to-this-address phrasing — the page's own lesson, from when a
  scan-to-pay code sat under a label that did not say what it was.
- **The label** is on the code (`role="img"` plus the SVG's own `<title>`), and
  the payload is printed beneath it in mono so a person can read the URL the
  picture carries.

`HERO_PAYMENT_URL` is one constant used by both the code and the printed line, so
the picture and the text cannot describe different URLs.

The owner's original hero image (`public/hero-banner.png`) has been deleted. It
stopped being the hero visual when the live payment QR replaced it, and an asset
in `public/` that nothing renders reads as part of the page to whoever comes next.

## Notes

- **The hero's right half is a live payment QR**, not an image. The
  third-party background video that used to sit there is gone — the drifting
  field replaced it — and the owner's banner was deleted along with the video once
  nothing rendered it. See
  [Hero payment QR](#hero-payment-qr) for what the code encodes and the one env
  var (`NEXT_PUBLIC_SITE_ORIGIN`) that decides it.
- **Legal placeholders are visible, on purpose.** `app/legal/site.ts` holds the
  three facts nothing in this repo can supply: `LEGAL_ENTITY`,
  `REGISTERED_ADDRESS` and `CONTACT_EMAIL`. They render as `[[LEGAL ENTITY]]`,
  `[[REGISTERED ADDRESS]]` and `[[CONTACT EMAIL]]` inside the documents, so the
  gap is visible on the page rather than filled with an invented company name.
  `domain` is read from `lib/site.ts` (`NEXT_PUBLIC_SITE_ORIGIN`), not restated
  here. The Terms additionally leave the governing law and forum unpublished.
  The three documents are written from the code — collected fields from
  `backend/prisma/schema.prisma`, the three `localStorage` keys, the processors
  (Privy, Cloudflare, AWS) — and each says plainly that it still needs a
  lawyer's review. Fill the placeholders and get that review before treating
  them as final.
- **There is no committed donations QR.** `public/treasury-qr.png` and
  `scripts/generate-treasury-qr.py` are both deleted. The footer block that
  published a treasury address is gone, so the image had no reader and the script
  had no consumer; a QR nobody displays in `public/` reads as a live part of the
  page. Every QR the site draws now comes from `react-qr-code` at render time. If
  the address ever gets a surface again, generate the code from
  `SETI_TREASURY_ADDRESS` in the component rather than committing an image of it.
- Keep this directory focused on marketing content only. Product logic lives in
  `mobile/` and `backend/`.

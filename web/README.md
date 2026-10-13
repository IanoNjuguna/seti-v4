# Seti Landing Page

Next.js marketing site for Seti, and the home of the binding legal documents the
mobile app links to. Built with Next.js 16 (App Router), React 19, Tailwind CSS
v4, and the Calm Finance design system.

## What it does

One page (`app/page.tsx`) with four numbered sections:

- **Hero** — "a neo-bank", with `Open the app` and `See how it works` anchors, over
  a background video
- **01 — Hello, World.** — the problem framing (currency debasement, global trade)
- **02 — How** — scan / pay / settlement
- **03 — Rails** — infrastructure & partners: Tempo and Privy only. Stripe and
  Bridge are deliberately absent — v1 has no fiat off-ramp and no
  Stripe/Bridge integration in the code, so listing them as "planned" invented a
  roadmap the product does not have.
- **04 — Get started** — `Open Seti`, on Tempo testnet

Plus:

- `/terms`, `/privacy`, `/cookies` — the binding legal documents, as plain-text
  data in `app/legal/*.content.ts` rendered by `app/legal/LegalDocument.tsx`
- `components/ScrollNavbar.tsx` with a ⌘K `SearchModal.tsx` index over the
  sections
- A footer that publishes Seti's treasury (fee-collection) address
  (`components/TreasuryAddress.tsx`). Labelled as what it is — a transparency
  item, not an address to send money to; no imperative and no scan-to-pay QR.

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

## Notes

- **The hero background video is hotlinked from a third-party CDN**
  (`d8j0ntlcm91z4.cloudfront.net`). Replace it with an owned asset before launch:
  a hotlinked asset can change or disappear without notice, and it sits in the
  critical path of the first screen.
- **Legal placeholders are published.** `app/legal/site.ts` holds `legalName`,
  `entitySuffix`, `address` (`[Registered address]`), `email` and
  `NOTICES_EMAIL` (`legal@seti.example`) and `domain` (`https://seti.example`).
  That file is marked LEGAL REVIEW REQUIRED, and the documents themselves state
  they have not been reviewed by a qualified Kenyan attorney. Replace the
  details and have the documents reviewed before publishing.
- **The donations QR is generated, not hand-made.** `public/treasury-qr.png`
  comes from `scripts/generate-treasury-qr.py`, which reads
  `SETI_TREASURY_ADDRESS`. Regenerate it whenever the address changes — otherwise
  the QR points somewhere the visible text does not.
- Keep this directory focused on marketing content only. Product logic lives in
  `mobile/` and `backend/`.

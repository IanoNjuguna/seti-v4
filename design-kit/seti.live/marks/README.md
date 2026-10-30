# Seti marks

Two expressions, three colourways, six files. This README is the rule; the script
is the source.

    python3 generate.py            # build the six marks + the app icon
    python3 generate.py --install  # build, then copy into web/public and web/app

## The sources, and what was wrong with one of them

`source/` holds the two files this pipeline reads. They are not a matched pair,
and the numbers are the argument:

| file | head | eyes | mouth |
| --- | --- | --- | --- |
| `No_Smile_Alien_Face.png` — 500px | cream `rgb(223,214,205)` | 14,850 opaque black px | none |
| `Smile_Alien_Face.png` — 500px | white `rgb(244,243,241)` | 13,144 px at **alpha 0** | a ≤1/255 emboss |
| `Friendly Alien Face Icon.png` — 1254px | white on near-black | inked | a real drawn stroke |

Head shape is consistent across all three (aspect 0.7727 / 0.7700 / 0.7740, eyes
inside 0.5% once normalised), so the geometry was never the problem.

The free-standing smile file (500px, white, measured in the middle column) is
**unusable** and has been DELETED from the kit, so nothing can pick it up again.
Its numbers stay here as the record of why:

- its head is a different colour from the neutral's, which the identity rules out
- its eyes are transparent holes, so on any non-flat surface the face looks
  through to what is behind it
- it contains no ink at all. The eyes are holes, the mouth is a deboss, and the
  peak local contrast of that mouth is **0.67 of 1/255**. There is nothing to
  extract and nothing survives a 32px render.

`Friendly Alien Face Icon.png` is usable and is where the smile comes from.

## What the script builds

The neutral file is the source of truth for the body; the 1254px icon supplies
the smile, warped into the neutral's pixel space. So the marks differ only by
expression and colourway, which is the whole point:

| file | expression | canvas | how it is drawn |
| --- | --- | --- | --- |
| `seti-mark-neutral.png` | neutral | light | the supplied cream artwork, unchanged |
| `seti-mark-friendly.png` | friendly | light | same body, smile in the eyes' ink |
| `seti-mark-neutral-dark.png` | neutral | dark | white, same shading, **eyes punched to alpha 0** |
| `seti-mark-friendly-dark.png` | friendly | dark | as above, smile punched |
| `seti-mark-neutral-code.png` | neutral | code | ink `#000000`, same shading, **eyes punched** |
| `seti-mark-friendly-code.png` | friendly | code | as above, smile punched |

All six are 384×384 with one crop, one scale, and the head at 93% of the
canvas, so swapping expression or canvas never shifts the mark by a pixel. The
head is 356px tall inside that canvas, downscaled from the 359px source: no
variant is upscaled.

The crop is taken on the SOLID head (`alpha > 128`) and padded by 4% of its
height. That is not fussiness: the supplied 500px neutral carries 653 pixels of
`alpha <= 64` haze out to its own canvas edges, so an `alpha > 0` bounding box is
the entire 500×500 file and the head silently ends up two thirds of the frame it
is being measured by. That bug shipped once — the first build framed the head at
68% of the canvas and every mark rendered a third smaller than its class said.

Eyes are punched rather than filled dark because the dark canvas is black and a
painted pupil breaks the moment the mark sits on anything else.

## When to use which

The neutral identifies. The friendly addresses a person. Both are the same
character; only the mouth differs, so the two can never read as two products.

**Neutral** — the identity, wherever the product is naming itself:

- app chrome: the rail's brand block, the sign-in handoff frame
- landing nav and footer, legal documents
- receipts and every export of one
- favicon, app icon, home screen
- error, warning and security screens
- anything that is a document, a record or a statement
- the middle of a payment code, in the `code` colourway (a code is a document: it is
  what a stranger scans and what a printer prints)

**Friendly** — the product talking to someone:

- sign-in (`SignInPanel`)
- onboarding
- empty states
- a payment that worked
- community and social

Rule of thumb: if the surface would be odd on a bank statement, it is friendly;
if it could appear on one, it is neutral. Never pick by mood per screen — the
expression is a role, and `BrandMark` takes it as a prop so it is visible in the
code that draws it.

## The `code` colourway, and why it is not a recolour

The middle of a payment code is white — it is the well the mark sits in, cut out of
the symbol so the mark does not eat scanning contrast — and on that well the two
colourways above both fail, for opposite reasons:

| on the white well | contrast | reads as |
| --- | --- | --- |
| cream `rgb(223,214,205)` (light) | 1.3:1 | two dark eyes with no head |
| white (dark) | 1.0:1 | nothing |
| **ink `#000000` (code)** | **21.00:1** | one solid head with white eyes |

So the code colourway is a real third ink, not a tint of an existing file: the head
is filled with `--color-canvas-dark` and its eyes are PUNCHED, exactly the treatment the
dark pair gets, because the well behind them is white. Ink is also the same colour as
the modules, which is what makes the code read as one object rather than a logo
pasted on a QR code.

It was cobalt `#494fdf` (6.06:1) while the plate spent its contrast on the brand
accent. A code is a document a camera reads before a person looks at it, so the ink
went to the maximum the system has.

`code` is a colourway axis, so both expressions exist — but only the NEUTRAL one is
ever drawn: a code is a document. `seti-mark-friendly-code.png` is generated so the
matrix stays complete, and no surface uses it.

## In the app

```tsx
import { BrandMark } from '@/components/ui';

<BrandMark expression="neutral" canvas="dark" className="h-8" />
<BrandMark expression="friendly" canvas="dark" className="h-[3.75rem]" preload />
<BrandMark expression="neutral" canvas="code" className="h-full w-auto" />
```

`canvas` follows the surface's own canvas token. Never hand a `src` path to an
`<img>`: the six files are one decision, and a path taken by hand is a mark
nobody can audit.

`label` only when the mark stands alone as the product's name. Beside a wordmark,
leave it off (empty `alt`, out of the accessibility tree).

## Known constraint

Cream on white is **1.3:1**. The light marks are correct brand colour and nearly
invisible on bare white, so on a light surface either:

- sit the mark on a tinted tile (`surface-soft`), which is how the brand colour is
  meant to be seen, or
- use the dark (white) pair on a black band, as every current surface does, or
- if the surface is a payment code's white well, the `code` colourway — that is the
  only surface where a THIRD ink was needed, and it is the one place the mark shares
  its colour with the thing around it.

Do not reach for a raw hex to "fix" the contrast; that is a seventh mark nobody
signed off. Add a colourway to this script instead, with its measurement.

## Icons: bare in the tab, tiled on the home screen

The rule is which surface owns the background, not which file it is.

**Browser tab: bare, one colourway.** `favicon.png` (64) and `favicon.ico`
(16/32/48) are the WHITE mark on a transparent canvas. No tile: the tab is chrome
the mark does not own, and it is the one place the alien is the whole of what a
visitor sees, so a black square there reads as a thumbnail of the product rather
than as its face. One colourway rather than a `prefers-color-scheme` pair, so the
tab is the same object on every machine. Measured on the three bars a tab can be:

| tab bar | white mark | cream mark | verdict |
| --- | --- | --- | --- |
| Chrome dark `#202124` | 16.10:1 | 11.22:1 | reads at 16px |
| Chrome light `#dee1e6` | 1.31:1 | 1.09:1 | reads by silhouette and by the punched eyes |
| Firefox light `#f0f0f4` | 1.14:1 | 1.26:1 | weak either way: only the eyes carry it |
| pure white | 1.00:1 | 1.43:1 | the head disappears; the shading leaves an outline |

Accepted, not overlooked. Cream is not the better answer, only a different one: it
wins on near-white bars, loses on Chrome's light strip, and the identity is not
worth splitting into two tab icons that disagree. If the near-white case ever matters
more than the single colourway, the fix is a `prefers-color-scheme` pair, not an
outline.

**Home screen: tiled.** `apple-icon.png` (180) and `icon.png` (512) are the
neutral mark on black, glyph inset to 62% of the tile. A launcher paints an icon
on its own background and flattens transparency, so a "bare" home-screen icon is
a black square with extra steps; the tile is what gives the white head an edge.
`icon.png` is kept in the kit only: with no web app manifest, nothing serves it
yet, and it is the asset a manifest should point at when one exists.

## Resolution, and where it stops

Every mark is a raster whose head is 356px, so anything rendered at or below that
height is pixel-for-pixel. Roughly: any UI size up to ~356px is free, a 512 icon
is still downscaling, and a **1024 icon or print beyond ~30mm at 300dpi is an
upscale** (a 1024 tile wants a ~635px head, 1.8× the master). At that point the
answer is an SVG master replacing this pipeline, not a bigger PNG: the shapes here
are flat fills with a mouth drawn as geometry, so a vector is the natural
replacement and nothing in the app depends on the mark being a raster.

If a vector master ever arrives, replace the PNG pipeline with it; nothing in the
app depends on the mark being a PNG.

## What was removed from the kit, and why

The kit is the brand source of truth, so it only earns its name if everything in
it is still the brand. Removed in the mark audit:

- **The whole phoenix generation** — `Seti.png`, `Seti (1).png`, `Seti (2).png`,
  `grey-phoenix.png`, `red-phoenix.png` (black, red and grey bird, 500px and
  2000px). The alien is the identity now, and five bird files sitting in the kit
  next to the new marks is an invitation to reach for the wrong logo. Git keeps
  them if the phoenix is ever wanted again.
- **`source/Smile_Alien_Face.png`** — the unusable smile file, deleted so it
  cannot be picked up a second time. Its measurements stay above.
- **`marks/favicon-light.png`, `marks/favicon-dark.png`** — the two-file tab
  scheme, replaced by the single white icon. `favicon-dark.png` was byte-identical
  to `favicon.png`, which is how the duplicate was caught.
- **Packaging junk** — `Stripe/__MACOSX/` (nine macOS zip artefacts), a
  `.directory` (desktop folder metadata) and `__pycache__/` from running the
  generator.

Kept, deliberately: the four partner kits (Tempo, Privy, Bridge, Stripe) in full,
including print and social variants. They are other people's marks, the site
renders four of them, and the reason the kit exists is that a variant you need
already exists so nobody recolours one by hand. `icon.png` (512) is also kept: no
manifest serves it yet, and it is the file a manifest should point at.

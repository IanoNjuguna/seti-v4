# Motion

Motion is a language, and the two surfaces speak it at different volumes. The landing
page may be ambient — it is a place you arrive at and look around. The app may not be: it
is a place where money moves, and every animation there has to explain a change of state
or get out of the way.

One vocabulary, two dials. This file is the vocabulary; the dials are set per surface.

## Tokens

Semantic names, defined once as CSS custom properties in `globals.css` and referenced
through Tailwind's `@theme`. Never a literal duration or curve at a call site.

| Token | Value | Use |
| --- | --- | --- |
| `--duration-instant` | 90ms | a press, a checkbox, a toggle — feedback that must feel tactile |
| `--duration-quick` | 160ms | hover, focus, a hairline brightening, a small state change |
| `--duration-base` | 240ms | a panel or row entering or leaving, a list settling |
| `--duration-slow` | 400ms | the largest change: a sheet, a route, the receipt moment |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | entrances — fast at the start, settled at the end |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | movement between two states |
| `--ease-linear` | `linear` | ambient loops only, so they never appear to pulse |
| `--distance-micro` | 4px | a row, a label, a chip |
| `--distance-small` | 8px | a card, a panel edge |

## DIAL ONE — the landing page: ambient

One ambient idea per page. Ours is the drifting field plus a fine grain overlay, on a
40–60s `linear` loop, at contrast low enough that body text passes on the actual render.
Nothing else drifts.

- **Scroll reveal** — a section rises `--distance-small` and fades in, once, on entry.
  Never per element, never replayed, never a parallax race.
- **Hover** — a hairline brightens and the card lifts 2px, `--duration-quick`. On touch
  there is no hover state at all.
- **Entrance** — the hero's lines stagger by 40ms, capped, once.
- **Never** — anything that follows the cursor, anything infinite except the field, any
  gradient that moves faster than a minute, more than one thing moving at a time.

## DIAL TWO — the app: feedback only

**No ambient motion in the app, ever.** Motion appears only to explain a change of state,
and it is short enough that a user never waits for it.

- **Press** — `--duration-instant`. A control acknowledges before the network does.
- **Panels** — enter from their own edge at `--duration-base`, with the backdrop fading at
  `--duration-quick`. Focus moves into the panel and returns to the opener on close.
- **Rows** — enter with `--distance-micro` and opacity, staggered 24ms, **capped at six**;
  after six they arrive together. A stagger that keeps going is decoration.
- **Values** — a changed figure fades its colour. It does **not** count up: in a payments
  app a number that animates through false values is a trust problem, not a flourish.
- **Success** — exactly one deliberate moment in the whole product: the receipt's check.
  `--duration-slow`, once, and never on a redraw.
- **Loading** — a quiet opacity pulse on a skeleton. No shimmer: a sweeping highlight is
  the single most template-like animation there is.

## Guardrails

1. Animate `transform` and `opacity` only — never `width`, `height`, `top` or `left`.
2. Nothing in the app runs longer than `--duration-slow`.
3. Motion never delays a money action and never blocks input.
4. `prefers-reduced-motion` freezes ambient motion and turns entrances into instant
   appearance. Implement one `useReducedMotion` hook and use it everywhere.
5. No animation library. CSS transitions and keyframes first; the View Transitions API for
   route changes where it is supported, with a static fallback. A 40kB dependency to
   duplicate what CSS does is how a product gets slow.
6. **One channel per event.** The app already has haptics on the quote and a sound when it
   arrives. Do not stack motion, haptic and sound on the same moment — that is noise, not
   feedback.

## How this gets reviewed

Every motion change is reviewed against `.agents/skills/review-animations` and rendered at
360px and desktop. Each one must be justifiable in a single line: *what does this
communicate?* If the answer is "it feels nice", delete it.

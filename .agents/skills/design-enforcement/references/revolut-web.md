# The Revolut system — every web surface

Source of truth: `design/revolut.md`. In force for `web/` — the landing page
(`web/app/page.tsx`) and the product app (`web/app/app/*`, served at `/app`).
This is the **target system for the whole repo**; mobile follows it after migration.

Loaded from `design-enforcement`. The Calm tokens on mobile are a separate
vocabulary — see `calm-finance-mobile.md`.

## Rules that are structural, not decorative

- **No shadows at all.** "The system has no traditional drop-shadow language."
  Depth is a 1px hairline plus canvas/soft/elevated luminance steps. `shadow-ambient`
  and every `shadow-*` utility are Calm leftovers on a web surface.
- **Two canvases, not a theme pair.** `canvas-light` (#fff) for product surfaces,
  `canvas-dark` (#000) for chrome and storytelling. There is **no light/dark mode
  equivalence requirement** here — that rule belongs to Calm. Do not add a `.dark`
  block for a web surface.
- **Everything is a pill.** Buttons and badges `rounded-full`; cards `rounded-lg`
  (20px); inputs `rounded-md` (12px).
- **On a white band the primary CTA is black** (`button-dark`), not an accent colour.
  Cobalt is reserved for links and featured states.
- Display type is Space Grotesk at weight 500 with negative tracking; body is
  Plus Jakarta Sans. Both come from the root layout — do not re-load fonts in a
  route segment.

## Tokens (verified compiling in `web/app/globals.css`)

| Purpose | Token |
| --- | --- |
| Canvases | `canvas-light`, `canvas-dark`, `surface-soft`, `surface-card`, `surface-deep`, `surface-elevated` |
| Text | `ink`, `body`, `charcoal`, `mute`, `ash`, `stone`, `faint`, `on-dark`, `on-dark-mute`, `on-primary` |
| Lines | `hairline-light`, `hairline-dark`, `hairline-strong` |
| Reserved | `primary` (cobalt #494fdf) |
| Accents | `accent-light-green` (success), `accent-yellow` (warning), `accent-danger`, `accent-deep-red` |

Type: `display-xl|lg|md`, `heading-lg|md|sm`, `body-lg|md|body-md-bold|sm`, `caption`, `button`.
Radii: `sm`, `md`, `lg`, `xl`, `pill`.

## Component recipes in use

- **Card** — `bg-surface-card border border-hairline-light rounded-lg p-8`, **no shadow**.
  Inset wells: `bg-surface-soft`, no border.
- **Buttons** — height 48px, padding 14px 28px, `rounded-full`, label `text-button`.
  `button-primary` = white pill on dark · `button-dark` = black pill on white ·
  `button-soft` = `surface-soft` · `button-outline-light` = white + `hairline-strong` ·
  `button-pill-sm` = 36px, `surface-soft`.
- **Nav** — `nav-bar` is black: `bg-canvas-dark text-on-dark`, height 64px. Landing nav
  is `ScrollNavbar`; the app uses `AppRail` (desktop) + `AppNav` (bottom bar), both
  black. `Log in` in the landing nav is the product app's only entry point — it points
  at `/app`.
- **Transaction row** — 64px, `border-b border-hairline-light`, merchant/amount
  `text-body-md-bold`, amount `font-tabular`, inflow `text-accent-light-green`.
- **Badges** — `surface-soft` background + semantic text colour; the system has no
  coloured-fill badge token.
- **Checkbox (the sign-up terms gate, `components/auth/TermsAcceptance.tsx`)** — a real
  `<input type="checkbox">`, `h-4 w-4 accent-primary`, with the focus ring the other
  controls use (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
  focus-visible:ring-offset-canvas-light`). The `<label htmlFor>` wraps the whole statement
  *including* the `/terms` link: verified in Chrome that clicking that link navigates and
  does **not** toggle the control, and the accessible name is the full sentence. Because a
  `disabled` CTA is skipped by Tab, the reason it is blocked is rendered as text beside the
  checkbox and wired with `aria-describedby`, not left to the dead button to explain.

## Gotchas paid for once already

- **`cn()` does not merge Tailwind classes, so a caller cannot override a
  primitive's spacing.** `web/lib/cn.ts` is a plain join (deliberately
  dependency-free), not `twMerge`. `Card` bakes in `p-8`, so
  `<Card className="p-6">` emits *both* classes and Tailwind's own ordering
  decides — the later-emitted `p-8` wins and the caller's `p-6` silently does
  nothing. Same for any base utility the primitive already sets. To change a
  primitive's recipe, change the primitive. From a caller you can only add a
  property it does not set — a *breakpoint* variant of one it does set is safe,
  because Tailwind emits variants after base utilities, so
  `<Button fullWidth className="sm:w-auto">` is full width at 360px and 184px from
  `sm` up (verified in a render here).
- **`Text` resolves exactly ONE colour class, so a colour is deterministic.** The variants
  used to carry a colour of their own (`micro` → `text-stone`), and Tailwind v4 emits
  colour utilities *alphabetically* — so `text-stone` landed after `text-accent-danger` and
  won at equal specificity, and `variant="micro" color="alert"` rendered grey
  (`rgb(141,150,158)` in a live render). The variants no longer set a colour at all:
  `Text` applies the caller's `color` when given, otherwise the variant's own default
  (`DEFAULT_COLOR_CLASSES` in `Text.constants.ts`, e.g. `micro` → `text-stone`), and emits
  only one of the two. Consequences that still bite:
  - A colour that must be chosen goes through the `color` prop. A `text-*` class in
    `className` still competes with the default and still loses (`cn()` is a join, not a
    merge) — `Text` is the one place colour is decided.
  - The `!` important modifier is no longer needed anywhere (`text-accent-danger!` was
    the old workaround). If you see one, it is dead weight.
  - Status roles are `success` / `warning` / `alert` (`accent-light-green` /
    `accent-yellow` / `accent-danger`).
  - A variant's colour set on an **ancestor** element is still overridden by the child
    `Text`'s own default. Name the role on the text itself — that is what `Badge` does.

- `--text-body-md-bold` is **not** in the original theme — it had to be added to
  `globals.css`. If an emphatic size compiles to nothing, the class is missing from the
  theme, not typed wrong; check the compiled CSS rather than trusting the class name.
- The product app's route segment is `app/app/`, because a group `app/(app)/` would map
  to `/` and collide with the landing page.
- The marketing `<body>` is black; app surfaces set their own `bg-canvas-light`.
- `design/revolut.md` is a reverse-engineering analysis (`version: alpha`) — it describes
  Revolut's system, and this repo follows it. When a rule here and the analysis disagree,
  say so rather than silently picking one.

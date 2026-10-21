# The Revolut system — every web surface

Source of truth: `design/revolut.md`. In force for `web/` — the landing page
(`web/app/page.tsx`) and the product app (`web/app/app/*`, served at `/app`).
This is the **target system for the whole repo**; mobile follows it after migration.

Loaded from `design-enforcement`. This is the only vocabulary in the repo; the old
vocabulary — see `calm-finance-mobile.md`.

## Rules that are structural, not decorative

- **No shadows at all.** "The system has no traditional drop-shadow language."
  Depth is a 1px hairline plus canvas/soft/elevated luminance steps. `shadow-ambient`
  and every `shadow-*` utility are leftovers from the deleted Calm system.
- **Two canvases, not a theme pair.** `canvas-light` (#fff) for product surfaces,
  `canvas-dark` (#000) for chrome and storytelling. There is **no light/dark mode
  equivalence requirement** here — that rule went with Calm. Do not add a `.dark`
  block for a web surface.
- **One radius, not a pill.** Surfaces and controls are `rounded-md` (12px) — buttons and
  inputs alike; chips and badges are `rounded-sm` (8px). **Circles stay circles**:
  `rounded-full` is for avatars, status dots and round icon buttons only. `rounded-lg` and
  `rounded-xl` are reserved for photography chrome. (This supersedes an earlier "everything
  is a pill" line; `design/revolut.md` is the source of truth and the owner has ruled the
  product squarer than the original reference.)
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
  focus-visible:ring-offset-canvas-light`). The statement is **two** `<label htmlFor>` runs
  either side of the `/terms` `<Link>`, and the input is named by the sentence's own element
  through `aria-labelledby`: clicking either text run toggles the box, clicking the link
  navigates, and the announced name is the full sentence, `Terms of Use` included. Do not
  wrap the statement in one label to shorten the markup — a link inside a label is
  interactive content in a label, and Chrome then follows neither the link nor the control,
  so the consent asks a customer to accept a document that silently does not open. A
  note here once said the single-label version was verified to navigate; it had not been,
  so the check that counts is a real pointer click on the link, never the markup reading
  plausibly. Because a
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
- **A named duration utility does not exist: `duration-quick` compiles to NOTHING.**
  Tailwind v4 has an `--ease-*` namespace (so `ease-out` really is a utility) but no
  `--duration-*` one, and `duration-<number>` only accepts bare numbers. `duration-quick`
  looks right and silently emits no rule, so a transition falls back to Tailwind's
  default 150ms — verified: zero `.duration-quick` selectors in the compiled CSS while
  `@theme` declared the token. Reach a token by variable instead:
  `duration-(--duration-quick)` (arbitrary-value shorthand) compiles to
  `transition-duration: var(--duration-quick)` and *does* pull the variable into the
  emitted `:root`. Same shape as the `--text-body-md-bold` trap — grep the built CSS for
  the selector before trusting a class name.
- The motion tokens live in a plain `@theme` block in `globals.css` (a real value, not a
  `@theme inline` mapping of a `:root` declaration): a custom property that references
  itself is invalid at computed-value time, so the landing's first build resolved
  `duration-quick` to nothing. The vocabulary is shared, the DIALS are not — the landing's
  ambient layer is in `globals.css`, the app's feedback-only layer is in
  `web/app/app/motion.css`, imported by `app/app/layout.tsx`. A route that lives OUTSIDE
  `/app` (a proof harness, a public page) does not get that sheet or its classes.
- **`Card` bakes `p-8`, and no caller can reduce it.** Same `cn()` join rule as above:
  `p-5` in `className` loses to the primitive's `p-8`. A *variant* is safe
  (`sm:p-8` beats a base `p-8`), but a base override is not — so a card is 32px of padding
  on a 360px screen and there is no in-caller fix. Change the primitive, or accept it.
- **`Skeleton` cannot be dark or circular.** It is `bg-surface-soft` with `rounded-md`
  baked in, and `cn()` is a join, so `bg-surface-elevated` and `rounded-full` both lose.
  A skeleton inside a dark surface (a hero, a dark panel) or standing in for a circular
  avatar has to be a real span with the token classes. Same finding for `Text`: it
  forwards no `ref`, so anything needing a DOM node (a change-highlight class, a
  measurement) drops to a real element with the variant's own classes copied.
- The product app's route segment is `app/app/`, because a group `app/(app)/` would map
  to `/` and collide with the landing page.
- The marketing `<body>` is black; app surfaces set their own `bg-canvas-light`.
- `design/revolut.md` is a reverse-engineering analysis (`version: alpha`) — it describes
  Revolut's system, and this repo follows it. When a rule here and the analysis disagree,
  say so rather than silently picking one.

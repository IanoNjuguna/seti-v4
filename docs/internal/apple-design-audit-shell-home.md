# Apple-principles audit — app shell, rail, bottom bar, Home

Scope: `web/components/app/**` (shell), `web/components/home/**` (Home + the send
panel it opens), `web/app/app/page.tsx`. Governing references:
`.agents/skills/apple-design/SKILL.md`, `.agents/skills/design-enforcement/SKILL.md`
with `design/revolut.md`, `.agents/skills/modular-ui-refactor/SKILL.md`.

Method: findings written first (`file:line` → Apple principle → one-sentence fix),
then the smallest in-vocabulary change per finding. No behaviour changes, no new
navigation pattern, no surface introduced, existing decisions preserved.

Legend: **[fix]** changed in this pass · **[kept]** found, deliberately not changed
(reason given).

## Verification

**Gate.** `npm run typecheck --workspace web` → exit 0, no diagnostics.
`npm run lint --workspace web` → 6 problems, 0 errors, 6 warnings — the same six
`<img>` warnings the tree had before this pass (one of them is `AppRail`'s phoenix
mark, untouched here). No seventh warning was added.

**Every utility this pass introduces was compiled against the repo's own
`globals.css` with the repo's Tailwind 4.3.3 (`@tailwindcss/postcss`), and the
emitted declarations read back** — a fix that silently compiles to nothing would be
the same defect it was meant to cure:

| class | emitted |
| --- | --- |
| `after:absolute` | `content: var(--tw-content); position: absolute` |
| `after:inset-x-0` | `inset-inline: 0px` |
| `after:-inset-y-3` | `inset-block: calc(var(--spacing) * -3)` (−12px) |
| `after:content-['']` | `--tw-content: ''; content: var(--tw-content)` (required — without it the box never renders) |
| `duration-(--duration-quick)` | `transition-duration: var(--duration-quick)` |
| `active:bg-surface-elevated` | `background-color: var(--color-surface-elevated)` |
| `text-heading-md` (new variant) | `font-size: 24px; line-height: 1.33` |

**Font-size emission order**, measured in that controlled compile (earliest first):
`body-md` 7058 · `body-md-bold` 7190 · `display-lg` 7327 · `display-md` 7464 ·
`display-xxl` 7600 · `heading-lg` 7755 · `body-lg` 7892 · `body-sm` 7977 ·
`caption` 8062 · `heading-md` 8146 · **`heading-sm` 8234**. The order is Tailwind's
own fixed sort — not the `@theme` order and not the call order — and `heading-sm`
lands last of the family. That single fact decides F1 (a real bug), N14 (a real bug)
and N15 (not a bug), so it was measured rather than assumed.

---

## Verified by compile (the one rendering bug)

**F1 · `components/app/AppRail.tsx:43` — a size resolved by Tailwind's emission
order, not by the code. [fix]**
`<Text variant="section" … className="text-heading-md">` emits TWO font-size
utilities (`text-heading-sm` from `section`, `text-heading-md` from the className)
through `cn()`, which is a plain join. Tailwind emits these in a fixed order that is
neither the `@theme` order nor the call order, and `text-heading-sm` is emitted last
of the family — measured twice: in the app's own dev sheet (`.text-heading-md`
@32869 → `.text-heading-sm` @32958) and in a controlled compile of `globals.css`
(`.text-heading-md` @8146 → `.text-heading-sm` @8234) — so the LAST emitted wins and
the wordmark renders at 20px, not the 24px the comment says was chosen ("a 20px
wordmark over 48px rows read as a label on the list"). Apple §16.7 Craft (nothing
random — every value deliberate) and §15 Typography (hierarchy from size + weight,
not accident). Identical class of bug to the colour-order defect already documented
in `components/ui/Text.constants.ts`.
**Fix:** expose `heading-md` as a `Text` variant (precedent in `globals.css`:
`body-md-bold` "had to be added when the app's row titles and amounts needed it"),
then use one variant — one size class can never lose to another.

## Apple §1 Response — feedback arrives on pointer-down

**F2 · `components/app/AppNavLink.tsx:42-54` — the tab bar is inert on touch. [fix]**
The app's most-tapped control changes only on `hover:` (desktop) and its fill only
appears once the route has already changed. Nothing tells the customer the tap
landed. Apple §1: "Respond on pointer-down, not on release… Waiting for
click/touch-up to show feedback feels dead." §10 Tap: "highlight on touch-down."
**Fix:** `active:bg-surface-elevated` on the rail row and on the bar's icon well —
the press previews the arrival, in the two dark steps the rail already uses. The
app's existing touch-feedback idiom is the same idea (`active:scale-[0.98]` in
`Button.constants.ts`, `QuickActions`); a tab bar gets a fill rather than a scale,
which is how a tab bar reads.

**F3 · `components/home/BalanceFigure.tsx:66` — the hide-balance control has no
press state and no duration token. [fix]**
`transition-colors` with no `active:` state and Tailwind's default 150ms. Same
Apple §1 principle as F2, and §16.7 for the timing. It sits on the hero, next to
the one figure it changes, which is exactly where feedback should be instant.
**Fix:** `duration-(--duration-quick) ease-out` plus
`active:bg-surface-elevated active:text-on-dark`.

## Apple §16.7 Craft — timings come from the vocabulary

**F4 · `components/app/AppNavLink.tsx:43,51` and `components/app/RailNetworkRow.tsx:39`
— `duration-200`, a literal. [fix]**
The app declares its motion vocabulary in `globals.css`
(`--duration-instant` 90ms, `--duration-quick` 160ms, `--duration-base` 240ms) and
the primitive layer's newer variants already read it
(`Button.constants.ts` → `duration-(--duration-quick) ease-out`). A literal 200ms
is a fourth duration nothing else uses. Apple §16.7: "every spacing, timing, and
alignment value is a deliberate choice you can defend."
**Fix:** `duration-(--duration-quick) ease-out` in all three places.

## Apple §10 / §16.5 — tap targets

**F5 · `components/home/HomeActivitySection.tsx:31-36` — "See all" is a bare
14px link (~55×20px). [fix]**
Under the 44px floor the system applies everywhere else (`min-touch`) and under the
doc's own 48px control floor. Apple §10: "Add ~10px of hysteresis/hit padding
around the target"; §16.5 Flexibility: design for the full range of abilities and
contexts (this is a thumb target on a phone). The identical link on Profile
(`ProfileHandleEmpty.tsx:8`) already carries `inline-flex min-touch items-center`.
**Fix:** the same two classes, so one link shape exists in two places.

## design-enforcement invariant — compose from the primitives

**F6 · `components/home/QuickActions.tsx:54`, `components/home/HomeGreeting.tsx:27`
— two Text primitives re-spelled by hand. [fix]**
`text-body-sm font-semibold text-ink` *is* `Text variant="tab" color="primary"`;
`font-semibold text-ink` inside a `body` line *is* `variant="body-medium"
color="primary"`. Apple §16.4 Familiarity ("things that look the same must behave
the same and live in the same place") plus the skill's own "compose from the shared
primitives before writing custom markup". Zero visual change.

---

## Found, deliberately not changed

**N1 · Rail and bar are opaque black, not translucent material (Apple §12).**
`design/revolut.md`'s `nav-bar` component fixes chrome as `canvas-dark`, 64px, and
`globals.css` states the rule flatly: "Chrome (nav) is black in both." The
surface's source of truth outranks the general Apple §12 treatment; a
`backdrop-filter` rail would be off-system.

**N2 · `/app` has no `h1`.** `HomeActivitySection` opens at `h2`, while every
sibling page declares its own (`receive`, `profile`, `activity`, `send`,
`onboarding`). Apple §16 Wayfinding ("where am I?") and heading order. Not fixed
because the page's name is a copy decision that collides with N3, and the obvious
candidate — the greeting — is client-only and null in the server render, so it
cannot be the title.

**N3 · The nav label "Home" is a vague umbrella.** Apple §16.6: "Name nav items for
their contents ('Progress', 'Library'), not vague umbrellas ('Home')." Renaming it
moves `APP_NAV_ITEMS`, the route and the page title together — an IA decision, not
layout polish.

**N4 · No tab is active on `/app/send`, `/app/receive`, `/app/pay`,
`/app/merchant`.** `useAppNav` matches exactly, and that is documented and
deliberate (a prefix match marks Home active on every screen). Apple §16.4 could
argue every screen should say where you are; those routes are tasks reached *from*
Home, not places, and the rule is a recorded decision.

**N5 · `RailIdentitySignedOut` labels its one control "Not signed in".** A state
where a control's label should map to what it does (Apple §16.6/§16.7). The
wording is defended at length in `RailIdentity.constants.ts`; it is the owner's
copy call.

**N6 · No `prefers-contrast: more` or `prefers-reduced-transparency: reduce`
treatment (Apple §14).** Moot while the chrome is opaque (N1); a repo-wide token
concern, not a shell one.

**N7 · `animate-spin` (`SendSubmit`, `Button`) and `animate-pulse` (`Skeleton`, so
every Home skeleton on load) are not gated by `prefers-reduced-motion`.** Apple
§14. A `components/ui` change that reaches the whole app, outside this audit's
surfaces.

**N8 · The rail width is restated three times.** `AppRail.tsx:36` `w-56`,
`AppShell.tsx:31` `md:pl-56`, `PracticeFrame.tsx:44` `md:ml-56` — the same drift
hazard the `--app-nav-*` tokens exist to kill ("neither restates a number"). Not an
Apple-principle violation today (all three are rem, so they scale together), and
the fix lands in `globals.css`, which is also the landing page's token and motion
file. Left as a three-line follow-up for its owner.

**N9 · `SendResolvedRecipient` wears `rounded-md border border-hairline-light`.**
It plates an identity *object* — the name, the address that will actually be
signed, and the verification badge — on `/app/send`, the same call `MerchantCard`
makes. The "no box around words" rule governs Home, and Home has no box.

**N10 · The balance hero and the chrome share one material (`canvas-dark`).** Apple
§12 says material weight encodes hierarchy: heavier for structural regions,
lighter for interactive content. The hero's black is a documented Revolut call
("canvas-dark is how the Revolut system signals a premium focal surface") and holds
the card apart from the white canvas. Changing it undoes a decision.

**N11 · The action strip's first icon well sits 8px inside the page's text axis**
(`px-2` on the tile, `QuickActions.tsx:29`). `px-2` is load-bearing for the 44px
tap target at both ends of the label range and the wells are centred on their
labels — an iOS-shortcut row, not a stray offset.

**N12 · A Home row's hairline and its text do not share an axis.** `TransactionRow`
carries `px-5` inside the shell's own `px-5`, so the separator spans the column
while its text starts 20px further in, and neither aligns with the page heading
(Apple §16.7 alignment). The padding lives in the shared primitive the Activity
page renders too; moving it moves a surface another agent holds.

**N13 · iOS overscroll on `/app` flashes black.** `globals.css` sets
`body { background: var(--color-canvas-dark) }`, which is the landing page's black
by design, so the white app canvas reveals it at the rubber-band edge (Apple §11 /
§16.7). The root background is a site-level decision, not the shell's.

**N14 · `components/signin/SignInHandoff.tsx:60` carries F1 verbatim** —
`variant="section"` plus `className="text-heading-md"`, so the handoff's wordmark is
20px where the code asks for 24. `components/signin/**` is held by another agent
right now, so it is reported and not touched. One line, now that the variant exists:
`<Text variant="heading-md" as="span" color="inverse">`.

**N15 · the same collision pattern on the public pages resolves the OTHER way —
checked, no defect. [kept: nothing to fix]**
`components/person-public/PersonPublicView.tsx:22` and
`components/merchant-public/MerchantPublicView.tsx:21` are `<Text variant="micro"
as="p" color="primary" className="font-brand text-heading-sm">` — `micro` carries
`text-body-sm` (14px) and the className asks for `text-heading-sm` (20px). This
looked like a repeat of F1 the other way round, and it is not: `text-body-sm` is
emitted BEFORE `text-heading-sm` (7977 vs 8234 in the controlled compile), so the
class wins and both pages render the 20px brand name the code intends. Recorded
because the pair of classes is ambiguous to read and the two collisions in this
audit look identical on the page but resolve in opposite directions — the fix is to
prefer a variant, not to reorder anything.

---

## Left standing (checked, compliant — do not "fix")

- Icon wells in the bottom bar (`h-8 w-12 rounded-md`) and the Home action strip
  (`h-12 w-12 rounded-md`) are the same squircle, matching the strip's skeleton.
  Words are still on the page: the only surfaces are the hero, the field wells and
  the quote inset.
- Nav destinations are Home / Activity / Profile in both navs, in the same order,
  from one constant, with the same 48px rail rows and 64px bar row.
- The rail states nothing about who is signed in; its foot is the signed-out
  sign-in link and `null` when signed in. No identity component was re-added.
- Active nav state is a shape *and* a luminance step (`surface-elevated` in both
  layouts) plus `aria-current="page"` — never colour alone.
- `AppShell`'s bottom padding, `AppNav`'s height and `AppLoading`'s column all read
  `--app-nav-reserved` / `--app-nav-clearance`; the rail/bar split is one
  `md:flex` / `md:hidden` pair, no third pattern.
- Home's loading state promises no number and no skeleton for a viewer with no
  account; `BalanceNote` / `NO_ACCOUNT_COPY` still say the fact in words. The
  send panel's in-flight states narrate (`role="status"`, button's own 48px held)
  and a quote is never shown as a figure before the server answers.
- Typography on these surfaces uses size-specific tracking (the tokens carry it),
  tabular figures on every amount, and one radius language (`rounded-md` surfaces
  and controls, `rounded-full` for the hide control and the avatar dots only).

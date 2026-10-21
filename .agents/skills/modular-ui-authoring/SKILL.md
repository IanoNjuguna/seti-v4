---
name: modular-ui-authoring
description: Write new UI code modular from the start — typed hooks, types/constants files, <80-line components — so it never needs a modularity refactor later
type: prompt
whenToUse: When the user asks to create, build, scaffold, or add a new UI component, screen, view, or feature in this repository — mobile (React Native / Expo) or web (Next.js)
---

# Modular UI Authoring

Write new UI code in its final modular shape from the first commit. The structure enforced here is identical to what `modular-ui-refactor` produces — code written this way never needs that refactor. If you are changing existing UI instead, use `modular-ui-refactor`; also follow `design-enforcement` for all styling, which is where the per-surface design system is decided.

## The web app (`web/`) — same structure, different runtime

The product web app is Next 16 (App Router) in `web/`, and the modular structure
above applies unchanged: one folder per feature, `.types.ts` / `.constants.ts`,
logic in a `use*` hook, components under 80 lines. What differs is the runtime,
and five things bite:

- **Route segment, not a route group.** `app/(app)/page.tsx` maps to `/` and
  collides with the marketing page. The app lives in `web/app/app/…` so the URLs
  are `/app`, `/app/pay`, `/app/activity`, `/app/profile`. `web/tsconfig.json`
  maps `@/*` → `web/`, so the same `@/components/ui` import style works.
- **`react-hooks/set-state-in-effect` is an error here** (React Compiler rules via
  eslint-config-next). A `useCallback` that fetches and is then `void load()`ed
  from an effect is rejected *even when every setState sits after an `await`*.
  Fetch inside the effect and write state only from `.then/.catch/.finally`
  callbacks, guard with an `active` flag, and derive `loading` instead of storing
  it. For a client-only value, use
  `useSyncExternalStore(subscribe, getClient, getServerReturningNull)`.
- **Nothing derived from `new Date()` may be computed during render.** The server
  renders it with its own clock, so every user in a different timezone hydrates a
  different string. This never bites on mobile.
- **Tailwind v4 is CSS-first, and there is no dark mode on web.** `web/` has no
  `tailwind.config.js`: tokens are `:root` custom properties mapped with
  `@theme inline` in `web/app/globals.css`. The Revolut system expresses its two
  canvases as *tokens* (`canvas-light` / `canvas-dark`, `surface-soft` /
  `surface-elevated`) rather than as a `.dark` theme flip, so there is no
  per-element light/dark pair to write: the canvas IS a token, and a component
  inherits it. RN's `active:` becomes
  `hover:`/`active:`/`focus-visible:`; `duration-press` is not a token — use
  `duration-[120ms]`. v4 derives spacing from one unit, so `p-4.5` is 18px with
  no token.
- **`web/`'s typecheck and lint are already in `npm run verify`**, so new web code
  is gated automatically — no script changes needed.

### One design system, one vocabulary

`web/` (landing page **and** the product app) follows `design/revolut.md`, and its
tokens are already declared in `web/app/globals.css`: `bg-canvas-light`, `text-ink`,
`border-hairline-light`, `rounded-lg`, `bg-surface-soft`, `text-caption`,
`text-body-md-bold`. One system governs every surface, so there is no second
vocabulary to translate to. Do not declare alias tokens for a surface and do not
introduce `--seti-*`-style raw names to "bridge" the two systems — that was tried,
it produced a duplicate vocabulary that silently rotted, and it is removed. If the
token you want is missing, add it to the surface's own system and say so.

**Verify the render, not the typecheck.** A Tailwind v4 token that never compiles
yields an unstyled page that passes `tsc` and `eslint` cleanly:

```bash
curl -s localhost:<port>/app -o /tmp/app.html        # 200 plus the expected copy
grep -oE '/_next/static/[^"]+\.css' /tmp/app.html    # fetch that CSS, then grep for
#   .bg-canvas-light, .text-ink, .border-hairline-light, .text-body-md-bold
```

A class that greps to **zero** is the signature of a missing theme token (exactly
how the missing `--text-body-md-bold` was caught), not of a typo in the component.
When another `next dev` already holds the directory, render it anyway — see
`references/verifying-a-web-render.md`.

## Before writing anything

1. **Confirm the target surface before anything else.** Mobile is React Native + Expo — no SSR, no `next/image`, no `next/link`, no App Router, every screen client-side. Web is the Next 16 App Router app in `web/` — server components by default, client components only where interactivity or browser APIs require them. The two share the modular structure and nothing else, including the design system (see `design-enforcement`).
2. **Find the in-repo pattern** for the feature you're adding and match it: folder naming (kebab-case subfolder per feature), export style, code style (tabs vs spaces, quotes), styling approach (NativeWind classes vs `StyleSheet`, or Tailwind classes on web).
3. **Verify dependencies before importing them** — check `package.json`; never assume a library exists.

## File structure for any non-trivial component

A component with state, handlers, or more than one visual section is a **module**, not a file:

- `components/<feature-name>/` — kebab-case subfolder holding the parts
- `[ComponentName].types.ts` — all props interfaces and shared types, exported explicitly
- `[ComponentName].constants.ts` — static values (keys, endpoints, timings, copy constants)
- `use[ComponentName].ts` — all non-render logic (state, effects, handlers, derived values, fetching), exporting a typed return interface (`UseComponentNameReturn`)
- Subcomponents — one per distinct UI section, each with an explicit props interface
- The public file (e.g. `components/ComponentName.tsx`) — a thin composed parent wiring hook → subcomponents

For screen-level modules, mirror the same pattern under `app/screens/<screen-name>/` (mobile) or the route's folder in `web/app/` (web).

## Hard rules

- **< 80 lines per UI component file.** If a draft crosses the limit, split before writing more — don't finish and plan to refactor later.
- **No inline logic in JSX.** Derived values, formatting, and conditionals beyond trivial ternaries belong in the hook or a named function.
- **Strict TypeScript:** explicit interfaces for every props object and hook return. No `any`/`unknown`; narrow unions and literal types over loose shapes.
- **Platform primitives first.** Mobile: `<View>`, `<Text>`, `<Pressable>`, `<TextInput>`, `<FlatList>` from `react-native` before reaching for libraries (`<Image>` from `expo-image` if installed). Web: the project's own `components/ui/` primitives before raw markup.
- **Stable public API:** choose default vs named export to match neighboring modules; once imported elsewhere, the path and export style are a contract.
- **Accessibility from the start:** accessible labels, focus/activation states, touch targets ≥ 44×44 pt, screen-reader hints — not a later pass.
- **Every async surface gets loading, empty, and error states**, with skeletons matching the layout shape.
- **No string-concatenated classNames.** Use `cn()` from the project's utility and semantic token classes from the surface's design system.

## Definition of done for new UI code

1. Every UI file < 80 lines; logic in hooks; types/constants in their own files.
2. `npx tsc --noEmit` clean (or `expo start` type-check pass if configured).
3. No new `any`, no raw hex colors, no magic numbers for spacing — use design tokens.
4. Tour / test-targeted IDs and testIDs used only for their established purpose — never renamed or duplicated.

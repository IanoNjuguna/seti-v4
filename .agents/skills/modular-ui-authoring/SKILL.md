---
name: modular-ui-authoring
description: Write new React Native / Expo UI code modular from the start — typed hooks, types/constants files, <80-line components — so it never needs a modularity refactor later
type: prompt
whenToUse: When the user asks to create, build, scaffold, or add a new React Native / Expo component, screen, view, or UI feature in this repository
---

# Modular UI Authoring

Write new UI code in its final modular shape from the first commit. The structure enforced here is identical to what `modular-ui-refactor` produces — code written this way never needs that refactor. If you are changing existing UI instead, use `modular-ui-refactor`; also follow `design-enforcement` for all styling.

## Before writing anything

1. **Confirm the target surface:** this is a React Native + Expo mobile app. There is no SSR, no `next/image`, no `next/link`, no App Router. Every screen runs in the client.
2. **Find the in-repo pattern** for the feature you're adding and match it: folder naming (kebab-case subfolder per feature), export style, code style (tabs vs spaces, quotes), styling approach (NativeWind classes vs `StyleSheet`).
3. **Verify dependencies before importing them** — check `package.json`; never assume a library exists.

## File structure for any non-trivial component

A component with state, handlers, or more than one visual section is a **module**, not a file:

- `components/<feature-name>/` — kebab-case subfolder holding the parts
- `[ComponentName].types.ts` — all props interfaces and shared types, exported explicitly
- `[ComponentName].constants.ts` — static values (keys, endpoints, timings, copy constants)
- `use[ComponentName].ts` — all non-render logic (state, effects, handlers, derived values, fetching), exporting a typed return interface (`UseComponentNameReturn`)
- Subcomponents — one per distinct UI section, each with an explicit props interface
- The public file (e.g. `components/ComponentName.tsx`) — a thin composed parent wiring hook → subcomponents

For screen-level modules, mirror the same pattern under `app/screens/<screen-name>/` or the project's established screen directory.

## Hard rules

- **< 80 lines per UI component file.** If a draft crosses the limit, split before writing more — don't finish and plan to refactor later.
- **No inline logic in JSX.** Derived values, formatting, and conditionals beyond trivial ternaries belong in the hook or a named function.
- **Strict TypeScript:** explicit interfaces for every props object and hook return. No `any`/`unknown`; narrow unions and literal types over loose shapes.
- **React Native primitives first:** prefer `<View>`, `<Text>`, `<Pressable>`, `<TextInput>`, `<FlatList>` from `react-native` before reaching for libraries. Use `<Image>` from `expo-image` if installed.
- **Stable public API:** choose default vs named export to match neighboring modules; once imported elsewhere, the path and export style are a contract.
- **Accessibility from the start:** accessible labels, focus/activation states, touch targets ≥ 44×44 pt, screen-reader hints — not a later pass.
- **Every async surface gets loading, empty, and error states**, with skeletons matching the layout shape.
- **No string-concatenated classNames.** Use `cn()` from `@/lib/cn` (or the project's utility) and semantic token classes from `DESIGN.md`.

## Definition of done for new UI code

1. Every UI file < 80 lines; logic in hooks; types/constants in their own files.
2. `npx tsc --noEmit` clean (or `expo start` type-check pass if configured).
3. No new `any`, no raw hex colors, no magic numbers for spacing — use design tokens.
4. Tour / test-targeted IDs and testIDs used only for their established purpose — never renamed or duplicated.

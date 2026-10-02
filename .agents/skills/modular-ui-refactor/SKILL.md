---
name: modular-ui-refactor
description: Refactor React Native / Expo UI source files into strict modular, maintainable, accessible code — hooks, types, constants, and <80-line subcomponents — with zero behavior changes and stable public import paths
type: prompt
whenToUse: When the user asks to refactor, split, or modularize React Native / Expo UI components, screens, or views into smaller files, extract hooks/types/constants, or enforce the <80-line component rule
---

# Modular UI Refactor

Transform large React Native / Expo UI files into small, single-responsibility modules. Behavior preservation outranks every other rule: a refactor that changes what the UI does is a failed refactor.

## Phase 0 — Recon (never skip)

1. **Confirm the framework.** This repo is a React Native + Expo mobile app. There is no SSR, no `next/image`, no `next/link`, no App Router, no RSC. All UI runs on the client.
2. **Check project conventions:** path aliases, styling approach (NativeWind vs `StyleSheet`), code style (tabs vs spaces, quotes), and existing refactored modules to use as the in-repo pattern.
3. **Map consumers first.** Grep for every import of each target file. Catalogue the full export surface (default vs named, hooks, types). Every exported symbol must remain importable from its current path after the refactor.
4. **Establish a verification baseline:** run `npx tsc --noEmit` before touching anything, so pre-existing errors are distinguishable from introduced ones.

## Phase 1 — Extraction rules

1. **Non-render concerns** (state, event handlers, side effects, derived logic, API calls) → custom hooks in `use[ComponentName].ts`, each exporting a typed return interface (`export interface UseComponentNameReturn { ... }`).
2. **Distinct UI sections** (header, toolbar, list, card, modal, form, footer, list item) → separate subcomponents with explicit props interfaces. Duplicated JSX blocks become ONE subcomponent parameterized by a literal-union prop (e.g. `variant: 'compact' | 'detailed'`).
3. **Static types** → `[ComponentName].types.ts`; **static values** → `[ComponentName].constants.ts`.
4. **File brevity:** every UI component file < 80 lines. Split further when exceeded. Hooks and types live in separate files; cohesive hooks may exceed 80 lines when splitting would lose cohesion (note it in the report).

## Phase 2 — Layout and stability rules

- **The original file stays at its path** as the composed parent (or a barrel re-export for infrastructure modules like `Providers.tsx`), keeping its exact export style (default vs named) and props signature. Extracted parts go in a sibling kebab-case subfolder (`components/payment-card/`), imported relatively.
- **React Native primitives:** keep imports from `react-native` unless the project explicitly wraps them. Do not swap `<Image>` for `next/image` or `<Pressable>` for web anchors.
- **TypeScript:** strict, explicit interfaces for all props and hook returns. No new `any`/`unknown`. Tighten existing loose typing only where consumers still compile (`catch (e: any)` → `catch (e)` + `instanceof Error` narrowing is safe).

## Phase 3 — Preservation rules (zero behavior changes)

- Preserve verbatim: JSX structure, classNames / style arrays, element IDs and `testID`s (tour-targeted IDs and automation IDs are load-bearing), accessibility props, handlers, conditional rendering, storage keys, provider nesting order, debounce/timing constants, toast messages, and all blockchain/Web3 logic.
- Allowed changes: dead-code removal (unused imports/variables), type-safe narrowing.
- Accessibility additions (labels, hints, larger touch targets) only where they don't alter visuals.
- Respect the design-enforcement skill: never restyle during a refactor.

## Phase 4 — Execution at scale

- **Batch, don't dump.** For more than a few files, work in batches of coupled files (e.g. a transaction list + its row item), writing changes directly to files — not giant code-block dumps. Parallelize independent batches.
- **Exclusions:** vendored primitives (`components/ui/*`), generated API clients, and files that must keep navigation/route config literal.

## Phase 5 — Verification and report

- `npx tsc --noEmit` must match the baseline (exit 0).
- Report per file: original → new file mapping with line counts, plus a behavior-changes list (expected: zero, plus any dead-code removals).
- Do not run `expo start` or device builds automatically unless the user asks.

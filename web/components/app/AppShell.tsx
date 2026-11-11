import type { ReactNode } from 'react';
import { AppDock } from './AppDock';
import { AppTopBar } from './AppTopBar';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * The app chrome: the frame above the content, the dock below it.
 *
 * One nav at every width (#542): the floating dock. There is no desktop rail any more, so the
 * content is no longer pushed 224px to the right of the window's edge — it is the same centred
 * column a phone gets, and the dock floats over it rather than framing it.
 *
 * The header is the FRAME and sits outside `main` (#559), which is what lets it span the viewport
 * while the column inside it stays `max-w-3xl`: a header nested in the column could only ever be
 * as wide as the column, and that is what made it a panel hovering above the page instead of the
 * window across it. `pt-4` is the step from the hairline to the first thing a page says — the page
 * titles are the top of every screen, so this number IS the app's top rhythm.
 *
 * The bottom padding is the dock's OWN reserved height plus its clearance, read from the tokens
 * that define the dock (`--app-nav-reserved`, `--app-nav-clearance` in `globals.css`). It was a
 * bare 112px literal — seven rem that happened to exceed the old bar and said nothing about it, so
 * nothing kept the two in step: raise the bar and this padding would stay put until someone
 * measured a screenshot.
 *
 * `bg-bg-canvas` and `text-text-primary` are set once here, so every screen inherits the palette
 * and dark mode flips by adding `.dark` to an ancestor — no per-screen colour work, and no raw hex
 * anywhere in a screen.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas-light text-ink">
      <AppTopBar />
      <main className="mx-auto w-full max-w-3xl px-5 pt-4 pb-[calc(var(--app-nav-reserved)_+_var(--app-nav-clearance))]">
        {children}
      </main>
      <AppDock />
    </div>
  );
}

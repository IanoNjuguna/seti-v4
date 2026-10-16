import type { ReactNode } from 'react';
import { AppNav } from './AppNav';
import { AppRail } from './AppRail';
import { PracticeFrame } from './PracticeFrame';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * The app chrome: nav, and a content column that clears whichever nav is
 * showing.
 *
 * The bottom padding is the bottom bar's OWN height plus its clearance, read
 * from the tokens that define the bar (`--app-nav-reserved`,
 * `--app-nav-clearance` in `globals.css`). It was a bare 112px literal — seven
 * rem that happened to exceed the 65px bar and said nothing about it, so nothing
 * kept the two in step: raise the bar and this padding would stay put until
 * someone measured a screenshot. From `md` up the bar is gone (the rail takes
 * over) and the padding is back to a plain step.
 *
 * `bg-bg-canvas` and `text-text-primary` are set once here, so every screen
 * inherits the palette and dark mode flips by adding `.dark` to an ancestor —
 * no per-screen colour work, and no raw hex anywhere in a screen.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas-light text-ink">
      <PracticeFrame />
      <AppRail />
      <div className="md:pl-56">
        <main className="mx-auto w-full max-w-3xl px-5 pt-6 pb-[calc(var(--app-nav-reserved)_+_var(--app-nav-clearance))] md:pb-10">
          {children}
        </main>
      </div>
      <AppNav />
    </div>
  );
}

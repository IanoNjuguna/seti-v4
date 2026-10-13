import type { ReactNode } from 'react';
import { AppNav } from './AppNav';
import { AppRail } from './AppRail';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * The app chrome: nav, and a content column that clears whichever nav is
 * showing.
 *
 * `bg-bg-canvas` and `text-text-primary` are set once here, so every screen
 * inherits the palette and dark mode flips by adding `.dark` to an ancestor —
 * no per-screen colour work, and no raw hex anywhere in a screen.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas-light text-ink">
      <AppRail />
      <div className="md:pl-56">
        <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-6 md:pb-10">{children}</main>
      </div>
      <AppNav />
    </div>
  );
}

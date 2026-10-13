import { Skeleton } from '@/components/ui';

/**
 * The gate's own loading state, and it deliberately renders NO shell.
 *
 * Both halves matter. Without the skeleton an account would see an empty page
 * while its handles are read, which reads as a broken app; with the shell it
 * would see the nav — destinations it may not be allowed to reach. So the
 * skeleton takes the app's canvas and content column but none of the chrome, and
 * it is what the SERVER renders too (the session and the handles are both client
 * reads), which is why no app surface is ever present in a server-rendered
 * document.
 */
export function AppLoading() {
  return (
    <div className="min-h-dvh bg-canvas-light text-ink">
      <main
        className="mx-auto w-full max-w-3xl px-5 pt-6 pb-28 md:pb-10"
        aria-busy="true"
      >
        <p className="sr-only">Loading your account…</p>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-4 h-40 w-full" />
        <Skeleton className="mt-6 h-16 w-full" />
        <Skeleton className="mt-4 h-16 w-full" />
      </main>
    </div>
  );
}

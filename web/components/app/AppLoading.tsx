import { CometSpinner } from '@/components/ui';

/**
 * The gate's own loading state, and it deliberately renders NO shell.
 *
 * Both halves matter. Without an indicator an account would see an empty page
 * while its handles are read, which reads as a broken app; with the shell it
 * would see the nav — destinations it may not be allowed to reach. So the frame
 * takes the app's canvas and content column but none of the chrome, and it is
 * what the SERVER renders too (the session and the handles are both client
 * reads), which is why no app surface is ever present in a server-rendered
 * document.
 *
 * It is one comet now, not four skeleton bars (#569). The bars claimed the shape
 * of the page that was coming, and the gate does not know that shape: whether
 * this account holds a handle, and therefore what the app will even contain, is
 * the question this frame is waiting on. A skeleton promises a layout; this wait
 * has none. The comet is also the object the sign-in page waits on, so the two
 * frames on either side of the code are the same indicator, and the wait is
 * announced once, by the comet's own label.
 */
export function AppLoading() {
  return (
    <div className="min-h-dvh bg-canvas-light text-ink">
      <main className="flex min-h-dvh items-center justify-center px-5" aria-busy="true">
        <CometSpinner label="Loading your account…" className="h-12 w-12 text-stone" />
      </main>
    </div>
  );
}

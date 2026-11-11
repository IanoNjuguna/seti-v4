/**
 * The dock's tail: the app's one way in, for a visitor who is not signed in (#542).
 *
 * This is where the rail's foot went. The rail carried a signed-out card pinned to its bottom
 * edge — the only sign-in affordance anywhere in `/app` — and a dock-only shell has no foot, so
 * the affordance has to live in the dock or a visitor lands in the app with no door.
 *
 * Signed in it renders NOTHING, not an empty slot: the dock is chrome and chrome does not hold a
 * place open for a control that is not there. `restoring` gets a bar rather than the link, because
 * telling a customer who IS signed in to sign in, even for a frame, is the one thing this control
 * must not do.
 *
 * The word is `Sign in`, an action, not the rail's `Not signed in`, a status: the rail had a
 * sentence's worth of room to explain itself and this has one row. It goes to `/signin`
 * (`SIGN_IN_PATH`), the product's front door — the full sign-in surface needs room for terms and
 * the email step, and a bank does not put its front door inside a room.
 */
import Link from 'next/link';
import { Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { useSession } from '@/lib/auth';

export function DockSignIn() {
  const session = useSession();

  if (session.status === 'signed-in') return null;

  if (session.status === 'restoring') {
    return (
      <span aria-hidden className="ml-1 flex h-11 w-16 items-center justify-center">
        <span className="block h-3 w-10 rounded-sm bg-hairline-dark" />
      </span>
    );
  }

  return (
    <>
      <span aria-hidden className="mx-2 h-6 w-px shrink-0 bg-hairline-dark" />
      <Link
        href={SIGN_IN_PATH}
        className="flex h-11 whitespace-nowrap items-center rounded-lg px-2 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Text variant="tab" as="span" color="inverse">
          Sign in
        </Text>
      </Link>
    </>
  );
}

import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { SignInFailureProps } from './SignInScreen.types';

/**
 * Something went wrong, said plainly, ON the page.
 *
 * It used to be `rounded-md border border-hairline-dark bg-surface-elevated p-4`:
 * a bordered, padded, background-filled surface drawn around a title and one
 * sentence. That is the box the system already took away from its own failure
 * shape (`StateMessage variant="failure"`): text lives on the page, only objects
 * get a surface, and a box around two sentences is a box around the page's own
 * words.
 *
 * So the shape here is that primitive's shape — a medallion, a title, the reason —
 * not a card. The medallion is the one object, and it is the reason the failure is
 * not signalled by colour alone: the alert mark reads to somebody who cannot see
 * the tint, and the title names it.
 *
 * It is still NOT `StateMessage variant="failure"` itself. That shape draws its
 * copy in `ink` and `mute`, the light-canvas text colours, so on this black band
 * it would render dark grey on black — an invisible error, which is worse than
 * none. The roles here are the canvas's own: `on-dark` for the title (21:1) and
 * `on-dark-mute` for the sentence (10.6:1), both clear of AA.
 *
 * `role="alert"` is the whole point of the component: a failure that is only
 * drawn, never announced, is a failure a screen reader never hears. The FIX is
 * the control the visitor was already reaching for, directly below.
 */
export function SignInFailure({ error }: SignInFailureProps) {
  return (
    <div role="alert" className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-accent-danger"
      >
        <Icon name="alert" className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <Text variant="card-title" as="p" color="inverse">
          {error.title}
        </Text>
        <Text variant="body" as="p" color="inverse-muted" className="mt-1">
          {error.message}
        </Text>
      </div>
    </div>
  );
}

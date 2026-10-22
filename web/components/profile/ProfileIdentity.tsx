import { Badge, Text } from '@/components/ui';
import type { ProfileIdentityProps } from './ProfileIdentity.types';

/**
 * Who this page is about, standing where the page title used to be.
 *
 * A 64px medallion with the account's own initial, the name at `heading-md`, and
 * the handle underneath as a soft tag. There is no page noun above it: the word
 * "Profile" told a person nothing they had not just told the app by pressing the
 * tab, and it held the one position at the top of the page that should belong to
 * the person.
 *
 * The name is the `h1`, so the document opens on the customer rather than on the
 * route, and the sections below it hang off that heading. The medallion is
 * `surface-soft`, the same well a shortcut's mark uses, so the identity and the
 * list under it read as one column instead of a header over a page.
 *
 * The handle is not a control. It is the string a sender types, drawn small and
 * secondary: the copy control for it belongs to the surfaces that hand it out
 * (Receive), and a tap here that copied something would be an unlabelled action on
 * a settings page.
 */
export function ProfileIdentity({ name, handle, initial }: ProfileIdentityProps) {
  return (
    <header className="flex items-center gap-4">
      <span
        aria-hidden
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-soft"
      >
        <Text variant="heading-md" as="span">
          {initial}
        </Text>
      </span>

      <span className="flex min-w-0 flex-col items-start gap-1">
        <Text variant="heading-md" as="h1" className="w-full truncate">
          {name}
        </Text>

        {handle ? <Badge>@{handle}</Badge> : null}
      </span>
    </header>
  );
}

import { Badge, Mark, Text } from '@/components/ui';
import type { ProfileIdentityProps } from './ProfileIdentity.types';

/**
 * Who this page is about, standing where the page title used to be.
 *
 * A 64px mark, the name at `heading-md`, and the handle underneath as a soft tag. There is
 * no page noun above it: the word "Profile" told a person nothing they had not just told the
 * app by pressing the tab, and it held the one position at the top of the page that should
 * belong to the person.
 *
 * The mark is `Mark` at `lg`, so it is the same object as the 40px well a row uses, one step
 * larger: initials from the name, on a tone derived from the account. It used to be a single
 * letter on `surface-soft`, which made every account look identical. Gravatar was the other
 * option and it is the wrong one: a Gravatar URL is the md5 of an email address, so serving
 * one hands an email-derived identifier to a third party on every profile view, and our own
 * CSP (`img-src 'self'`) blocks it anyway. See `Mark`.
 *
 * The name is the `h1`, so the document opens on the customer rather than on the route, and
 * the sections below it hang off that heading.
 *
 * The handle is not a control. It is the string a sender types, drawn small and secondary:
 * the copy control for it belongs to the surfaces that hand it out (Receive), and a tap here
 * that copied something would be an unlabelled action on a settings page.
 */
export function ProfileIdentity({ name, handle }: ProfileIdentityProps) {
  return (
    <header className="flex items-center gap-4">
      <Mark size="lg" handle={handle ?? name} />

      <span className="flex min-w-0 flex-col items-start gap-1">
        <Text variant="heading-md" as="h1" className="w-full truncate">
          {name}
        </Text>

        {handle ? <Badge>@{handle}</Badge> : null}
      </span>
    </header>
  );
}

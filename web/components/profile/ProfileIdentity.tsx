import { Mark, Text } from '@/components/ui';
import type { ProfileIdentityProps } from './ProfileIdentity.types';

/**
 * Who this page is about, standing where the page title used to be.
 *
 * A 64px mark, the name at `heading-md`, and the handle underneath as a soft tag. There is
 * no page noun above it: the word "Profile" told a person nothing they had not just told the
 * app by pressing the tab, and it held the one position at the top of the page that should
 * belong to the person.
 *
 * The mark is `Mark` at `lg`: the product's own face in the 64px well — the same smiling alien
 * the sign-in page opens with, one size up. It used to be two letters from the username on a
 * tone hashed from it, and the owner replaced that with our face: an account in Seti looks like
 * Seti, and the `@handle` printed under the name is what identifies the person. Gravatar was
 * the other option and it is the wrong one for the same reason `Mark` records: the URL is the
 * md5 of an email address, so serving one hands an email-derived identifier to a third party on
 * every profile view, and our own CSP (`img-src 'self'`) blocks it anyway.
 *
 * The name is the `h1`, so the document opens on the customer rather than on the route, and the
 * sections below it hang off that heading.
 *
 * The handle is not a control. It is the string a sender types, drawn small and secondary:
 * the copy control for it belongs to the surfaces that hand it out (Receive), and a tap here
 * that copied something would be an unlabelled action on a settings page.
 */
export function ProfileIdentity({ name, handle }: ProfileIdentityProps) {
  return (
    <header className="flex items-center gap-4">
      <Mark size="lg" />

      <span className="flex min-w-0 flex-col items-start gap-1">
        <Text variant="heading-md" as="h1" className="w-full truncate">
          {name}
        </Text>

        {/* Plain text, not a chip (#498): every account page in the reference set prints the
            identifier under the name as a quiet line — X's @handle, Uphold's email, ChatGPT's
            account address — and a bordered badge reads as a status rather than as a name. */}
        {handle ? (
          <Text variant="micro" as="span" color="secondary">
            {`@${handle}`}
          </Text>
        ) : null}
      </span>
    </header>
  );
}

import { Text } from '@/components/ui';
import { PROFILE_LEGAL_LINKS } from './ProfileLegal.constants';
import { PROFILE_PAGE_COPY } from './ProfilePage.constants';
import { ProfileRow } from './ProfileRow';

/**
 * Legal, as three rows instead of a cobalt block.
 *
 * The links used to be the loudest thing on the page: semibold cobalt, three of
 * them stacked, in the one place the eye lands after the title. Nothing about a
 * policy is a call to action, so they are ordinary rows now: same ink as the
 * settings above them, a chevron because they lead somewhere, and `Legal` as a
 * label rather than a heading, because the group is a place in the list rather
 * than a section of the page.
 *
 * The label is the block's own `micro` line and the hairline above the block comes
 * from the list that holds it, so there is exactly one rule between the last
 * settings row and the first document.
 */
export function ProfileLegalRows() {
  return (
    <div className="flex flex-col gap-1 pt-4">
      <Text variant="micro" as="h3" color="secondary">
        {PROFILE_PAGE_COPY.legalLabel}
      </Text>

      <div className="flex flex-col divide-y divide-hairline-light">
        {PROFILE_LEGAL_LINKS.map((document) => (
          <ProfileRow key={document.href} title={document.title} href={document.href} />
        ))}
      </div>
    </div>
  );
}

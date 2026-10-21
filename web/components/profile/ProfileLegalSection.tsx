import { PROFILE_PAGE_COPY } from './ProfilePage.constants';
import { ProfileLegalCard } from './ProfileLegalCard';
import { ProfileSection } from './ProfileSection';

/**
 * The legal row — the page's heading and the three documents, on the page's own
 * canvas.
 *
 * The heading belongs to the page (`PROFILE_PAGE_COPY.legalTitle`, the same treatment
 * every other row's heading gets) and the links are the object, so the only thing this
 * row adds to `ProfileLegalCard` is the page's own shape around it. It is the row both
 * the signed-in page and the signed-out shape render, so the page does not grow a
 * second spelling of the same three links.
 */
export function ProfileLegalSection() {
  return (
    <ProfileSection icon="document" title={PROFILE_PAGE_COPY.legalTitle}>
      <ProfileLegalCard />
    </ProfileSection>
  );
}

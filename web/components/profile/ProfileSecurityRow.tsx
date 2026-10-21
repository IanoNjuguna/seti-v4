import { ButtonLink, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { PROFILE_SECURITY_COPY } from './ProfilePage.constants';

/**
 * The way into the security screen.
 *
 * A row, not a section: it carries no state of its own and makes no claim, so it is a
 * name, one line of why, and a destination. The whole row is the link, because a
 * settings list where only the chevron is tappable is a list of near misses.
 */
export function ProfileSecurityRow() {
  return (
    <section className="border-t border-hairline-light pt-6">
      <ButtonLink
        href={PROFILE_SECURITY_COPY.href}
        variant="ghost"
        className="min-h-12 w-full justify-between px-0"
      >
        <span className="flex min-w-0 flex-col items-start text-left">
          <Text variant="card-title" as="span">
            {PROFILE_SECURITY_COPY.title}
          </Text>
          <Text variant="micro" as="span" color="secondary">
            {PROFILE_SECURITY_COPY.intro}
          </Text>
        </span>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0" />
      </ButtonLink>
    </section>
  );
}

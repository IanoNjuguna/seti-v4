import Link from 'next/link';
import { Text } from '@/components/ui';
import { HANDLE_KIND_FOR_INTENT } from '@/lib/account';
import { PROFILE_INTENT_COPY, claimHref } from './ProfileIntent.constants';
import type { ProfileHandleEmptyProps } from './ProfileIntent.types';

const LINK_CLASS =
  'mt-3 inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The mode has no name yet: what a name is FOR, and the one way to claim one.
 *
 * It is its own block rather than the top half of the handle panel's `if`,
 * because it renders a different thing — no value, nothing to copy, no code —
 * and the panel is long enough that keeping both in one file pushed it past the
 * size a component should be. The words are still the mode row's
 * (`PROFILE_INTENT_COPY`); only the JSX moved.
 *
 * The action is a link, not a button: it navigates, and the claim surface is a
 * page. Which claim page is decided by the same kind mapping the panel and the
 * QR use, so a business-first account cannot be sent to the personal form.
 */
export function ProfileHandleEmpty({ intent }: ProfileHandleEmptyProps) {
  const kind = HANDLE_KIND_FOR_INTENT[intent];
  const personal = intent === 'personal';

  return (
    <div>
      <Text variant="card-title" as="p">
        {personal ? PROFILE_INTENT_COPY.emptyPersonalTitle : PROFILE_INTENT_COPY.emptyBusinessTitle}
      </Text>
      <Text variant="micro" as="p" className="mt-1">
        {personal ? PROFILE_INTENT_COPY.emptyPersonalBody : PROFILE_INTENT_COPY.emptyBusinessBody}
      </Text>
      <Link href={claimHref(kind)} className={LINK_CLASS}>
        {personal ? PROFILE_INTENT_COPY.emptyPersonalAction : PROFILE_INTENT_COPY.emptyBusinessAction}
      </Link>
    </div>
  );
}

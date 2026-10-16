import { Badge, Text } from '@/components/ui';
import { claimCopy } from '@/components/merchant/Claim.constants';
import type { ProfileHandleStatusProps } from './ProfileIntent.types';

/**
 * The state of a claimed handle: verified, waiting, or parked for review.
 *
 * The words come from the claim copy for the KIND (`claimCopy`) rather than being
 * spelled again here, so the claim surface and the profile row cannot start
 * disagreeing about what "under review" is called. A parked handle carries the
 * reviewer's own sentence under it, so a person told to wait can see what they
 * are waiting on rather than only that something is pending.
 */
export function ProfileHandleStatus({ kind, handle }: ProfileHandleStatusProps) {
  const words = claimCopy(kind);

  if (handle.review) {
    return (
      <div className="space-y-2">
        <Badge variant="neutral">{words.underReview}</Badge>
        <Text variant="micro" as="p">
          {handle.review.message}
        </Text>
      </div>
    );
  }

  return (
    <Badge variant={handle.verified ? 'success' : 'warning'}>
      {handle.verified ? words.verified : words.unverified}
    </Badge>
  );
}

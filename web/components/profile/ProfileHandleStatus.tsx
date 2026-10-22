import { Badge, Text } from '@/components/ui';
import { claimCopy } from '@/components/merchant/Claim.constants';
import type { ProfileHandleStatusProps } from './ProfileIntent.types';

/**
 * The state of a claimed handle: verified, or not.
 *
 * The words come from the claim copy for the KIND (`claimCopy`) rather than being
 * spelled again here, so the claim surface and the profile row cannot start
 * disagreeing about what the state is called.
 *
 * "Verified" is the whole statement: this signature was made by the key that
 * controls the address the name points at. It is not a claim that Seti has checked
 * who the business is — that is the KYB mark, which does not exist yet.
 */
export function ProfileHandleStatus({ kind, handle }: ProfileHandleStatusProps) {
  const words = claimCopy(kind);

  return (
    <Badge variant={handle.verified ? 'success' : 'warning'}>
      {handle.verified ? words.verified : words.unverified}
    </Badge>
  );
}

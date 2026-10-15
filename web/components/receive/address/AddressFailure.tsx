'use client';

import { Text } from '@/components/ui';
import { ADDRESS_COPY } from './address.constants';
import type { AddressFailureProps, AddressFailureState } from './address.types';

/**
 * The words for each way the address could not be confirmed.
 *
 * Kept as a named function rather than a chain of ternaries in JSX, and `switch`
 * rather than `if`, so adding a variant to `AddressFailureState` is a type error
 * here until it has copy — a state with no words is a blank panel, which is worse
 * than the wrong words because it looks like a working screen.
 */
function failureCopy(state: AddressFailureState): { title: string; body: string } {
  switch (state.status) {
    case 'wrong-network':
      return {
        title: ADDRESS_COPY.wrongNetworkTitle,
        body: ADDRESS_COPY.wrongNetworkBody(state.servedNetwork, state.buildNetwork),
      };
    case 'address-mismatch':
      return { title: ADDRESS_COPY.mismatchTitle, body: ADDRESS_COPY.mismatchBody };
    case 'unavailable':
      return { title: ADDRESS_COPY.title, body: ADDRESS_COPY.unavailable(state.network) };
    case 'unreachable':
      return { title: ADDRESS_COPY.unreachableTitle, body: ADDRESS_COPY.unreachableBody };
  }
}

/**
 * No address is shown, and the reason is named.
 *
 * Deliberately NOT a fallback address with a warning beside it. Every one of these
 * states means "which address this account is registered with, and which chain to
 * send on, have not been established together", and a plausible-looking address
 * under that sentence is the mismatched receive instruction the whole surface
 * guards against. A person who cannot see where to deposit this minute has lost
 * nothing; a person who sends on the wrong chain moneyed nobody can show them has
 * a support problem neither of them can fix from here.
 */
export function AddressFailure({ state }: AddressFailureProps) {
  const { title, body } = failureCopy(state);

  return (
    <div className="space-y-2">
      <Text variant="card-title" as="p">
        {title}
      </Text>
      <Text variant="body" as="p" color="secondary">
        {body}
      </Text>
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAccountIdentity, setAccountIntent } from '@/lib/api';
import type { AccountIntent } from '@/lib/api';
import { HANDLE_KIND_FOR_INTENT, useAccountIdentity } from '@/lib/account';
import { useSession } from '@/lib/auth';
import { useMerchantClaim } from '@/hooks/useMerchantClaim';
import { APP_HOME_PATH } from '@/components/app/AppGate.constants';
import type { OnboardingStep, UseOnboardingReturn } from './Onboarding.types';

/**
 * The onboarding wizard's state machine.
 *
 * ## The signature happens at the INTENT step, not at the name step
 *
 * This is the one ordering that matters. The chosen intent decides the handle's
 * `kind` (through `HANDLE_KIND_FOR_INTENT`), and the kind decides the `purpose`
 * inside the bytes the wallet signs — so the wallet cannot be asked to sign until
 * the person has said how they will use Seti. Step two therefore only collects the
 * name (`ClaimForm` with a continue action), and step three signs. Asking for the
 * signature at step two would mean guessing the purpose, and the backend refuses a
 * signature made for the other purpose — correctly, but the person would be told
 * their name was wrong.
 *
 * ## Why the account is re-read after the claim
 *
 * The gate decides what an account may reach from `GET /account`, whose `onboarded`
 * is DERIVED from the handles the account holds. The moment a claim lands, the
 * answer that gate last read is stale — an account that just claimed a name would
 * still be refused, which is a loop. So the wizard re-reads and applies the answer
 * before it navigates, and the gate and the wizard cannot disagree.
 */
export function useOnboarding(): UseOnboardingReturn {
  const session = useSession();
  const account = useAccountIdentity();
  const router = useRouter();
  const claim = useMerchantClaim();

  const [requested, setRequested] = useState<OnboardingStep>('username');
  const [pending, setPending] = useState<AccountIntent | null>(null);
  const [finishing, setFinishing] = useState(false);

  const toIntent = useCallback(() => setRequested('intent'), []);

  /**
   * Re-read the account so the gate learns about the handle it just gained.
   *
   * A failed re-read falls back to the provider's own refresh rather than
   * navigating on a stale answer: the gate would otherwise bounce the person back
   * into onboarding they have already finished.
   */
  const syncIdentity = useCallback(async () => {
    try {
      account.apply(await fetchAccountIdentity());
    } catch {
      account.refresh();
    }
  }, [account]);

  const choose = useCallback(
    async (intent: AccountIntent) => {
      setPending(intent);

      // Record the intent BEFORE the claim. It is what the person said they are,
      // it is what decides the purpose signed below, and if this write fails the
      // claim still runs — a preference can be set again in Profile, while a
      // failed claim is the thing the person has to act on.
      try {
        account.apply(await setAccountIntent(intent));
      } catch {
        // Deliberately swallowed: see above.
      }

      // The ONE place the account's mode becomes the handle's kind. Passing the
      // kind explicitly (rather than setting state first) is what keeps the signed
      // purpose and the `kind` sent in one request identical.
      await claim.claim(HANDLE_KIND_FOR_INTENT[intent]);
      setPending(null);
      await syncIdentity();
    },
    [account, claim, syncIdentity]
  );

  const finish = useCallback(async () => {
    setFinishing(true);
    await syncIdentity();
    router.replace(APP_HOME_PATH);
  }, [router, syncIdentity]);

  // `done` is derived, never stored, and has TWO ways to be true: a claim that has
  // just landed in this wizard, or an account that finished onboarding in an earlier
  // session and has arrived at this URL. Both are "there is nothing left to set up",
  // and the step renders the result for the first and a short confirmation for the
  // second — never a name form the account does not need.
  const step: OnboardingStep =
    session.status !== 'authenticated'
      ? 'sign-in'
      : claim.claimed || account.onboarded
        ? 'done'
        : requested;

  return { step, claim, pending, toIntent, choose, finish, finishing };
}

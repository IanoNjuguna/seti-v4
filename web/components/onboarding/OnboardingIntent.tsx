'use client';

import { Text } from '@/components/ui';
import { ClaimFormStatus } from '@/components/merchant/ClaimFormStatus';
import { ONBOARDING_NAME_COPY } from '@/components/merchant/Claim.constants';
import { IntentOption } from './IntentOption';
import { INTENT_OPTIONS, ONBOARDING_COPY } from './Onboarding.constants';
import { WalletRepairAction } from './WalletRepairAction';
import { intentWalletState } from './intent-wallet';
import type { OnboardingIntentProps } from './Onboarding.types';

/**
 * Step three: personal or business.
 *
 * This is the step that signs. The choice decides the handle's `kind`, the kind
 * decides the `purpose` inside the signed bytes, and the backend refuses a
 * signature made for the other purpose — so asking for the signature here, after
 * the choice, is what makes the purpose unambiguous rather than a guess.
 *
 * ## The refusal is the CLAIM's to render, not this step's
 *
 * This step used to carry its own heading, "That name could not be claimed", for
 * every failure. That sentence is true only of a name the backend refused. A wallet
 * that was never there to sign, a provider that would not sign, and a request that
 * never left the browser all arrived under it: a new account was told its name was
 * at fault for a failure that had nothing to do with the name, and retried the same
 * tap three times.
 *
 * So the failure is rendered by `claimErrorView`, the same view the claim form
 * uses: one decision about what goes where, two renderers. A name problem is a name
 * problem, a server refusal prints its reason and its reference, and a missing
 * wallet carries the controls that can fix it.
 *
 * ## Which controls the wallet carries is a decision, not a condition (#226)
 *
 * `intentWalletState` says whether the app can repair the wallet here and whether a
 * sign-in is still a way out; `WalletRepairAction` draws them in that order. Neither
 * answer is computed in this file, because "is the repair still worth offering" is
 * the kind of rule that silently rots in markup.
 *
 * A refusal from the previous attempt is shown HERE rather than back on the name
 * field: a name that was taken while the wallet was open is not the person's
 * mistake, and sending them back to rewrite a name that was fine is the wrong fix.
 *
 * The question, its two answers and the note sit ON the page, not in a card. The
 * send flow's identical decision made exactly this call and said why ("the
 * question, the two answers, the field and the Continue control sit directly on
 * the page"), and two questions of the same shape in two different containers is
 * how a person learns that the app is not one thing. The options are objects and
 * keep their own borders; the words are the page's.
 */
export function OnboardingIntent({
  pending,
  busy,
  claim,
  walletStatus,
  walletRepair,
  onChoose,
  onRepair,
  onSignIn,
}: OnboardingIntentProps) {
  // Asking for a signature needs something that can sign. The decision is a
  // precedence with a test of its own (`intent-wallet.ts`), not a condition here.
  const { canChoose, failure } = intentWalletState(walletStatus, claim, walletRepair);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Text variant="section" as="h2">
          {ONBOARDING_COPY.intentTitle}
        </Text>
        <Text variant="body" color="secondary" as="p" className="mt-1">
          {ONBOARDING_COPY.intentIntro}
        </Text>
      </div>

      <div className="flex flex-col gap-3">
        {INTENT_OPTIONS.map((option) => (
          <IntentOption
            key={option.intent}
            intent={option.intent}
            title={option.title}
            body={option.body}
            action={option.action}
            pending={pending}
            busy={busy}
            disabled={!canChoose}
            onChoose={onChoose}
          />
        ))}
      </div>

      <Text variant="micro" as="p" color="secondary">
        {ONBOARDING_COPY.intentReversible}
      </Text>

      <ClaimFormStatus
        progress={null}
        error={failure?.blockError ?? null}
        errorTitle={ONBOARDING_NAME_COPY.errorTitle}
        reference={failure?.reference ?? null}
        action={
          failure ? (
            <WalletRepairAction
              showRepair={failure.canRepair}
              showSignIn={failure.needsSignIn}
              repairing={walletRepair.repairing}
              onRepair={onRepair}
              onSignIn={onSignIn}
            />
          ) : null
        }
      />
    </div>
  );
}

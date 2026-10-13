'use client';

import { Button, Card, Input } from '@/components/ui';
import { claimCopy } from './Claim.constants';
import { ClaimFormHeader } from './ClaimFormHeader';
import { ClaimFormStatus } from './ClaimFormStatus';
import { ClaimResult } from './ClaimResult';
import { MerchantHandlePreview } from './MerchantHandlePreview';
import type { ClaimFormProps } from './ClaimForm.types';

/**
 * The claim form: one field, one signature, one result. ONE form for BOTH kinds,
 * because a username and a business name are the same signed claim.
 *
 * A bad or reserved name belongs on the field (it is the person's input); every
 * other refusal — a signature that does not match, an address you do not own, a name
 * already taken — is the server's answer about the claim, so it is a block message.
 *
 * `copy`, `linkKind` and `submit` are the three things a caller may vary without a
 * second form: the words, which route the handle will live at (unknown until the kind
 * is chosen), and what the button does — onboarding continues to the intent step,
 * which is where the signature happens, because that is what fixes the purpose.
 */
export function ClaimForm({ claim, linkKind, copy, submit }: ClaimFormProps) {
  if (claim.step === 'done' && claim.claimed) {
    return <ClaimResult claimed={claim.claimed} onAgain={claim.reset} />;
  }

  const { isBusy } = claim;
  const words = copy ?? claimCopy(claim.kind);
  const previewKind = linkKind === undefined ? claim.kind : linkKind;
  // `invalid-handle-name` is the code the backend and the claim hook both use for a
  // name the rule refuses; this used to test for `invalid-merchant-name`, which
  // nothing sends, so a name-rule failure never reached the field it belongs on.
  const nameProblem =
    claim.errorCode === 'invalid-handle-name' || claim.errorCode === 'reserved-handle';
  const blockError = claim.error && !nameProblem ? claim.error : null;

  const onPress = submit ? submit.onPress : () => void claim.claim();
  const progress = isBusy ? (claim.step === 'signing' ? words.signing : words.submitting) : null;

  return (
    <Card className="space-y-4">
      <ClaimFormHeader title={words.title} intro={words.intro} />

      <Input
        label={words.fieldLabel}
        placeholder={words.placeholder}
        value={claim.name}
        onChange={(event) => claim.setName(event.target.value)}
        hint={words.hint}
        error={nameProblem ? (claim.error ?? undefined) : undefined}
        disabled={isBusy}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && claim.name.trim() && !isBusy) onPress();
        }}
      />

      <MerchantHandlePreview
        name={claim.name}
        preview={claim.preview}
        loading={claim.previewLoading}
        kind={previewKind}
        copy={words}
      />

      <ClaimFormStatus progress={progress} error={blockError} errorTitle={words.errorTitle} />

      <Button
        onClick={onPress}
        disabled={!claim.name.trim() || isBusy || (submit?.disabled ?? false)}
        loading={isBusy}
        fullWidth
      >
        {submit ? submit.label : words.submit}
      </Button>
    </Card>
  );
}

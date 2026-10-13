'use client';

import { Button, Card, Input, StateMessage, Text } from '@/components/ui';
import { CLAIM_COPY } from './Claim.constants';
import { ClaimResult } from './ClaimResult';
import { MerchantHandlePreview } from './MerchantHandlePreview';
import type { ClaimFormProps } from './ClaimForm.types';

/**
 * The claim form: one field, one signature, one result.
 *
 * A name-rule failure belongs on the field (it is the person's input); every
 * other refusal — a signature that does not match, an address you do not own, a
 * name already taken — is the server's answer about the claim, so it renders as a
 * block message rather than as field validation. Blaming the field for a taken
 * name sends the person rewriting a name that was fine.
 *
 * Between the field and the submit sits the link preview: the handle the name
 * will get, and whether it is already taken — asked of the backend, live, so a
 * collision is found while the name is being edited rather than at the moment of
 * signing.
 */
export function ClaimForm({ claim }: ClaimFormProps) {
  if (claim.step === 'done' && claim.claimed) {
    return <ClaimResult claimed={claim.claimed} onAgain={claim.reset} />;
  }

  const { isBusy } = claim;
  const nameProblem = claim.errorCode === 'invalid-merchant-name';
  const blockError = claim.error && !nameProblem ? claim.error : null;

  return (
    <Card className="space-y-4">
      <div>
        <Text variant="section" as="h2">
          {CLAIM_COPY.title}
        </Text>
        <Text variant="micro" as="p" className="mt-1">
          {CLAIM_COPY.intro}
        </Text>
      </div>

      <Input
        label={CLAIM_COPY.fieldLabel}
        placeholder={CLAIM_COPY.placeholder}
        value={claim.name}
        onChange={(event) => claim.setName(event.target.value)}
        hint={CLAIM_COPY.hint}
        error={nameProblem ? (claim.error ?? undefined) : undefined}
        disabled={isBusy}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && claim.name.trim() && !isBusy) void claim.claim();
        }}
      />

      <MerchantHandlePreview
        name={claim.name}
        preview={claim.preview}
        loading={claim.previewLoading}
      />

      {isBusy ? (
        <Text variant="micro" as="p">
          {claim.step === 'signing' ? CLAIM_COPY.signing : CLAIM_COPY.submitting}
        </Text>
      ) : null}

      {blockError ? (
        <StateMessage tone="alert" title={CLAIM_COPY.errorTitle} body={blockError} />
      ) : null}

      <Button
        onClick={() => void claim.claim()}
        disabled={!claim.name.trim() || isBusy}
        loading={isBusy}
        fullWidth
      >
        {CLAIM_COPY.submit}
      </Button>
    </Card>
  );
}

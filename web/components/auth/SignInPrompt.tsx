'use client';

import { ButtonLink, Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { SIGN_IN_PROMPT_COPY } from './SignInPrompt.constants';
import type { SignInPromptProps } from './SignInPrompt.types';

/**
 * Ask for an account, at the moment one is needed, and send the visitor to the
 * one page that signs people in.
 *
 * This is the app's sign-in-on-demand affordance: the money actions a visitor can
 * still tap (`Send` / `Pay`) render it, so the ask happens where the money flow
 * would have started. It carries the page's own words (`title` / `body`) and
 * exactly ONE control — a link to `/signin`, the product's front door.
 *
 * ## Why it does not start a sign-in itself
 *
 * Signing in here CREATES the account, and the account is created on the request
 * that carries the Terms version the person accepted. That acceptance is displayed
 * and given at `/signin`, which owns the control that takes it
 * (`TermsAcceptance`). A surface inside the app never showed the terms, so it has
 * no version it may claim — it points at the page that does instead of starting a
 * flow that would open an account with no acceptance on record.
 *
 * The same component therefore serves both session sources: on any build the door
 * is the same door, so there is no `privy` / `dev` branch left to drift.
 *
 * `surface` chooses which canvas the words and the control are dressed for, because
 * the app has two (`canvas-light` pages and the `canvas-dark` rail) and a control
 * that reads on one is invisible on the other.
 */
export function SignInPrompt({ title, body, surface = 'light' }: SignInPromptProps) {
  const onDark = surface === 'dark';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Text variant="card-title" as="p" color={onDark ? 'inverse' : 'primary'}>
          {title}
        </Text>
        <Text variant="body" as="p" color={onDark ? 'inverse-muted' : 'secondary'} className="mt-1">
          {body}
        </Text>
      </div>

      <ButtonLink href={SIGN_IN_PATH} variant={onDark ? 'on-dark' : 'primary'} fullWidth>
        {SIGN_IN_PROMPT_COPY.action}
      </ButtonLink>
    </div>
  );
}

'use client';

import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { useSession } from '@/lib/auth';
import { MerchantPayStepBody } from './MerchantPayStepBody';
import { PAY_SIGNED_OUT_COPY } from './Pay.constants';
import type { MerchantPayStepProps } from './MerchantPayStep.types';

/**
 * The amount-and-pay step for a MERCHANT — the second half of the send flow when
 * the resolved name turns out to be a business.
 *
 * ## The gate is here, with the money
 *
 * Paying is the action that needs an account, so the account is asked for at the
 * step that pays: a visitor who reaches this step meets the sign-in prompt where
 * the amount field would be, and nothing behind this component is reachable
 * without a session — no quote is priced (`usePayMerchant`), no wallet is asked
 * to sign. The route that mounts it refuses first, and this makes the money step
 * itself unable to price or sign for anybody else: the guard belongs to the
 * component whose whole job is moving money, not only to the screen that renders
 * it.
 *
 * The body is otherwise the old pay screen's, extracted rather than rewritten:
 * same merchant card, same itemised quote, same "Payment not sent / Nothing left
 * your wallet" routing, same success screen. What left is the frame — the page
 * heading and the entry field — because the send flow owns those now.
 */
export function MerchantPayStep({ payment, onCancel }: MerchantPayStepProps) {
  const session = useSession();

  if (session.status !== 'signed-in') {
    return <SignInPrompt title={PAY_SIGNED_OUT_COPY.title} body={PAY_SIGNED_OUT_COPY.body} />;
  }

  return <MerchantPayStepBody payment={payment} onCancel={onCancel} />;
}

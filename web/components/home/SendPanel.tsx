'use client';

import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { SEND_SIGNED_OUT_COPY } from '@/components/send/Send.constants';
import { useSession } from '@/lib/auth';
import { SendPanelForm } from './SendPanelForm';
import type { SendPanelProps } from './SendPanel.types';

/**
 * Send to a person — the body of `/app/send`'s amount step.
 *
 * ## The gate is here, with the money
 *
 * Sending is the action that needs an account, so the account is asked for at
 * the step that sends: a visitor meets the sign-in prompt where the form would
 * be, and NOTHING this panel owns is reachable without a session — no currency
 * is read from the customer's dashboard, no recipient is resolved, no fee is
 * quoted, no wallet is asked to sign. The account-scoped reads live in
 * `SendPanelForm`, which is a separate component precisely so this branch can
 * return before any of them run (a hook cannot be called conditionally; a child
 * component can simply not be rendered).
 *
 * The route refuses first and this makes the money step itself unable to price
 * or sign for anybody else — the guard belongs to the component whose whole job
 * is moving money, not only to the screen that renders it.
 *
 * The form itself is unchanged: a recipient (an address, or a username the
 * server resolves to a name AND an address) and an amount quoted by the server,
 * signed as ONE Tempo transaction with two calls, then verified against the
 * receipt before it appears in Activity.
 */
export function SendPanel({ initialRecipient }: SendPanelProps) {
  const session = useSession();

  if (session.status !== 'signed-in') {
    return <SignInPrompt title={SEND_SIGNED_OUT_COPY.title} body={SEND_SIGNED_OUT_COPY.body} />;
  }

  return <SendPanelForm initialRecipient={initialRecipient} />;
}

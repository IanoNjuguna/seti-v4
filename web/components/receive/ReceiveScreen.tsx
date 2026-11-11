'use client';

import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/app/PageHeader';
import { SignInCard } from '@/components/auth/SignInCard';
import { Text } from '@/components/ui';
import { RECEIVE_PAGE_COPY } from './ReceivePage.constants';
import { ReceiveAddress } from './ReceiveAddress';
import { ReceiveFailure } from './ReceiveFailure';
import { ReceiveLoading } from './ReceiveLoading';
import { ReceiveMerchantHalf } from './ReceiveMerchantHalf';
import { ReceiveNameHalf } from './ReceiveNameHalf';
import { ReceiveNoName } from './ReceiveNoName';
import { ReceiveSwitch } from './ReceiveSwitch';
import { useReceiveView } from './useReceiveView';
import type { ReceiveScreenState } from './useReceiveView.types';

/** The states that have a completed session behind them, so the page frame is drawn. */
type ResolvedState = Exclude<ReceiveScreenState, { status: 'loading' | 'signed-out' }>;

/**
 * `/app/receive`, once the session is known: the frame (back, title, one line of
 * framing) around whichever state the account is in.
 *
 * The switch is drawn ONLY when there is more than one half to switch between. A
 * person's account has one view — the username — and a one-item tab strip is
 * decoration that reads as a control that has already been chosen for you.
 *
 * The URL stays the source of truth for which half is showing (`?view=merchant`), and
 * `useReceiveView` resolves it against what this account can offer.
 */
export function ReceiveScreen() {
  const requested = useSearchParams().get('view');
  const { state } = useReceiveView(requested);

  if (state.status === 'loading') return <ReceiveLoading />;

  /*
   * A visitor gets the page's FRAME and then the ask (#562).
   *
   * This branch used to return `SignInCard` bare, so `/app/receive` signed out had no title and
   * no back control: the one screen a visitor could reach with no way back and nothing naming it,
   * on a route that signed in opens with both. Swap, Activity and every other visitor state keep
   * their frame and put the prompt inside it; this one now does too.
   *
   * The frame is `start`-aligned rather than the centred treatment the resolved states use. The
   * centred column belongs to the OBJECT — a name and a code to hold up — and a visitor has no
   * object, so there is nothing to centre; what is left is a title, a sentence and a button, which
   * is the shape every other visitor page already has.
   */
  if (state.status === 'signed-out') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={RECEIVE_PAGE_COPY.title} />
        <SignInCard error={state.error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-full">
        <PageHeader title={RECEIVE_PAGE_COPY.title} align="center" />
      </div>

      {state.status === 'ready' ? (
        <Text variant="body" as="p" color="secondary" className="max-w-md">
          {state.lead}
        </Text>
      ) : null}

      <ReceiveBody state={state} />
    </div>
  );
}

/** Everything below the frame: one state, one half. */
function ReceiveBody({ state }: { state: ResolvedState }) {
  if (state.status === 'failed') {
    return <ReceiveFailure message={state.message} retry={state.retry} />;
  }

  if (state.status === 'no-name') {
    return <ReceiveNoName claim={state.claim} />;
  }

  return (
    <>
      {state.views.length > 1 ? <ReceiveSwitch view={state.view} views={state.views} /> : null}

      {state.view === 'merchant' && state.business ? (
        <ReceiveMerchantHalf name={state.business.name} handle={state.business.handle} />
      ) : (
        <ReceiveNameHalf handle={state.handle.handle} link={state.handle.link} />
      )}

      {/* Under whichever half is showing (#419): the address money arrives at, which a
          business needs for the same reason a person does. */}
      <ReceiveAddress />
    </>
  );
}

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageBack } from '@/components/app/PageBack';
import { SignInCard } from '@/components/auth/SignInCard';
import { SendPanel } from '@/components/home/SendPanel';
import { MerchantPayStep } from '@/components/pay/MerchantPayStep';
import { RecipientStep, type RecipientKind } from '@/components/send/RecipientStep';
import { SEND_FLOW_COPY } from '@/components/send/Send.constants';
import { SendProgress } from '@/components/send/SendProgress';
import { useResolvedRecipient } from '@/components/send/useResolvedRecipient';
import { Button, Skeleton, StateMessage, Text } from '@/components/ui';
import { usePayMerchant } from '@/hooks/usePayMerchant';
import { useSession } from '@/lib/auth';
import { looksLikeAddress, validateRecipient } from '@/lib/pay/validate-transfer';

/**
 * Send — `/app/send`, and the ONE way money leaves the account.
 *
 * Step one asks the flow's single question (does the person you are paying have a
 * Seti account?) and step two is the amount. Paying a MERCHANT is not a separate
 * flow any more: a merchant is a Seti account whose name resolved as a business,
 * so `/app/pay` forwards here and the resolved kind decides which amount step is
 * mounted — `SendPanel` for a person or a bare address, `MerchantPayStep` for a
 * business. Nothing about the money path changed: a send and a payment are the
 * same 2% and the same two-leg batch, verified against the receipt either way.
 *
 * Why the question is asked at all, when a string answers it: the two answers have
 * different CONSEQUENCES. A name is looked up on the server and must resolve to
 * somebody; an address is not looked up at all, and its checksum is the customer's
 * to get right. Asking first lets the field say which one it wants.
 *
 * `?to=` (and `?handle=`, the old pay link) skip step one: a person's page, a
 * merchant's page and a printed QR all know who is being paid, so the flow starts
 * where they left off rather than asking again.
 *
 * The query is read with `useSearchParams` — the LIVE URL — never the page's
 * `searchParams` prop: this route is prerendered as static content, so that prop
 * resolves once at build time and arrives EMPTY, which left a person's public link
 * resolving nobody in a production build.
 */
export default function SendPage() {
  return (
    <Suspense fallback={<SendLoading />}>
      <SendScreen />
    </Suspense>
  );
}

function SendLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label={SEND_FLOW_COPY.loading}>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function SendScreen() {
  const params = useSearchParams();
  const session = useSession();

  // A deep link already names the recipient; nothing is asked twice.
  const linked = params.get('to') ?? params.get('handle') ?? null;
  const [kind, setKind] = useState<RecipientKind>('name');
  const [typed, setTyped] = useState('');
  const [recipient, setRecipient] = useState<string | null>(linked);
  const [error, setError] = useState<string | null>(null);

  const isAddress = recipient !== null && looksLikeAddress(recipient);
  // Only a NAME is looked up: an address is signed as it stands, and a name is
  // resolved once, by the server, into the person or the merchant it belongs to.
  const resolved = useResolvedRecipient(!isAddress ? recipient : null);
  const merchant = resolved.status === 'business' ? recipient ?? undefined : undefined;
  const payment = usePayMerchant(session.user?.id ?? '', merchant);

  if (session.status === 'loading') {
    return <SendLoading />;
  }

  if (!session.isAuthenticated) {
    return (
      <SignInCard
        onSignIn={() => void session.signIn()}
        error={session.error}
        source={session.source}
        pending={session.signingIn}
      />
    );
  }

  const submitRecipient = () => {
    const value = typed.trim();
    if (!value) return;

    if (kind === 'address') {
      const check = validateRecipient(value);
      if (!check.ok) {
        setError(check.error);
        return;
      }
    }

    setError(null);
    setRecipient(value);
  };

  const backToWho = () => {
    setRecipient(null);
    setTyped('');
    setError(null);
  };

  const onAmountStep = recipient !== null;

  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {SEND_FLOW_COPY.title}
      </Text>

      <SendProgress current={onAmountStep ? 1 : 0} />

      {!onAmountStep ? (
        <RecipientStep
          kind={kind}
          value={typed}
          error={error}
          busy={false}
          onKindChange={setKind}
          onChange={setTyped}
          onSubmit={submitRecipient}
        />
      ) : resolved.status === 'failed' ? (
        <div className="flex flex-col gap-4">
          <StateMessage
            variant="failure"
            title={SEND_FLOW_COPY.resolveFailedTitle}
            body={resolved.message}
            action={<Button onClick={backToWho}>{SEND_FLOW_COPY.changeRecipient}</Button>}
          />
        </div>
      ) : !isAddress && resolved.status === 'loading' ? (
        <div className="flex flex-col gap-4" role="status" aria-label={SEND_FLOW_COPY.resolving}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : merchant ? (
        <div className="flex flex-col gap-4">
          <Button variant="ghost" onClick={backToWho} className="self-start">
            {SEND_FLOW_COPY.changeRecipient}
          </Button>
          <MerchantPayStep payment={payment} onCancel={backToWho} />
        </div>
      ) : (
        <SendPanel initialRecipient={recipient ?? undefined} />
      )}
    </div>
  );
}

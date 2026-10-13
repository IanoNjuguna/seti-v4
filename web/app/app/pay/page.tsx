'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignInCard } from '@/components/auth/SignInCard';
import { MerchantCard } from '@/components/pay/MerchantCard';
import { MerchantEntry } from '@/components/pay/MerchantEntry';
import { PayActions } from '@/components/pay/PayActions';
import { PayPreviewSummary } from '@/components/pay/PayPreviewSummary';
import { PaySuccess } from '@/components/pay/PaySuccess';
import { Input, Skeleton, StateMessage, Text } from '@/components/ui';
import { usePayMerchant } from '@/hooks/usePayMerchant';
import { useSession } from '@/lib/auth';

/**
 * Pay a merchant, ported from `mobile/src/app/(tabs)/pay.tsx`.
 *
 * Entry is manual only for now: the mobile screen also scans a QR, and whether a
 * browser camera path is needed at all is an open question, so this ships the
 * paste-a-code half first. Every state below is a component, so this file stays a
 * list of decisions rather than markup.
 *
 * `?handle=` is the one automatic entry: a `seti.live/m/<handle>` page's Pay
 * action sends it here, and it is resolved through the SAME path a pasted code
 * takes (the resolver accepts a handle). It waits for the session, so a
 * signed-out visitor is asked to sign in first and the merchant resolves the
 * moment they are.
 *
 * The handle comes from `useSearchParams` — the LIVE URL — and not from the page's
 * `searchParams` prop. This route is prerendered as static content, so that prop is
 * resolved once at build time and arrives EMPTY, and the Pay action on a merchant's
 * public page resolved nothing in a production build. The boundary below is what
 * makes the query-dependent subtree client-render while the rest stays static.
 *
 * `formKey` exists because the entry field owns its own local state: bumping the
 * key on cancel remounts it empty, which is cheaper and less error-prone than
 * pushing the payload up into this component just to clear it.
 */
export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <PayScreen />
    </Suspense>
  );
}

function PayScreen() {
  const handle = useSearchParams().get('handle') ?? undefined;
  const session = useSession();
  const payment = usePayMerchant(session.user?.id, handle);
  const [formKey, setFormKey] = useState(0);

  if (session.status === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
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

  if (payment.step === 'done') {
    return <PaySuccess txHash={payment.txHash} onDone={() => payment.reset()} />;
  }

  const handleCancel = () => {
    payment.reset();
    setFormKey((key) => key + 1);
  };

  // No merchant yet: the entry form is the whole screen, and any error at this
  // point can only be a resolution failure.
  if (!payment.merchant) {
    return (
      <div className="space-y-4">
        <MerchantEntry
          key={formKey}
          onResolve={(payload) => void payment.resolve(payload)}
          error={payment.step === 'error' ? payment.error : null}
          disabled={payment.step === 'resolving'}
        />
      </div>
    );
  }

  const amountIsValid = payment.amount !== '' && Number(payment.amount) > 0;
  const canPay =
    amountIsValid &&
    !payment.isBusy &&
    !payment.previewLoading &&
    payment.preview?.hasEnoughBalance !== false;

  // Route the failure by cause. Only a balance problem is the customer's entry,
  // so only that one belongs on the field; a wallet/config/rejection failure is
  // not an amount problem and rendering it as field validation blames the wrong
  // thing. (Mobile passes everything but the gas case to the field, which is
  // where this port diverges deliberately.)
  const amountError =
    payment.errorKind === 'insufficient-funds' ? (payment.error ?? undefined) : undefined;
  const blockError = payment.error && !amountError ? payment.error : null;

  return (
    <div className="space-y-4">
      <div>
        <Text variant="section" as="h2">
          Pay merchant
        </Text>
        <Text variant="micro" as="p" className="mt-1">
          {payment.merchant.category ?? 'Enter the amount to send.'}
        </Text>
      </div>

      <MerchantCard merchant={payment.merchant} resolving={payment.step === 'resolving'} />

      <Input
        label="Amount (KES)"
        inputMode="decimal"
        placeholder="0"
        value={payment.amount}
        onChange={(event) => payment.setAmount(event.target.value)}
        error={amountError}
        disabled={payment.isBusy}
      />

      <PayPreviewSummary
        preview={payment.preview}
        loading={payment.previewLoading || payment.step === 'previewing'}
      />

      {blockError ? (
        <StateMessage tone="alert" title="Payment not sent" body={blockError} />
      ) : null}

      <PayActions
        step={payment.step}
        canPay={canPay}
        onPay={() => void payment.pay()}
        onCancel={handleCancel}
      />
    </div>
  );
}

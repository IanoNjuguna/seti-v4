'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignInCard } from '@/components/auth/SignInCard';
import { MerchantCard } from '@/components/pay/MerchantCard';
import { MerchantEntry } from '@/components/pay/MerchantEntry';
import { PayActions } from '@/components/pay/PayActions';
import { PayHeading } from '@/components/pay/PayHeading';
import { PAY_HEADING_COPY } from '@/components/pay/PayHeading.constants';
import { PayPreviewSummary } from '@/components/pay/PayPreviewSummary';
import { PaySuccess } from '@/components/pay/PaySuccess';
import { Input, Skeleton, StateMessage } from '@/components/ui';
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
 *
 * Two layout notes, because both were measurable defects:
 *
 *  - **The heading belongs to the page** (`PayHeading`), so the title is the
 *    same words at the same level in the same place before and after a merchant
 *    resolves. It used to live inside the entry card and then outside it, and
 *    moved up the screen mid-flow.
 *  - **The body is one `gap-6` ladder** (24px `spacing.xl`), with 4px inside a
 *    heading pair. It used to be a flat 16px between every element, which left the
 *    title, the merchant, the amount and the quote all equally far apart — a list
 *    of controls rather than a sequence of decisions.
 */
export default function PayPage() {
  return (
    <Suspense fallback={<PayLoading />}>
      <PayScreen />
    </Suspense>
  );
}

/** The screen's own shape, used for both boundaries. */
function PayLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading the pay screen">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-1 h-4 w-56" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function PayScreen() {
  const handle = useSearchParams().get('handle') ?? undefined;
  const session = useSession();
  const payment = usePayMerchant(session.user?.id, handle);
  const [formKey, setFormKey] = useState(0);

  if (session.status === 'loading') {
    return <PayLoading />;
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
    const preview = payment.preview;
    return (
      <PaySuccess
        txHash={payment.txHash}
        onDone={() => payment.reset()}
        summary={
          preview && payment.merchant
            ? {
                merchant: payment.merchant.name,
                amountFiat: preview.fiatAmount,
                feeFiat: preview.feeFiat,
                networkFeeFiat: preview.networkFeeFiat,
                totalFiat: preview.totalFiat,
                fiatCurrency: preview.fiatCurrency,
                gasEstimated: preview.networkFeeSource === 'estimate',
              }
            : null
        }
      />
    );
  }

  const handleCancel = () => {
    payment.reset();
    setFormKey((key) => key + 1);
  };

  // No merchant yet: the entry form is the whole screen, and any error at this
  // point can only be a resolution failure.
  //
  // The entry instruction is the pay card's sentence, passed as the heading's
  // subtitle: it says what to type, and it sits exactly where the card was —
  // above the field, in the page's own voice rather than in a box of its own.
  // Its wording is the owner's (`PAY_HEADING_COPY`), not the card's verbatim.
  if (!payment.merchant) {
    return (
      <div className="flex flex-col gap-6">
        <PayHeading subtitle={PAY_HEADING_COPY.entrySubtitle} />
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
    <div className="flex flex-col gap-6">
      <PayHeading subtitle={payment.merchant.category ?? 'Enter the amount to send.'} />

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
        <StateMessage
          variant="failure"
          title="Payment not sent"
          /* The question a failed payment has to answer is "did my money move?".
             No broadcast means no: say so. Once a transaction hash exists the
             money DID move and only the recording failed, so nothing is added —
             the code's own sentence already sends the customer to their wallet. */
          body={payment.txHash ? blockError : `${blockError} Nothing left your wallet.`}
        />
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

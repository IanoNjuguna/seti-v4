'use client';

import { useId } from 'react';
import { Text } from '@/components/ui';
import { ONBOARDING_COPY } from './Onboarding.constants';
import type { IntentOptionProps } from './Onboarding.types';

/**
 * One intent, as a BUTTON rather than a radio.
 *
 * The choice is not a form field waiting for a submit — choosing it is what asks
 * the wallet to sign, and the kind it names is the purpose the signature carries. A
 * radio group would fire on arrow keys, so sweeping the keyboard across the two
 * options would sign twice. A button fires only on Enter or Space, which is the
 * only place a signature should ever start.
 *
 * The description is wired with `aria-describedby` so the label a screen reader
 * announces carries the consequence ("your link is seti.live/m/<name>") and not
 * just the word "Business" — which is the part the person is choosing between.
 *
 * ## `disabled` is not "busy"
 *
 * `busy` means "a signature is in flight"; `disabled` means "there is nothing on
 * this device that can sign, so this control cannot complete". Both stop the tap,
 * and only one of them is temporary — which is why the caller says which, and why
 * the reason is rendered beside the options rather than hidden in an attribute.
 */
export function IntentOption({
  intent,
  title,
  body,
  action,
  pending,
  busy,
  disabled = false,
  onChoose,
}: IntentOptionProps) {
  const descriptionId = useId();
  const isSigning = pending === intent;

  return (
    <button
      type="button"
      onClick={() => onChoose(intent)}
      disabled={busy || disabled}
      aria-describedby={descriptionId}
      aria-busy={isSigning}
      className="min-touch w-full rounded-md border border-hairline-light bg-surface-card p-5 text-left transition-colors duration-(--duration-quick) ease-out hover:border-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Text variant="card-title" as="span" className="block">
        {title}
      </Text>
      {/* The description is `body` (16px, mute) rather than `micro` (14px in
          `stone`, 2.9:1 on white): it names the consequence of the choice — the
          link this option produces — which is the part being chosen between. */}
      <Text variant="body" color="secondary" as="span" id={descriptionId} className="mt-1 block">
        {body}
      </Text>
      <Text variant="tab" as="span" className="mt-3 block text-link">
        {isSigning ? ONBOARDING_COPY.signing : action}
      </Text>
    </button>
  );
}

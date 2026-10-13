'use client';

import Link from 'next/link';
import { Badge, Text } from '@/components/ui';
import { claimCopy } from '@/components/merchant/Claim.constants';
import { MerchantQr } from '@/components/merchant/MerchantQr';
import { HANDLE_KIND_FOR_INTENT } from '@/lib/account';
import { handleLink } from '@/lib/merchant-link';
import { PROFILE_INTENT_COPY, claimHref } from './ProfileIntent.constants';
import type { ProfileHandlePanelProps } from './ProfileIntent.types';

const LINK_CLASS =
  'mt-3 inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The handle behind the active mode — the claimed one, or the way to claim it.
 *
 * A BUSINESS gets the surfaces that already exist for a business: the shareable
 * link and the printable QR, both rendered by the SAME code the claim result uses
 * (`handleLink`, `MerchantQr`). Nothing is re-drawn here — a second QR renderer is
 * a second sticker, and the two drift the first time one changes.
 *
 * A PERSON gets the link only: `/u/<handle>` is a username people send to, and a
 * printable customer-facing sticker is a merchant's surface.
 *
 * When the mode has no name yet the panel says so and points at the one claim
 * surface, with `?kind=` deciding which name is being claimed. That is what keeps
 * the switch reversible in BOTH directions — a business-first account can still
 * claim a username.
 */
export function ProfileHandlePanel({ intent, handle }: ProfileHandlePanelProps) {
  const kind = HANDLE_KIND_FOR_INTENT[intent];
  const words = claimCopy(kind);

  if (!handle) {
    const personal = intent === 'personal';
    return (
      <div className="rounded-md bg-surface-soft p-4">
        <Text variant="card-title" as="p">
          {personal
            ? PROFILE_INTENT_COPY.emptyPersonalTitle
            : PROFILE_INTENT_COPY.emptyBusinessTitle}
        </Text>
        <Text variant="micro" as="p" className="mt-1">
          {personal ? PROFILE_INTENT_COPY.emptyPersonalBody : PROFILE_INTENT_COPY.emptyBusinessBody}
        </Text>
        <Link href={claimHref(kind)} className={LINK_CLASS}>
          {personal
            ? PROFILE_INTENT_COPY.emptyPersonalAction
            : PROFILE_INTENT_COPY.emptyBusinessAction}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Text variant="card-title" as="p">
          {handle.name}
        </Text>
        {/* A parked handle has no page yet, so its link is not shown. */}
        {handle.review ? null : (
          <p className="mt-1 break-all font-mono text-body-sm text-ink">
            {handleLink(kind, handle.name)}
          </p>
        )}
      </div>

      {handle.review ? (
        <div className="space-y-2">
          <Badge variant="neutral">{words.underReview}</Badge>
          <Text variant="micro" as="p">
            {handle.review.message}
          </Text>
        </div>
      ) : (
        <Badge variant={handle.verified ? 'success' : 'warning'}>
          {handle.verified ? words.verified : words.unverified}
        </Badge>
      )}

      {kind === 'business' && handle.review === null ? (
        <MerchantQr name={handle.name} kind="business" />
      ) : null}
    </div>
  );
}

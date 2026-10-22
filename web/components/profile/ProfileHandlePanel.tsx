'use client';

import { RAIL_IDENTITY_COPY } from '@/components/app/RailIdentity.constants';
import { CopyRow } from '@/components/copy/CopyRow';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui';
import { MerchantQr } from '@/components/merchant/MerchantQr';
import { RECEIVE_COPY } from '@/components/receive/receive.constants';
import { HANDLE_KIND_FOR_INTENT } from '@/lib/account';
import { handleLink } from '@/lib/merchant-link';
import { ProfileHandleEmpty } from './ProfileHandleEmpty';
import { ProfileHandleStatus } from './ProfileHandleStatus';
import type { ProfileHandlePanelProps } from './ProfileIntent.types';

/**
 * The handle behind the active mode — the claimed one, or the way to claim it.
 *
 * The name and the link are the two strings this account hands out, so each is
 * drawn by the app's copy row (`CopyRow`, the one the receive halves use), and on
 * each row the control sits on the character after the value ends. It used to be
 * pushed to the row's far edge, where on a wide screen it stood a long way from
 * the name it copied and read as a control belonging to the row rather than to
 * the value.
 *
 * The link is drawn by the row rather than as a bare paragraph, and that is what
 * removed the duplicate: the link was printed once as text with no way to take
 * it, so a control for it would have had to be a second copy of the same string
 * beside the first. One row, one string, one control. The name is shown as the
 * account typed it and copied as the bare handle a sender types; the link is both
 * shown and copied as the absolute URL, and it wraps rather than clipping, because
 * a clipped link is unusable for the person pasting it.
 *
 * The state badge and the printable QR are their own components, and a mode with
 * no name yet is `ProfileHandleEmpty`.
 */
export function ProfileHandlePanel({ intent, handle }: ProfileHandlePanelProps) {
  const kind = HANDLE_KIND_FOR_INTENT[intent];

  if (!handle) {
    return <ProfileHandleEmpty intent={intent} />;
  }

  /*
   * A claim is either live or not, and nothing above the signature withholds a name
   * any more (#139). A row held for first refusal never reaches this panel: it does
   * not resolve, so the account's identity read does not return it.
   */
  const link = handleLink(kind, handle.name);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <CopyRow
          display={handle.name}
          value={handle.name}
          label={RAIL_IDENTITY_COPY.copyHandle}
          failureText={RAIL_IDENTITY_COPY.copyFailed}
          copiedText={RAIL_IDENTITY_COPY.copied}
          emphasis
        />

        <CopyRow
          display={link}
          value={link}
          label={RECEIVE_COPY.copyLink}
          failureText={RECEIVE_COPY.copyFailed}
          copiedText={RECEIVE_COPY.copiedAction}
          wrap
        />
      </div>

      {/*
        * The verified mark sits under the name it attests, not in a header far from it.
        * The word is in the chip because a tick alone is colour-and-shape only: someone
        * who cannot see the glyph still hears "Verified", and the chip is aria-labelled
        * by that same word.
        */}
      {handle.verified ? (
        <span
          className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1"
          role="status"
        >
          <Icon name="verified" className="h-3.5 w-3.5" />
          <Text variant="micro" as="span">
            Verified
          </Text>
        </span>
      ) : null}

      <ProfileHandleStatus kind={kind} handle={handle} />

      {kind === 'business' ? <MerchantQr name={handle.name} kind="business" /> : null}
    </div>
  );
}

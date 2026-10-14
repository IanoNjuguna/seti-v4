'use client';

import {
  copyLinkAriaLabel,
  copyLinkLabel,
  RAIL_IDENTITY_COPY,
} from './RailIdentity.constants';
import type { CopyLinkButtonProps } from './RailIdentity.types';
import { useCopyLink } from './useCopyLink';

/**
 * The account's public link, and the control that copies it.
 *
 * The caption shows the link without its scheme — `seti.live/u/devrail` is what
 * a person reads out or retypes — while the button copies the absolute URL, and
 * the accessible name says which link it is so a rail of controls is not a row
 * of identical "Copy link"s.
 *
 * `text-on-dark-mute` rather than the cobalt link colour: on the black rail,
 * cobalt is the quieter colour that reads as decoration, and the rail's own
 * inactive destinations are already `on-dark-mute`. The state is a word
 * ("Copied"), not a colour, and it is announced politely.
 */
export function CopyLinkButton({ link, caption }: CopyLinkButtonProps) {
  const { state, copy } = useCopyLink(link);

  return (
    <div className="mt-2">
      <p className="break-all font-mono text-body-sm text-on-dark-mute">{caption}</p>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        aria-label={copyLinkAriaLabel(state, caption)}
        className="mt-2 inline-flex min-touch items-center rounded-md border border-hairline-dark px-4 text-body-sm font-semibold text-on-dark-mute transition-colors duration-200 hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {copyLinkLabel(state)}
      </button>
      {state === 'failed' ? (
        <p className="mt-1 text-body-sm text-on-dark-mute">{RAIL_IDENTITY_COPY.copyFailed}</p>
      ) : null}
    </div>
  );
}

'use client';

import { Button, Text } from '@/components/ui';
import { ReceiveField } from '@/components/receive/ReceiveField';
import { useShareLink } from '@/components/receive/useShareLink';
import { INVITE_COPY, describeShare } from './Invite.constants';
import type { InviteLinkFieldProps } from './Invite.types';

/**
 * The link, and the two ways to pass it on.
 *
 * The field is the app's own field primitive (`ReceiveField`), so the border, the
 * monospace value and the control inside the box are the same object here as on any
 * screen that holds a URL. It used to be shared with the two receive halves, which have
 * since stopped putting their string in a box: the receive page presents a username as
 * display type, so this is now the field's only caller. Share sits BESIDE the field
 * rather than inside it — inside, two icon controls a few pixels apart would read as two
 * ways to copy, which is not what the second one does.
 *
 * `items-end` aligns the control with the FIELD rather than with the caption above
 * it, so the button's bottom edge is the box's bottom edge on every width. The field
 * is the flexible column and the button never shrinks, so the link wraps inside its
 * own box instead of pushing the control off a 360px screen.
 *
 * Share is `secondary`, not `primary`: handing out a link is not the app's loudest
 * action and the field already carries the value at full contrast. It is a real
 * control everywhere — where `navigator.share` is absent the hook copies instead and
 * says so, which is why its confirmation is not the field's word.
 */
export function InviteLinkField({ value }: InviteLinkFieldProps) {
  const share = useShareLink(INVITE_COPY.title, value);

  return (
    <div className="flex flex-col gap-2">
      {/*
        * Beside the field from 640px up, under it below that. Measured at 360px, a
        * side-by-side control leaves the field about 190px, and the link then wrapped
        * mid-handle (`https://seti.live/i/ia` / `n`): the one string this screen exists
        * to hand out became the one thing on it that could not be read in a glance.
        * The link keeps its line on a phone, and the control moves back beside it on
        * anything wider.
        */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <ReceiveField
            label={INVITE_COPY.fieldLabel}
            value={value}
            copyLabel={INVITE_COPY.copyLabel}
            copyFailed={INVITE_COPY.copyFailed}
            copiedText={INVITE_COPY.copied}
          />
        </div>

        <Button variant="secondary" onClick={share.share} className="w-full shrink-0 sm:w-auto">
          {INVITE_COPY.share}
        </Button>
      </div>

      {/*
        * One sentence for every outcome the person can act on, and silence for the
        * one they cannot: a dismissed sheet is not a failure, and the two successes
        * say which path actually ran.
        */}
      <Text
        variant="micro"
        as="p"
        color={share.state === 'failed' ? 'alert' : 'secondary'}
        role="status"
        className={share.state === 'idle' ? 'sr-only' : undefined}
      >
        {describeShare(share.state)}
      </Text>
    </div>
  );
}

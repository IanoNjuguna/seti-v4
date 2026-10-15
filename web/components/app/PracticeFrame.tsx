'use client';

import { Text } from '@/components/ui';
import { NETWORK_LABEL, NETWORK_NOTE } from '@/lib/network';
import { useAppNetwork } from './useAppNetwork';

/**
 * The app frame's network strip: one line, in PRACTICE only.
 *
 * It states the fact ONCE — the network's product word, then the sentence that
 * belongs to it — and it is drawn by the shell rather than by each screen, so no
 * screen can be the one that forgets to say it and a screenshot of any surface
 * carries the network with it.
 *
 * One line, because this is permanent chrome: it is 32px of every screen until
 * the account goes Live, and the loud moment belongs at the payment the customer
 * is about to sign (`PracticeNote`), not in a band that is read for a day and
 * then not at all.
 *
 * `md:ml-56` fixes a real defect: the rail is `fixed` with no z-index, so a
 * full-width strip paints over the top of the rail's brand block on every desktop
 * screen. This has to be a MARGIN, not padding: `pl-56` moves the words and
 * leaves the black background spanning the whole viewport, which is the clip it
 * was meant to fix.
 *
 * `py-1` and a `text-body-sm` strut are what make it one line of chrome rather
 * than a banner: 29px measured, and the strip is no longer 8px taller than the
 * words inside it — the div's own default strut (16/24) is taller than the 14/20
 * spans it contains, which is where that padding went.
 *
 * On live it renders nothing: a live payment does not need a badge to be
 * believable, and the profile control is where the network is chosen. While the
 * account is still loading it renders nothing rather than flashing a frame the
 * app then removes — and the signed-out state has no network to be loud about.
 */
export function PracticeFrame() {
  const { practice, network } = useAppNetwork();

  if (!practice) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 border-b border-hairline-dark bg-canvas-dark py-1 text-center text-body-sm md:ml-56"
    >
      <Text
        variant="micro"
        as="span"
        color="attention"
        className="font-semibold uppercase tracking-wider"
      >
        {NETWORK_LABEL[network]}
      </Text>
      <Text variant="micro" as="span" color="inverse" className="ml-2">
        {NETWORK_NOTE[network]}
      </Text>
    </div>
  );
}

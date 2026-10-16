'use client';

import { cn } from '@/lib/cn';
import { NETWORKS, NETWORK_LABEL } from '@/lib/network';
import { PROFILE_NETWORK_COPY } from './ProfileNetwork.constants';
import type { ProfileNetworkSwitchProps } from './ProfileNetwork.types';

/**
 * The two-state Practice ⇄ Live control.
 *
 * Same pressed-state-button shape as `ProfileIntentSwitch`, and for the same
 * keyboard reason: a state change fires on Enter/Space only, never on an arrow
 * sweep. What is different is that an option can be DISABLED, and Live is
 * disabled whenever the deployment or the server says it is not ready
 * (`live.ready`).
 *
 * The control carries the state and the tap target; it no longer carries the
 * words. The network's own sentence (`NETWORK_NOTE`) and the REASON a disabled
 * Live cannot be chosen are the page's, said once under this control, so the fix
 * for a greyed-out option is readable without a pointer and without a second
 * spelling of the same sentence living in here.
 *
 * `aria-disabled` is set alongside the `disabled` attribute so the state is
 * announced rather than being carried by the fill alone.
 */
export function ProfileNetworkSwitch({
  network,
  switching,
  live,
  onSwitch,
}: ProfileNetworkSwitchProps) {
  return (
    <div role="group" aria-label={PROFILE_NETWORK_COPY.switchLabel} className="flex flex-wrap gap-2">
      {NETWORKS.map((option) => {
        const active = network === option;
        const isLive = option === 'mainnet';
        const unavailable = isLive && !live.ready;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            aria-busy={switching === option}
            aria-disabled={unavailable}
            disabled={switching !== null || unavailable}
            onClick={() => onSwitch(option)}
            className={cn(
              'min-touch h-10 rounded-md px-5 text-body-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active ? 'bg-canvas-dark text-on-dark' : 'bg-surface-soft text-ink hover:bg-faint'
            )}
          >
            {NETWORK_LABEL[option]}
          </button>
        );
      })}
    </div>
  );
}

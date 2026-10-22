'use client';

import { InviteBody } from './InviteBody';
import { useInviteView } from './useInviteView';

/**
 * `/app/invite` — the screen an account opens to hand out its link.
 *
 * Two lines of code on purpose: the state is worked out in `useInviteView` (one read,
 * plus the handles that explain an absent link) and drawn by `InviteBody`. Nothing
 * about what the screen says lives between them, so the screen and any single state
 * of it are the same components.
 */
export function InviteScreen() {
  const { view } = useInviteView();

  return <InviteBody view={view} />;
}

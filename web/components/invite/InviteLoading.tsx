import { Skeleton } from '@/components/ui';
import { INVITE_COPY } from './Invite.constants';

/**
 * The shape of the screen while the invite is being read.
 *
 * Sized to what replaces it — a caption, a field with its box, a control, then the
 * joined rows — so the page does not jump when the answer arrives. `aria-busy` and a
 * label, because a screen of grey blocks with no name is indistinguishable from a
 * screen that failed.
 */
export function InviteLoading() {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label={INVITE_COPY.loading}>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-32" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

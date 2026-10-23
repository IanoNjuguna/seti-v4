import { Skeleton } from '@/components/ui';
import { RECEIVE_PAGE_COPY } from './ReceivePage.constants';

/**
 * The page's own shape while the session and the account are still resolving: back,
 * title, one line of framing, then the object this page is — a code, a name and two
 * controls.
 *
 * The skeleton matches the layout it stands in for, at the size the code actually
 * renders (288px), so the page does not jump when the real one arrives. It is a
 * skeleton rather than a sentence because an account IS behind it: the session is
 * being restored, not absent, which is the case the system says must say so in words
 * instead.
 */
export function ReceiveLoading() {
  return (
    <div
      className="flex flex-col items-center gap-4"
      aria-busy
      aria-label={RECEIVE_PAGE_COPY.loading}
    >
      <Skeleton className="h-11 w-24 self-start" />
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-72 w-72" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-10 w-56" />
    </div>
  );
}

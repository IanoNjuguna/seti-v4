import { Skeleton } from '@/components/ui';
import { SEND_FLOW_COPY } from './Send.constants';

/**
 * This screen's own shape: Back, the title, the progress bar, the field, the
 * step body. It is deliberately not `HomeLoading`, which promises a balance hero
 * and an activity list on a screen that has neither.
 */
export function SendLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label={SEND_FLOW_COPY.loading}>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

import { Skeleton } from '@/components/ui';

/**
 * The shape of the page while a stored session is being re-resolved.
 *
 * It matches what is coming: a 64px medallion and two lines where the identity
 * will be, two rows where the shortcuts will be, then the settings list. It used
 * to be one grey block, which is the shape of a card and the shape of nothing on
 * this page.
 *
 * There is no figure here and no name: a placeholder name is a claim about an
 * account nobody has confirmed yet.
 */
export function ProfileLoading() {
  return (
    <div aria-busy aria-label="Loading your profile" className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

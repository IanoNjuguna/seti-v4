import Link from 'next/link';
import { Text } from '@/components/ui';
import { PAY_ACTION_CLASS, PUBLIC_COPY } from './MerchantPublic.constants';
import type { MerchantPayActionProps } from './MerchantPublic.types';

/**
 * The page's one primary action: Pay, carrying the handle into the pay flow.
 *
 * The href is `/app/pay?handle=<handle>` — an existing route, and the SAME
 * `GET /merchants/resolve` path that a pasted code takes, because the resolver
 * now accepts a handle. No second entry path is invented for the link.
 *
 * It is an ordinary anchor, so this page needs no session to render it. Following
 * it enters the product app, which is where sign-in lives: the note says so,
 * because a stranger should not have to tap to discover they need an account.
 */
export function MerchantPayAction({ handle }: MerchantPayActionProps) {
  return (
    <div>
      <Link href={`/app/pay?handle=${encodeURIComponent(handle)}`} className={PAY_ACTION_CLASS}>
        {PUBLIC_COPY.pay}
      </Link>
      <Text variant="micro" as="p" className="mt-2">
        {PUBLIC_COPY.signInNote}
      </Text>
    </div>
  );
}

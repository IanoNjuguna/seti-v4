import type { Metadata } from 'next';
import { ConvertPage } from './ConvertPage';
import { CONVERT_METADATA } from './ConvertPage.constants';

/**
 * `/convert` — the route file, and it owns nothing but the head (#586).
 *
 * The page is `ConvertPage`, every string it prints is a constant beside it, and the
 * calculator is a component under `components/convert/`. `metadata` is static rather than
 * `generateMetadata` because nothing in it is computed: a route that rendered per request
 * would cost more than it gains, and the rate the page shows is read on the client anyway.
 *
 * `robots` is deliberately absent — this is a page written to be found. A stranger
 * searching "OUSD to KES" is exactly the reader the page exists for, and there is nothing
 * behind a session here to protect.
 */
export const metadata: Metadata = CONVERT_METADATA;

export default function Convert() {
  return <ConvertPage />;
}

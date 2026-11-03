import type { Metadata } from 'next';
import { PricingPage } from './PricingPage';
import { PRICING_METADATA } from './PricingPage.constants';

/**
 * `/pricing` — the route file, and it owns nothing but the head.
 *
 * The page is `PricingPage`, and every string it prints is a constant beside it, so a copy
 * change is a constants change and a layout change is a component's. There is no
 * `generateMetadata` here: nothing about this page's head is computed, and a route that
 * renders per request would cost more than the four static bytes it gains.
 *
 * `robots` is deliberately absent — see `PRICING_METADATA` for why this page is meant to be
 * found rather than hidden.
 */
export const metadata: Metadata = PRICING_METADATA;

export default function Pricing() {
  return <PricingPage />;
}

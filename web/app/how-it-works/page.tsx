import type { Metadata } from 'next';
import { HowItWorksPage } from './HowItWorksPage';
import { HOW_IT_WORKS_METADATA } from './HowItWorksPage.constants';

/**
 * `/how-it-works` — the route file, and it owns nothing but the head.
 *
 * The page is `HowItWorksPage`, and every string it prints is a constant beside it. There is
 * no `generateMetadata`: nothing about this head is computed, and the page has no request to
 * read, so it stays a static route.
 *
 * `robots` is deliberately absent — see `HOW_IT_WORKS_METADATA` for why this page is meant to
 * be found rather than hidden.
 */
export const metadata: Metadata = HOW_IT_WORKS_METADATA;

export default function HowItWorks() {
  return <HowItWorksPage />;
}

'use client';

import { useParams } from 'next/navigation';
import { MarketEventScreen } from '@/components/markets/MarketEventScreen';

/**
 * `/app/markets/[slug]` — one event.
 *
 * The slug is read with `useParams` rather than awaited from the page's `params`
 * prop, because this route is client-side: the component fetches the event itself,
 * so there is no server render to hand it a promise. A missing slug renders nothing
 * rather than an empty shell, and the screen's own "not found" state covers the
 * case where the slug exists but the event has closed.
 */
export default function MarketEventPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  if (slug.length === 0) return null;

  return <MarketEventScreen slug={slug} />;
}

import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { PersonPublicView } from '@/components/person-public/PersonPublicView';
import { fetchPublicHandle } from '@/lib/api/handles';

interface PersonLinkPageProps {
  params: Promise<{ handle: string }>;
}

/**
 * `seti.live/u/<handle>` — the page a person's link opens.
 *
 * UNAUTHENTICATED, deliberately: it is a server component with no session gate,
 * and the identity comes from `/public/handles/:handle`, which has no auth hook
 * either. A stranger opening a link from a chat must see who they are sending to
 * before being asked for anything.
 *
 * It reads as "send money to Ian" — a person, not a shop. The one action carries
 * the handle into the SEND flow, never the merchant pay flow.
 *
 * `/u/<handle>` and `/m/<handle>` are two routes onto ONE namespace. If a
 * BUSINESS handle is opened here, it redirects to its business page rather than
 * pretending to be a person; the same is true in reverse on `/m`. The handle
 * itself is the same signed string either way.
 *
 * An unknown handle is a real 404 (`notFound()`), never an empty page. The read is
 * uncached (`no-store`, see `fetchPublicHandle`), so a name claimed or an address
 * repointed a moment ago is what the customer sees.
 */
const loadPerson = cache(fetchPublicHandle);

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PersonLinkPageProps): Promise<Metadata> {
  const { handle } = await params;
  const person = await loadPerson(handle);

  return person
    ? { title: `${person.name} — Seti`, description: `Send money to ${person.name} with Seti.` }
    : { title: 'No one here — Seti' };
}

export default async function PersonLinkPage({ params }: PersonLinkPageProps) {
  const { handle } = await params;
  const person = await loadPerson(handle);

  if (!person) notFound();
  if (person.kind === 'business') redirect(`/m/${handle}`);

  return (
    <main className="min-h-dvh bg-canvas-light text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10">
        <PersonPublicView person={person} />
      </div>
    </main>
  );
}

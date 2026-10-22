import Link from 'next/link';
import { Text } from '@/components/ui';

/** A link, styled as the system's inline action rather than as a button. */
const ACTION_CLASS =
  'mt-3 inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export interface InviteStateNoteProps {
  /** What is true right now, in the page's own words. */
  title: string;
  /** Why, and what changes it. One sentence. */
  body: string;
  /** The one way out, when there is one. A link, because it navigates. */
  action?: { href: string; label: string };
}

/**
 * A state of the invite screen that has no link in it.
 *
 * Two of them exist — no username, and a username that does not resolve yet — and
 * they are the same SHAPE with different words, so they are one component rather
 * than two files that drift. What it never does is draw a disabled field or a grey
 * Copy control: there is nothing to copy, and a control that cannot work is worse
 * than a screen that explains why.
 *
 * The action is a `Link`, not a button: the claim surface is a page.
 */
export function InviteStateNote({ title, body, action }: InviteStateNoteProps) {
  return (
    <section className="border-t border-hairline-light pt-6">
      <Text variant="card-title" as="h2">
        {title}
      </Text>
      <Text variant="body" as="p" color="secondary" className="mt-1">
        {body}
      </Text>

      {action ? (
        <Link href={action.href} className={ACTION_CLASS}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

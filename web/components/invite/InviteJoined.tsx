import { Text } from '@/components/ui';
import { INVITE_COPY, countSentence } from './Invite.constants';
import type { InviteJoinedProps } from './Invite.types';

/**
 * The count as a sentence, then the people it counts.
 *
 * The count is said in words BEFORE the names, because it is the thing the screen
 * exists to answer and it has to make sense with an empty list under it. The list
 * is rows on the canvas, separated by the system's hairline rather than drawn as
 * cards: a person's arrival is a fact, not a surface.
 *
 * Every row is a HANDLE and a DATE, and that is the whole of what a referrer may
 * know about an invitee (#145). An invitee who has not claimed a name yet reads as
 * `joinedNoName` rather than being left out, so the count above and the list below
 * cannot disagree.
 */
export function InviteJoined({ count, joined }: InviteJoinedProps) {
  return (
    <section className="border-t border-hairline-light pt-6">
      <Text variant="card-title" as="h2">
        {INVITE_COPY.joinedTitle}
      </Text>

      <Text variant="micro" as="p" color="secondary" className="mt-1" role="status">
        {countSentence(count)}
      </Text>

      {joined.length === 0 ? (
        <Text variant="body" as="p" color="secondary" className="mt-4">
          {INVITE_COPY.joinedEmpty}
        </Text>
      ) : (
        <ul className="mt-4 flex flex-col">
          {joined.map((join, index) => (
            <li
              key={`${join.handle ?? 'no-name'}-${join.joinedAt}-${index}`}
              className="flex items-baseline justify-between gap-4 border-t border-hairline-light py-3 first:border-t-0"
            >
              <Text variant="body-medium" as="p" className="min-w-0 break-all">
                {join.handle ? `@${join.handle}` : INVITE_COPY.joinedNoName}
              </Text>
              <Text variant="micro" as="p" color="secondary" className="shrink-0">
                {INVITE_COPY.joinedOn(join.joinedAt)}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

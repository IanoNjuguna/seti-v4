import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui';
import { EMPTY_ACTIVITY_COPY, EMPTY_ACTIVITY_SEND_HREF } from './EmptyActivity.constants';

/**
 * The action's own class list, beside the one element that uses it — the same
 * class the profile panel's empty state puts on its claim link
 * (`ProfileHandleEmpty`): a 14px semibold line in the inline-link role
 * (`text-link`), underlined on hover, in the repo's `min-touch` 44px box.
 *
 * A TEXT action and not a button, deliberately. On the home screen the action
 * strip directly above already carries a Send tile, so a second, filled control
 * for the same destination would compete with it; on Activity it would read as a
 * call-to-action block this screen is not asking for.
 */
const ACTION_CLASS =
  'inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * The empty state: one illustration, one sentence that invites the action, and
 * that action as a quiet line under it. No card. It is the SAME block both
 * screens render, imported by `ActivityStates` rather than re-drawn, because
 * "nothing has moved yet" is one idea with one voice — Home under "Recent
 * activity", Activity under "Activity". No margin of its own: the step to it
 * belongs to whichever page stacks it (`HomeActivitySection`'s `gap-4`, `ActivityList`'s `gap-6`).
 *
 * Nothing here is plated: an empty state has no object to hold a surface, so
 * there is no well, no ring and no medallion. It used to be a `surface-soft` well
 * with a round icon, a title and a paragraph inside — a card drawn around words,
 * under a heading that already said what the list was.
 *
 * THE SIZE. The illustration is `send`, because the state invites sending, at
 * 56px (`h-14`), up from the 40px it had been wearing. 40px is a ROW MARK's size
 * — every `TransactionRow` draws its mark at 40px — so the illustration was drawn
 * at the weight of the UI it stands in for. 56px clears that mark by a full 16px
 * step and stops one step short of a whole row (`TransactionRow` is `min-h-16`,
 * 64px): at a row's height the picture would measure the same as the content it
 * replaces, which is where an illustration starts reading as a row of nothing.
 * 56px is also what this state's old medallion was. `stone`, not `mute` or
 * `secondary`, because this is a picture and not text — it sets the eye going
 * without competing with the sentence.
 *
 * THE CENTRING is deliberate, and it is the one exception to this app's shared
 * left edge. An empty state is a PLACEHOLDER, not a layout: the rows it stands in
 * for are a list with a left edge, and this is a single idea appearing where they
 * would be. Left-aligned it reads as a row that failed to load — a 728px column
 * with one small mark and one sentence hugging a corner, which is the negative
 * space this was asked to close.
 *
 * THE SPACING is two steps off the design ladder and nothing is padded to fill
 * the section: `{spacing.lg}` (16px, `gap-4`) from the picture to the words, and
 * `{spacing.xxs}` (4px, `gap-1`) inside them — where the link's own `min-touch`
 * leading (a 44px box around a 20px line) leaves an OPTICAL 16px between the
 * sentence and the action, the same step as the picture's, so the block reads as
 * one rhythm rather than three things at three distances.
 *
 * The action is a LINK to `/app/send` and reads no session, because this app asks
 * for an account at the ACTION and never at the door: `/app/send` renders
 * `SendSignedOut` for a visitor, so a signed-out tap lands on the sign-in prompt
 * in the place the recipient question would have been.
 */
export function EmptyActivity() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Icon name="send" className="h-14 w-14 text-stone" />

      <div className="flex flex-col items-center gap-1">
        <Text variant="body" color="secondary" as="p">
          {EMPTY_ACTIVITY_COPY.message}
        </Text>

        <Link href={EMPTY_ACTIVITY_SEND_HREF} className={ACTION_CLASS}>
          {EMPTY_ACTIVITY_COPY.action}
        </Link>
      </div>
    </div>
  );
}

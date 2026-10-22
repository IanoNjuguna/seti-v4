import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { PAY_COPY } from './PayPublic.constants';

/**
 * The custody sentence, outside the card and standing alone.
 *
 * It is the reason a stranger can pay a stranger: the money goes to the recipient's
 * own wallet and Seti never holds it. It sits below the card rather than inside it
 * because it describes the whole request, not one of its rows — and it is never
 * abbreviated to a word like "secure", which claims comfort instead of a mechanism.
 *
 * The shield is decorative (`Icon` is `aria-hidden` by default) and the sentence is
 * the whole message, so nothing here depends on the glyph being seen.
 */
export function PayCustodyNote() {
  return (
    <div className="flex items-start gap-3 px-1">
      <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-mute" />
      <Text variant="micro" as="p">
        {PAY_COPY.custody}
      </Text>
    </div>
  );
}

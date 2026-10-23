import { PAY_LINK_CLASS } from './PayPublic.constants';
import type { PayPayerSwitchProps } from './PayPayer.types';

/**
 * The answer that was not "I can pay", as links.
 *
 * The page cannot see a wallet, so the state is something the payer tells it. These
 * are how they change their answer, and they are plain anchors rather than a control
 * with an `onClick` (the send panel's `ChoiceRow` is a button): the whole page has to
 * work with JavaScript off, and a state is a URL.
 *
 * Every state offers a way out, including back to the request, so no answer ends on a
 * page with nothing to do. They sit at the END of the payer block, under the request,
 * because the payer who can pay should not read a refusal first.
 */
export function PayPayerSwitch({ links }: PayPayerSwitchProps) {
  if (links.length === 0) return null;

  return (
    <p className="flex flex-wrap gap-x-4 gap-y-2">
      {links.map((link) => (
        <a key={link.href} href={link.href} className={PAY_LINK_CLASS}>
          {link.label}
        </a>
      ))}
    </p>
  );
}

import { cn } from '@/lib/cn';
import { PaymentCard } from './PaymentCard';
import { STACKED_PAYMENTS, STACK_ENTRANCE_CLASSES } from './PaymentStack.constants';

/**
 * The payment stack — the object that replaced the single "example payment"
 * card in the how-it-works band.
 *
 * A stack rather than one card because the band is about the mechanic, and one
 * card cannot show a balance working: three movements say "this is a feed you
 * live in", which is the thing the three step rows beside it are describing.
 *
 * ONE CARD ON A PHONE. The second and third cards are `hidden md:flex`: at 360px
 * the band has already given its width to the step rows, and a three-card column
 * would push them a full screen down. The first card — a payment arriving — is
 * the one that carries the sentence.
 *
 * `hidden md:flex` rather than `md:block`, deliberately: the card's own display
 * is `flex`, so a `md:block` would win at md and collapse the row into a stack.
 * The entrance classes come from the constants file, capped at three.
 */
export function PaymentStack() {
  return (
    <div className="flex flex-col gap-3">
      {STACKED_PAYMENTS.map((payment, index) => (
        <PaymentCard
          key={payment.id}
          payment={payment}
          className={cn(
            STACK_ENTRANCE_CLASSES[Math.min(index, STACK_ENTRANCE_CLASSES.length - 1)],
            index > 0 && 'hidden md:flex'
          )}
        />
      ))}
    </div>
  );
}

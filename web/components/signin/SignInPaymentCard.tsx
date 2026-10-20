import { Text } from '@/components/ui';
import { SIGN_IN_AMBIENT_COPY } from './SignInAmbientPanel.constants';

/**
 * The one object in the panel: a payment, mid-flight, told the way the product tells it.
 *
 * Numbers are `tabular` so the column of figures lines up, and the row rules sit on the
 * card's own edge rather than floating — the same shared-edge rule the rest of the app
 * follows. The teal dot and line are the settled status, the one place on this page a
 * status colour appears, which is what makes it read as a live thing rather than a
 * screenshot.
 */
export function SignInPaymentCard() {
  const { card } = SIGN_IN_AMBIENT_COPY;

  return (
    <div className="w-full rounded-lg border border-hairline-dark bg-surface-elevated p-6">
      <div className="flex items-center justify-between">
        <Text as="p" variant="micro" color="inverse-muted" className="uppercase tracking-[0.14em]">
          {card.title}
        </Text>
        <Text as="p" variant="micro" color="inverse-muted">
          {card.age}
        </Text>
      </div>

      <p className="mt-5 font-brand text-[2.5rem] font-medium leading-none tracking-[-0.04em] text-on-dark">
        <span className="tabular">{card.amount}</span>
        <span className="ml-2 align-middle font-sans text-sm font-normal tracking-normal text-stone">
          {card.currency}
        </span>
      </p>

      <Text as="p" variant="micro" color="inverse-muted" className="mt-1.5">
        {card.merchant}
      </Text>

      <div className="mt-5 flex flex-col gap-3 border-t border-divider-soft pt-4">
        {card.rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <Text as="span" variant="micro" color="inverse-muted">
              {row.label}
            </Text>
            <Text as="span" variant="micro" color="inverse" tabular className="text-right">
              {row.value}
            </Text>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
        <Text as="span" variant="micro" color="success">
          {card.settled}
        </Text>
      </div>
    </div>
  );
}

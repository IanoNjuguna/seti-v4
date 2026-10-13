import { ButtonLink, Card, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/**
 * The signature action, given its own module.
 *
 * Seti's whole premise is "scan a merchant's code and pay their wallet", so the
 * QR lives on the home screen rather than behind a tab a user has to find. The
 * QR mark is the icon set's only multi-path glyph, which is why it reads as a
 * mark rather than a line drawing.
 *
 * This card is the home screen's ONE pay entry point (`quick-actions.constants`
 * records the same rule for the tile strip: a second affordance for one job is
 * two affordances). The CTA is therefore a single control — a `ButtonLink` — and
 * not `<Link><Button>`, which rendered the action twice in the DOM.
 *
 * Layout is the one thing this card has to get right at both ends. On a phone the
 * mark sat beside the text and took a third of the card, squeezing the paragraph
 * to five lines and wrapping the CTA onto two; so below `sm` the card is one
 * column — mark, then text, then the CTA full width, which holds "Find a
 * merchant" on one line down to 320px. From `sm` up it is a single row instead,
 * with the CTA at the far end: on a 728px card a left-hugging row left ~370px of
 * dead canvas to its right. The mark scales with the layout (48px → 80px) rather
 * than being one fixed size, and nothing has a fixed height, so there is no void
 * to leave.
 */
export function ScanPayCard() {
  return (
    <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-soft text-ink sm:h-20 sm:w-20"
      >
        <Icon name="qr" className="h-6 w-6 sm:h-10 sm:w-10" />
      </span>

      <div className="min-w-0 sm:flex-1">
        <Text variant="card-title" as="h2">
          Pay a merchant
        </Text>
        <Text variant="micro" as="p" className="mt-1">
          Type their Seti name, or scan their code. The money goes straight to their wallet.
        </Text>
      </div>

      <ButtonLink href="/app/pay" variant="secondary" fullWidth className="sm:w-auto">
        Find a merchant
      </ButtonLink>
    </Card>
  );
}

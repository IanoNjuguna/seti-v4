import type { ButtonVariant } from '@/lib/types';
import type { ICON_PATHS } from '@/components/ui/icon-paths.constants';

/** One of Home's two actions: a label, a destination, and the weight it wears. */
export interface HomeAction {
  key: string;
  label: string;
  href: string;
  /**
   * Which of the system's two button recipes this one wears — `primary` is the
   * black CTA on a white band, `secondary` the outlined one beside it
   * (`design/revolut.md`, Components → Buttons). Two FILLED buttons side by side
   * is two calls to action; one filled and one outlined is a premise and its
   * alternative.
   */
  variant: Extract<ButtonVariant, 'primary' | 'secondary'>;
  /**
   * A short marker for a door that is new or not open yet. The door stays so the signal
   * stays with it; a removed door is a feature nobody discovers later.
   *
   * It is drawn as a glowing chip in the tile's corner and spoken as part of the link's
   * name, so "Save, New" is what a screen reader hears (#328, #377).
   */
  badge?: string;
  /**
   * The glyph above the label, from the hand-drawn set (#328). The label STAYS: at 20px
   * nothing in the set distinguishes paying from receiving from exchanging, so the glyph
   * carries the rhythm and the words carry the meaning.
   */
  icon: keyof typeof ICON_PATHS;
}

/**
 * The grain plate on the primary action (#377).
 *
 * A flat `canvas-dark` tile beside three white ones is a black rectangle; the owner asked for
 * tooth on it. Fractal noise, desaturated and laid over the fill with `overlay`, reads as printed
 * card stock rather than as a texture sticker, and because it is an inline SVG the whole thing is
 * one cached raster at any size, with no image request and no third-party asset.
 *
 * The baseFrequency is high enough to be grain at 79px wide and not read as a pattern; `stitchTiles`
 * keeps the 120px tile from showing its own seams when the browser repeats it.
 */
export const ACTION_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)'/%3E%3C/svg%3E\")";

/**
 * The two things a customer opens their account to do, side by side and full width.
 *
 * Two, not four: paying a merchant is the product, and being paid is how money
 * gets in. There is no third action because there is nowhere real to send it —
 * an inert tile reads as a broken tap (the rule the old icon strip carried), and a
 * funded account that wants to move money between people does it through `Pay`.
 *
 * `Pay` rather than `Send` is the copy decision from #94: the merchant QR is the
 * premise, and `/app/pay` is the merchant-first door onto the same flow.
 *
 * `Receive` rather than `Add money`, deliberately, and this one is a refusal of
 * the issue's own wording: the only surface that puts money in is `/app/receive`,
 * whose title is "Receive money" and whose two halves explain a username and an
 * address. Labelling it `Add money` would name a flow this product does not have —
 * v1 has no on-ramp (`backend/src/services/account.ts`) — and send the customer to
 * a page headed with a different verb. The panel's own rule already prefers the
 * label the destination answers with ("a person is not depositing this month's
 * takings into anything, they are being paid").
 */
export const HOME_ACTIONS: HomeAction[] = [
  { key: 'pay', label: 'Pay', href: '/app/pay', variant: 'primary', icon: 'send' },
  { key: 'receive', label: 'Receive', href: '/app/receive', variant: 'secondary', icon: 'scan' },
  /*
   * Save is the third door, and it is here because the strip this replaces had it:
   * it is the one thing a funded account can do with money it is NOT spending, and
   * `/app/save` is reachable from nowhere else (`AppNav` carries Home, Activity and
   * Profile only). Removing the strip without carrying this across would have
   * orphaned a shipped page.
   *
   * Four short labels in one row, at the system's button height: a quarter of the
   * column each, which `Receive` is the widest of and still clears at 360px.
   */
  /*
   * Saving is closed (#137): deposits revert on an unverified vault with a zero rate,
   * so the door stays and the badge marks why. Hiding it would lose the signal that the
   * feature exists; greying it out would read as broken. The mark is a corner dot and
   * the word lives in the accessible name (#328): `Save Soon` as text did not fit.
   */
  { key: 'save', label: 'Save', href: '/app/save', variant: 'secondary', badge: 'New', icon: 'save' },
  /*
   * Swap becomes a door here and stops being a control on the balance card (#328,
   * slice 2 removes that affordance). It belongs beside Pay and Receive because it is
   * the fourth thing an account does with money: move it between its own assets.
   */
  { key: 'swap', label: 'Swap', href: '/app/swap', variant: 'secondary', icon: 'swap' },
];

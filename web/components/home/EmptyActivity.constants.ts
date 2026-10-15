/**
 * The one sentence the empty activity state says.
 *
 * It is a constant rather than a literal in the component so the shared empty
 * state — the home screen's recent-activity section and the Activity screen's
 * list (`ActivityStates` renders the same block) — cannot drift into two
 * voices for one idea.
 *
 * The sentence names what will appear (the amount, the merchant, the receipt)
 * and where it comes from (the chain, not us), which is more than "No
 * payments yet" ever said. There is no title and no body beside it any more:
 * the section it sits under already says what the list is, so a heading here
 * would be the same words twice (`EmptyActivity`).
 */
export const EMPTY_ACTIVITY_COPY = {
  message:
    'Pay a Seti merchant and it shows up here with the amount, the merchant and the receipt — straight from the chain, not from us.',
} as const;

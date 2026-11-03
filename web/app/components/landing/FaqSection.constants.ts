import type { FaqSectionCopy } from './FaqSection.types';

/**
 * The nine questions a merchant asks, and the answers the product can back.
 *
 * THE BAND'S CONSTANT IS THE SINGLE SOURCE of the questions and their answers.
 * `web/lib/faq-schema.ts` reads THIS constant to build the page's `FAQPage` node, so the
 * visible band and the structured data cannot drift: editing an answer here changes both,
 * and there is no second copy of a question anywhere in the repo.
 *
 * EVERY ANSWER IS TRUE OF THE SHIPPED PRODUCT, which is why some of them are short and
 * one of them is a refusal. The 2% is `backend/src/services/fees.ts` (customer pays,
 * no floor, no cap, no monthly fee, no minimum); nobody holds the money because v1 is
 * non-custodial and a payment runs customer to merchant; there is no off-ramp in v1, so
 * question five answers "Not yet" and says what the balance does instead of what a
 * product might one day do. Nothing here mentions bank funding, cards, yield or a
 * cash-out, because none of those ship.
 *
 * THE ANSWERS ARE WRITTEN TO BE READ COLD. They are also the strings a search result
 * or an assistant may quote without the page around them, so each one stands on its own
 * and each one repeats the noun it is about ("Seti", "your balance") rather than
 * leaning on the question above it.
 *
 * THE COPY IS THE OWNER'S, REPRODUCED, including the full stops.
 */
export const FAQ_COPY: FaqSectionCopy = {
  heading: 'Questions',
  items: [
    {
      question: 'What does Seti cost?',
      answer:
        '2% of each payment, paid by your customer in the same payment. There is no monthly fee and no minimum.',
    },
    {
      question: 'Who can use it?',
      answer:
        'Shops and traders in Kenya, and anyone who sells online and wants to be paid in dollars.',
    },
    {
      question: 'Does Seti hold my money?',
      answer: 'No. A payment goes from your customer to you, and Seti never holds it on the way.',
    },
    {
      question: 'Does my customer need an account?',
      answer:
        'Yes. Signing in takes an email and a code, and they pay from the same balance they signed in with.',
    },
    {
      question: 'Can I take the money out in shillings?',
      answer:
        'Not yet. Your balance stays in dollars, and taking it out as shillings is not something Seti does today.',
    },
    {
      question: 'What if the code does not scan?',
      answer:
        'They type your name instead, or open the link you sent them. Nothing leaves their balance until they confirm.',
    },
    {
      question: 'How quickly does the money arrive?',
      answer:
        'In seconds, at any hour. The payment is confirmed on Tempo and shows up in your balance and in Activity straight away.',
    },
    {
      question: 'Can I send a link instead of printing the code?',
      answer:
        'Yes. The link works the same as the code. A customer opens it, sees your name and the amount, and pays you from their own balance.',
    },
    {
      question: 'Do I need a card or a bank account?',
      answer:
        'No. Seti asks for an email and a code. A card and a bank account are not part of the product today.',
    },
  ],
};

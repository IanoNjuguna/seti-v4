import type { FooterStatementProps } from './LandingFooter.types';

/**
 * The footer's statement: the page's last sentence, in display type.
 *
 * WHY IT IS HERE, AND IN THE FOOTER. The landing page lost its custody sentence (#288: "The
 * money lands in your own wallet. Seti never holds it.") from the hero, and the note left
 * behind said the claim needed "a home that is not the hero". This is that home. A footer is
 * where a reader goes to check what a company actually promises, so the strongest true claim on
 * the page belongs here rather than in a sales line: it says the one thing no competitor can
 * copy cheaply, because it is a property of the architecture (`backend` holds no key that can
 * move a customer's money) and not of the copy.
 *
 * IT IS NOT A SECOND HEADING. The band's name is not in the outline and this is a `<p>`,
 * deliberately: the page's `h2`s are its bands, and a footer that adds another one makes an
 * outline where the last section is furniture.
 *
 * ONE LINE PER SENTENCE, AND NO HANGING SECOND LINE. Both were tried at `display-lg` (48px):
 * the first line wrapped after "lands" and the hanging indent then made a staircase of three
 * fragments, which reads as an accident rather than as composition. At `display-md` (40px) each
 * sentence is one line inside the band's eight columns, so the couplet is real and the left edge
 * is the only alignment the block needs.
 *
 * IT NO LONGER ARRIVES WORD BY WORD (#365). The stagger cost one `span` per word, a
 * `--word-index` per span and an observer to arm `data-statement-*`: three mechanisms to fade a
 * sentence in. With the page's motion gone, the words are what they always were — a sentence,
 * rendered on the server, in the first frame.
 */
export function FooterStatement({ lines }: FooterStatementProps) {
  return (
    <p className="max-w-2xl font-brand text-display-md font-medium text-balance text-on-dark">
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

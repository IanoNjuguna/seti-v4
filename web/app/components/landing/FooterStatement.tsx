'use client';

import { useRef, type CSSProperties } from 'react';
import { useFooterStatement } from './useFooterStatement';
import type { FooterStatementProps } from './LandingFooter.types';

/**
 * The footer's statement: the page's last sentence, in display type, arriving one
 * word at a time.
 *
 * WHY IT IS HERE, AND IN THE FOOTER. The landing page lost its custody sentence
 * (#288: "The money lands in your own wallet. Seti never holds it.") from the hero,
 * and the note left behind said the claim needed "a home that is not the hero". This
 * is that home. A footer is where a reader goes to check what a company actually
 * promises, so the strongest true claim on the page belongs here rather than in a
 * sales line: the statement sits at the top of the band, above the index and the
 * colophon, and it says the one thing no competitor can copy cheaply because it is a
 * property of the architecture (`backend` holds no key that can move a customer's
 * money) and not of the copy.
 *
 * IT IS NOT A SECOND HEADING. The band's name is not in the outline and this is a
 * `<p>`, deliberately: the page's `h2`s are its bands, and a footer that adds another
 * one makes an outline where the last section is furniture.
 *
 * ONE LINE PER SENTENCE, AND NO HANGING SECOND LINE. Both were tried at `display-lg`
 * (48px): the first line wrapped after "lands" and the hanging indent then made a
 * staircase of three fragments, which reads as an accident rather than as composition.
 * At `display-md` (40px) each sentence is one line inside the band's eight columns, so
 * the couplet is real and the left edge is the only alignment the block needs.
 *
 * Each word is its own `span` so the stagger can reach it, and the index rides on a
 * CSS custom property rather than an inline transition-delay per word: the delay is
 * `calc(var(--word-index) * 40ms)` in `globals.css`, which keeps the timing in the
 * design system with the other durations instead of in ten style attributes.
 */
export function FooterStatement({ lines }: FooterStatementProps) {
  /** The word index each line starts at, so the stagger runs across the whole
   *  sentence instead of restarting on the second line. Computed, not accumulated:
   *  a `let` mutated inside `.map` is a render-time side effect React Compiler
   *  refuses to memoise. */
  const lineOffsets = lines.map(
    (_, lineIndex) => lines.slice(0, lineIndex).reduce((count, line) => count + line.split(' ').length, 0)
  );

  return (
    <p className="max-w-2xl font-brand text-display-md font-medium text-balance text-on-dark">
      {lines.map((line, lineIndex) => (
        <span key={line} className="block">
          {line.split(' ').map((word, wordIndexInLine) => {
            const index = lineOffsets[lineIndex] + wordIndexInLine;

            return (
              <span
                key={`${index}-${word}`}
                className="footer-word"
                style={{ '--word-index': index } as CSSProperties}
              >
                {word}
                {' '}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}

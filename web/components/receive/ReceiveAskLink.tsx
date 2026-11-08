'use client';

import { ButtonLink } from '@/components/ui';

/**
 * The way from "here is my name" to "here is what you owe me" (#465).
 *
 * The word is `Claim`: what a customer sends is a claim on a figure, and `ask` is the name the code
 * uses for the record. One concept, two readers.
 *
 * Receive answers `who do I pay` and Ask answers `how much`, and a person who has just been told to
 * send their name is one step away from the case where an amount has to be named. It sits under the
 * half rather than in the app bar because it is the same job as the half above it, with the figure
 * added: money coming in.
 *
 * A link rather than a button: the destination is a page, it survives a middle-click, and it reads as
 * a place you can go back to rather than an action that happens.
 */
export function ReceiveAskLink() {
  return (
    <ButtonLink href="/app/ask" variant="secondary" fullWidth>
      Claim
    </ButtonLink>
  );
}

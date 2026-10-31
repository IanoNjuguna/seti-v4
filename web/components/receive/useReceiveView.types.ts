import type { SessionProblem } from '@/lib/auth';
import type { ReceiveView } from './ReceivePage.types';

/** The half's string: the bare handle, and the resolvable link the code encodes. */
export interface ReceiveHandleView {
  /** What a sender types, and what the copy control writes. No `@`. */
  handle: string;
  /** `seti.live/u/<handle>` (or `/m/`). Fed to the code and the sheet, never printed. */
  link: string;
}

/** A business's counter name, which is the only reason this page has a second half. */
export interface ReceiveBusinessView {
  /** The name a customer reads: `Java House`. */
  name: string;
  /** The stored handle the business link is built from: `javahouse`. */
  handle: string;
}

/** What a missing name is, and the one route that fixes it. */
export interface ReceiveClaimView {
  /** The claim route the rail's identity card also offers. */
  href: string;
  /** `No username yet` — the same words the rail uses, from `PROFILE_INTENT_COPY`. */
  title: string;
  /** `Claim a username` — the same words the rail uses. */
  label: string;
  /** Why the missing name matters on THIS page. */
  body: string;
}

/**
 * Everything `/app/receive` can be, typed — one variant per real outcome, so a state
 * with no words is a type error rather than a blank column.
 *
 * `no-name` is the state this surface used to render as `null`: an account holding no
 * name of its own under a page title. It is a state, not a failure, and it is reachable
 * whenever the gate has let an account through that the mode has no name for.
 */
export type ReceiveScreenState =
  | { status: 'loading' }
  | { status: 'signed-out'; error: SessionProblem | null }
  | { status: 'failed'; message: string; retry: () => void }
  | { status: 'no-name'; claim: ReceiveClaimView }
  | {
      status: 'ready';
      /** The half on screen, resolved from the URL against what this account holds. */
      view: ReceiveView;
      /** What the page offers, in order. One member means no switch is drawn. */
      views: ReceiveView[];
      /** The lead sentence: one clause for a person, two for a business. */
      lead: string;
      handle: ReceiveHandleView;
      /** The business half's target, or null for a person's account. */
      business: ReceiveBusinessView | null;
    };

export interface UseReceiveViewReturn {
  state: ReceiveScreenState;
}

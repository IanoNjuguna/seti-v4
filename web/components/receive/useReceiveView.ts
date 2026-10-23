'use client';

import { useAccountIdentity } from '@/lib/account';
import type { AccountIdentityValue } from '@/lib/account';
import { useSession } from '@/lib/auth';
import type { SessionValue } from '@/lib/auth';
import { useRailIdentity } from '@/components/app/useRailIdentity';
import type { UseRailIdentityReturn } from '@/components/app/RailIdentity.types';
import { RECEIVE_PAGE_COPY } from './ReceivePage.constants';
import type { ReceiveView } from './ReceivePage.types';
import type { ReceiveScreenState, UseReceiveViewReturn } from './useReceiveView.types';

/** Every view this page has, in the order it offers them. The username comes first. */
const ORDER: ReceiveView[] = ['name', 'merchant'];

/**
 * What `/app/receive` shows: which halves this account has, which one the URL asked
 * for, and what to say when there is nothing to show.
 *
 * The identity is not fetched here. `useRailIdentity` already answers "which name is
 * this account's active one" from the session and `useAccountIdentity`, and it is the
 * SAME answer the rail's identity card uses — a second reader would be a second rule,
 * and the two would eventually disagree about who is signed in. The handle and its
 * link consequently come from `merchant-link.ts` rather than being rebuilt here.
 *
 * The URL is the source of truth for the view (`?view=merchant`), resolved against
 * what the account actually holds: an absent value, an unknown value, or a view this
 * account cannot offer falls back to the username. Deliberate — `?view=address` and
 * `/app/deposit` links exist in bookmarks and on stickers, and a dead query string
 * must land on the username rather than on an empty frame.
 *
 * A second half exists for the business HANDLE, not for the mode: an account that has
 * claimed a shop name holds two strings, and the switch is how the owner chooses
 * between handing over a username and printing a counter code.
 */
export function useReceiveView(requested: string | null): UseReceiveViewReturn {
  const session = useSession();
  const account = useAccountIdentity();
  const rail = useRailIdentity();

  const business = businessView(account);
  const views: ReceiveView[] = business ? ORDER : ['name'];
  const view: ReceiveView = views.find((option) => option === requested) ?? 'name';

  return { state: deriveState({ session, account, rail, business, views, view }) };
}

/**
 * The one place this page decides WHAT it is. A pure function of the four answers,
 * kept out of the component so the order of the checks stays readable: a session that
 * has not settled, then nobody signed in, then a failed account read, then an account
 * with no name, and only then a page with something on it.
 *
 * `failed` before `no-name` matters: a failed read leaves `identity` null, and drawing
 * "No username yet" over an unknown would tell a person to claim a name they may
 * already hold.
 */
function deriveState(input: {
  session: SessionValue;
  account: AccountIdentityValue;
  rail: UseRailIdentityReturn;
  business: { name: string; handle: string } | null;
  views: ReceiveView[];
  view: ReceiveView;
}): ReceiveScreenState {
  const { session, account, rail, business, views, view } = input;

  if (session.status === 'restoring' || account.loading) return { status: 'loading' };
  if (!session.isAuthenticated) return { status: 'signed-out', error: session.error };
  if (account.error) {
    return { status: 'failed', message: account.error, retry: account.refresh };
  }

  if (rail.claim) {
    /* The middle sentence is the only part of the claim this page owns; the mode is
       read for it alone, by the same rule `useRailIdentity` applies. */
    const personal = (account.identity?.intent ?? 'personal') === 'personal';

    return {
      status: 'no-name',
      claim: {
        ...rail.claim,
        body: personal ? RECEIVE_PAGE_COPY.emptyPersonBody : RECEIVE_PAGE_COPY.emptyBusinessBody,
      },
    };
  }

  if (!rail.handle) {
    /* Unreachable by construction — no claim and no handle cannot both be false while an
       identity is loaded — but a blank column under a title is the failure this state
       exists to prevent, so it says so rather than rendering nothing. */
    return { status: 'failed', message: RECEIVE_PAGE_COPY.failedBody, retry: account.refresh };
  }

  return {
    status: 'ready',
    view,
    views,
    lead: business ? RECEIVE_PAGE_COPY.leadBusiness : RECEIVE_PAGE_COPY.lead,
    handle: { handle: rail.handle.handle, link: rail.handle.link },
    business,
  };
}

/** The business half's target, when the account holds a business handle. */
function businessView(account: AccountIdentityValue): { name: string; handle: string } | null {
  const held = account.identity?.handles.find((candidate) => candidate.kind === 'business');
  return held ? { name: held.name, handle: held.handle } : null;
}

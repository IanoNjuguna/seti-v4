import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/api.constants';
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE } from '@/lib/invite/invite.constants';

/** Where an invite lands, and where a dead one says so. */
const APP_HOME = '/app';
const APP_HOME_INVITE_COLD = '/app?invite=not-live';

/**
 * `seti.live/i/<handle>` — open an invitation.
 *
 * Three steps, in this order, and the order is the design:
 *
 *  1. ASK the API for the invite code that belongs to this handle. Resolution runs
 *     through the ONE resolver on the server that owns it (`findHandleByHandle`),
 *     so this route cannot disagree with `seti.live/u/<handle>` about whether the
 *     name exists, and a name parked for brand review is simply not found.
 *  2. Set the httpOnly cookie when a code came back. When it did not (unknown,
 *     parked, a business name, no account behind the name) NO code is set, and any
 *     cookie from an earlier link is cleared: the link that was opened last is the
 *     honest answer to "who invited you", and a stale one would count the wrong
 *     person.
 *  3. Forward to `/app` in both cases. A dead invite is not an error page: the
 *     person following it is a visitor, and they should land in the product. The
 *     ONE difference is a flag on the query, which is what lets the app say the
 *     invite is not live rather than silently pretending it worked.
 *
 * `no-store` on the API read, because a name can be claimed or parked a moment
 * ago and this response must not be cached by anything.
 */
export const dynamic = 'force-dynamic';

interface InviteRouteContext {
  params: Promise<{ handle: string }>;
}

async function fetchInviteCode(handle: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/referrals/invite/${encodeURIComponent(handle)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return null;

    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === 'string' && body.code.length > 0 ? body.code : null;
  } catch {
    // An API that cannot be reached must not turn a link into a 500 page: the
    // visitor is forwarded to the app with no invite, which is the same outcome as
    // a dead link and is honest about it.
    return null;
  }
}

export async function GET(request: NextRequest, { params }: InviteRouteContext) {
  const { handle } = await params;
  const code = await fetchInviteCode(handle);

  const response = NextResponse.redirect(
    new URL(code ? APP_HOME : APP_HOME_INVITE_COLD, request.url),
    // 307: a GET that stays a GET, and no cache can pin "this link works" from the
    // moment it was opened.
    { status: 307 }
  );

  if (code) {
    response.cookies.set({
      name: INVITE_COOKIE,
      value: code,
      httpOnly: true,
      sameSite: 'lax',
      // In production the app is served over https and the cookie must never ride
      // a plaintext request; on `next dev` over http a `secure` cookie is dropped
      // by the browser, which would make the feature untestable locally.
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: INVITE_COOKIE_MAX_AGE,
    });
  } else {
    response.cookies.set({ name: INVITE_COOKIE, value: '', path: '/', maxAge: 0 });
  }

  return response;
}

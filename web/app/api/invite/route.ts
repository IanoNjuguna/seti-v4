import { NextResponse } from 'next/server';
import { INVITE_COOKIE } from '@/lib/invite/invite.constants';

/**
 * Discard the invite cookie once it has been carried to the one call it is for.
 *
 * An invite is a ONE-SHOT fact: "this browser arrived from this person's link".
 * It is spent the moment an account is established from this browser, and the
 * browser cannot expire an httpOnly cookie itself, so the page that used it asks
 * the server that set it. Without this, a second account created in the same
 * browser inside thirty days would be attributed to whoever invited the first one,
 * which is a claim about a person that happens to be wrong.
 *
 * `DELETE` rather than `POST`: nothing is created, and the method says what the
 * route does. It answers 204 with no body in every case, because there is nothing
 * a caller could usefully learn from it and nothing it can fail at.
 */
export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({ name: INVITE_COOKIE, value: '', path: '/', maxAge: 0 });

  return response;
}

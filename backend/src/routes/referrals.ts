import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { inviteCodeFor, referralSummary } from '../services/referral.js';

/**
 * Invites: the code a link hands out, and what an account may know about who
 * joined on its invitation.
 *
 * TWO HALVES WITH TWO DIFFERENT AUDIENCES, in one file because they are one
 * feature and the difference is the point:
 *
 *  - `GET /referrals/invite/:handle` is UNAUTHENTICATED, and has to be. The
 *    `seti.live/i/<handle>` page is a server render for a stranger who is not
 *    signed in and may never be; it asks this endpoint to turn a handle into a
 *    signed code, and a signed-out visitor must not be sent to sign in first to
 *    follow an invitation.
 *  - `GET /referrals/me` sits behind `authMiddleware` as a route-level
 *    `preHandler`, like `GET /auth/me` in the file next door, so the public half
 *    cannot leak a hook it does not have.
 *
 * The public half answers `{ code: null }` for a handle it will not invite on:
 * unknown, parked, a business name, or a handle with no account behind it. It is
 * deliberately NOT a 404, because the page's job is to forward to the app either
 * way, and a 404 for an invitation is a stranger reading `404` where they expected
 * to be let in. The code is the only thing that matters, and the page treats
 * `null` as "no invite, just the app".
 */
export async function referralRoutes(app: FastifyInstance) {
  /**
   * The invite code for a handle. Silently `null` for every reason.
   *
   * Nothing about the account behind the handle is returned — not the name as
   * typed, not the id, not how many people it has invited. The response is one
   * opaque, signed string, and the signed string is the only thing carried into
   * the next step, so this endpoint cannot be used to enumerate accounts or to
   * learn anything about a name that `seti.live/u/<handle>` does not already say.
   */
  app.get('/invite/:handle', async (request) => {
    const { handle } = z.object({ handle: z.string().min(1).max(64) }).parse(request.params);

    return { code: await inviteCodeFor(handle) };
  });

  /**
   * Who joined on this account's invitation.
   *
   * Exactly `{ handle, link, count, joined }`, where `handle` and `link` are
   * `null` for an account with no live username: inviting REQUIRES a name, because
   * a link has to point at something that exists, and the screen that offers the
   * link has to be able to say why there is none yet.
   */
  app.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    const caller = request.user;
    if (!caller) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return referralSummary(caller.id);
  });
}

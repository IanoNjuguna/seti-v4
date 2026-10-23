import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findPayeeByAddress } from '../services/payee-directory.js';

/**
 * The public pay page's by-address read (#197): who is paid at an address, and what has
 * been checked about them.
 *
 * UNAUTHENTICATED ON PURPOSE, and for the same reason a charge is: a payment request has
 * to be readable by someone with no Seti account. The payer opened a link, not a session.
 *
 * It answers a QUESTION, not a resource, so a miss is a `200` with `payee: null` rather
 * than a `404`: the common case today is an address with no Seti name at all, and that is
 * an answer the page has a tier for, not an error to log on every stranger's payment
 * request. A malformed address gets the same answer, because no stored claim can be
 * bound to a string that is not an address.
 *
 * What it exposes: the handle, the address it is stored against, whether the claim
 * signature holds, and the date a person reviewed the merchant. NOT the evidence behind
 * that review (an internal audit trail, #154) and nothing about any account. Read-only:
 * there is no way to write a name here.
 *
 * Deliberately its own file, with no auth hook anywhere in it, so this unauthenticated
 * route cannot leak an authenticated neighbour by accident. Same rule as
 * `public-handles.ts` and `public-charges.ts`.
 */
export async function publicPayeeRoutes(app: FastifyInstance) {
  app.get('/:address', async (request) => {
    const { address } = z
      .object({ address: z.string().min(1).max(64) })
      .parse(request.params);

    return { payee: await findPayeeByAddress(address) };
  });
}

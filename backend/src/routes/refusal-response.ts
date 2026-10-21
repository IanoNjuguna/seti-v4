import type { FastifyReply } from 'fastify';
import type { PaymentRefusalError } from '../services/payment-refusal.js';

/**
 * How a refusal reaches the client: 422, a code, and the hash.
 *
 * 422 rather than 500 because the request was understood and the CHAIN refused to
 * support it, which the app can render as a specific state instead of "something
 * went wrong". The refusal is already in `audit_logs` (keyed by txHash), so this
 * body only has to be actionable for the client.
 *
 * Shared rather than duplicated: the convert, send and savings routes all refuse
 * rows for chain-side reasons, and three copies of this would eventually disagree
 * about the status code.
 */
export function refusalResponse(reply: FastifyReply, error: PaymentRefusalError) {
  return reply.status(422).send({
    error: error.message,
    code: error.code,
    txHash: error.txHash,
  });
}

/**
 * Seti API tools.
 *
 * These wrap the backend as it exists. Two honesty constraints are baked in:
 *
 * - **Authentication is a prerequisite, not a detail.** The Seti API has no
 *   public keys; every route needs a Privy-issued bearer token. A missing token
 *   produces an error that says so plainly rather than a confusing 401 later.
 * - **There is no endpoint for everything.** No standalone FX quote, no
 *   merchant list, no webhook management. Those tools do not exist here either,
 *   rather than being faked out of a neighbouring call.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { allowWrites } from '../config.js';
import { ToolError, toolError, toolJson } from '../errors.js';
import { setiRequest } from '../http.js';

const assetArg = z
  .enum(['ousd', 'pathusd'])
  .optional()
  .describe('Payment asset. v1 supports ousd (default) and pathusd only.');

export function registerSetiTools(server: McpServer): string[] {
  const registered: string[] = [];

  server.registerTool(
    'seti_resolve_merchant',
    {
      title: 'Resolve a merchant QR payload',
      description:
        "Resolve a Seti merchant QR payload to a merchant record. Accepts the Seti deep link " +
        "(seti://pay?merchantId=…&amount=…), 'merchant:<id>', or a bare merchant id. Note this parser " +
        'accepts only Seti-issued payloads — it does not read other QR standards.',
      inputSchema: {
        qr: z.string().describe('The scanned or pasted QR payload.'),
      },
    },
    async ({ qr }) => {
      try {
        const result = await setiRequest<{ merchant: unknown; suggestedAmount: string | null }>({
          method: 'GET',
          path: '/merchants/resolve',
          query: { qr },
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_resolve_merchant');

  server.registerTool(
    'seti_preview_payment',
    {
      title: 'Preview a merchant payment',
      description:
        'Get the server-computed preview for a payment: the principal, the platform fee, the GROSS ' +
        'the customer must sign for, the customer-currency conversion with its FX provenance, and ' +
        'whether the balance covers it. The amount is in the CUSTOMER\'s currency — the field is ' +
        'amountFiat on the wire, because that is what the customer actually enters.',
      inputSchema: {
        merchantId: z.string().describe('Merchant id, from seti_resolve_merchant.'),
        amountFiat: z.string().describe("Amount the customer pays, in their currency, e.g. \"250\"."),
        asset: assetArg,
      },
    },
    async ({ merchantId, amountFiat, asset }) => {
      try {
        const result = await setiRequest<{ preview: unknown }>({
          method: 'POST',
          path: '/transactions/preview',
          body: { merchantId, amountFiat, asset: asset ?? 'ousd' },
        });
        return toolJson({ preview: result.preview });
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_preview_payment');

  server.registerTool(
    'seti_get_transaction_status',
    {
      title: 'Get a transaction status',
      description:
        'Fetch the status, tx hash and settlement timestamps of one transaction you recorded. ' +
        'Statuses are pending, processing, completed, failed or reversed.',
      inputSchema: {
        transactionId: z.string().describe('The transaction id returned when the payment was recorded.'),
      },
    },
    async ({ transactionId }) => {
      try {
        const result = await setiRequest<unknown>({
          method: 'GET',
          path: `/transactions/${encodeURIComponent(transactionId)}/status`,
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_get_transaction_status');

  server.registerTool(
    'seti_get_balance',
    {
      title: 'Get a wallet balance',
      description:
        'Read the on-chain balance the Seti API reports for a user, in the payment asset. This is the ' +
        'same figure the payment preview checks against the gross.',
      inputSchema: {
        userId: z.string().describe('The Seti user id.'),
      },
    },
    async ({ userId }) => {
      try {
        const result = await setiRequest<unknown>({
          method: 'GET',
          path: `/users/${encodeURIComponent(userId)}/balance`,
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_get_balance');

  server.registerTool(
    'seti_list_transactions',
    {
      title: 'List recent transactions',
      description: 'List transactions for the authenticated account, newest first.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Page size, default 20.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, default 0.'),
      },
    },
    async ({ limit, offset }) => {
      try {
        const result = await setiRequest<unknown>({
          method: 'GET',
          path: '/transactions',
          query: { limit, offset },
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_list_transactions');

  /**
   * The only tool with a side effect, so it is registered only when writes are
   * explicitly enabled. A host that enables it should know that the backend
   * verifies the claimed amount against the on-chain receipt and fails closed:
   * a missing payout address, an unverifiable receipt, or a mismatch beyond 1%
   * are all refused rather than recorded.
   */
  if (allowWrites()) {
    server.registerTool(
      'seti_record_payment',
      {
        title: 'Record a settled payment (write)',
        description:
          'Record an already-broadcast payment. The backend reconciles the claimed amount against the ' +
          'on-chain receipt and refuses on a mismatch beyond 1%, a missing payout address, or an ' +
          'unverifiable receipt. In inside-transfer mode pass the GROSS that was signed; in batch mode ' +
          'pass the PRINCIPAL. Enabled only with SETI_MCP_ALLOW_WRITES=true.',
        inputSchema: {
          merchantId: z.string().describe('Merchant id.'),
          amount: z.string().describe('Amount in token units that was actually transferred (see description).'),
          txHash: z.string().regex(/^0x[a-fA-F0-9]+$/).describe('The broadcast transaction hash.'),
          asset: assetArg,
          description: z.string().optional(),
        },
      },
      async ({ merchantId, amount, txHash, asset, description }) => {
        try {
          if (!allowWrites()) {
            throw new ToolError('Writes are disabled. Set SETI_MCP_ALLOW_WRITES=true to enable this tool.');
          }
          const result = await setiRequest<unknown>({
            method: 'POST',
            path: '/transactions/pay',
            body: { merchantId, amount, asset: asset ?? 'ousd', txHash, description },
          });
          return toolJson(result);
        } catch (error) {
          return toolError(error);
        }
      }
    );
    registered.push('seti_record_payment');
  }

  return registered;
}

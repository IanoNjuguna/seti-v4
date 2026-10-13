import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(1),
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  /**
   * Explicit development-only bypass for auth. Must be set to "true" to take
   * effect; it is ignored outside of development.
   */
  DEV_BYPASS_AUTH: z.enum(['true', 'false']).default('false'),
  TEMPO_CHAIN_ID: z.string().optional(),
  TEMPO_RPC_URL: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  TEMPO_TOKEN_PATHUSD: z.string().min(1),
  TEMPO_TOKEN_OUSD: z.string().min(1),

  /**
   * Address that collects the platform fee.
   *
   * v1 collects the fee as its own transfer inside the customer's transaction
   * (`batch` mode), so the fee leg is sent here rather than to the recipient.
   * Validated as a 20-byte hex address at boot: a malformed treasury address
   * would otherwise silently produce transfers to 0x0.
   *
   * The zero address is REFUSED, and that is not pedantry. It is a valid 20-byte
   * address and a burn destination: a build that boots with it would collect the
   * 2% into a hole, `recordPayment`/`recordSend` would verify a Transfer to it as
   * legitimately collected, and the ledger would report revenue that no one can
   * ever spend. `.env.example` ships the real address for the same reason — a
   * placeholder that is copied verbatim must not be able to destroy fees.
   */
  SETI_TREASURY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'SETI_TREASURY_ADDRESS must be a 20-byte hex address')
    .refine((value) => value.toLowerCase() !== `0x${'0'.repeat(40)}`, {
      message:
        'SETI_TREASURY_ADDRESS is the zero address, which is a burn address: the platform fee ' +
        'would be destroyed while the ledger recorded it as collected. Set the address that ' +
        'should receive the fee, or set FEE_ROUTING_MODE=inside-transfer if no fee is to be ' +
        'collected at all.',
    }),
  /**
   * Comma-separated list of origins allowed to call the API cross-origin.
   *
   * Only consulted outside development. In development any origin is reflected,
   * so localhost ports and a tunnel URL work unconfigured. In production this
   * list IS the policy: a deployed or tunnelled front end has an origin the
   * server cannot infer, and the previous production behaviour (`origin: false`)
   * blocked every request from it without an error the browser will explain.
   *
   * Example: https://app.seti.example,https://random-words.trycloudflare.com
   */
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  BRIDGE_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),

  /**
   * How the fee reaches Seti.
   *
   * - `batch`: the customer signs ONE atomic transaction carrying two transfers —
   *   principal to the recipient, fee to SETI_TREASURY_ADDRESS. `recordPayment`
   *   and `recordSend` each require BOTH legs on-chain and fail closed if either
   *   is missing, which is what makes the atomicity load-bearing rather than
   *   merely reassuring. This is the only mode where the 2% is collected, so it
   *   is the default.
   * - `inside-transfer`: one transfer of the gross to the recipient. The fee is
   *   computed, recorded and audited — and not collected, because the recipient
   *   receives the whole gross. With a merchant that is a fee Seti forgoes as a
   *   known, measured leak; with a person there is no merchant to absorb it, so
   *   the fee would be paid TO the recipient and sends are refused in this mode
   *   (see `previewSend`).
   *
   * The mode is a server-side decision on purpose. Accepting it from the client
   * would let a modified client ask for the laxer path, so a client that batches
   * while the server is in `inside-transfer` mode simply fails reconciliation.
   *
   * NOT YET PROVEN: no batched transaction has been signed on Tempo. Reconciliation
   * is covered (`npm run check:fee-batch`, `check:send`) and both are proven against
   * real receipts, but "both legs land in one real receipt" is only provable with a
   * real signature. Do that on Moderato before operating on mainnet — see
   * docs/internal/fee-routing.md.
   */
  FEE_ROUTING_MODE: z.enum(['inside-transfer', 'batch']).default('batch'),

  /**
   * How long a fiat rate quote stays valid, in seconds.
   *
   * The preview signs the rate it used and returns it as a `quoteId`; a record
   * path may only write fiat figures from a rate it can prove came from that
   * signed quote. The TTL bounds how long a stale promise may be redeemed: on
   * expiry the app re-quotes and, if the figure changed, shows the customer the
   * new figure before they sign.
   *
   * 60s covers the gap between a preview and the record that follows a wallet
   * signature, which is the window the freeze has to span. It is deliberately NOT
   * surfaced as a countdown in the UI — the promise is "the figure you saw is the
   * figure we record", not "your rate is locked for a minute".
   */
  QUOTE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),

  /**
   * HMAC key for signed rate quotes.
   *
   * Must be set in production, and MUST be shared by every backend instance that
   * issues or reads quotes: a quote minted by one instance is verified by another
   * only if they hold the same key. When unset, the process mints a random key
   * and warns once — quotes stay unforgeable but do not survive a restart and are
   * not readable across instances, which is fine for a single local dev server.
   */
  QUOTE_SIGNING_SECRET: z.string().optional(),

  /**
   * Merchant fee schedule. Consumers pay 0%; merchants pay
   * MERCHANT_FEE_PERCENT of the payment.
   *
   * v1 settles non-custodially: the customer's stablecoins go straight to the
   * merchant's own wallet. There is no fiat off-ramp and no per-payout cost,
   * so the fee needs no floor to stay above settlement cost. The floor and
   * cap default to 0 — a flat percentage — which keeps the published headline
   * ("merchants pay 2%") true at every ticket size.
   *
   * Both are retained because they become load-bearing the moment a real
   * off-ramp lands: a flat fee on a KES 50 payment would not cover a per-payout
   * charge. Set MERCHANT_FEE_MIN_KES > 0 to reintroduce a floor, and
   * MERCHANT_FEE_MAX_PERCENT > 0 to cap it as a share of small payments.
   */
  MERCHANT_FEE_PERCENT: z.coerce.number().min(0).max(100).default(2),
  MERCHANT_FEE_MIN_KES: z.coerce.number().min(0).default(0),
  MERCHANT_FEE_MAX_PERCENT: z.coerce.number().min(0).max(100).default(0),
  /**
   * Blocks to look back when no cursor exists yet.
   *
   * Deliberately 0 by default. A non-zero lookback makes the indexer treat
   * pre-existing chain history as new activity: on mainnet that writes real
   * historical transfers to tracked addresses as `top_up` Transaction rows,
   * fabricating ledger entries that no payment produced.
   *
   * Set this only for a fresh chain you explicitly want to backfill, and only
   * on testnet. On mainnet, seed the cursor to the current head instead.
   */
  INDEXER_BOOTSTRAP_LOOKBACK: z.coerce.number().int().min(0).default(0),

  /**
   * How long a transaction may sit in `processing` before a sweep resolves it
   * against the chain.
   *
   * Must stay comfortably above the inline confirmation timeout in
   * `confirmTransactionByHash` (30s), or the sweep races a confirmation that is
   * still in flight and the two write the same transition twice. 10 minutes is
   * far outside any normal receipt wait.
   */
  STUCK_TX_AGE_MINUTES: z.coerce.number().int().min(1).default(10),

  /**
   * Cap on receipt fetches per sweep.
   *
   * Each examined row is one RPC call, so a large backlog must be walked in
   * bounded steps rather than all at once. The next tick picks up the rest.
   */
  STUCK_TX_SWEEP_LIMIT: z.coerce.number().int().min(1).default(25),

  /**
   * Explicit safety gate for mainnet. The backend refuses to use a mainnet
   * chain ID unless this flag is set to "true", preventing accidental mainnet
   * transactions during development.
   */
  ALLOW_MAINNET: z.enum(['true', 'false']).default('false'),
});

export const env = envSchema.parse(process.env);

/*
 * Brand review: decide a PARKED claim, or hand a proved brand a name.
 *
 *   npm run review:brand -- list
 *   npm run review:brand -- approve <handle>
 *   npm run review:brand -- refuse  <handle> --reason "..."
 *   npm run review:brand -- expire
 *   npm run review:brand -- reassign --owner <email> --name "KFC Karibu" \
 *        --address 0x.. --issued-at <iso> --nonce <n> --signature 0x.. \
 *        --evidence "..." --reason "..."
 *
 * Why a script and not an admin UI: there is no role or claim in the schema, so
 * an admin endpoint would need an authorisation model that does not exist yet —
 * the same reason `support:payment` is a script. It works against the same `.env`
 * the backend uses, and it lives under `src/` so the repo's gates see it.
 *
 * The two decisions are asymmetric on purpose:
 *
 *   - `approve` makes the claimant's OWN signed binding live. Nobody's name is
 *     moved; a binding that already verifies stops being withheld.
 *   - `refuse` FREES the string (the row is deleted) and records why in the audit
 *     trail, which is the only record afterwards.
 *   - `reassign` is the door past uniqueness for a brand that has PROVED a name
 *     is its own, whatever state the name is in — free, parked, or held by
 *     someone else. It REQUIRES the evidence and the brand's own SIGNATURE (the
 *     name can only attach to an address whose key signs for it), and the
 *     previous holder's claim is preserved in `handle_releases` with the reason
 *     it was released. It is never a silent overwrite.
 *
 * Nothing here moves funds: a decision is about a NAME, never about money.
 */
import { prisma } from '../lib/prisma.js';
import {
  HandleClaimError,
  approveHandleClaim,
  listHandleReviews,
  reassignHandleClaim,
  refuseHandleClaim,
  releaseExpiredParkedClaims,
  PARK_EXPIRY_DAYS,
  type HandleKind,
} from '../services/handle-claims.js';

interface Args {
  command: string;
  handle?: string;
  reason?: string;
  evidence?: string;
  owner?: string;
  name?: string;
  address?: string;
  issuedAt?: string;
  nonce?: string;
  signature?: string;
  kind: HandleKind;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? '', kind: 'business' };
  const flags: Record<string, keyof Args> = {
    '--reason': 'reason',
    '--evidence': 'evidence',
    '--owner': 'owner',
    '--name': 'name',
    '--address': 'address',
    '--issued-at': 'issuedAt',
    '--nonce': 'nonce',
    '--signature': 'signature',
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--kind') {
      const value = argv[++i];
      if (value === 'person' || value === 'business') args.kind = value;
    } else if (flags[arg]) {
      (args as unknown as Record<string, string>)[flags[arg]] = argv[++i];
    } else if (!args.handle && !arg.startsWith('--')) {
      args.handle = arg;
    }
  }

  return args;
}

function usage(): void {
  console.log(`usage:
  npm run review:brand -- list
  npm run review:brand -- approve <handle>
  npm run review:brand -- refuse  <handle> --reason "..."
  npm run review:brand -- expire
  npm run review:brand -- reassign --owner <email> --name "..." --address 0x.. \\
       --issued-at <iso> --nonce <n> --signature 0x.. --evidence "..." --reason "..."`);
}

async function list(): Promise<void> {
  const parked = await listHandleReviews();
  if (parked.length === 0) {
    console.log('No claims are parked for review.');
    return;
  }
  console.log(`${parked.length} claim(s) parked for review (released after ${PARK_EXPIRY_DAYS} days):`);
  for (const handle of parked) {
    console.log(
      `  ${handle.handle.padEnd(24)} ${String(handle.name).padEnd(24)} ${handle.address ?? ''}`
    );
    if (handle.review) console.log(`      matched ${handle.review.brand}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case 'list':
      await list();
      return;

    case 'approve': {
      if (!args.handle) throw new Error('approve needs a <handle>.');
      const handle = await approveHandleClaim(args.handle);
      console.log(`approved ${handle.handle} — now live (verified: ${handle.verified})`);
      return;
    }

    case 'refuse': {
      if (!args.handle) throw new Error('refuse needs a <handle>.');
      if (!args.reason) throw new Error('refuse needs --reason "..." — the record says why.');
      const result = await refuseHandleClaim(args.handle, args.reason);
      console.log(`refused ${result.handle} — the string is freed; reason recorded.`);
      return;
    }

    case 'expire': {
      const released = await releaseExpiredParkedClaims();
      console.log(`released ${released} parked claim(s) past ${PARK_EXPIRY_DAYS} days.`);
      return;
    }

    case 'reassign': {
      const { owner, name, address, issuedAt, nonce, signature, evidence, reason } = args;
      if (!owner || !name || !address || !issuedAt || !nonce || !signature || !evidence || !reason) {
        throw new Error(
          'reassign needs --owner --name --address --issued-at --nonce --signature --evidence --reason.'
        );
      }
      const user = await prisma.user.findUnique({ where: { email: owner } });
      if (!user) throw new Error(`no account with email ${owner}`);

      const handle = await reassignHandleClaim({
        userId: user.id,
        kind: args.kind,
        name,
        address,
        issuedAt,
        nonce,
        signature,
        evidence,
        reason,
      });
      console.log(`reassigned ${handle.handle} to ${handle.address} (verified: ${handle.verified})`);
      return;
    }

    default:
      usage();
      process.exitCode = 2;
  }
}

main()
  .catch(async (error) => {
    if (error instanceof HandleClaimError) {
      console.error(`${error.code}: ${error.message}`);
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

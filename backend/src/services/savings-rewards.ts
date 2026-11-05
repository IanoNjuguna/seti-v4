/**
 * The Merkl campaign behind the vault's 3.5994%, read for one wallet.
 *
 * WHY THIS LIVES HERE. The campaign pays wrapped OUSD (`0x45A8…`) to whoever supplies the
 * vault, and the claim is a Merkl `Distributor` call the CUSTOMER signs: Seti never takes
 * custody, so it never claims on their behalf and never needs an operator authorisation.
 * That makes this a read service plus a payload for the client to encode, nothing more.
 *
 * THE SHAPE IS PARSED DEFENSIVELY, ON PURPOSE. Merkl's `/v4/users/{address}/rewards`
 * response has not been seen with a live holder from this codebase (#322), and inventing
 * field names would be the kind of guess that reads as working until a customer's claim
 * button pays nothing. So the parser accepts the names it is given and returns null for
 * anything it does not recognise: no shape, no button, no wrong number.
 *
 * PENDING IS EXCLUDED, and claimed is subtracted. `amount` is the campaign's CUMULATIVE
 * figure and the Distributor subtracts what has already been paid, so claimable is
 * `amount - claimed`. Adding pending would show a number that is not yet claimable.
 *
 * THE FIGURE ALSO COMES BACK IN THE CUSTOMER'S CURRENCY (#331). `claimableAmount` is
 * token units, which is what the claim signs, and a client that prints them prints a
 * bare number: no symbol it may name (a coin name on a customer surface is what
 * `check-asset-words` exists to stop) and no way to read it as money beside the KES
 * figures on the same screen. So this service converts, at the same user currency and
 * the same fx quote `getSavingsSummary` prices `savedFiat` with — one screen, one rate.
 * The conversion is a LABEL: nothing signs `claimableFiat`.
 */
import { getAddress } from 'viem';
import { publicClientFor } from './chain.js';
import { getFxQuote, resolveUserFiat } from './payments.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { ASSET_DECIMALS } from '../config/assets.js';

/** The Merkl reward token for this campaign: wrapped OUSD, not OUSD itself. */
export const MERKL_WRAPPER = getAddress('0x45A884E97491316F944901d4E9F40539d0cC0f92');

/** The campaign's end, as published today. Copy quotes this, never a bare rate. */
export const MERKL_CAMPAIGN_END = '2027-01-06';

const MERKL_API = 'https://api.merkl.xyz/v4';

export interface SavingsRewards {
  /** True only when a claimable amount, a wrapper and a distributor were all read. */
  claimable: boolean;
  wrapper: string;
  distributor: string | null;
  /** Cumulative campaign amount for this wallet, in wrapped-OUSD units. */
  amount: string;
  /** Already paid out, in the same units. */
  claimed: string;
  /** `amount - claimed`, which is what the button may offer and what the claim signs. */
  claimableAmount: string;
  /** The currency `claimableFiat` is in: the customer's own, as `GET /savings` reports it. */
  fiatCurrency: string;
  /** `claimableAmount` in that currency, to the minor unit. A label, never signed. */
  claimableFiat: string;
  proofs: string[];
  campaignEnds: string;
  /** Why there is nothing to claim, when there is nothing. */
  reason: string | null;
}

/**
 * What a claimable amount is worth in the customer's currency.
 *
 * The reward is wrapped OUSD, a 1:1 wrapper of a USD stablecoin, so the units are dollars
 * before they are anything else and `fiatPerUsd` is the only rate involved. Two decimals
 * because that is the minor unit of every figure this app prints, and `toFixed` rather
 * than a rounding helper because the value is display only: nothing is charged from it.
 *
 * Exported so `check:save` can pin the arithmetic instead of reading the route.
 */
export function claimableFiatFor(claimableUnits: bigint, fiatPerUsd: number): string {
  return ((Number(claimableUnits) / 10 ** ASSET_DECIMALS) * fiatPerUsd).toFixed(2);
}

/**
 * The answer when there is nothing to claim, in the customer's currency.
 *
 * `claimableFiat` is `0.00` rather than absent: a client that prints the figure without
 * reading `claimable` first prints zero, not a stale number or `NaN`.
 */
function nothingToClaim(fiatCurrency: string): SavingsRewards {
  return {
    claimable: false,
    wrapper: MERKL_WRAPPER,
    distributor: null,
    amount: '0',
    claimed: '0',
    claimableAmount: '0',
    fiatCurrency,
    claimableFiat: '0.00',
    proofs: [],
    campaignEnds: MERKL_CAMPAIGN_END,
    reason: 'No rewards to claim yet.',
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBigInt(value: unknown): bigint | null {
  const raw = asString(value);
  if (raw === null) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

/** The wrapper's Distributor, which is the contract that pays and the one to call. */
async function readDistributor(network: Network): Promise<string | null> {
  try {
    // `MERKL_WRAPPER` is already an `Address` (getAddress), so no cast is needed here:
    // asserting `0x${string}` at the generic call is what the lint rule rejected.
    const distributor = await publicClientFor(network).readContract({
      address: MERKL_WRAPPER,
      abi: [
        {
          name: 'distributor',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ type: 'address', name: 'distributor' }],
        },
      ] as const,
      functionName: 'distributor',
    });
    return String(distributor);
  } catch {
    return null;
  }
}

/**
 * One wallet's claimable rewards for this campaign.
 *
 * A failure upstream is NOT an error to surface as a broken screen: no rewards is a normal
 * state, so the answer is `claimable: false` with a reason, and the button simply is not
 * offered.
 */
export async function getSavingsRewards(input: {
  userId: string;
  address: string | null;
  network: Network;
}): Promise<SavingsRewards> {
  const network = normalizeNetwork(input.network);

  // Resolved before the address check, because the empty answer carries a currency too:
  // the same read `getSavingsSummary` makes, so the two figures on one screen cannot be
  // priced at two rates.
  const fiatCurrency = await resolveUserFiat(input.userId);
  const fiatPerUsd = (await getFxQuote(fiatCurrency)).fiatPerUsd;
  const nothing = nothingToClaim(fiatCurrency);

  if (!input.address) return nothing;

  const distributor = await readDistributor(network);
  if (!distributor) return { ...nothing, reason: 'Could not reach the rewards contract.' };

  let payload: unknown;
  try {
    const response = await fetch(`${MERKL_API}/users/${input.address.toLowerCase()}/rewards`);
    if (!response.ok) return { ...nothing, distributor, reason: 'Rewards are unavailable right now.' };
    payload = await response.json();
  } catch {
    return { ...nothing, distributor, reason: 'Rewards are unavailable right now.' };
  }

  // The response is a list of chains, each with a list of rewards. Flatten defensively.
  const chains = Array.isArray(payload) ? payload : [];
  for (const chain of chains) {
    const chainId = (chain as { chain?: { id?: number } })?.chain?.id;
    if (chainId !== 4217 && chainId !== 42431) continue;

    const rewards = (chain as { rewards?: unknown[] })?.rewards;
    if (!Array.isArray(rewards)) continue;

    for (const reward of rewards) {
      if (typeof reward !== 'object' || reward === null) continue;
      // Read through `Record<string, unknown>` rather than asserting a shape at each
      // field: the lint rule here rejects an assertion the generic could have inferred,
      // and one honest narrowing reads better than five casts.
      const entry = reward as Record<string, unknown>;

      const tokenNode = entry.token;
      const token =
        typeof tokenNode === 'object' && tokenNode !== null
          ? (tokenNode as Record<string, unknown>).address
          : undefined;
      if (typeof token !== 'string' || token.toLowerCase() !== MERKL_WRAPPER.toLowerCase()) continue;

      const amount = asBigInt(entry.amount ?? entry.accumulatedAmount) ?? BigInt(0);
      const claimed = asBigInt(entry.claimed) ?? BigInt(0);
      const proofsNode = entry.proofs;
      const proofs = Array.isArray(proofsNode)
        ? proofsNode.filter((proof): proof is string => typeof proof === 'string')
        : [];

      const claimable = amount > claimed ? amount - claimed : BigInt(0);
      if (claimable === BigInt(0) || proofs.length === 0) {
        return { ...nothing, distributor, amount: amount.toString(), claimed: claimed.toString() };
      }

      return {
        claimable: true,
        wrapper: MERKL_WRAPPER,
        distributor,
        amount: amount.toString(),
        claimed: claimed.toString(),
        claimableAmount: claimable.toString(),
        fiatCurrency,
        claimableFiat: claimableFiatFor(claimable, fiatPerUsd),
        proofs,
        campaignEnds: MERKL_CAMPAIGN_END,
        reason: null,
      };
    }
  }

  return { ...nothing, distributor };
}

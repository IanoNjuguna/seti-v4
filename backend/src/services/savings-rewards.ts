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
 */
import { getAddress } from 'viem';
import { publicClientFor } from './chain.js';
import { normalizeNetwork, type Network } from '../lib/network.js';

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
  /** `amount - claimed`, which is what the button may offer. */
  claimableAmount: string;
  proofs: string[];
  campaignEnds: string;
  /** Why there is nothing to claim, when there is nothing. */
  reason: string | null;
}

const NOTHING: SavingsRewards = {
  claimable: false,
  wrapper: MERKL_WRAPPER,
  distributor: null,
  amount: '0',
  claimed: '0',
  claimableAmount: '0',
  proofs: [],
  campaignEnds: MERKL_CAMPAIGN_END,
  reason: 'No rewards to claim yet.',
};

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
async function readDistributor(wrapper: string, network: Network): Promise<string | null> {
  try {
    const distributor = await publicClientFor(network).readContract({
      address: wrapper as `0x${string}`,
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
  address: string | null;
  network: Network;
}): Promise<SavingsRewards> {
  const network = normalizeNetwork(input.network);
  if (!input.address) return NOTHING;

  const distributor = await readDistributor(MERKL_WRAPPER, network);
  if (!distributor) return { ...NOTHING, reason: 'Could not reach the rewards contract.' };

  let payload: unknown;
  try {
    const response = await fetch(`${MERKL_API}/users/${input.address.toLowerCase()}/rewards`);
    if (!response.ok) return { ...NOTHING, distributor, reason: 'Rewards are unavailable right now.' };
    payload = await response.json();
  } catch {
    return { ...NOTHING, distributor, reason: 'Rewards are unavailable right now.' };
  }

  // The response is a list of chains, each with a list of rewards. Flatten defensively.
  const chains = Array.isArray(payload) ? payload : [];
  for (const chain of chains) {
    const chainId = (chain as { chain?: { id?: number } })?.chain?.id;
    if (chainId !== 4217 && chainId !== 42431) continue;

    const rewards = (chain as { rewards?: unknown[] })?.rewards;
    if (!Array.isArray(rewards)) continue;

    for (const reward of rewards) {
      const token = (reward as { token?: { address?: unknown } })?.token?.address;
      if (typeof token !== 'string' || token.toLowerCase() !== MERKL_WRAPPER.toLowerCase()) continue;

      const amount = asBigInt((reward as { amount?: unknown; accumulatedAmount?: unknown }).amount) ??
        asBigInt((reward as { accumulatedAmount?: unknown }).accumulatedAmount) ??
        BigInt(0);
      const claimed = asBigInt((reward as { claimed?: unknown }).claimed) ?? BigInt(0);
      const proofs = Array.isArray((reward as { proofs?: unknown }).proofs)
        ? ((reward as { proofs: unknown[] }).proofs.filter((p) => typeof p === 'string') as string[])
        : [];

      const claimable = amount > claimed ? amount - claimed : BigInt(0);
      if (claimable === BigInt(0) || proofs.length === 0) {
        return { ...NOTHING, distributor, amount: amount.toString(), claimed: claimed.toString() };
      }

      return {
        claimable: true,
        wrapper: MERKL_WRAPPER,
        distributor,
        amount: amount.toString(),
        claimed: claimed.toString(),
        claimableAmount: claimable.toString(),
        proofs,
        campaignEnds: MERKL_CAMPAIGN_END,
        reason: null,
      };
    }
  }

  return { ...NOTHING, distributor };
}

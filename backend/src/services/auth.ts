import { PrivyClient } from '@privy-io/server-auth';
import { env } from '../config/env.js';

if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
  // In development we allow the auth service to be missing so the scaffold
  // can run without real Privy credentials. All verify calls will throw.
  console.warn(
    '[auth] PRIVY_APP_ID or PRIVY_APP_SECRET is not set. Privy token verification is disabled.'
  );
}

export const privy =
  env.PRIVY_APP_ID && env.PRIVY_APP_SECRET
    ? new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET)
    : null;

export interface VerifiedUser {
  privyDid: string;
  email?: string;
  phone?: string;
  walletAddress?: string;
  /**
   * Every embedded wallet Privy holds for this user, in Privy's order.
   *
   * A user can have MORE THAN ONE embedded wallet — `createOnLogin` makes one in
   * the browser, and the login route used to mint another server-side when
   * Privy's server view had none to report. The browser then signs with whichever
   * one `useWallets()` lists first, which is not necessarily `wallet`, so login
   * needs the whole set to check a client-declared address against.
   */
  embeddedWalletAddresses: string[];
}

export async function verifyPrivyToken(token: string): Promise<VerifiedUser> {
  if (!privy) {
    throw new Error('Privy is not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET.');
  }

  let claims;
  try {
    claims = await privy.verifyAuthToken(token);
  } catch (cause) {
    // Do not collapse every cause into "Invalid or expired auth token". A network
    // fault while fetching the app's verification key, or a token minted for a
    // different app, arrive here too — and under the flat message they were
    // indistinguishable from a genuinely bad token, which sent a debugging
    // session after the wrong thing. Log the full cause (including undici's
    // hidden `.cause`); report only the SDK's own message to the caller.
    const e = cause as Error & { cause?: { message?: string; code?: string } };
    const inner = e.cause?.message ?? e.cause?.code ?? '';

    // `console.error`, matching this file's existing console.warn for the
    // missing-credentials case: this function has no request/logger in scope, and
    // the cause (undici hides the real network reason in `.cause`) matters more
    // than the channel.
    console.error(
      '[auth] Privy token verification failed:',
      e.message,
      inner ? `| cause: ${inner}` : ''
    );

    throw new Error(`Invalid or expired auth token: ${e.message}`, { cause });
  }

  const user = await privy.getUserById(claims.userId);

  const email = user.email?.address;
  const phone = user.phone?.number;
  const walletAddress = user.wallet?.address;

  // Every address-bearing linked account, then the embedded ones specifically:
  // `walletClientType === 'privy'` is what marks a wallet this app created, as
  // opposed to an external one the user connected. Falling back to any linked
  // wallet keeps an app configured without the field working rather than
  // silently reporting zero wallets.
  const linked = (user.linkedAccounts ?? []) as Array<{
    type?: string;
    address?: string;
    walletClientType?: string;
  }>;
  const withAddress = linked.filter((account) => typeof account.address === 'string');
  const embedded = withAddress.filter((account) => account.walletClientType === 'privy');
  const embeddedWalletAddresses = (embedded.length > 0 ? embedded : withAddress)
    .filter((account) => account.type === 'wallet' || embedded.length > 0)
    .map((account) => account.address as string);

  return {
    privyDid: claims.userId,
    email,
    phone,
    walletAddress,
    embeddedWalletAddresses,
  };
}

export function isPrivyConfigured(): boolean {
  return privy !== null;
}

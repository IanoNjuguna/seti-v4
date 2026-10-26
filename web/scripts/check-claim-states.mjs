/**
 * `npm run check:claim-states` — what step three of onboarding says when a claim
 * fails, and whether it is ever offered a claim it cannot sign.
 *
 * The bug this exists for: a new account was told "That name could not be claimed"
 * when the failure was that nothing could sign, and "Nothing was claimed. Try
 * again." for every other pre-server failure. The name was fine. The backend had
 * already called it free. The person retried the same tap three times and the app
 * recorded nothing anywhere.
 *
 * So this renders the REAL component tree, through `OnboardingIntent`, and reads
 * the markup a browser receives. Six things are pinned:
 *
 *  1. **Five failures, five sentences.** A missing wallet, a wallet still loading, a
 *     wallet that would not sign, a taken name and a server refusal each produce
 *     their own body, and no two of them are the same string. One generic line is
 *     the defect.
 *  2. **The heading does not blame the name.** "That name could not be claimed" is
 *     absent from the copy and from the markup, because it is false for four of the
 *     five.
 *  3. **The action matches the fix.** `wallet-missing` renders "Sign in again",
 *     because a retry cannot produce a wallet. Nothing else does.
 *  4. **No signature is asked for when there is nothing to sign with.** With the
 *     wallet missing both options are disabled and the reason is rendered; with it
 *     ready they are not. This is the half that stops the wall, not just explains it.
 *  5. **The signed bytes are unchanged.** The domain, the type name, the field order
 *     and the purpose per kind are asserted against what the backend verifies, and
 *     the claim path is asserted to hold no EIP-1193 request at all.
 *  6. **The form keeps its split.** A name problem still belongs on the field, so the
 *     intent step must not print it as a block message about the claim.
 *  7. **A wallet the browser cannot see is repaired here, not signed out (#226).**
 *     Three states are pinned, because they are the three a person can be in:
 *     signed in with the server holding a wallet the client cannot see (the address
 *     comes from the account), genuinely absent (creation is offered), and creation
 *     that failed (the cause is named and the repair is no longer offered). Signing
 *     out stays reachable in all three, and is never the only control while a
 *     repair is still possible.
 *  8. **Our session alive and Privy's dead is its own state (#241).** The wallet
 *     session expired state gets its own row in the matrix, its own sentence, no
 *     repair control at all, and exactly one way out. `canSign` and `canRepair` are
 *     both asserted to require Privy's own authentication, so dropping that term
 *     fails here rather than in a report from a device.
 *
 * Run from `web/`: npm run check:claim-states (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingIntent } from '../components/onboarding/OnboardingIntent.tsx';
import { intentWalletState } from '../components/onboarding/intent-wallet.ts';
import { claimErrorView } from '../components/merchant/Claim.error.ts';
import { classifyClaimError } from '../lib/claim/classify-claim-error.ts';
import { registeredWalletAddress, resolveEmbeddedWallet } from '../lib/auth/account-wallet.ts';
import { REFUSAL_BY_CODE, REFUSAL_UNKNOWN, refusalMessageFor } from '../lib/api/refusal.constants.ts';

/**
 * The served chain, set BEFORE anything imports the app's chain table.
 *
 * `lib/pay/sign-handle-claim.ts` reads `tempoChain` from `@/lib/chain`, whose module
 * body calls `resolveNetwork()` and throws when `NEXT_PUBLIC_TEMPO_CHAIN_ID` is
 * unset. Next loads `.env.local`; tsx does not, and CI sets no web chain id. Practice,
 * always: this check inspects bytes and never signs, so the chain only decides which
 * id appears in the domain. Skipped when the environment already named one.
 */
process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ??= '42431';

/**
 * Loaded AFTER the line above, which is why these are dynamic: the chain table
 * evaluates the env var at module load, so a static import would hoist past it.
 */
const { buildHandleClaim, buildHandleClaimMessage, HANDLE_CLAIM_DOMAIN_NAME, HANDLE_CLAIM_DOMAIN_VERSION, HANDLE_CLAIM_PRIMARY_TYPE } =
  await import('../lib/pay/sign-handle-claim.ts');
const { tempoChain } = await import('../lib/chain/chain.constants.ts');


let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

/** The name step's own heading, which is the honest one for a failed claim. */
const ERROR_TITLE = 'Name not claimed';

/** The callbacks the step needs; the check is about words and states, not clicks. */
const NOOP = () => {};

/**
 * A wallet nothing has tried to repair yet, which is the state a page opens in.
 *
 * A repair is still on the table, so both controls are offered: `Set up my wallet`
 * first, `Sign in again` beside it.
 */
const REPAIRABLE = { canRepair: true, repairing: false, failureCode: null };

/** The same, after a repair whose create call failed: the repair is spent. */
const REPAIR_FAILED = { canRepair: true, repairing: false, failureCode: 'wallet-create-failed' };

/** A build with no Privy app, where there is nothing to create. */
const NOT_REPAIRABLE = { canRepair: false, repairing: false, failureCode: null };

/**
 * A wallet that can sign, which is what the step opens on in the ordinary case.
 *
 * Every fact is named at every call site rather than defaulted: `status` says an
 * address is known, `canSign` says this device can sign with one, and `privySession`
 * says whether the session behind both is still alive (#241). A default for any of
 * them is how #233 came to be offered a tap that could not finish.
 */
const SIGNING = { status: 'ready', canSign: true, privySession: 'live' };

/** The ordinary device with no wallet: Privy's session is fine, the wallet is not. */
const WALLETLESS = { status: 'missing', canSign: false, privySession: 'live' };

/** A list that has not arrived yet, which is a moment and not a verdict. */
const LOADING = { status: 'loading', canSign: false, privySession: 'live' };

/**
 * The state #241 is about: OUR session signed in, PRIVY's over.
 *
 * `status` stays `ready`, because the account still names an address — which is
 * exactly why `status` alone cannot tell this state from row two of the #233 matrix,
 * and why the third fact exists.
 */
const PRIVY_EXPIRED = { status: 'ready', canSign: false, privySession: 'expired' };

function render(claim, wallet = SIGNING, walletRepair = REPAIRABLE) {
  return renderToStaticMarkup(
    createElement(OnboardingIntent, {
      pending: null,
      busy: false,
      claim,
      walletStatus: wallet.status,
      canSign: wallet.canSign,
      privySession: wallet.privySession,
      walletRepair,
      onChoose: NOOP,
      onRepair: NOOP,
      onSignIn: NOOP,
    })
  );
}

/** A failure the way the app builds one: throw, classify, take the sentence. */
function failureFrom(error) {
  const code = classifyClaimError(error);
  return { error: refusalMessageFor(code), errorCode: code, errorRequestId: null };
}

const NOTHING_FAILED = { error: null, errorCode: null, errorRequestId: null };

// The errors, as they are actually thrown on the way to a claim.
const noWallet = Object.assign(new Error('No embedded wallet is available for this account yet.'), {
  name: 'NoEmbeddedWalletError',
});
const disconnected = Object.assign(new Error('Disconnected'), { code: 4900 });
const cannotConnect = new Error('Unable to connect to wallet');
const rejected = new Error('User rejected the request');
const mystery = new TypeError("Cannot read properties of undefined (reading 'chainId')");

// --- 1. the classification, marker by marker ------------------------------
check('the classifier is the only place a wallet failure is named', (() => {
  const source = readSource('../lib/claim/classify-claim-error.ts');
  return source.includes('MISSING_WALLET_MARKERS') && !source.includes('refusalMessageFor');
})());

check('our own no-wallet error is wallet-missing', classifyClaimError(noWallet) === 'wallet-missing');
check('Privy 4900 Disconnected is wallet-missing', classifyClaimError(disconnected) === 'wallet-missing');
check('"Unable to connect to wallet" is wallet-missing', classifyClaimError(cannotConnect) === 'wallet-missing');
check('a dismissed prompt is wallet-signing-failed', classifyClaimError(rejected) === 'wallet-signing-failed');
check('an unrecognised throw is wallet-signing-failed', classifyClaimError(mystery) === 'wallet-signing-failed');
check(
  'every classified code has a sentence of its own',
  ['wallet-missing', 'wallet-signing-failed', 'wallet-not-ready'].every((code) => {
    const sentence = REFUSAL_BY_CODE[code];
    return typeof sentence === 'string' && sentence.length > 20 && sentence !== REFUSAL_UNKNOWN;
  })
);

// --- 2. five failures, five sentences -------------------------------------
const missing = failureFrom(noWallet);
const refused = failureFrom(rejected);
const taken = { error: refusalMessageFor('handle-taken'), errorCode: 'handle-taken', errorRequestId: 'req_8f2c1a4e' };
const offline = { error: refusalMessageFor(undefined), errorCode: null, errorRequestId: null };

const html = {
  missing: render(missing),
  refused: render(refused),
  taken: render(taken),
  offline: render(offline),
  loading: render(NOTHING_FAILED, LOADING),
  /** The wall itself: a device with no wallet, and no claim attempted yet. */
  walletGone: render(NOTHING_FAILED, WALLETLESS),
  /** A repair was tried and its create call failed: the cause must be on screen. */
  repairFailed: render(NOTHING_FAILED, WALLETLESS, REPAIR_FAILED),
  /** A build with no Privy app: nothing can be created, so only the sign-in is left. */
  noRepair: render(NOTHING_FAILED, WALLETLESS, NOT_REPAIRABLE),
  /** Our session alive, Privy's over (#241): its own sentence, its own single control. */
  privyExpired: render(NOTHING_FAILED, PRIVY_EXPIRED),
  /** The same state after a repair that was refused rather than attempted. */
  privyExpiredRepair: render(NOTHING_FAILED, PRIVY_EXPIRED, REPAIR_FAILED),
};

for (const [name, body] of Object.entries({
  missing: missing.error,
  refused: refused.error,
  taken: taken.error,
  offline: offline.error,
  loading: refusalMessageFor('wallet-not-ready'),
  walletGone: REFUSAL_BY_CODE['wallet-missing'],
})) {
  check(`${name}: the sentence is rendered on the page`, html[name].includes(escapeHtml(body)), body);
}

const bodies = [missing.error, refused.error, taken.error, offline.error, refusalMessageFor('wallet-not-ready')];
check('no two of the five states say the same thing', new Set(bodies).size === 5, `${new Set(bodies).size} distinct`);

// --- 3. the heading and the action ---------------------------------------
check('the heading names the claim, not the name', Object.values(html).every((markup) => markup.includes(ERROR_TITLE)));
check(
  'the old sentence that blamed the name is neither copied nor rendered',
  Object.values(html).every((markup) => !markup.includes('could not be claimed')) &&
    !readSource('../components/onboarding/Onboarding.constants.ts').includes('could not be claimed')
);

check('wallet-missing offers a sign-in', html.missing.includes('Sign in again'));
check('a claim started with no wallet at all offers a sign-in', html.missing.includes('Sign in again'));
check('a refusal the wallet made does NOT offer a sign-in', !html.refused.includes('Sign in again'));
check('a taken name does NOT offer a sign-in', !html.taken.includes('Sign in again'));
check('a wallet still loading does NOT offer a sign-in', !html.loading.includes('Sign in again'));
check('a server refusal prints its reference', html.taken.includes('req_8f2c1a4e'));
check('a pre-server failure prints no reference', !html.missing.includes('Reference'));

// --- 4. an option that cannot complete is not offered --------------------
const readyMarkup = render(NOTHING_FAILED, SIGNING);
check('with a ready wallet and no failure, nothing is refused', !readyMarkup.includes('disabled=""'));
check('with no wallet, both options are disabled', (html.walletGone.match(/disabled=""/g) ?? []).length >= 2);
check('while the wallet loads, both options are disabled', (html.loading.match(/disabled=""/g) ?? []).length >= 2);
check('the wall says why, and offers the sign-in', html.walletGone.includes('Sign in again') && html.walletGone.includes('There is no wallet'));

check(
  'the decision offers nothing while there is no wallet',
  intentWalletState(WALLETLESS, NOTHING_FAILED).canChoose === false
);
check(
  'the decision offers both options once the wallet is ready',
  intentWalletState(SIGNING, NOTHING_FAILED).canChoose === true
);
check(
  'a claim that already failed outranks the wallet state',
  (() => {
    const state = intentWalletState(WALLETLESS, taken);
    return state.failure?.blockError === taken.error && state.failure?.needsSignIn === false;
  })()
);
check(
  'a missing wallet on the claim becomes the sign-in case',
  (() => {
    const state = intentWalletState(SIGNING, failureFrom(noWallet));
    return state.failure?.needsSignIn === true && state.failure?.blockError === REFUSAL_BY_CODE['wallet-missing'];
  })()
);

// --- 5. the signed bytes are unchanged, and no provider is involved ------
const ADDRESS = '0x8fad55b7c481bd76889fbf1eb719789f87db5113';
const personMessage = buildHandleClaimMessage({ kind: 'person', name: 'Java   House ', address: ADDRESS });
const businessMessage = buildHandleClaimMessage({ kind: 'business', name: 'Java House', address: ADDRESS });
const typed = buildHandleClaim(personMessage);

check('the domain is Seti / 1 / this chain', (() => {
  return (
    typed.domain.name === HANDLE_CLAIM_DOMAIN_NAME &&
    typed.domain.name === 'Seti' &&
    typed.domain.version === HANDLE_CLAIM_DOMAIN_VERSION &&
    typed.domain.version === '1' &&
    typed.domain.chainId === tempoChain.id
  );
})());
check('the primary type is HandleClaim', typed.primaryType === HANDLE_CLAIM_PRIMARY_TYPE && typed.primaryType === 'HandleClaim');
check(
  'the fields are the five the backend verifies, in order',
  JSON.stringify(typed.types.HandleClaim) ===
    JSON.stringify([
      { name: 'name', type: 'string' },
      { name: 'address', type: 'address' },
      { name: 'purpose', type: 'string' },
      { name: 'issuedAt', type: 'string' },
      { name: 'nonce', type: 'string' },
    ])
);
check('the name is normalised before it is signed', personMessage.name === 'Java House');
check('a person signs the username purpose', personMessage.purpose === 'username');
check('a business signs the merchant-name purpose', businessMessage.purpose === 'merchant-name');
check('the address signed for is the address in the message', typed.message.address === ADDRESS && typed.message === personMessage);
check('the timestamp is the moment of signing', !Number.isNaN(Date.parse(personMessage.issuedAt)));
check('two claims never share a nonce', personMessage.nonce !== businessMessage.nonce);

check(
  'the claim path holds no EIP-1193 request',
  ['../hooks/useMerchantClaim.ts', '../hooks/useSignHandleClaim.ts', '../lib/pay/sign-handle-claim.ts'].every(
    (file) => {
      // Comments are stripped first: these files EXPLAIN the provider path they left
      // behind, and the explanation is not a call site.
      const source = stripComments(readSource(file));
      return !source.includes('eth_signTypedData_v4') && !source.includes('getEthereumProvider');
    }
  )
);
check(
  'the signature comes from Privy own typed-data hook',
  readSource('../hooks/useSignHandleClaim.ts').includes('useSignTypedData')
);

// --- 6. a name problem stays on the field --------------------------------
for (const code of ['invalid-handle-name', 'reserved-handle']) {
  const view = claimErrorView({ error: refusalMessageFor(code), errorCode: code, errorRequestId: null });
  check(`${code} is a field problem, not a block refusal`, view.nameProblem === true && view.blockError === null);
}

// --- 7. the voice -------------------------------------------------------
const sentences = [...bodies, ERROR_TITLE, REFUSAL_BY_CODE['wallet-missing'], REFUSAL_BY_CODE['wallet-signing-failed']];
check('no em dash, no exclamation, no question mark', sentences.every((s) => !/[—!?]/.test(s)));
check(
  'every wallet sentence says nothing was claimed',
  ['wallet-missing', 'wallet-signing-failed', 'wallet-not-ready'].every((code) =>
    /nothing was claimed/i.test(REFUSAL_BY_CODE[code])
  )
);

// --- 8. a wallet the browser cannot see, and the repair for it (#226) ----
//
// Three states, because a person can be in any of them and each needs a different
// sentence and a different set of controls. Before #226 all three collapsed into
// one: `useWallets()` was empty, so the app said "sign in again" and ended a
// session it could have repaired.
console.log('\na wallet the browser cannot see is repaired in place, not signed out:');
{
  const reported = '0x5c1F7d3a2E9bB80d6C4aF1e7D2b3A4c5E6f70819';

  // The state the issue is about: signed in, the server records a wallet, the
  // browser's own list is empty. The address is a fact, so it comes from the account.
  const fromAccount = resolveEmbeddedWallet({
    ready: true,
    signedIn: true,
    privyAddress: null,
    accountAddress: ADDRESS,
  });
  check(
    'signed in, the account knows a wallet and the browser does not: the address comes from the account',
    fromAccount.status === 'ready' && fromAccount.address === ADDRESS,
    fromAccount.status
  );
  check(
    'a wallet the browser DOES hold is never overruled by the account read',
    resolveEmbeddedWallet({ ready: true, signedIn: true, privyAddress: reported, accountAddress: ADDRESS })
      .address === reported
  );
  check(
    'no session, no server address: nothing is signed for an account nobody confirmed',
    resolveEmbeddedWallet({ ready: true, signedIn: false, privyAddress: null, accountAddress: ADDRESS })
      .status === 'missing'
  );
  check(
    'genuinely absent stays missing, which is the state creation is for',
    resolveEmbeddedWallet({ ready: true, signedIn: true, privyAddress: null, accountAddress: null })
      .status === 'missing'
  );
  check(
    'a list still loading is a moment, not a missing wallet',
    resolveEmbeddedWallet({ ready: false, signedIn: true, privyAddress: null, accountAddress: ADDRESS })
      .status === 'loading'
  );
  check(
    'the account read prefers the active row',
    registeredWalletAddress([
      { status: 'deprecated', address: reported },
      { status: 'active', address: ADDRESS },
    ]) === ADDRESS
  );
  check(
    'a deprecated row still names an address the account holds, so it is used rather than ignored',
    registeredWalletAddress([{ status: 'deprecated', address: reported }]) === reported
  );

  // The surface: the repair is the first offer, and the sign-in is never taken away.
  check('a device with no wallet offers to set one up', html.walletGone.includes('Set up my wallet'));
  check('and keeps the sign-in reachable beside it', html.walletGone.includes('Sign in again'));
  check(
    'the repair is offered BEFORE the sign-in, which is the fallback',
    html.walletGone.indexOf('>Set up my wallet<') !== -1 &&
      html.walletGone.indexOf('>Set up my wallet<') < html.walletGone.indexOf('>Sign in again<')
  );
  check(
    'a claim refused for a missing wallet offers the repair too, not only a sign-out',
    (() => {
      const state = intentWalletState(SIGNING, failureFrom(noWallet), REPAIRABLE);
      return state.failure?.canRepair === true && state.failure?.needsSignIn === true;
    })()
  );

  // Creation failed: the cause is on the page, and the same tap is not offered again.
  check(
    'a failed create names what happened rather than repeating the missing-wallet line',
    html.repairFailed.includes(escapeHtml(REFUSAL_BY_CODE['wallet-create-failed'])) &&
      !html.repairFailed.includes(escapeHtml(REFUSAL_BY_CODE['wallet-missing']))
  );
  check(
    'a failed create does not offer the repair again',
    !html.repairFailed.includes('Set up my wallet')
  );
  check('a failed create leaves the sign-in, which is the remaining way out', html.repairFailed.includes('Sign in again'));
  const createSentence = REFUSAL_BY_CODE['wallet-create-failed'];
  check(
    'the create failure has a sentence of its own, in the voice the wallet states use',
    typeof createSentence === 'string' &&
      createSentence !== REFUSAL_UNKNOWN &&
      !/[—!?]/.test(createSentence) &&
      /nothing was claimed/i.test(createSentence) &&
      /\bseti\b/i.test(createSentence),
    String(createSentence)
  );

  // A build with no Privy app cannot create anything, so it must not offer to.
  check(
    'with no wallet to create, only the sign-in is offered',
    !html.noRepair.includes('Set up my wallet') && html.noRepair.includes('Sign in again')
  );

  // And the code behind the controls: where the address comes from, and the order
  // the repair runs in. Markup cannot show either.
  const walletSource = stripComments(readSource('../hooks/useEmbeddedWallet.ts'));
  /** The repair's own read, and the only line in the hook shaped like it. */
  const accountRead = 'const accountWallet = registeredWalletAddress(rows);';
  check(
    'the signing address is not taken from the wallet list alone',
    walletSource.includes('fetchAccountWallets') && walletSource.includes('resolveEmbeddedWallet')
  );
  check(
    'a wallet is created only after the account itself was read',
    walletSource.includes(accountRead) &&
      walletSource.indexOf(accountRead) < walletSource.indexOf('createWallet()')
  );
  check(
    'a failed create is logged with its cause, not swallowed',
    walletSource.includes('could not set up a wallet') && /catch \(error\)/.test(walletSource)
  );
  check(
    'sign-in no longer swallows a failed createWallet either',
    readSource('../lib/auth/privy-email-sign-in.ts').includes(
      'could not create an embedded wallet during sign-in'
    )
  );
}

// --- 9. the matrix: an option is offered only when this device can sign (#233)
//
// The table the issue writes out, each row a fact about the browser rather than a
// preference, plus the fifth row #241 adds:
//
//   privy  account  created  session  status   canSign  canChoose  what happens
//   yes    yes      -        live     ready    true     true       signs
//   no     yes      -        live     ready    false    false      repair offered on arrival
//   no     no       -        live     missing  false    false      repair offered on arrival
//   no     yes      yes      live     ready    true     true       repaired here, offered again
//   no     yes      -        expired  ready    false    false      sign in again, and no repair
//
// Column one and two are what `useWallets()` and `GET /users/:id/wallets` answer,
// `created` is a wallet `repair` made in THIS browser, `session` is what
// `usePrivy().authenticated` says about Privy's own session, `status` is what
// `resolveEmbeddedWallet` makes of the first two, and `canSign` is the hook's rule —
// a live Privy session AND (`privyAddress !== null || createdAddress !== null`) —
// which is asserted against the hook's own source at the end of this block so the
// column cannot drift into being this check's private opinion.
//
// Row two is the #233 bug. It was `canChoose: true`, and the tap it offered ended in a
// Privy throw classified `wallet-missing`: the sentence the step could have printed
// BEFORE the tap, printed after it instead, with the repair only then appearing.
//
// Row five is the #241 bug, on the owner's own device: `status` is `ready` because the
// account still names a wallet, so three columns agree with row two and only the
// session column tells them apart — which is why both the sentence and the absence of
// a repair hang on it.
console.log('\n an option is offered only when this device can sign (#233, #241):');
{
  const PRIVY_WALLET = '0x5c1F7d3a2E9bB80d6C4aF1e7D2b3A4c5E6f70819';
  const ACCOUNT_WALLET = ADDRESS;

  const MATRIX = [
    {
      label: 'a wallet Privy lists and one the account holds',
      privy: PRIVY_WALLET,
      account: ACCOUNT_WALLET,
      created: null,
      session: 'live',
      status: 'ready',
      canSign: true,
      canChoose: true,
      sentence: null,
      repair: false,
    },
    {
      label: 'an account wallet and no Privy wallet: row two, the bug',
      privy: null,
      account: ACCOUNT_WALLET,
      created: null,
      session: 'live',
      status: 'ready',
      canSign: false,
      canChoose: false,
      // The word for "nothing here can sign", which is true of a known address
      // whose key is on another device.
      sentence: 'wallet-missing',
      repair: true,
    },
    {
      label: 'neither an account wallet nor a Privy one',
      privy: null,
      account: null,
      created: null,
      session: 'live',
      status: 'missing',
      canSign: false,
      canChoose: false,
      sentence: 'wallet-missing',
      repair: true,
    },
    {
      label: 'a wallet the repair created here, before the list catches up',
      privy: null,
      account: ACCOUNT_WALLET,
      created: ACCOUNT_WALLET,
      session: 'live',
      status: 'ready',
      canSign: true,
      canChoose: true,
      sentence: null,
      repair: false,
    },
    {
      label: 'our session signed in and Privy unauthenticated: the wallet session expired',
      privy: null,
      account: ACCOUNT_WALLET,
      created: null,
      // The 401 state. Nothing about the browser differs from row two except this:
      // Privy cannot load a user, so neither half of the repair can run.
      session: 'expired',
      status: 'ready',
      canSign: false,
      canChoose: false,
      sentence: 'wallet-session-expired',
      repair: false,
    },
  ];

  for (const row of MATRIX) {
    const { status } = resolveEmbeddedWallet({
      ready: true,
      signedIn: true,
      privyAddress: row.privy,
      accountAddress: row.account,
    });
    // The hook's rule, term by term: a live Privy session first, then a wallet Privy
    // lists or one a repair created in this browser. Never the account's address on
    // its own, and never a wallet whose session cannot use it.
    const canSign = row.session === 'live' && (row.privy !== null || row.created !== null);
    const state = intentWalletState(
      { status, canSign, privySession: row.session },
      NOTHING_FAILED,
      REPAIRABLE
    );
    const markup = render(NOTHING_FAILED, { status, canSign, privySession: row.session });

    check(`${row.label}: status is ${row.status}, which is about knowledge`, status === row.status, status);
    check(
      `${row.label}: this device ${row.canSign ? 'can' : 'cannot'} sign, so the options are ${row.canChoose ? 'offered' : 'refused'}`,
      canSign === row.canSign && state.canChoose === row.canChoose,
      `canSign ${canSign}, canChoose ${state.canChoose}`
    );

    if (row.canChoose) {
      check(`${row.label}: nothing is refused on arrival`, state.failure === null && !markup.includes('disabled=""'));
      continue;
    }

    check(
      `${row.label}: the sentence is ${row.sentence}, and the repair is offered ${row.repair ? 'on arrival' : 'not at all'}`,
      state.failure?.blockError === REFUSAL_BY_CODE[row.sentence] &&
        state.failure?.needsSignIn === true &&
        state.failure?.canRepair === row.repair,
      `blockError ${state.failure?.blockError === REFUSAL_BY_CODE[row.sentence]}, canRepair ${state.failure?.canRepair}`
    );
    check(
      `${row.label}: both options are disabled in the markup, before any tap`,
      (markup.match(/disabled=""/g) ?? []).length >= 2
    );
    check(
      `${row.label}: the repair control is ${row.repair ? 'on' : 'NOT on'} the page`,
      row.repair ? markup.includes('Set up my wallet') : !markup.includes('Set up my wallet')
    );
  }

  /**
   * The post-repair transition, which is the part that is easy to get wrong in the
   * other direction: `createWallet()` puts a key in this browser while Privy's list
   * still reports the old one for a render or two, so a rule keyed on the LIST alone
   * would disable the two options again the instant a successful repair returned —
   * the control going dead under the finger that had just fixed it, and the repair
   * it had spent offered a second time.
   */
  const walletSource = stripComments(readSource('../hooks/useEmbeddedWallet.ts'));
  check(
    'canSign is defined in the hook, from a live Privy session AND a wallet Privy lists or one the repair created HERE',
    walletSource.includes(
      "const canSign = privySession === 'live' && (privyAddress !== null || createdAddress !== null);"
    )
  );
  check(
    'the account address alone is NOT what canSign is made of',
    !/const canSign = [^;]*accountAddress/.test(walletSource),
    'canSign must not be derived from the account read'
  );
  check(
    'the expiry term is Privy own authentication, read from the SDK and not inferred from an empty list',
    walletSource.includes('usePrivy()') &&
      walletSource.includes('authenticated: privyAuthenticated') &&
      /privySession: PrivySessionState =\s*privyReady && !privyAuthenticated && signedIn/.test(walletSource),
    'privySession must be derived from usePrivy().ready and .authenticated, and only while OUR session is signed in'
  );
  check(
    'a created wallet is recorded after creation, which is what carries canSign through the catch-up window',
    walletSource.indexOf('setCreatedAddress(newAddress)') !== -1 &&
      walletSource.indexOf('await createWallet()') < walletSource.indexOf('setCreatedAddress(newAddress)')
  );
  check(
    'repair no longer hands the created address to the account state alone',
    walletSource.includes('setAccountAddress(newAddress)')
  );
  // And the two consumers of the claim, by name: the guard and the decision.
  const claimSource = stripComments(readSource('../hooks/useMerchantClaim.ts'));
  check(
    'the claim refuses on canSign, not on status',
    claimSource.includes('if (!walletCanSign)') && !claimSource.includes("if (walletStatus !== 'ready')")
  );
  const decisionSource = stripComments(readSource('../components/onboarding/intent-wallet.ts'));
  check(
    'the step decides canChoose on canSign, not on status',
    decisionSource.includes('canChoose: wallet.canSign') && decisionSource.includes('if (!wallet.canSign)')
  );
}

// --- 10. our session alive, Privy's dead (#241) --------------------------
//
// The state the whole wallet saga was actually in, and the app mislabelled it. Two
// sessions exist; only one was being checked. The evidence was on the owner's own
// device: the page on onboarding step three, so `session.status` signed-in, while
// `GET https://auth.privy.io/api/v1/users/me` answered 401 — twice. `useWallets()` was
// empty because Privy could not load a USER, not because a list lagged.
//
// So both repairs #229/#233 added are impossible there: `refreshUser()` re-reads a
// user that is not there, and `createWallet()` needs a session to create into. The
// surface offered exactly that repair beside a sentence about a missing wallet, which
// is a button that cannot work — the class of bug this stack keeps removing.
console.log("\n our session alive and Privy's dead is its own state (#241):");
{
  const sentence = REFUSAL_BY_CODE['wallet-session-expired'];

  // The sentence: its own, and in the voice every failure sentence is held to.
  check(
    'the expiry has a sentence of its own, not the generic fallback and not the missing-wallet one',
    typeof sentence === 'string' && sentence !== REFUSAL_UNKNOWN && sentence !== REFUSAL_BY_CODE['wallet-missing'],
    String(sentence)
  );
  check('it says what happened, which is the session expiring', /session expired/i.test(sentence), sentence);
  check('it says what to do next, which is signing in again', /sign in again/i.test(sentence), sentence);
  check('it says nothing was claimed, like every other wallet sentence', /nothing was claimed/i.test(sentence));
  check('no em dash, no exclamation, no question mark', !/[—!?]/.test(sentence), sentence);
  check(
    'no token name where a customer is looking',
    !/\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/i.test(sentence),
    sentence
  );
  check('it speaks to the reader, second person', /\byou\b|\byour\b/i.test(sentence), sentence);
  check('it is a finished sentence', /\.$/.test(sentence.trim()), sentence);

  // The decision: no repair, one control, and the sentence above it.
  const state = intentWalletState(PRIVY_EXPIRED, NOTHING_FAILED, REPAIRABLE);
  check('the options are refused on arrival', state.canChoose === false);
  check('the sentence is the expiry, not the missing wallet', state.failure?.blockError === sentence);
  check('signing in again is offered, because it is the only thing that works', state.failure?.needsSignIn === true);
  check(
    'the repair is NOT offered, even to a caller that says it is available',
    state.failure?.canRepair === false
  );

  // The markup: one control, and the word for the state.
  check('the expiry sentence is on the page', html.privyExpired.includes(escapeHtml(sentence)));
  check(
    "the missing-wallet sentence is NOT: this is not a missing wallet",
    !html.privyExpired.includes(escapeHtml(REFUSAL_BY_CODE['wallet-missing']))
  );
  check('there is no repair control to press', !html.privyExpired.includes('Set up my wallet'));
  check('there IS a sign-in control, which is the whole answer here', html.privyExpired.includes('Sign in again'));
  check(
    'both intents are disabled, so no signature is asked for in a session that cannot give one',
    (html.privyExpired.match(/disabled=""/g) ?? []).length >= 2
  );
  check(
    'one control and no other: no repair offered in either variant of the state, and no retry',
    // The sentence itself says "Sign in again", so the control is counted by the
    // repair that is absent rather than by the sign-in that is present twice.
    !html.privyExpired.includes('Set up my wallet') &&
      !html.privyExpiredRepair.includes('Set up my wallet') &&
      !/Try again/i.test(html.privyExpired)
  );
  check(
    'the state a repair refused looks the same, since the repair was never attempted',
    html.privyExpiredRepair.includes('Sign in again') &&
      !html.privyExpiredRepair.includes('Set up my wallet') &&
      html.privyExpiredRepair.includes(escapeHtml(sentence))
  );
  check(
    'a claim refused for an expired session keeps its own reason, and still offers no repair',
    (() => {
      const failed = intentWalletState(
        PRIVY_EXPIRED,
        { error: refusalMessageFor('wallet-missing'), errorCode: 'wallet-missing', errorRequestId: null },
        REPAIRABLE
      );
      return failed.failure?.canRepair === false && failed.failure?.needsSignIn === true;
    })()
  );
  // And the state that must NOT change: a wallet-less device in a live session.
  check(
    'a live session with no wallet still offers the repair, which is #233 unchanged',
    (() => {
      const live = intentWalletState(WALLETLESS, NOTHING_FAILED, REPAIRABLE);
      return live.failure?.canRepair === true && live.failure?.blockError === REFUSAL_BY_CODE['wallet-missing'];
    })()
  );

  // The code behind it, which markup cannot show. The terms are asserted against the
  // hook's own source so the two cannot drift: a `canRepair` that stops requiring a
  // live Privy session re-offers the button this issue removes, and that is the one
  // thing this block exists to catch.
  const hookSource = stripComments(readSource('../hooks/useEmbeddedWallet.ts'));
  const decisionSource = stripComments(readSource('../components/onboarding/intent-wallet.ts'));
  check(
    'canRepair requires a live Privy session, so a dead one does not offer the repair',
    hookSource.includes("canRepair: privySession === 'live'")
  );
  check(
    'a repair called anyway refuses instead of trying: no createWallet in a session that cannot create',
    (() => {
      const guard = hookSource.indexOf("if (privySession !== 'live') {");
      return (
        guard !== -1 &&
        guard < hookSource.indexOf('await createWallet()') &&
        /setRepairFailure\('wallet-session-expired'\)/.test(hookSource)
      );
    })()
  );
  check(
    'the automatic refresh does not run in a dead session, where it could only fail',
    (() => {
      const refresh = hookSource.indexOf('void refreshUser().catch(reportPrivyRefusal)');
      const skip = hookSource.lastIndexOf("if (privySession !== 'live') return;", refresh);
      return refresh !== -1 && skip !== -1 && refresh - skip < 200;
    })()
  );
  check(
    'the 401 is written down ONCE with its cause, instead of being swallowed',
    // The reporter is ref-guarded (once), it is threaded into both catches that used
    // to be empty, and the state itself is reported on arrival.
    hookSource.includes('const refusalReported = useRef(false)') &&
      hookSource.includes('if (refusalReported.current) return;') &&
      hookSource.includes('reportPrivyRefusal(error)') &&
      hookSource.indexOf('reportPrivyRefusal(error)') > hookSource.indexOf('await refreshUser()') - 400 &&
      /reportPrivyRefusal\(\s*'Privy reports no authenticated user/.test(hookSource)
  );
  check(
    'the decision hard-codes no repair in the expiry branch, so a caller cannot re-open it',
    (() => {
      const branch = decisionSource.indexOf("if (wallet.privySession === 'expired')");
      const end = decisionSource.indexOf("if (wallet.status === 'loading')");
      return branch !== -1 && end > branch && /canRepair: false/.test(decisionSource.slice(branch, end));
    })()
  );
  check(
    'the step is TOLD about the session, rather than deriving it from a status that stays ready',
    stripComments(readSource('../components/onboarding/OnboardingIntent.tsx')).includes(
      '{ status: walletStatus, canSign, privySession }'
    )
  );
  check(
    "the claim's guard names the expiry rather than blaming a wallet that is there",
    (() => {
      const claim = stripComments(readSource('../hooks/useMerchantClaim.ts'));
      return (
        claim.includes("walletPrivySession === 'expired'") &&
        claim.includes("? 'wallet-session-expired'")
      );
    })()
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readSource(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

/** Source with comments removed, for assertions that are about CALL SITES only. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

# Fee routing: getting the 2% to Seti's treasury

**Status:** Option A is implemented behind a server-side flag, default OFF.
The refusal guards are proven against a live chain; the success path is not.

- `FEE_ROUTING_MODE=inside-transfer` (default) — one transfer of the gross to
  the merchant. Fee recorded, **not collected**. This is the historical
  behaviour.
- `FEE_ROUTING_MODE=batch` — the customer signs an atomic batch of two
  transfers: principal to the merchant, fee to `SETI_TREASURY_ADDRESS`
  (`0x48cb25f9d82aF721e71437feAfb295da627BA475`). `recordPayment` then requires
  BOTH `Transfer` logs in the single receipt and fails closed if either is
  absent.

The mode is decided by the server and returned in the preview as
`feeRoutingMode`, so a modified client cannot request the laxer path — it simply
fails reconciliation. The batch leg amount travels as `feeInAsset` (0 in
inside-transfer mode, because no second transfer exists there).

**What is proven:** `npm run check:fee-batch` (run with `FEE_ROUTING_MODE=batch`)
anchors on a real OUSD transfer (on whichever chain the configured env selects —
currently Moderato), points a merchant at that transfer's
genuine recipient so the principal leg genuinely resolves, and confirms the
payment is then refused *specifically* for the missing treasury leg. It also
asserts the treasury is a well-formed, non-zero address distinct from the
merchant's.

**What is NOT proven:** no batched transaction has ever been signed on Tempo. The
success path — both legs landing in one real receipt — is uncovered, and EIP-7702
support on Tempo mainnet is inferred from TIP-1047 rather than confirmed. Prove
it on Moderato before flipping the flag.

Every claim about SDK behaviour was verified against the `tempoxyz/accounts`
source and examples at v0.19.1, plus Privy's live docs; nothing has been executed
against a live chain.

## The problem

v1 settles non-custodially: the customer's stablecoins go straight to the
merchant's wallet. In `inside-transfer` mode `usePayMerchant.ts` signs exactly one
transfer:

```ts
transfer(merchant.payoutAddress, grossAmount)
```

One call, one recipient. The 2% is included in that amount, so the merchant
receives `principal + fee` and **Seti retains nothing**. The fee is computed,
persisted (`feeAmount`, `merchantNetAmount`), audited — and uncollected. That
remains the default, which is why the batch path below exists and why
`FEE_ROUTING_MODE` defaults to `inside-transfer` rather than `batch`.

`recordPayment` already reconciles against the chain, so the arithmetic is sound.
What was missing was a second transfer to `SETI_TREASURY_ADDRESS`
(`0x48cb25f9d82aF721e71437feAfb295da627BA475`) — now implemented behind the
flag, with both legs required on-chain.

## Option A — Batch (two transfers, one signature)

The customer signs two transfers in a single user operation:

```
transfer(merchant.payoutAddress, principal)
transfer(treasuryAddress,         fee)
```

### Why this is the recommendation

It is the only option that keeps the existing architecture intact. The
principal still goes customer → merchant with no intermediary, so
`recordPayment`'s reconciliation barely changes: it verifies the merchant leg
instead of the gross. Seti never custodies the principal. No contract to
deploy, audit, or pay gas for.

### Privy can batch without a wallet-type migration — CORRECTED

I originally wrote that batching requires migrating embedded wallets to Privy
**smart wallets**, and that EOAs therefore cannot batch atomically. Both claims
were wrong. From the Privy batch-transactions recipe:

> "On EVM chains, Privy uses the `wallet_sendCalls` RPC method to send multiple
> calls in a single atomic batch. Under the hood, Privy leverages **EIP-7702** to
> upgrade your user's wallet to a Kernel smart contract, which enables batched
> execution."
>
> "In both cases, batch calls are **atomic** — either all calls succeed, or the
> entire batch reverts."

There are two Privy mechanisms, and they are different things:

| | ERC-4337 smart wallet | EIP-7702 `wallet_sendCalls` |
| --- | --- | --- |
| Account type | Separate `smart_wallet` linked account | Existing embedded EOA, upgraded in place |
| Address | New | **Unchanged** |
| Dashboard config | Required per network | Not described as required |
| Bundler | Required | Only if sponsored |
| Atomic | Yes | Yes |

EIP-7702 delegates an *existing* EOA to Kernel code without changing its
address. That is exactly our case: keep Privy embedded wallets, keep the same
addresses, add batching.

Consequences for Option A:

- **No wallet-type migration.** Existing wallets and addresses keep working.
- **No `Wallet.walletType` column** needed (though recording the upgrade would
  be useful for support).
- Sponsorship (`sponsor: true`) is optional; without it the wallet executes
  `self.execute` and pays its own gas.
- Tempo appears to support EIP-7702: protocol TIP-1047 explicitly governs
  "contract creation and EIP-7702 delegations", which only makes sense on a
  chain that implements it.

This removes the main objection to Option A. The remaining work is enabling the
batch in the payment hook and reconciling it in `recordPayment`.

### Correctness problem: non-atomicity — RESOLVED for the batch, not for the interim

With EIP-7702 the two calls are atomic, so a partial payment is impossible. The
merchant is paid and the fee is collected, or neither happens.

That risk applies only to the **interim two-sequential-transaction** approach
below, which deliberately skips batching. If Option A is implemented, there is no
revenue leak to reconcile — though you would still want to observe batch
failures rather than assume they cannot happen.

## Option B — Tempo `feePayer` / MPP

**I checked this carefully and it does not solve our problem.**

The MPP pattern is: your server issues an HTTP 402 challenge, the client
auto-pays it, and the server releases the response once payment settles. From
`examples/mpp/README.md` and `examples/mpp/src/App.tsx`:

> "The SDK signs and broadcasts a pathUSD transfer; the server only releases
> the response after the transfer settles on-chain."

Money flows **customer → your server**. That is a customer-pays-seti charge, the
reverse of what we need. We need the merchant receiving the principal while
Seti skims the fee.

The `account` in `tempo({ account, feePayer: true })` is a **server-held private
key** for the recipient account, and `feePayer: true` lets the worker co-sign
and broadcast. So MPP would mean Seti holding a key and receiving a per-call
charge — not a merchant-payment fee split.

Adapting it would require inverting its payment direction, which means using
the pieces (`Handler.relay({ feePayer })`, co-signing) for something they were
not designed for. I read the docs and examples; I have not run it. I don't
recommend building on it for this.

## Option C — Settlement contract

Customer → contract, contract splits and forwards to merchant and treasury.

Non-custodial in that nobody holds keys, but a contract sits in the path of
every payment, plus deployment, gas, and an audit. Heavy for v1, and it
contradicts the "direct to merchant's wallet" story on your site.

## Privy vs Tempo Accounts for fee routing

The SDK comparison, since it's the actual decision.

| | **Privy** | **Tempo Accounts** |
| --- | --- | --- |
| Fee routing mechanism | `wallet_sendCalls` (EIP-7702) | None found **in the SDK** — see the correction below |
| Atomic merchant + fee legs | **Yes** | n/a |
| Requires new account type | No (EIP-7702 upgrades in place) | n/a |
| Changes wallet address | No | n/a |
| Already integrated | **Yes** — `@privy-io/expo`, wallets in use | Installed, unused |
| Status of this path | Documented, not yet executed | Read docs only |

**Verdict: Privy, for this problem.** It has a documented atomic batch over
existing embedded wallets, it is already integrated, and the fee leg needs no
new infrastructure. Tempo Accounts has no batching in the SDK — grepping the
source for `sendCalls`, `4337`, `userOperation`, and `batch` across `src/` turns
up nothing on the client side.

### CORRECTION (2026-10-09): batching is protocol-native; the table above measured the wrong artifact

The "None found" row and the paragraph above are scoped to the **`tempoxyz/accounts`
npm package** — that is what "the source" and "`src/`" refer to, as stated at the
top of this document. That is not the same claim as "Tempo has no batching
primitive", and this document made the latter. Batching is a property of Tempo's
**transaction type**, not of that package:

- Tempo Transactions are a native EIP-2718 type, serialized as `0x76`, carrying
  `calls: Call[]` in one envelope alongside `feeToken`, `feePayer`, `nonceKey`,
  `validAfter` / `validBefore`.
- The primitive is already in this repo's installed viem (**2.57.2**):
  `node_modules/viem/_types/tempo/Transaction.d.ts` declares `calls` on both
  `TransactionTempo` and `TransactionSerializableTempo`, and viem's `Transaction`
  type is `OneOf<viem_Transaction | TransactionTempo>`.
- viem's own docs present it as exactly this: `client.sendTransactionSync({ calls:
  [...] })` is documented as atomic batching, and `writeContract` plus the Tempo
  Actions accept the same `calls` / `feeToken` properties.

**What this changes:** Option A has a second implementation that needs no
EIP-7702, no Kernel delegation and no Privy smart-wallet upgrade — a single Tempo
transaction carrying the merchant leg and the fee leg. `nonceKey` is also the
"parallel transactions" lead that `HANDOVER.md` told the next session to check
and this document never resolved.

**What it does not change:** the signer. The app signs through Privy's
embedded-wallet provider, and whether that provider will author or forward a
`0x76` transaction with `calls` is **untested** — the same unknown this document
already records for `wallet_sendCalls` on the Expo SDK. Both routes hinge on that
one question, so the sequencing below still holds: nothing is settled until an
atomic two-leg transfer actually lands on Moderato.

Tempo Accounts earns its place elsewhere, if at all: its server-side
`Handler.relay({ feePayer })` is for **sponsoring gas**, and MPP is for charging
customers per API call — a different shape of problem from skimming a fee off a
merchant payment.

### What installing `accounts` bought

All ten of its peers are now satisfied (`@privy-io/react-auth` 3.47.0,
`wagmi` 3.7.7, `@wagmi/core` 3.6.5, `react-native-mmkv` 4.3.2,
`react-native-nitro-modules` 0.35.10,
`@react-native-async-storage/async-storage` 3.1.1). But **nothing imports it**,
and on this evidence I'd treat it as unproven for v1: 641 packages changed, 52
vulnerabilities, two new native modules requiring a rebuild — for a capability
that doesn't appear to exist in the SDK.

My recommendation: keep it installed but unwired until there's a specific
requirement for it. Revisit if gas sponsorship becomes important, since
`feePayer` is genuinely good at that.

## Comparison of fee-routing options

| | Atomic | Non-custodial | New infra | Effort | Risk |
|---|---|---|---|---|---|
| **A. Batch** — Privy `wallet_sendCalls` | Yes (EIP-7702, no migration) | Yes | None — existing Privy EOAs | Medium | Requires EIP-7702 support on Tempo, and that the Expo provider forwards the method |
| **A2. Batch** — native Tempo `calls` | Yes — one `0x76` tx | Yes | None — protocol primitive, viem already ships it | Medium | Requires the Privy provider to sign a `0x76` tx (untested) |
| **B. feePayer/MPP** | Yes | No (server key) | Hono worker + key custody | High | Wrong payment direction |
| **C. Contract** | Yes | Contract in path | Own contract | High | Audit, gas, deployment |
| **D. No fee in v1** | n/a | Yes | None | None | Seti earns 0 |

## Gas: solved — customer sponsors, paid in stablecoins

Tempo gas is paid in stablecoins, and **users sponsor their own gas**. That closes
the last open question and simplifies the plan considerably:

- No bundler. No paymaster. No `sponsor: true`.
- No Privy default-bundler rate-limit problem (Privy warns their default is
  "not suitable for production usage" — irrelevant now).
- No Seti operating cost per transaction.

The consequence for the UX: a customer paying a small amount must hold enough of
a Tempo fee token alongside their payment balance. That is a real precondition,
and it belongs in the payment flow — surface "insufficient gas balance"
distinctly from "insufficient payment balance" rather than letting a failed
transaction look like a bug.

It also means the batch is genuinely self-funded by the user, so the atomic
merchant + fee legs cost them one transaction's worth of gas rather than two.

## Recommendation

**Privy `wallet_sendCalls` (EIP-7702), on Moderato first.** Tempo Accounts is not
competitive for this problem.

1. **Moderato first.** Get a batched merchant leg + fee leg landing in a test
   treasury on testnet. Nothing on mainnet until that works.
2. **Update `recordPayment`.** Reconciliation currently verifies the gross
   against the chain. With a batch it must verify *both* legs: the merchant
   transfer equals the principal, and the treasury transfer equals the fee.
   Fail closed if either is missing — that is what makes atomicity useful rather
   than merely reassuring.
3. **Then mainnet**, with a small funded wallet and a separate test treasury.

If the batch proves unreliable on Tempo, fall back to the interim two-transaction
approach and accept a measured leak rate. Do **not** reach for `feePayer`/MPP —
the payment direction is wrong and it would put a server key in the path.

## Open questions

1. ~~Who sponsors gas?~~ **Settled:** the customer does, in stablecoins. See the
   gas section above. The residual work is surfacing a distinct
   "insufficient gas balance" state in the payment flow.
2. Does the customer see one confirmation or two? Affects `pay.tsx` copy. With an
   atomic batch it should be one, but that needs confirming on a real
   transaction.
3. Should the fee be quoted as a surcharge or absorbed? Current copy implies the
   latter, but a separate fee leg makes it visible on-chain.
4. Which Tempo fee token do customers hold? Tempo's chain config names `TEMPO` as
   the native currency, but gas is paid in a fee token chosen at send time. This
   needs to be pinned down before the payment flow can check for it.

## What I have not verified

- **No batched transaction has been signed here.** Every Privy claim above comes
  from their documentation, read live via the Privy MCP server, not from
  execution. The client path calls `provider.request({method:
  'wallet_sendCalls'})` on the Expo embedded-wallet provider; `wallet_sendCalls`
  is documented for the server SDKs, the Node SDK and cURL, but the Expo SDK
  (0.75.0) does not reference it in its own source, so whether the embedded
  wallet provider forwards the method is **unconfirmed**.
- Whether EIP-7702 works on Tempo *mainnet* specifically. TIP-1047 references
  7702 delegations, which implies support, but I could not confirm it by RPC —
  `eth_getCode` on the `0x…0100` designator returns empty on every chain
  (including Ethereum mainnet), so that probe is meaningless. A testnet batch is
  the only real proof.
- Whether Tempo Accounts has client-side batching I missed. My grep covered
  `sendCalls`, `4337`, `userOperation`, and `batch` across `src/`.
- `accounts/react/privy` interop with Privy **smart** wallets — now moot under
  the EIP-7702 route, but unresolved if you later go that way.

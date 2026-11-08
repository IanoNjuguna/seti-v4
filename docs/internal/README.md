# Internal documents

Engineering documents, outside the developer path. They describe how the system
is built and what is unresolved — not how to integrate with it.

| Document | Read it for |
| --- | --- |
| [Operations](../operations.md) | How Seti is deployed: production boot refusals, managed Postgres and migrations, the indexer cursor as data, the honest state of error tracking, and the CI gate |
| [CI / deploy pipeline](./ci.md) | The secrets and variables an owner must create for `.github/workflows/deploy.yml`, and why the deploy pulls before it removes |
| [The mainnet flip](./mainnet-flip.md) | The owner-run procedure to move to mainnet, in order, gated on a mainnet batch proof before any real money moves |
| [The charge object](./charge-object.md) | The frozen shape a hosted page, a public API and an MCP tool all render: the signed field set and why `scope` is outside it, the status transitions, and the pure classifier behind `check:charge` |
| [Product requirements](./prd.md) | Scope, a per-area implementation status table, non-functional requirements, risks, resolved questions and what is still open |
| [Fee routing](./fee-routing.md) | How the 2% merchant fee is meant to reach Seti's treasury: the options considered, the dead ends, and the current correction that batching is protocol-native |
| [The analytics page's shape](./analytics-page.md) | The analytics tab as three bands: what each holds, the eight equal blocks it replaces, the two populations it used to braid, and what the page refuses |

## The five facts these documents keep coming back to

1. **The 2% fee is attributed to the merchant but funded by the customer.** The
   customer signs principal + fee; the merchant receives the principal
   (`backend/src/services/fees.ts`).
2. **The fee is collected, and the default mode is the one that collects it.**
   `FEE_ROUTING_MODE` defaults to `batch` (`backend/src/config/env.ts:224`): one
   atomic Tempo transaction carries the principal to the recipient and the fee to
   `SETI_TREASURY_ADDRESS`, so "was it collected" is a question a receipt can
   answer (`backend/src/services/fees.ts:36`). `inside-transfer` is the
   NON-default alternative: the fee rides inside the single transfer and is paid
   to the recipient, so Seti collects nothing, which is also why a send to a
   person is refused while the server is in that mode.
3. **Every client-supplied figure is checked against the chain.**
   `recordPayment` (`backend/src/services/transactions.ts:576`) verifies the
   claimed amount against the on-chain receipt, allows 1% for rounding in the
   client's own preview (`:684`), and fails closed on anything wider.
4. **v1 supports four assets, and an address belongs to a chain.** OUSD, pathUSD,
   USDT0 and USDC.e (`backend/src/config/assets.ts:35`), all 6 decimals, with
   addresses read per chain from Tempo's registry
   (`https://tokenlist.tempo.xyz/list/{chainId}`). USDT0 is mainnet-only, so
   practice supports three. EURC.e is excluded on currency grounds rather than
   availability: every figure the product shows is KES, and a EUR balance could
   not be summed into it. `eth_getCode` answers nothing about deployment here, it
   returns `0xef` for every TIP-20 including OUSD, so it is never the test.
5. **Production runs on mainnet; the repository's default is practice.** The
   tree's `.env.example` and the CI gate point at Moderato (`42431`) while the
   deployed service reports `4217` (`https://api.seti.live/health`). Moving a
   deployment between them is `TEMPO_CHAIN_ID` plus `ALLOW_MAINNET`, and the
   mainnet batch proof is a PROCESS gate the operator honours first, because the
   code cannot read that hash and treats any value as proof (`mainnet-flip.md`).

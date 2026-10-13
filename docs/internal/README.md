# Internal documents

Engineering documents, outside the developer path. They describe how the system
is built and what is unresolved — not how to integrate with it.

| Document | Read it for |
| --- | --- |
| [Operations](../operations.md) | How Seti is deployed: production boot refusals, managed Postgres and migrations, the indexer cursor as data, the honest state of error tracking, and the CI gate |
| [The mainnet flip](./mainnet-flip.md) | The owner-run procedure to move to mainnet, in order, gated on a mainnet batch proof before any real money moves |
| [Product requirements](./prd.md) | Scope, a per-area implementation status table, non-functional requirements, risks, resolved questions and what is still open |
| [Fee routing](./fee-routing.md) | How the 2% merchant fee is meant to reach Seti's treasury: the options considered, the dead ends, and the current correction that batching is protocol-native |

## The five facts these documents keep coming back to

1. **The 2% fee is attributed to the merchant but funded by the customer.** The
   customer signs principal + fee; the merchant receives the principal.
2. **In the default mode the fee is not collected at all.**
   `FEE_ROUTING_MODE=inside-transfer` sends the whole gross to the merchant. The
   atomic two-leg alternative is implemented behind the flag and has never run on
   a chain.
3. **Every client-supplied figure is checked against the chain.** `recordPayment`
   verifies the claimed amount against the on-chain receipt and fails closed.
4. **v1 supports two assets only** — pathUSD and OUSD, the only two with deployed
   bytecode on both Tempo chains.
5. **Mainnet is one config edit away.** The tree currently points at Moderato
   (testnet, `42431`); `TEMPO_CHAIN_ID` plus `ALLOW_MAINNET` are the only things
   between the same code and real funds.

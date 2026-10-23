---
sidebar_position: 5
---

# MCP server

Seti ships a [Model Context Protocol](https://modelcontextprotocol.io) server, so
an AI agent can do two things:

1. **Read and build on Tempo with no Seti account** — four tools need no
   credentials at all.
2. **Drive the Seti API** — resolve merchants, preview payments, read balances
   and statuses. These need a Seti account, because the API has no public
   authentication ([Authentication](./authentication.md)) — with one exception:
   asking whether an ADDRESS is a reviewed merchant is a public read, so that
   tool takes no token either.

It **never signs and never holds a key**. `seti_build_payment_transfer` returns
calldata for a wallet you control.

## Install and configure

```bash
cd mcp-server
npm install
npm run build
```

```json
{
  "mcpServers": {
    "seti": {
      "command": "node",
      "args": ["/absolute/path/to/seti-v4/mcp-server/dist/index.js"],
      "env": {
        "SETI_API_BASE_URL": "http://localhost:4000",
        "SETI_API_TOKEN": "<a Privy-issued bearer token>",
        "TEMPO_CHAIN_ID": "42431"
      }
    }
  }
}
```

Environment:

| Variable | Default | Notes |
| --- | --- | --- |
| `SETI_API_BASE_URL` | — | Without it, the Seti API tools refuse with a clear message. |
| `SETI_API_TOKEN` | — | Bearer token. Never logged; scrubbed from error text. `seti_lookup_payee_address` does not need it. |
| `SETI_MCP_ALLOW_WRITES` | off | Only `"true"` registers the one write tool. |
| `TEMPO_CHAIN_ID` | testnet | `4217` selects mainnet as the default network. |
| `TEMPO_MAINNET_RPC_URL` / `TEMPO_TESTNET_RPC_URL` | public Tempo RPCs | Override for a private endpoint. |

Defaults are conservative: **testnet**, and **writes off**. Mainnet is opt-in per
call (`"network": "mainnet"`) or via `TEMPO_CHAIN_ID=4217`.

## Tools

| Tool | Token | What it does |
| --- | --- | --- |
| `tempo_inspect_address` | no | Validate an address and report whether it has code. Distinguishes an EOA from the `0xef` EIP-7702 designator that Tempo's TIP-20 tokens return. |
| `tempo_get_balance` | no | Read a TIP-20 balance, with the token's own `decimals` and `symbol` so the number can be trusted rather than assumed. |
| `tempo_get_dex_quote` | no | Quote an exact-input swap on Tempo's enshrined Stablecoin DEX, including the spread. |
| `seti_build_payment_transfer` | no | Build the ERC-20 `transfer` calldata for a merchant payment. |
| `seti_lookup_payee_address` | no | Who is paid at an address, and what has been checked: the bound handle, plus `name` and `merchantVerifiedAt` only for a merchant a person actually reviewed. |
| `seti_resolve_merchant` | yes | Resolve a Seti QR payload to a merchant record. |
| `seti_preview_payment` | yes | The server-computed fee, FX, gross and balance sufficiency. |
| `seti_get_transaction_status` | yes | Status, tx hash and settlement timestamps. |
| `seti_get_balance` | yes | The balance the API reports for a user. |
| `seti_list_transactions` | yes | Recent transactions, newest first. |
| `seti_record_payment` | yes, **writes** | Record a settled payment. Registered only with `SETI_MCP_ALLOW_WRITES=true`. |

## Examples

Quote the mainnet DEX with no credentials:

```
tempo_get_dex_quote { "tokenIn": "pathUSD", "tokenOut": "OUSD",
                      "amountIn": "1", "network": "mainnet" }
→ { "tokenOut": { "amount": "0.9999", "decimals": 6 },
    "spreadPercent": 0.01, "dex": "0xdec0…0000" }
```

Preview a payment (needs a token):

```
seti_preview_payment { "merchantId": "merchant_java_house", "amountFiat": "250" }
→ { "amount": "1.928398", "fee": "5.00", "total": "1.966966", … }
```

Then build the transfer for your own wallet to sign, and report the hash with
`seti_record_payment` once it is mined.

## Safety properties worth knowing as an integrator

- **No keys, no signing.** The server builds; your wallet signs.
- **Secrets never reach output.** The API token and any credential-shaped query
  parameter are scrubbed from every message — provider libraries embed full URLs,
  and tool output lands in model context and transcripts.
- **stdout is the protocol channel.** Diagnostics go to stderr and `console.log`
  is redirected, so a dependency logging to stdout cannot corrupt the session.
- **Address validation is strict.** A mixed-case address with a bad EIP-55
  checksum is refused *with the corrected form*, rather than signing to a typo.

## Known issue the server surfaces

`prisma/seed.ts` registers `merchant_java_house` with an address that **fails its
EIP-55 checksum** (`0x20c0…8b50`; the correct form is `0x20C000000000000000000000b9537d11c60E8b50`).
The backend's `isValidEvmAddress` is a regex, so the API stores it happily, while
viem — and therefore the mobile signing path — refuses to build a transfer to it.
The MCP server reports this distinctly instead of a bare "invalid address",
because the fix is to correct the checksum, not to find another merchant.

# Seti MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI
agents two things:

1. **Credential-free Tempo tools** — read the chain, quote the DEX, and build
   unsigned payment calldata. No Seti account, no API token.
2. **Seti API tools** — resolve merchants, preview payments, read balances and
   transaction status. These need a Seti API connection (see *Authentication*
   below, which is the honest caveat on this whole package).

It never signs anything and never holds a key. `seti_build_payment_transfer`
returns calldata for a wallet *you* control.

## Run it

```bash
cd mcp-server
npm install
npm run build
npm start            # speaks MCP over stdio
```

A typical host configuration:

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

## Tools

| Tool | Needs a token | What it does |
| --- | --- | --- |
| `tempo_inspect_address` | no | Validate an address and report whether it has code. Catches the EOA/no-code and `0xef` EIP-7702 cases. |
| `tempo_get_balance` | no | Read a TIP-20 balance with the token's own decimals and symbol. |
| `tempo_get_dex_quote` | no | Quote an exact-input swap on Tempo's enshrined Stablecoin DEX. |
| `seti_build_payment_transfer` | no | Build ERC-20 `transfer` calldata for a merchant payment. |
| `seti_resolve_merchant` | yes | Resolve a Seti QR payload to a merchant. |
| `seti_preview_payment` | yes | Server-computed fee, FX, gross and balance sufficiency. |
| `seti_get_transaction_status` | yes | Status, tx hash and settlement timestamps. |
| `seti_get_balance` | yes | The balance the API reports for a user. |
| `seti_list_transactions` | yes | Recent transactions, newest first. |
| `seti_record_payment` | yes, **writes** | Record a settled payment. Registered only when `SETI_MCP_ALLOW_WRITES=true`. |

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `SETI_API_BASE_URL` | — | e.g. `http://localhost:4000`. Without it the Seti API tools refuse. |
| `SETI_API_TOKEN` | — | Bearer token. Never logged; scrubbed from errors. |
| `SETI_MCP_ALLOW_WRITES` | off | Only `"true"` registers `seti_record_payment`. |
| `TEMPO_CHAIN_ID` | testnet | `4217` selects mainnet as the default network. |
| `TEMPO_MAINNET_RPC_URL` / `TEMPO_TESTNET_RPC_URL` | public Tempo RPCs | Point at a private endpoint if you have one. |

**Defaults are conservative on purpose:** the default network is testnet, and
writes are off. Mainnet is opt-in per call (`"network": "mainnet"`) or by setting
`TEMPO_CHAIN_ID=4217`.

## Authentication — read this before planning around it

The Seti API has **no public authentication**. Every route sits behind a
Privy-issued bearer token, so today the Seti API tools require a Seti account.
There are no API keys, no client credentials and no OAuth. The credential-free
Tempo tools exist partly for that reason: they are the part a developer can
actually use right now.

## Safety properties

- **No signing, no keys.** The server builds calldata; your wallet signs it.
- **Secrets never reach output.** `src/errors.ts` scrubs the API token and any
  credential-shaped query parameter from every message, because provider
  libraries embed full URLs (viem puts the RPC URL, key included, in its error
  text) and tool output lands in model context and transcripts.
- **stdout is the protocol channel.** All diagnostics go to stderr, and
  `console.log` is redirected — a dependency logging to stdout would otherwise
  corrupt the session.
- **Address validation is strict.** A mixed-case address with a bad EIP-55
  checksum is refused with the corrected form, rather than silently signing to a
  typo. See the known issue below.

## Known upstream issue this server surfaces

`prisma/seed.ts` registers `merchant_java_house` with
`0x20c000000000000000000000b9537d11c60E8b50`, which **fails its EIP-55
checksum** — the correct form is
`0x20C000000000000000000000b9537d11c60E8b50`. The backend's
`isValidEvmAddress` is a regex (`/^0x[a-fA-F0-9]{40}$/`), so the API accepts and
stores it, while viem — and therefore the mobile signing path — refuses to build
a transfer to it. This server reports that distinctly instead of returning a bare
"invalid address", because the fix is to correct the checksum, not to find
another merchant.

## Verifying a change

```bash
npm run typecheck     # tsc --noEmit
npm run build
npm run smoke         # handshake + tools/list over raw stdio JSON-RPC
```

`npm run smoke` drives the server with newline-delimited JSON-RPC rather than the
SDK's own client, so an SDK change that only satisfies its own client cannot make
it pass. To exercise a tool against the live chain:

```bash
node scripts/smoke.mjs --call tempo_get_dex_quote \
  --args '{"tokenIn":"pathUSD","tokenOut":"OUSD","amountIn":"1","network":"mainnet"}'

# Refusal paths are asserted, not merely observed:
node scripts/smoke.mjs --call seti_resolve_merchant --args '{"qr":"merchant:x"}' --expect-error
```

## Why this is a standalone package

Like `docs-site/`, this is deliberately **not** an npm workspace member: the repo
runs a single root lockfile and `npm run verify` covers only `backend`, `mobile`
and `web`. Keeping its own lockfile means this package's dependencies cannot
destabilise the app's gate.

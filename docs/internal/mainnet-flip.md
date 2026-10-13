# The mainnet flip — an owner-run procedure

This is item **30b**. It is **documentation only**: an agent must not perform it.
It is irreversible, it moves real money, and every step that needs the owner's
keys or a funded address is marked so. Read it top to bottom before starting.

Legend: **🔑 owner's key** (secret the operator holds, never the agent) ·
**💰 funded address** (an address holding real mainnet stablecoins) ·
**🗄️ database** (a production DB operation).

The one rule that overrides everything below:

> **A mainnet batch proof must land before any real money moves.**

That proof is the transaction in step 8. Until its receipt exists, the batch fee
path is designed but never executed against the chain that holds the funds.

---

## Preconditions

- [ ] **30a is done and proven.** A production process refuses to boot with
      `DEV_BYPASS_AUTH=true`, without `QUOTE_SIGNING_SECRET` (or under 16 chars),
      or with the `JWT_SECRET` placeholder — pinned by `npm run check:env`. Run
      `npm run verify` and confirm it is green.
- [ ] The tree is frozen. Every other measurement in flight is invalidated by
      this flip; do it on a still tree.
- [ ] All check anchors currently point at Moderato receipts and the gate is
      green (item 24). You will re-point them at mainnet in step 7.
- [ ] The owner has decided to operate on mainnet, in writing, and knows the
      treasury and the merchant wallet that will receive the smoke test (step 11).

---

## The ordered steps

### 1. Prepare production secrets in the environment 🔑
Set, on every backend instance: `NODE_ENV=production`, `DEV_BYPASS_AUTH=false`,
a real `JWT_SECRET` (not the placeholder), and a `QUOTE_SIGNING_SECRET` of at
least 16 chars **identical on every instance** (`openssl rand -base64 32`). Get
these wrong and step 10's boot will refuse — that is the point.

### 2. Confirm the token addresses exist on mainnet
Verify `TEMPO_TOKEN_PATHUSD` and `TEMPO_TOKEN_OUSD` have **non-empty
`eth_getCode`** on the mainnet RPC (`https://rpc.tempo.xyz`), decimals `6`. The
same two addresses are deployed on both chains, but confirm rather than assume —
a transfer to a no-code address can succeed as a silent no-op.

```bash
cast code <TOKEN> --rpc-url https://rpc.tempo.xyz   # non-empty => deployed
```

### 3. Turn the opt-in on: `ALLOW_MAINNET=true` 🔑
Mainnet is refused unless this is exactly `"true"` (§1 of `docs/operations.md`).
It stays opt-in for a reason: never default to mainnet.

### 4. Point the network at mainnet 🔑
Set `TEMPO_CHAIN_ID=4217` and the mainnet RPC — either `TEMPO_RPC_URL` (takes
precedence) or `ALCHEMY_API_KEY` for the Alchemy mainnet endpoint. Keep
**`INDEXER_BOOTSTRAP_LOOKBACK=0`**: a non-zero value on mainnet is now a boot
refusal, because it would write pre-existing history as fabricated `top_up` rows.

### 5. Seed the indexer cursor to the current head 🗄️ — do NOT backfill
There is no mainnet cursor yet. Seed it so the indexer starts at the head and
never re-scans history (details in `docs/operations.md` §4):

```sql
INSERT INTO indexer_cursors (chain, "lastBlock", "updatedAt")
VALUES ('tempo-mainnet', <current_head_block>, NOW());
```

Get the head from the mainnet RPC immediately before inserting. If you skip this,
the indexer bootstraps with lookback 0 anyway (starts from now) — but the explicit
seed is the auditable record of where mainnet indexing began.

### 6. Set the treasury 🔑
Point `SETI_TREASURY_ADDRESS` at the **mainnet** treasury (it may be the same
EOA; confirm). The backend refuses the zero address, so a copied placeholder
cannot silently burn the fee. This is the address the fee leg of every batch pays.

### 7. Re-point the check anchors at mainnet receipts 🔑
After step 8 produces a mainnet receipt, set `PAYOUT_ANCHOR_TX`,
`SEND_ANCHOR_TX`, `QUOTE_ANCHOR_TX` to **mainnet** transaction hashes and re-run
`npm run verify`. Confirm the suites report `tempo-mainnet`. A suite still reading
a Moderato hash is verifying the wrong chain.

### 8. 🔴 THE GATE — a mainnet batch proof, before real money moves
Sign **ONE** mainnet transaction carrying the exact shape Seti signs:

```
transfer(recipient,        principal)
transfer(SETI_TREASURY_ADDRESS, fee)      # both legs in the same receipt
```

- **💰 It needs a funded mainnet address.** `npm run prove:batch` today targets
  Moderato and funds a throwaway key from the **testnet** faucet; there is no
  faucet on mainnet. The mainnet proof therefore needs a funded mainnet address
  and a variant of that script (or a hand-signed transaction) that skips the
  faucet and spends real funds. **Do not point the existing script at mainnet and
  expect it to fund itself.**
- **🔑 Signed by the owner.** The key that signs this is the operator's, never an
  agent's, and never a user's.
- **Accept:** a real mainnet receipt (`chainId 4217`) whose **single**
  transaction carries both `Transfer` logs — principal to the recipient, fee to
  the treasury — in the right amounts. Paste the receipt; it becomes
  `PAYOUT_ANCHOR_TX` in step 7.

Nothing else in this document may proceed to real money until this receipt
exists. A batched transaction that has only ever run on Moderato is a promise,
not proof.

### 9. Re-measure gas in the primary asset (OUSD)
The displayed estimate and the balance reservation both come from the measured
gas figure. Measure it against the mainnet receipt from step 8 — OUSD gas is
roughly 2.6× pathUSD, and the number is chain- and asset-specific. Update the
figure and re-run the gate.

### 10. Deploy the production configuration
Deploy with the environment from steps 1–6. The boot will refuse if anything is
insecure or inconsistent — watch for it and treat a refusal as the config being
wrong, not the guard being in the way.

### 11. Smoke test with real funds 💰🔑
Send a small real payment to your own merchant wallet. Confirm: it records, the
receipt verifies, and the **fee leg reaches `SETI_TREASURY_ADDRESS`** (in `batch`
mode both legs land in one receipt). Confirm the treasury balance rose by the fee.

### 12. Rollback
- Set `ALLOW_MAINNET=false` (or `TEMPO_CHAIN_ID` back to `42431`) and restore the
  previous environment; redeploy.
- **Migrations are not rolled back.** A migration applied during the flip stays;
  this is why they must be backward compatible (`docs/operations.md` §3).
- The cursor row for `tempo-mainnet` should be left in place — do not delete it.

---

## What this document deliberately does not do

It does not perform the flip. Steps 1–12 are the owner's, in order, with the
owner's keys and funded address. An agent stops at this page.

---
name: privy
description: Use when building wallet infrastructure, authentication systems, or financial applications. Reach for this skill when implementing embedded wallets, user authentication, transaction signing, policy controls, or financial flows (deposits, payouts, swaps, yield). Also use for server-side wallet management, organization wallets, treasury operations, and AI agent wallets.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is a programmable wallet infrastructure platform that enables developers to build secure financial applications with embedded wallets, authentication, and transaction management. Use Privy to create non-custodial wallets for users, authenticate users via email/SMS/social/passkeys, sign transactions, enforce spending policies, and manage financial flows (deposits, payouts, swaps, yield). Privy supports Ethereum, Solana, Bitcoin, Tempo, and 50+ blockchains.

**Key files and config:**
- Client-side: `PrivyProvider` wraps React/React Native apps with `appId` and `config`
- Server-side: REST API at `https://api.privy.io/v1/` with Basic Auth (app ID + app secret)
- SDKs: React, React Native, Swift, Android, Flutter, Unity, NodeJS, Java, Go, Rust, Ruby, Python
- Dashboard: https://dashboard.privy.io for app setup, policies, authentication methods

**Primary docs:** https://docs.privy.io

---

## When to use

Reach for this skill when:

- **Building wallets:** Creating embedded wallets for users, organizations, servers, or AI agents
- **User authentication:** Implementing login via email, SMS, social (Google, Twitter, Discord), passkeys, or external wallets
- **Transaction execution:** Signing transactions, sending funds, swapping tokens, or interacting with smart contracts on EVM or Solana
- **Financial flows:** Building deposits (fiat/crypto), payouts, card spend, or yield integrations
- **Access control:** Enforcing spending policies, multi-sig approvals, or role-based permissions on wallets
- **Server-side automation:** Creating wallets owned by your backend, executing transactions via API, or managing treasury operations
- **Webhooks:** Tracking wallet events, transaction status, or user authentication events in real-time

Do NOT use Privy for: password-based authentication (Privy doesn't support passwords), custody of user private keys (Privy uses key splitting), or non-financial blockchain operations outside Privy's supported chains.

---

## Quick reference

### SDK initialization

**React:**
```tsx
<PrivyProvider appId="your-app-id" clientId="your-client-id" config={{embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}}}}>
  {children}
</PrivyProvider>
```

**NodeJS:**
```ts
import {PrivyClient} from '@privy-io/node';
const privy = new PrivyClient({appId: 'your-app-id', appSecret: 'your-app-secret'});
```

**REST API:**
```bash
curl -u "app-id:app-secret" -H "privy-app-id: app-id" https://api.privy.io/v1/wallets
```

### Common operations

| Task | Method | Notes |
|------|--------|-------|
| Create wallet | `createWallet()` (React) or `wallets().create()` (NodeJS) | Specify owner (user ID, auth key, or key quorum) |
| Authenticate user | `usePrivy().login()` (React) or `users().create()` (API) | Configure login methods in dashboard |
| Headless email login | `useLoginWithEmail().sendCode()` / `loginWithCode()` (React) | No Privy UI at all; a one-time CODE, not a link |
| Send transaction | `sendTransaction()` (React) or `intents().rpc()` (API) | Use wallet actions for common flows |
| Sign message | `signMessage()` (React) or `wallets().ethereum.personalSign()` (API) | Returns signature bytes |
| Get wallet | `useWallets()` (React) or `wallets().get()` (API) | Returns wallet address, chain, policies |
| Create policy | Dashboard or `policies().create()` (API) | Defines spending limits, allowlisted addresses |
| Add signer | `useAddSigners()` (React) or `signers().add()` (API) | Grants scoped permissions to additional party |
| Track action | Webhooks or `wallets().actions().get()` (API) | Monitor transaction status, swaps, transfers |

### Authentication methods

Configure in dashboard under **Authentication > Login methods**:
- Email (OTP)
- SMS / WhatsApp (OTP)
- Social: Google, Apple, Twitter, Discord, GitHub, Farcaster, Telegram
- Passkeys (WebAuthn)
- External wallets (MetaMask, Phantom)
- Custom OAuth / JWT-based auth

### Headless email sign-in (no Privy UI)

Privy's email method is a one-time **code (OTP)**, not an emailed link — there is no
magic-link login in the SDK. Drive it with no Privy UI at all, which is what Seti's own
sign-in page does:

```tsx
const { sendCode, loginWithCode, state } = useLoginWithEmail();
await sendCode({ email });      // mails the OTP; Promise<void>, REJECTS on failure
await loginWithCode({ code });  // consumes it; max 5 attempts per OTP
```

`state` is `{status}`: `initial | error | sending-code | awaiting-code-input |
submitting-code | done` — `awaiting-code-input` is the "we emailed you a code" moment.

`useLinkEmail({ email })` is NOT a login: it attaches a new email to a user who is
ALREADY authenticated (same for `useLinkPhone`).

After `loginWithCode` resolves the user is authenticated and the embedded wallet is
created on login (`createOnLogin`). Read the access token with
`usePrivy().getAccessToken()` and hand it to your own backend to mint your session —
the token is issued in the browser only and no server can mint or refresh one.


### Wallet control models

| Model | Owner | Use case |
|-------|-------|----------|
| User-owned | User (via client SDK) | Self-custodial consumer wallets |
| User + server | User + authorization key | Automated trading, limit orders, delegated access |
| App-owned | Authorization key | Treasury, trading bots, agent wallets |
| Custodial | Licensed custodian | Institutional custody, FBO accounts |

### Policy types

- **Transaction limits:** Max amount per transfer
- **Allowlisted addresses:** Approved recipient addresses
- **Contract interactions:** Approved smart contracts
- **Time windows:** Restrict actions to specific times
- **Stateful policies:** Track state across transactions

---

## Decision guidance

### When to use embedded wallets vs external wallets

| Scenario | Embedded | External |
|----------|----------|----------|
| New users, no existing wallet | ✓ | ✗ |
| Users have MetaMask/Phantom | ✗ | ✓ |
| Need seamless onboarding | ✓ | ✗ |
| Users want to bring existing assets | ✗ | ✓ |
| Non-custodial requirement | ✓ | ✓ |
| Server-side automation | ✓ | ✗ |

### When to use wallet actions vs low-level RPC

| Scenario | Wallet actions | RPC |
|----------|---|---|
| Send transfer, swap, or earn | ✓ | ✗ |
| Custom transaction flow | ✗ | ✓ |
| Need Privy to handle complexity | ✓ | ✗ |
| Full control over payload | ✗ | ✓ |
| Recommended for most apps | ✓ | ✗ |

### When to use Privy auth vs JWT-based auth

| Scenario | Privy auth | JWT-based |
|----------|---|---|
| No existing auth system | ✓ | ✗ |
| Have Auth0, Firebase, Cognito | ✗ | ✓ |
| Need multiple login methods | ✓ | ✓ |
| Want Privy to manage users | ✓ | ✗ |
| Integrating with existing app | ✗ | ✓ |

---

## Workflow

### Typical task: Build a user wallet app with deposits and transactions

1. **Set up Privy app**
   - Create app in Privy Dashboard
   - Copy app ID and app secret
   - Configure login methods (email, social, passkeys)
   - Enable embedded wallets for Ethereum or Solana

2. **Initialize SDK**
   - Wrap React app with `PrivyProvider` (client-side) or instantiate `PrivyClient` (server-side)
   - Set `appId` and `clientId` (React) or `appId` and `appSecret` (server)
   - Configure `embeddedWallets` to auto-create on login

3. **Authenticate user**
   - Call `login()` from `usePrivy()` hook (React) or create user via API
   - User selects login method (email, Google, etc.)
   - Privy returns authenticated user object with user ID

4. **Create or retrieve wallet**
   - React: `createWallet()` from `useCreateWallet()` hook (auto-created if configured)
   - Server: `wallets().create({chain_type: 'ethereum', owner: {user_id: 'privy:...'}})`
   - Store wallet ID and address for future use

5. **Set up deposit flow**
   - Create fiat or crypto deposit account via API
   - Display deposit modal or bank account details to user
   - Track deposits via webhooks (`wallet_action.transfer.succeeded`)

6. **Execute transactions**
   - React: `sendTransaction({to: '0x...', value: amount})` from `useSendTransaction()`
   - Server: `intents().rpc(wallet_id, {method: 'eth_sendTransaction', ...})`
   - Privy handles signing, gas estimation, and broadcast

7. **Monitor and verify**
   - Subscribe to webhooks for transaction status
   - Poll `wallets().actions().get(wallet_id, action_id)` for status
   - Verify transaction on block explorer

---

## Common gotchas

- **Tempo needs `supportedChains` in the provider config:** the SDK resolves a chain by id against the chain list you configure, and throws `Unsupported chainId 42431` (`PrivyConnectorError`, code 4901) while building the public client — before any signature is requested — when Tempo (4217) or Tempo Moderato (42431) is missing from it. Set `config.supportedChains: [tempoChain]` and `config.defaultChain`; with no `supportedChains` the embedded wallet sits on Ethereum mainnet and every Tempo call fails at the first step. Privy knows `tempoModerato` natively (its SDK imports it from viem), so this is a list-membership problem, not a missing-chain problem.
- **HTTPS required:** Embedded wallets only work on `https://` (except localhost). `http://` will silently fail to create wallets.
- **Wait for `ready`:** Always check `usePrivy().ready` before consuming Privy state. Privy initializes asynchronously.
- **Policy violations:** Transactions blocked by policies return `policy_violation` error. Review policy rules in dashboard or via API.
- **Insufficient funds:** Error can mean wallet balance is low OR gas credits are depleted. Check both wallet balance and gas sponsorship credits.
- **Authorization signatures required:** Server-side wallet actions require `privy-authorization-signature` header. Use `AuthorizationContext` in SDKs to auto-sign.
- **User session keys expire:** User signing keys are time-bound. Request fresh keys via `/wallets/authenticate` before they expire.
- **Idempotency keys prevent duplicates:** Use `idempotency_key` header to safely retry failed requests without double-sending transactions.
- **Webhooks are not guaranteed delivery:** Treat webhooks as notifications only. Poll API for authoritative status.
- **Policies are enforced in TEE:** Policies are evaluated in secure enclaves before signing. Cannot be bypassed client-side.
- **Entity assignment is permanent:** Once a wallet is assigned to a user or organization, it cannot be changed.
- **One policy per wallet:** Currently only one policy can be attached to a wallet at a time.
- **Pick the implementation at MODULE scope, never with a branch in a hook body:** `usePrivy`, `useLoginWithEmail` and `useWallets` all THROW with no `PrivyProvider` above them (`usePrivy must be used within a PrivyProvider`). An app that must also run with no Privy app configured selects its implementation once,
  `export const useX = APP_ID ? useWithPrivy : useWithoutPrivy`, where `APP_ID` is fixed for the build. Exactly one implementation is then used and hook order is stable; a conditional inside the hook body breaks `react-hooks/rules-of-hooks` for the same reason.
- **The access token is readable slightly BEFORE `authenticated` flips true:** asking `getAccessToken()` once, right after a login resolves, can return `null` and turn a timing race into a "signed in but no token" failure. Poll a few times. A null read with `authenticated` now false is a sign-OUT racing the read — treat it as a no-op, not an error.
- **`sendCode` rejects when your origin is not allowlisted:** a web origin missing from the app id's allowed domains fails as a generic `invalid_origin`, which reads like a network fault. Add the origin in the dashboard (Settings → Domains).
- **A Privy token is only half a session:** if your own API verifies it and has no app id/secret, that endpoint answers `503 "not configured"`. A client that maps server errors to its own copy (so it never renders the server's sentence) must match that case on the HTTP STATUS — matching on the error text can never fire.
- **`loginWithCode` allows 5 attempts per OTP**, after which the code is dead and `sendCode` must be called again.
- **`createOnLogin` does nothing in a HEADLESS flow: create the wallet yourself.** `config.embeddedWallets.ethereum.createOnLogin: 'users-without-wallets'` works by PROMPTING on Privy's own UI after login. An app that signs in with its own page and its own code field never shows that prompt, so the account ends up authenticated and walletless — Privy's own record reads `linked_accounts: [ { type: 'email' } ]` and nothing else — and any backend that registers the wallet the browser signs with refuses the session (Seti's answered `400 "No embedded wallet is attached to this account"` in production, 2026-10-18). `grep -r createWallet` in the app returned nothing: no part of it created one. After `loginWithCode` resolves, call `createWallet()` from `useCreateWallet` when `useWallets()` holds no `walletClientType === 'privy'` wallet. Expose the returned address to the API call that follows IN THE SAME TICK through a ref: `useWallets()` has not re-rendered yet, so reading it there still returns nothing. Create on the CLIENT, never server-side — the browser has to hold the key, and a wallet minted on the server is one nothing can spend from.

---

## Verification checklist

Before submitting work with Privy:

- [ ] App ID and app secret are configured correctly (check dashboard > App settings > Basics)
- [ ] `PrivyProvider` wraps the entire app (React) or SDK is initialized (server)
- [ ] Login methods are enabled in dashboard and configured in SDK
- [ ] Wallets are created with correct owner (user ID, auth key, or key quorum)
- [ ] Policies are attached to wallets if spending controls are needed
- [ ] Transactions use wallet actions (not raw RPC) for common flows
- [ ] Authorization signatures are included for server-side wallet actions
- [ ] Webhooks are subscribed to for async operations (deposits, transfers, swaps)
- [ ] Error handling covers `policy_violation`, `insufficient_funds`, `request_expired`
- [ ] A headless email login runs end to end: `sendCode` → `loginWithCode` → the access token exchanged with your own backend
- [ ] HTTPS is enabled in production (not http://)
- [ ] Gas sponsorship credits are funded if using gas sponsorship
- [ ] Idempotency keys are used for retry-safe requests
- [ ] User session keys are refreshed before expiry
- [ ] Wallet addresses are verified on block explorer after creation

---

## Resources

**Comprehensive navigation:** https://docs.privy.io/llms.txt

**Critical docs:**
- [Getting started](https://docs.privy.io/basics/get-started/about) — Overview of Privy's architecture and use cases
- [Wallets overview](https://docs.privy.io/wallets/overview) — Embedded wallets, external wallets, and wallet types
- [Authentication overview](https://docs.privy.io/authentication/overview) — Login methods, MFA, and security levels
- [API reference](https://docs.privy.io/api-reference/introduction) — REST API endpoints, rate limits, and error codes
- [Controls and policies](https://docs.privy.io/controls/overview) — Authorization models, signers, and policy enforcement
- [Error handling](https://docs.privy.io/basics/troubleshooting/error-handling/api-errors) — Common errors and troubleshooting steps

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt
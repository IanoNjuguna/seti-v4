# Seti Mobile

React Native + Expo app for Seti users. It lets people scan or enter merchant QR codes, preview payments in OUSD/KES, and sign stablecoin transfers on Tempo using a Privy embedded wallet.

---

## What it does

- **Authentication:** Privy embedded wallets and social/email login.
- **Home dashboard:** shows total balance in KES and recent activity.
- **Pay merchant:** resolve a merchant from a QR payload, preview the payment, then sign and broadcast an OUSD `transfer` on Tempo.
- **Activity:** list of recent transactions.
- **Profile:** placeholder for account settings.

---

## Tech stack

- React Native 0.86 / Expo SDK 57
- TypeScript
- Expo Router
- NativeWind v4 (Tailwind for React Native)
- Privy embedded wallets (`@privy-io/expo`)
- viem (transaction construction)

---

## Prerequisites

- Node.js 20+ and npm (install from the **repo root** — this is an npm workspace, and a nested lockfile inside `mobile/` defeats hoisting)
- For a native build: Android Studio with the SDK, or EAS for a cloud build. **Expo Go cannot run this app** — it bundles `expo-camera`, `react-native-passkeys`, `expo-secure-store`, `expo-webview` and `@privy-io/expo`, all of which need a development build.
- iOS builds require macOS with Xcode; there are no `ios/`/`android/` directories (CNG generates them).
- A running Seti backend at `http://localhost:4000` (or your LAN IP for physical devices)

---

## Environment variables

Create `mobile/.env` from the example:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `PRIVY_APP_ID` | Privy app identifier |
| `TEMPO_CHAIN_ID` | `4217` for mainnet, `42431` for testnet |
| `ALCHEMY_API_KEY` | Optional Alchemy API key for Tempo RPC |
| `TEMPO_RPC_URL` | Optional Tempo RPC override (takes precedence over the Alchemy-derived endpoint) |
| `TEMPO_TOKEN_PATHUSD` / `TEMPO_TOKEN_OUSD` | The only two assets v1 supports. Both are required |
| `SETI_TREASURY_ADDRESS` | Fee-collection address. **Must match the backend's value exactly**, or the two legs of a batched payment disagree. Validated on read; fails closed rather than risking a `0x0` fee leg |
| `ALLOW_MAINNET` | Must be `"true"` to use chain ID `4217` |

To reach a backend on another host, set `EXPO_PUBLIC_API_URL` — `localhost` on a
physical device means the phone itself.

Expo loads these automatically at build time through `app.config.js` and exposes them via `Constants.expoConfig.extra`.

---

## Setup

```bash
npm install            # from the repo ROOT, not here
cp mobile/.env.example mobile/.env
# edit mobile/.env and set PRIVY_APP_ID, TEMPO_TOKEN_* and SETI_TREASURY_ADDRESS
```

### Start the dev server

Expo Go cannot load this app (native modules). Use a development build:

```bash
npm run dev:mobile              # or: npx expo start
npx expo run:android            # local Android build + install
npx eas-cli@latest build --profile development   # cloud build
```

Then point the dev client at your Metro server. A physical device also needs
`EXPO_PUBLIC_API_URL` set to your machine's LAN IP.

#### Using Alchemy for RPC

Set `ALCHEMY_API_KEY` in `.env`. If `TEMPO_RPC_URL` is also set, it takes precedence. Verify the generated endpoint against your Alchemy dashboard if requests fail.

### Clear the bundler cache

After changing `tailwind.config.js`, `global.css`, `babel.config.js`, or `metro.config.js`:

```bash
npx expo start --clear
```

---

## Useful scripts

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # Expo lint
npm run android      # expo start --android
npm run ios          # expo start --ios
```

---

## Architecture notes

- Entry config is in `app.config.js` (replaces `app.json`).
- NativeWind is configured in `metro.config.js` and `babel.config.js`.
- Global polyfills (`Buffer`, `fast-text-encoding`, `react-native-get-random-values`) are loaded in `src/app/_layout.tsx`.
- `metro.config.js` aliases `jose` to its browser build so Privy works in React Native without Node.js `crypto` globals.
- Tempo chain config and token addresses are read from `Constants.expoConfig.extra` in `src/lib/chain.ts`.

---

## Testing the payment flow

1. Make sure the backend is running.
2. Open the **Pay** tab.
3. Enter a merchant reference, e.g. `merchant:merchant_java_house`, and tap **Resolve merchant**.
4. Enter an amount in KES.
5. Tap **Pay**.
6. The app previews the payment, checks your on-chain balance, and (if sufficient) prompts the embedded wallet to sign the transfer.

If the demo wallet has no real stablecoins on Tempo testnet, the preview will show `hasEnoughBalance: false` and block the payment.

> The Pay screen currently defaults to OUSD. An in-app asset selector for
> pathUSD — the only other asset v1 supports — is a future UI change.

---

## Notes

- Mainnet is gated by `ALLOW_MAINNET=true`.
- A physical device needs `EXPO_PUBLIC_API_URL` set to your machine's LAN IP —
  `localhost` there means the phone itself.

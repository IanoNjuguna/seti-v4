# Seti

A mobile neobank for emerging markets. Users pay via existing QR infrastructure; the backend converts stablecoins to local fiat (KES) for merchant settlement. Built on **Tempo** with **OUSD** and **Stripe + Bridge** off-ramps.

> **Current focus:** Nairobi, Kenya. M-Pesa settlement is not a priority for this phase.

---

## Repository layout

```
├── mobile/                 # React Native + Expo app
├── backend/                # Node.js API service (planned)
├── .agents/skills/         # Project agent skills
├── DESIGN.md               # Calm Finance design system
├── design.tokens.json      # Machine-readable design tokens
├── tailwind.config.js      # NativeWind / Tailwind token config
└── AGENTS.md               # Project conventions for agents
```

---

## Tech stack

- **Mobile:** React Native, Expo SDK 57, TypeScript, NativeWind v4, Expo Router
- **Design system:** Calm Finance — quiet, trustworthy, modern minimalist fintech
- **Backend:** Node.js, Fastify, TypeScript, Prisma, PostgreSQL
- **Onchain:** Tempo, OUSD
- **Off-ramp:** Stripe + Bridge for KES bank payouts

---

## Prerequisites

- Node.js 20+ and npm
- Git
- For iOS: macOS with Xcode
- For Android: Android Studio or a physical device with Expo Go
- For backend: Docker (for local Postgres) or a running Postgres instance

---

## Setup

1. Clone the repo:

   ```bash
   git clone git@github.com:IanoNjuguna/seti-v4.git
   cd seti-v4
   ```

2. Install project agent skills (optional, for AI-assisted work):

   ```bash
   npx skills experimental_install
   ```

---

## Run the mobile app

All mobile commands run from the `mobile/` directory.

```bash
cd mobile
npm install
```

> **Note:** If you hit React peer-dependency conflicts during install, use:
> ```bash
> npm install --legacy-peer-deps
> ```

### Start the dev server

```bash
npx expo start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- `w` for web
- Scan the QR code with **Expo Go** on a physical device

### Clear the bundler cache

After changing `tailwind.config.js`, `global.css`, or `babel.config.js`:

```bash
npx expo start --clear
```

---

## Run the backend

All backend commands run from the `backend/` directory.

```bash
cd backend
cp .env.example .env
npm install
```

### Start Postgres

```bash
docker compose up -d
```

### Set up the database

```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed
```

### Start the API server

```bash
npm run dev
```

The API runs on `http://localhost:4000`.

Useful endpoints:
- `GET /health`
- `POST /auth/register`
- `GET /users/:id/home`
- `GET /transactions?userId=:id`
- `POST /transactions/pay`

---

## Verify before committing

From `mobile/`:

```bash
npx tsc --noEmit      # TypeScript check
npx expo-doctor       # Expo dependency/config health check
npx expo lint         # Lint (if configured)
```

From `backend/`:

```bash
npx tsc --noEmit      # TypeScript check
```

Both mobile and backend type checks should pass before you consider a change done.

---

## Design system

`DESIGN.md` is the single source of truth for UI/UX. Key constraints:

- Semantic tokens only — no raw hex in components
- `font-tabular` on every monetary value
- Currency format: `KES 1,250.00`
- Calm, direct copy — no exclamation marks, no gamification
- Minimum 44×44 pt touch targets
- Light + dark mode parity for every surface/text pair

---

## Branch conventions

- `main` — stable, reviewed state
- `feat/<name>` — feature branches
- Open pull requests for review before merging into `main`

---

## Fee model (current)

- Consumer: 0%
- Merchant: 2% + KES 50 minimum
- FX markup embedded in conversion

---

## Security notes

- Never store seed phrases or private keys
- Wallet keys belong to the user via Privy / Tempo Accounts SDK
- Backend never signs transactions on behalf of users without explicit authorization
- Keep testnet and mainnet configs separate

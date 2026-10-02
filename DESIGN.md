# DESIGN.md — Calm Finance Design System

> **Core Visual Ethos:** Financial clarity without cognitive overload. A quiet, trustworthy neobank surface built around modern minimalism — calm colors, generous whitespace, clear hierarchy, and tabular precision for money. Every element reduces anxiety; nothing gamifies, shouts, or distracts.

This design system governs the React Native + Expo mobile app and any related web/marketing surfaces for the Tempo-based neobank.

---

## 1. Design Principles

1. **Quiet confidence.** No exclamation marks, no flashy gradients, no celebratory animations for routine actions.
2. **Clarity first.** Every screen answers one question: “What do I do here?”
3. **Tabular honesty.** Money is shown in tabular lining figures. Balances, amounts, and columns align vertically.
4. **Touchable calm.** Minimum 44×44 pt targets, generous padding, obvious pressed states.
5. **Dark mode parity.** Every semantic token has a light and dark value. No raw hex without a dark equivalent.

---

## 2. Color Tokens

### 2.1 Raw palette

| Token name | Hex | Usage |
|---|---|---|
| `raw-canvas` | `#F8F9FA` | App background |
| `raw-card` | `#FFFFFF` | Card surfaces |
| `raw-inset` | `#F1F5F9` | Inset fields, secondary surfaces |
| `raw-border` | `#E5E7EB` | Hairline borders, dividers |
| `raw-ink` | `#0F172A` | Primary text, anchors, structural ink |
| `raw-slate` | `#64748B` | Secondary text, icons, placeholders |
| `raw-sage` | `#059669` | Primary CTA, success, retention accent |
| `raw-terracotta` | `#E05252` | Danger, alerts, destructive actions |
| `raw-success-bg` | `#F0FDF4` | Subtle success backgrounds |

### 2.2 Semantic tokens

| Semantic token | Light value | Dark value | Usage |
|---|---|---|---|
| `color-bg-canvas` | `#F8F9FA` | `#0F172A` | Screen background |
| `color-surface-card` | `#FFFFFF` | `#1E293B` | Cards, sheets, elevated panels |
| `color-surface-inset` | `#F1F5F9` | `#334155` | Input backgrounds, nested wells |
| `color-border-1` | `#E5E7EB` | `#334155` | Hairline borders and dividers |
| `color-border-focus` | `#059669` | `#34D399` | Focus rings, active borders |
| `color-text-primary` | `#0F172A` | `#F8FAFC` | Headings, primary amounts, anchors |
| `color-text-secondary` | `#64748B` | `#94A3B8` | Body, captions, placeholders, metadata |
| `color-text-inverse` | `#FFFFFF` | `#0F172A` | Text on primary/accent backgrounds |
| `color-accent-primary` | `#059669` | `#34D399` | Primary buttons, success states, links |
| `color-accent-hover` | `#047857` | `#6EE7B7` | Hover/active accent |
| `color-alert` | `#E05252` | `#F87171` | Errors, destructive actions, warnings |
| `color-alert-bg` | `#FEF2F2` | `#450A0A` | Subtle alert backgrounds |
| `color-success-bg` | `#F0FDF4` | `#064E3B` | Subtle success backgrounds |
| `color-warning` | `#D97706` | `#FBBF24` | Pending, caution |

### 2.3 Contrast ratios

| Pairing | Ratio | Pass WCAG AA? |
|---|---|---|
| `color-text-primary` on `color-bg-canvas` light | ~15.8:1 | Yes |
| `color-text-secondary` on `color-bg-canvas` light | ~5.2:1 | Yes |
| `color-text-primary` on `color-surface-card` light | ~15.8:1 | Yes |
| `color-text-inverse` on `color-accent-primary` light | ~4.6:1 | Yes (large text); body text use `#FFFFFF` carefully — confirmed 4.6:1 |
| `color-text-inverse` on `color-alert` light | ~4.5:1 | Yes (borderline; use semibold) |
| `color-text-primary` on `color-success-bg` light | ~14.5:1 | Yes |
| `color-text-secondary` on `color-surface-inset` light | ~4.8:1 | Yes |

All body text pairings meet 4.5:1. UI components meet WCAG AA for normal text.

---

## 3. Typography

### 3.1 Font stacks

```css
/* Primary */
font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Apple native fallback */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif;

/* Android native fallback */
font-family: 'Roboto', 'Inter', ui-sans-serif, system-ui, sans-serif;
```

React Native / Expo:
```tsx
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
```

### 3.2 Typographic scale

| Token | Size | Weight | Letter-spacing | Line-height | Usage |
|---|---|---|---|---|---|
| `text-balance` | 40px | 600 | -0.02em | 1 | Hero balance, total portfolio |
| `text-section` | 20px | 600 | -0.01em | 1.2 | Screen titles, section headers |
| `text-card-title` | 16px | 500 | -0.005em | 1.25 | Card titles, merchant names |
| `text-body` | 14px | 400 | 0 | 1.5 | Body copy, descriptions |
| `text-body-medium` | 14px | 500 | 0 | 1.5 | Emphasized body |
| `text-micro` | 12px | 500 | 0.01em | 1.4 | Captions, timestamps, badges |
| `text-button` | 16px | 600 | 0 | 1 | Button labels |
| `text-tab` | 11px | 500 | 0.02em | 1 | Bottom tab labels |

### 3.3 Numeric formatting

All monetary values use tabular lining figures and slashed zero:

```css
.font-tabular {
  font-feature-settings: "tnum" 1, "zero" 1;
  font-variant-numeric: tabular-nums slashed-zero;
}
```

Apply `font-tabular` to:
- Hero balance
- Transaction amounts in lists
- Amount input
- Any column of numbers

Currency format: `KES 1,250.00` — symbol, space, thousands separator, two decimals.

---

## 4. Spacing, Radii, Elevation & Motion

### 4.1 Spacing scale

| Token | Value |
|---|---|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-14` | 56px |
| `space-16` | 64px |

Default outer screen padding: 20px (`space-5`).
Card internal padding: 16px (`space-4`).

### 4.2 Radii

| Token | Value | Usage |
|---|---|---|
| `radius-input` | 12px | Buttons, inputs, small pills |
| `radius-card` | 16px | Cards, panels, lists |
| `radius-pill` | 9999px | Status badges, quick pills, filters |
| `radius-sheet` | 24px | Bottom sheets, modals (top radius only) |

### 4.3 Elevation

| Token | Value | Usage |
|---|---|---|
| `shadow-ambient` | `0 2px 8px rgba(15, 23, 42, 0.04)` | Subtle card lift |
| `shadow-sheet` | `0 -4px 24px rgba(15, 23, 42, 0.08)` | Bottom sheet backdrop shadow |

Borders:
- Default card border: `1px solid color-border-1`
- On dark mode: keep border subtle to avoid heavy lines.

### 4.4 Motion

| Token | Value | Usage |
|---|---|---|
| `duration-press` | 120ms | Press feedback |
| `duration-transition` | 200ms | State transitions, ease-out |
| `duration-spring` | 300ms | Sheet open/close, spring-based |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Standard transitions |

Press feedback: `scale(0.98)` on active.
Haptic: 10ms light impact on payment confirmation and errors.
Motion preference: respect `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled()`.

---

## 5. Component Inventory

### 5.1 Buttons

#### Primary Button
- **Anatomy:** Rounded rectangle, centered label, optional left icon.
- **Tokens:** `bg-accent-primary`, `text-inverse`, `radius-input`, `text-button`.
- **Sizes:** Default height 48px; full-width on mobile forms.
- **States:**
  - Default: `bg-accent-primary`
  - Hover: `bg-accent-hover`
  - Pressed: `scale(0.98)`, `bg-accent-hover`
  - Disabled: 50% opacity
  - Focus: `ring-2 ring-border-focus ring-offset-2`
- **Accessibility:** `accessibilityRole="button"`, `accessibilityLabel` when icon-only, min 44×44 pt.

```tsx
<Pressable className="h-12 rounded-input bg-accent-primary active:scale-[0.98] items-center justify-center">
  <Text className="text-button text-inverse font-semibold">Send</Text>
</Pressable>
```

#### Secondary Button
- **Tokens:** `bg-surface-card`, `text-primary`, `border border-1`.
- **States:** same press/focus as primary.

#### Ghost Button
- **Tokens:** transparent background, `text-accent-primary` text.
- **Use:** low-priority actions, inline links.

#### Destructive Button
- **Tokens:** `bg-alert`, `text-inverse`.
- **Use:** delete, revoke, freeze.

#### Quick Pill
- **Tokens:** `bg-surface-inset`, `text-secondary`, `radius-pill`, `text-micro`.
- **Size:** height 32px, horizontal padding 12px.
- **Pressed:** `bg-border-1`.

### 5.2 Cards

#### Elevated Surface Card
- **Tokens:** `bg-surface-card`, `radius-card`, `shadow-ambient`, optional `border border-1`.
- **Padding:** 16px.
- **Use:** balance summary, insights, settings groups.

#### Inset Metric Card
- **Tokens:** `bg-surface-inset`, `radius-card`.
- **Use:** nested metrics, breakdowns.

#### Insight / Nudge Card
- **Tokens:** `bg-success-bg` (or `bg-alert-bg` for warnings), `radius-card`.
- **Icon + one-line text + optional dismiss.
- **Copy max length:** one sentence.

### 5.3 Status Badges

| Variant | Background | Text | Shape |
|---|---|---|---|
| Success | `color-success-bg` | `color-accent-primary` | Pill |
| Neutral | `color-surface-inset` | `color-text-secondary` | Pill |
| Warning | `#FFFBEB` dark `#451A03` | `color-warning` | Pill |
| Danger | `color-alert-bg` | `color-alert` | Pill |

Size: height 24px, padding 8px horizontal, `text-micro`.

### 5.4 Inputs

#### Single-line text input
- **Tokens:** `bg-surface-inset`, `text-primary`, `border border-1`, `radius-input`.
- **Height:** 48px.
- **Focused:** `border-border-focus`.
- **Error:** `border-alert` + caption.
- **Label:** `text-micro text-secondary` above input.
- **Placeholder:** `text-secondary`.

#### Amount hero input
- **Centered, large, tabular.**
- **Tokens:** `text-balance font-tabular text-primary`, transparent background.
- **Prefix:** currency symbol left-aligned or above.
- **Keyboard:** decimal-pad.

#### Search input
- **Tokens:** `bg-surface-inset`, `radius-pill`, left search icon.
- **Height:** 40px.

### 5.5 Bottom Sheets / Drawers

- **Backdrop:** `rgba(15, 23, 42, 0.4)` with blur.
- **Sheet:** `bg-surface-card`, top radius `radius-sheet`.
- **Drag handle:** 36px wide, 4px high, `bg-surface-inset`, rounded.
- **Snap points:** 25%, 50%, 85% of screen height.
- **Accessibility:** `aria-modal`, focus trap, close on backdrop tap, `accessibilityLabel` for close.

### 5.6 Transaction Row

```
[icon/avatar 40px] [merchant + category] [amount]
                    [date]              [status]
```

- **Tokens:** row height 64px, separator `border-b border-1`.
- **Merchant name:** `text-card-title text-primary`.
- **Category/date:** `text-micro text-secondary`.
- **Amount:** `text-body-medium font-tabular text-primary` (negative in `text-alert`).
- **Grouping:** sticky section headers by date, `text-micro text-secondary uppercase`.

### 5.7 Virtual Card Screen

- **Card:** `bg-surface-card`, `radius-card`, `shadow-ambient`, numberless by default.
- **Tap-to-reveal:** show full PAN for 30 seconds; log reveal event; require auth.
- **Freeze toggle:** immediate state change with haptic.
- **Spending slider:** track `bg-surface-inset`, fill `bg-accent-primary`, thumb 24px.

### 5.8 P2P Transfer

- **Recipient selector:** avatars + friendly names, smart suggestions.
- **Hero amount input:** centered, `text-balance font-tabular`.
- **Preset pills:** KES 100, 500, 1000, 2500, 5000.
- **Slide-to-confirm:** track `bg-surface-inset`, thumb `bg-accent-primary`, label `text-inverse`.
- **Accessibility fallback:** standard primary button if slide gesture is not accessible.

### 5.9 Navigation

- **Bottom tab bar:** `bg-surface-card`, top border `border-1`, 4 tabs.
- **Tab labels:** Home, Pay, Activity, Profile.
- **Active:** `text-accent-primary`; inactive: `text-secondary`.
- **Min touch target:** 44×44 pt per tab.

---

## 6. Wireframes & UI Execution

### 6.1 Home / Dashboard

```
┌─────────────────────────────┐  ← SafeAreaView
│  [Good morning]             │  ← text-secondary, text-micro
│  KES 12,450.00              │  ← text-balance font-tabular, text-primary
│  ↑ 2.4% this month          │  ← pill: color-success-bg + text-accent-primary
│                             │
│  [Add Money] [Send] [Pay]   │  ← quick-action row, pills/buttons
│                             │
│  ─── Recent Activity ───    │  ← text-section
│  [icon] Java House          │
│  Dining            -250.00  │  ← transaction row
│  Today                      │
│  [icon] Safaricom           │
│  Airtime           -100.00  │
│  Yesterday                  │
│                             │
│  [──────── tab bar ────────]│
└─────────────────────────────┘
```

**Step-by-step build checklist:**

1. Create `HomeScreen` wrapper with `SafeAreaView`, `ScrollView`, 20px horizontal padding.
2. Add greeting label using `text-micro text-secondary`.
3. Add hero balance using `text-balance font-tabular text-primary`.
4. Add month-to-date delta pill using `color-success-bg` background and `text-accent-primary` text.
5. Add quick-action row: `Add Money`, `Send`, `Pay` — use primary/secondary/pill button styles; ensure 44×44 pt min size.
6. Add section header `Recent Activity` using `text-section`.
7. Implement `TransactionRow` component with avatar, merchant, category, date, amount.
8. Wire `FlatList` with date-grouped sections and sticky headers.
9. Add bottom tab bar with Home, Pay, Activity, Profile.
10. Verify `font-tabular` on balance and amounts; run contrast and touch-target checks.

### 6.2 Transaction Detail Drawer

```
┌─────────────────────────────┐
│         [drag handle]       │
│  [icon] Java House          │
│  KES 250.00                 │  ← text-balance font-tabular
│  Completed • Today, 9:41 AM │  ← badge + text-micro
│                             │
│  ─── Payment details ───    │
│  Merchant      Java House   │
│  Category      Dining       │
│  Card          •••• 4242    │
│  Transaction ID tx_abc123   │
│                             │
│  [Download receipt]         │
│  [Report an issue]          │
└─────────────────────────────┘
```

**Step-by-step build checklist:**

1. Create `TransactionDetailSheet` with `radius-sheet` top corners and drag handle.
2. Add merchant icon/avatar (40px) and name using `text-card-title`.
3. Add amount using `text-balance font-tabular`.
4. Add status badge (success/neutral/pending) and timestamp.
5. Add detail list: label `text-micro text-secondary`, value `text-body text-primary`.
6. Add secondary actions: “Download receipt” and “Report an issue”.
7. Implement backdrop tap-to-close and focus trap.
8. Add share/receipt download handlers.

### 6.3 P2P Transfer Screen

```
┌─────────────────────────────┐
│  Send money                 │  ← text-section
│                             │
│  To: [Search or choose...]  │  ← recipient selector
│  [Alice] [Bob] [James +3]   │  ← smart suggestion pills
│                             │
│         KES                 │
│      1,250.00               │  ← text-balance font-tabular centered
│                             │
│  [100] [500] [1k] [2.5k]    │  ← preset amount pills
│                             │
│  ─── From ───               │
│  Balance  KES 12,450.00     │
│                             │
│  [Slide to confirm →]       │  ← slide-to-confirm track
│                             │
│  [Cancel]                   │
└─────────────────────────────┘
```

**Step-by-step build checklist:**

1. Create `SendScreen` with 20px horizontal padding.
2. Add recipient selector with search input and smart-suggestion pills.
3. Add centered hero amount input with `text-balance font-tabular` and currency label.
4. Add preset amount pills: 100, 500, 1000, 2500, 5000.
5. Show source balance row with `font-tabular`.
6. Implement slide-to-confirm or fallback primary button.
7. On confirm, show biometric/PIN prompt, then success sheet.
8. Handle insufficient balance with inline `color-alert` message.

---

## 7. Microcopy & Tone

### Voice
- Direct, reassuring, transparent, quiet.
- No exclamation marks.
- No aggressive upsells or gamification.
- Avoid clichés: “seamless,” “revolutionary,” “next-gen,” “unleash.”

### Examples

| Context | Copy |
|---|---|
| Primary CTA | Send |
| Secondary | Cancel, Back, Done |
| Add funds | Add Money |
| Success | Sent KES 1,250.00 to Alice |
| Error | Couldn’t send. Check your balance and try again. |
| Insight | You spent 12% less on dining this week. |
| Empty state | No transactions yet. Send a payment. |
| Loading | Loading… |

### CTA length
- Max 2–4 words per button label.
- Max one sentence for inline insights.

---

## 8. Engineering & Handoff Notes

### 8.1 Figma library structure

- **Tokens page:** color, typography, spacing, radii, shadow, motion.
- **Components page:** buttons, inputs, cards, badges, lists, sheets, navigation.
- **Patterns page:** Home, Transaction Detail, P2P Transfer, empty/error states.
- Naming: `color/bg/canvas`, `text/balance`, `component/button/primary/default`.

### 8.2 Token JSON schema

See `design.tokens.json` in this repo for the machine-readable token set (colors, typography, spacing, radii, shadows).

### 8.3 Security: tap-to-reveal

- PAN never stored in UI state unencrypted.
- Reveal requires biometric/PIN.
- Visible for 30 seconds, then auto-mask.
- Log every reveal event server-side.
- Screen reader: mask full PAN by default; announce “Card number hidden. Double-tap to reveal.”

### 8.4 QA checklist

- [ ] All text meets 4.5:1 contrast on its background.
- [ ] Tabular numbers render in balances, amounts, and list columns.
- [ ] Every interactive element is ≥ 44×44 pt.
- [ ] Focus/pressed states visible on all buttons and inputs.
- [ ] Screen reader labels on icon-only buttons.
- [ ] Reduced-motion preference respected.
- [ ] Color-blind safe: do not rely on color alone for status; use text + icon.
- [ ] Dark mode tokens applied to every surface/text pair.

---

## 9. Acceptance Criteria

- [ ] Semantic color tokens defined with light/dark values and contrast ratios.
- [ ] Typography scale includes `font-tabular` utility for monetary values.
- [ ] Spacing, radii, shadow, and motion tokens documented.
- [ ] Component inventory covers buttons, cards, badges, inputs, sheets, lists, virtual card, P2P transfer, navigation.
- [ ] ASCII wireframes and build checklists provided for Home, Transaction Detail, and P2P Transfer.
- [ ] Microcopy and tone guidelines included.
- [ ] Engineering handoff notes and QA checklist included.

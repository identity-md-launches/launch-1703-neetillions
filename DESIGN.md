# $NEETHOME design system

## Overview

A single-page token home for the $NEET community: quiet charcoal surfaces, lilac actions, large prices and a small house with a sleeping sofa. The requested sentence is the main heading, verbatim. It takes precedence over the reference guide’s six-word headline rule.

The page places token data and trading controls ahead of the contract address and fee explanation. It distinguishes live quotes, pool reference prices, estimates, stale data and unavailable data. This is a dark-only interface. The website source lives in `web/src/`; the production export is `dist/`.

## Colors

`web/src/styles.css` defines these semantic tokens. The palette uses hex values for reproducible sRGB contrast and straightforward browser inspection.

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#111315` | Page background |
| `--color-surface` | `#191c1f` | Token panels and wallet dialog |
| `--color-hover` | `#24282d` | Neutral control hover |
| `--color-line` | `#34383e` | Structural borders and dividers |
| `--color-text` | `#f0eff3` | Primary copy and figures |
| `--color-muted` | `#a3a4ae` | Supporting text, labels and source details |
| `--color-accent` | `#c3bcf5` | Buy button, brand and headline emphasis |
| `--color-accent-hover` | `#d5d0ff` | Primary button hover |
| `--color-accent-ink` | `#242033` | Text on lilac button |
| `--color-focus` | `#ded9ff` | Keyboard focus perimeter |
| `--color-positive` | `#b3d7bf` | Current quote status and positive change |
| `--color-negative` | `#f3b3ac` | Negative change and recoverable errors |

Token marks use `#302c40` and `#28372e` as decorative backgrounds; wallet marks retain vendor colors. The fee bar uses lilac, `#8c96a7` and `#515a66`, with percentages and labels providing the same information in text. The decorative house is an inline SVG in `icons.tsx`.

Calculated contrast: primary text on the page **16.27:1**, primary text on a panel **14.95:1**, muted text on a panel **6.91:1**, muted text on hover **5.99:1**, and primary button text **8.90:1**. Focus is **13.72:1** against the page and **10.93:1** against hover. These solid foreground/background pairs were also covered by rendered checks; they are not a claim about arbitrary future backgrounds.

## Typography

Manrope is bundled locally as `web/src/assets/manrope-latin.woff2` (variable WOFF2, 24,836 bytes). CSS exposes weights 400–700; the application uses 400 and 600. Fallbacks: `ui-sans-serif`, system UI, Apple system, BlinkMacSystemFont, Segoe UI, sans-serif. Addresses use the platform monospace stack. The font license is in `web/licenses/Manrope-OFL.txt`.

| Token | Desktop | At 621–900px | At ≤620px | Use |
| --- | --- | --- | --- | --- |
| `--size-small` | 13px | 13px | 13px | Metadata, compact controls |
| `--size-body` | 15px | 15px | 15px | Short interface copy |
| `--size-title` | 18px | 18px | 18px | Token names, brand, market caps |
| `--size-section` | 24px | 24px | 24px | Fee heading, totals, dialog heading |
| `--size-number` | 36px | 36px | 32px | Token price |
| `--size-display` | 48px | 36px | 32px | Exact requested headline |

Sizes are implemented in rem. Body line-height is 1.6; display line-height is 1.14 desktop / 1.2 mobile, with balanced wrapping. Headline tracking is −0.045em desktop / −0.035em mobile. Prices use −0.035em and tabular numbers. At most six sizes and two weights are rendered at each normal viewport. Addresses remain selectable and wrap without clipping. Supporting disclosure paragraphs have bounded measures.

## Layout

The `.site-shell` has a 1120px maximum outer width, centered with 40px desktop gutters, 28px below 900px, 20px below 620px, and 16px below 360px. Internal spacing is mostly 8/12/16/20/24/28/36px; section separation is 36–52px. Groups use space first, with dividers reserved for the address, fee disclosure and footer.

Above 900px, the headline and 260px house drawing share a row. Token panels use two equal columns with a 20px gap. Fee allocation and fee totals use two columns, separated by a vertical line. At 621–900px, the house is 190px wide and price/cap values stack within the panels.

At ≤620px, the illustration disappears, token and fee panels stack, each price gets its own full-width row with market cap below, and Buy/Sell moves above the token panels so the main action appears on the first 390px screen. Trading actions and token headers wrap when text is enlarged. At ≤360px the compact brand drops its icon and market values use separate rows. The wallet dialog becomes a bottom sheet with safe-area padding. Desktop dialogs remain centered and at most 440px wide.

Widths 320, 390, 620, 900 and 1440 are covered by the interaction test. Live screenshots were inspected at 390 and 1440; the pinned probe also measures 320. Text enlargement is tested separately from browser-native zoom.

## Elevation & Depth

The design is flat: structural one-pixel borders, tonal panel backgrounds and no box shadows. The modal uses the native dialog top layer, a `#08090bbf` backdrop, background scroll locking and contained overscroll. No sticky element covers page content. There are no animated loading skeletons or background motion.

## Shapes

Controls have a 9px radius, token panels 14px, decorative token marks 12px, desktop dialog 18px, and mobile sheet upper corners 20px. The allocation bar is 7px tall with a 4px radius and 5px segment gaps. Only decorative art and the bar clip their contents; no address or price is ellipsized.

## Components

- **`App` / `TokenCard` — `web/src/App.tsx`:** exact hero, both token panels, USD price, market cap, chain labels, source time and explorer navigation. `TokenCard` takes `kind` and `now`; supports loading, live, reference, stale, missing-cap and unavailable states. `priceFromSqrt` is in `chain-data.ts`, with labels and source disclosure in `App.tsx`.
- **Buttons — `styles.css`:** `.button` is a neutral outlined control; `.primary` is the lilac Buy action. Rest, hover, pressed, focus and disabled states are defined. Normal controls are at least 44px tall; mobile trading actions are 48px. Text links use consistent underlines and external-arrow icons. All transitions name their properties and use 150ms; reduced motion removes transitions and press scaling.
- **`CopyAddress` — `App.tsx`:** full exact address, clipboard copy, confirmed state, live announcement and manual-copy fallback. Mobile reduces only the button’s visual label, keeping its accessible name.
- **`Wallet` — `web/src/Wallet.tsx`:** a single header control, EIP-6963 provider discovery, local vendor marks, mobile deep links, Coinbase connector, account details, balance, add-token and disconnect. Native dialog semantics, explicit Tab cycling, Escape/backdrop/close control, focus return, pending state and recoverable errors. Wrong-chain UI offers the pinned network switch and add-chain fallback.
- **`Fees` — `web/src/Fees.tsx`:** verified full-history swap-fee estimate, through-block and count, refresh, loading, error and stale states. Unverified or partial data never becomes a numeric zero. The allocation is explained separately from actual fee generation.
- **Disclosures — `App.tsx`:** native `details`/`summary` for pricing methodology and fee policy. Keyboard operable, no custom accordion state machine.
- **Icons — `web/src/icons.tsx`:** one `Icon` component, 1.7px current-color strokes, hidden from assistive technology beside text; decorative `HomeArt` is also hidden. Vendor wallet icons are bundled under `web/public/wallets/`.

## Do’s and don’ts

Reuse the existing shell, text scale, controls and data states. Keep the product/action ahead of explanations on mobile. Use the primary fill for one action in a group. Label estimates and stale values at the point of use. Preserve the exact token identities and displayed contract address. Give new controls visible keyboard focus and a recoverable failure state.

Do not replace missing values with sample numbers, FDV with circulating market cap, or a stated allocation with claims of executed transfers. Avoid additional display fonts, gradient text, nested panels and page-load motion. If another page becomes necessary, use a static export or hash route, retain relative assets, and compose these same primitives; this implementation itself is one page.

## Attribution

Design review applied the pinned Better Interface guidance by Jakub Krehel (MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`) and the documentation method adapted from Paul Bakaus’s Impeccable (Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). Notices and licenses are retained in `web/licenses/Design-guidance.txt`. Wallet marks are sourced from RainbowKit, with its license retained alongside the font license.

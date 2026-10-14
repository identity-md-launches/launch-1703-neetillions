# Website validation

Date: 2026-10-14. This is the implementing worker’s evidence, not independent certification.

## Scope and decisions

Single-page React / TypeScript / Vite site in `web/`, finished static export in `dist/`. Existing Solidity source, dependencies and build settings remain unchanged. The requested sentence and both exact token identities are preserved. The wallet uses the supplied Robinhood Chain facts; contracts are not redeployed. No real transaction, approval, buyback, burn or payout was sent.

The design applies the pinned Better Interface workflow and all six domain cores. Its house-and-sofa illustration, charcoal palette and lilac Buy action form one visual idea. The exact requested long headline overrides the design reference’s six-word marketing-headline guideline.

Two necessary factual distinctions are visible in the product:

1. There was no indexed $NEETHOME USD quote. The live pool/IMD reference supplies a USD value and full-supply market-cap estimate. The pool has no active liquidity at its current tick, so the card says **Reference**, **No active liquidity**, and **Market cap (est.)**. The methodology disclosure explains this is not an executable trading quote or a verified circulating cap.
2. The deployed ERC-20 does not implement the requested 50/40/10 distribution. The site explains that allocation as an intended policy. Fee generation is independently measured from the verified pool’s swaps; the page does not present that total as evidence of payouts.

## Requirement coverage

| Requirement | Implementation / result |
| --- | --- |
| Exact prominent sentence | `App.tsx:48`; verified exact DOM text in interaction tests |
| $NEETHOME is on Robinhood Chain | Hero, token card, address row and wallet network UI |
| Both USD prices and market caps | 30-second live requests; $NEET indexed quote, $NEETHOME on-chain reference/estimate fallback; source and stale states |
| Total fees generated | Full launch-pool history verified from initialization, refreshes every 60 seconds, USD conversion and estimation labels; no partial totals |
| Exact contract and copy | Full visible/wrapping address; real clipboard success manually checked; failure fallback tested |
| 50% / 40% / 10% mechanism | Allocation bar, labeled percentages and explicit intended-policy disclosure |
| Wallet connection | Named EIP-6963 providers, four phone links, Coinbase Wallet/Smart Wallet; connection, rejection, network switch/add, balance, watchAsset, disconnect tested with provider fixtures |
| Buy / Sell / Explorer | Correct trade direction and chain in Uniswap URLs, exact required Blockscout and Solscan links; opens external site in a new tab |
| Mobile first screen | At 390×844, exact headline, Buy/Sell and $NEETHOME product card visible; screenshot inspected |
| Static export and source/lockfile | `dist/index.html`, local runtime assets, `web/src/`, `web/package.json`, `web/package-lock.json`; relative asset URLs |
| Link sharing | Title, description, favicon, `og:title`, 1200×630 local PNG `og:image`, Twitter card; files load under a subpath |
| Documentation | Root README install/preview/rebuild commands, root DESIGN.md, this evidence record |

## Commands and observed results

| Check | Result |
| --- | --- |
| `forge inspect Neetillions abi --json --out test/scratch/forge-out --cache-path test/scratch/forge-cache` | Passed; ABI derived from the unchanged pinned source |
| `node web/scripts/check-provenance.mjs` (also runs in build) | Canonical Keccak matches `0xb48adcbf1a0e9b355d85120282552da2aa95ef6406529af056dbad779f13dccb` |
| `npm --prefix web run typecheck` | Passed, exit 0, TypeScript strict mode |
| `npm --prefix web test` | Passed: 10 tests, 0 failures |
| `npm --prefix web run build` | Passed, exit 0; Vite production export, local assets and relative base |
| `npm --prefix web run share` | Passed; actual 1200×630 PNG generated from local HTML and font |
| `NEETHOME_WEBKIT_EXECUTABLE=/tmp/neethome-webkit-run.sh npm --prefix web run test:browser` | Passed, exit 0: **22 interaction groups**, 11 each in Chromium and WebKit; production export at `/preview/` with explicit API/provider fixtures |
| Pinned `taste.mjs --out test/scratch/taste` | **15/16 raw checks passed**; single confirmed false positive described below |
| Live production browser | Actual public API/RPC reads, address copying, modal opening/closing, keyboard focus and desktop/mobile screenshots; no site console errors or missing local resources in the final inspected session |
| `git diff --check` | Passed |

Build warnings: wallet dependencies contain Rollup PURE-comment annotations that are removed during bundling. One minified chunk is about 606 kB (about 188 kB gzip), above Vite’s advisory 500 kB threshold. The entire export is about 1.45 MB uncompressed, including required wallet SDK chunks. No build errors were suppressed.

The browser groups exercise: live-adapter fixture results; responsive widths 320/390/620/900/1440; visible mobile product/action; clipboard success/failure; fee disclosure; exact trading and explorer destinations; wallet dialog and focus return; 30-second auto-refresh using an advanced test clock; retained stale price and retry recovery; fee-history failure/stale recovery; zero axe violations on page and dialog; reduced motion; 200% text enlargement; RTL reflow; zero script/local resource errors; EIP-6963 discovery; generic-row suppression; rejection/retry; wrong chain and 4902 add-chain fallback; balance; add-token; disconnect; and mobile wallet links/marks/row heights.

Fixtures are confined to tests and never imported by the site. No fixture price, connected account or seeded fee value is served as real data.

## Live data evidence

The assigned browser can access public RPC/data services that returned HTTP 403 to some shell probes. Successful browser reads verified:

- Chain ID `0x1237` (4663), nonempty token runtime code and on-chain total supply `1000000000000000000000000000`.
- Pool key computed to `0xd0294d1e511ef2168fd0e1562a85364b228ec43906c2e7aa642e3a5e282f883c`.
- Successful deployment receipt at block 88157730, with the exact pool’s matching `Initialize` event, currencies, 12500 fee, 60 tick spacing and supplied hook.
- `getSlot0`, `getLiquidity`, `totalSupply`, IMD/USD and $NEET/USD fetches. The observed pool had zero active liquidity; the UI correctly labeled its reference price.
- The official RPC returned a complete empty `Swap` log result from initialization through the scanned head, so the measured launch-pool swap fees were **$0.00**, with the through-block printed on the page (for example 88,192,262 during inspection). That zero is computed after verifying history, not a fallback for unavailable data.

The publicnode endpoint rejected archive requests as requiring a personal token. The implementation uses the supplied official endpoint first for historical reads and needs no token. No requester credentials were requested or invented.

The Uniswap destination itself loaded, but its backend RPC requests returned 401 and its telemetry requests failed CORS in this environment. The correct `robinhood` URL slug was checked against Uniswap’s chain metadata. Token preselection and a live executable trade could not be validated end-to-end on that external service. This is reported separately from local URL/interaction checks.

## Better Interface six-domain review

| Domain | Coverage and evidence |
| --- | --- |
| Accessibility | Checked native landmarks/controls, exact accessible names, skip link, visible 2px focus rings, modal Tab cycle and focus return, Escape/backdrop close, live status messages, copy failure, target sizes, reduced motion and 200% text enlargement. Axe: zero violations for page and dialog in Chromium and WebKit. Screen-reader session, native browser zoom and physical device use were not performed. |
| Layout | Checked actual export under a subpath at 320/390/620/900/1440, no horizontal overflow, mobile first-screen product/action, address wrapping, dialog bottom sheet, desktop columns and RTL reflow. Text-enlargement overflow found and fixed. No localization product variant was requested; translated copy was not tested. |
| Writing | Checked headline verbatim, chain names, action labels, data source/time, clear errors/retry, truthful price/reference/estimate/stale wording, and policy vs on-chain behavior. The long exact headline is an explicit brief override. |
| Typography | Inspected local Manrope rendering, 400/600 weights, at most six sizes, restrained display tracking, tabular numbers, headline/address wrapping and selectable complete values. No font/image/CDN dependency is needed for page layout. |
| Colors | Measured actual rendered text/background pairs with the probe; all met 4.5:1 or 3:1 for large text. Explicit token calculations are in DESIGN.md. Focus ring visually inspected; statuses also have text. Dark-only brief makes light-theme checks not applicable. |
| UI details | Checked button rest/hover/pressed/focus/disabled states, loading/empty/error/stale/retry, clipboard confirmation, modal pending/error states, bundled vendor icons and reduced-motion behavior. No continuous animation, cards within cards, gradient text, or shadow+border depth treatment. Slow-motion animation replay is not applicable to this static interface. |

## Findings, fixes and rechecks

1. **High — modal keyboard focus could leave the dialog.** `web/src/Wallet.tsx:78`, native dialog initially allowed the final Tab to move focus away. Reproduction: 390px, open Connect, repeatedly press Tab. An explicit first/last focus cycle and immediate close/focus-return were added. Both engines’ six-Tab cycle, Escape return and backdrop dismissal now pass; modal axe has zero violations.
2. **High — 200% text enlargement overflow.** `web/src/styles.css:71` and the mobile `.trade-actions` rule. The Reference label’s right edge reached 458.73px on a 390px page, and Sell reached 396.05px. Token headers and mobile actions now wrap; mobile data fields also reflow. Recheck: full page right edge equals 390px at 200% text, with no overflow in the browser test.
3. **Medium — third-party wallet link ambiguity.** `web/src/open-in.ts:4`, the abbreviated pinned guide omitted Rabby’s command/query format. Verified its published mobile handler, then used `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=…`. Encoding/subpath preservation is unit tested. Physical app handoff remains untested.
4. **Medium — indexed-price absence could hide useful live state.** `web/src/market.ts:66` and `web/src/chain-data.ts:41`. DEX Screener returned no $NEETHOME pair and Blockscout returned null price/cap. Added the verified pool plus IMD/USD reference path. Rechecked against actual browser RPC responses; zero active liquidity is explicitly identified, and cap is labeled estimated.
5. **Medium — a fee total must not imply fee distributions.** `web/src/Fees.tsx:11`, `web/src/App.tsx:59`. Added full-history verification, strict event decoding, visible through-block/count, timeout/range limits and stale/error states. Kept the requested allocation as intended policy because the deployed ERC-20 has no distribution logic. Unit tests cover signed inputs, duplicates and removed/wrong-pool events; browser tests cover verified zero and history failures.
6. **High — a live price split across lines at 390px.** `web/src/styles.css`, mobile `.token-values` rule. A fresh live quote changed from `$0.0000211` to `$0.00002107`; its last digit wrapped while the cap occupied the same row. Mobile prices now use a full-width row and the cap sits below. The interaction suite now explicitly rejects multi-line price values at every tested normal viewport.
7. **Probe false positive — header Connect is classified as an eyebrow.** `web/src/Wallet.tsx:74`, `web/src/styles.css:56`. The probe reports the small rounded header control within 40px above the headline at 390px. The screenshot shows a conventional right-aligned, working wallet utility, not a content kicker. Retained it because the connector requirement explicitly calls for this control. Raw result remains 15/16; it is not relabeled as a passing probe.

WebKit initially lacked system libraries and an EGL platform. Required Ubuntu libraries were downloaded and extracted only under `/tmp/neethome-webkit-libs/`, with a temporary wrapper selecting those libraries and Mesa’s software rendering. The provided browser binaries and system configuration were not modified. After that runtime repair, all WebKit groups passed. The wrapper path is a local validation aid; normal development machines can use Playwright’s documented browser/dependency installation and run the default test command.

No applicable unresolved high design defect remained after the fixes. Five controls are under the probe’s comfortable 44px target recommendation but pass its 24px/spacing rule; these are text links/disclosures, with separate spacing. Main actions and wallet rows meet 44px/48px sizes.

## Evidence and remaining limits

Temporary logs and probe screenshots are under `test/scratch/`, including `taste-final.json`, `typecheck-final.log`, `unit-tests-final.log`, `build-final.log`, `browsers-final.log`, and `taste/shots/`. This scratch directory is intentionally excluded from submission. Retained screenshots: [`mobile-390.png`](web/evidence/mobile-390.png) and [`desktop-1440.png`](web/evidence/desktop-1440.png). They were taken from the real production export after the final CSS fix, not the API fixtures.

Unperformed: physical phones, actual extension wallets, Coinbase passkey enrollment, real signing, funded swaps, screen-reader sessions and browser-native zoom. The fixture tests verify the website’s wallet integration and request parameters, not the vendors’ complete native applications. Fees are launch-pool gross estimates at current USD prices, excluding 12 newest blocks; they do not prove implementation of 50/40/10 payouts. The static site depends on public APIs/RPCs for dynamic data and exposes honest failure states.

## Completion

Complete for the stated website implementation scope, with the live-market and native-wallet limitations above. Final checks: production build and strict typecheck passed, 10 unit tests passed, 22 Chromium/WebKit interaction groups passed, and the pinned design probe scored 15/16 with one documented header-control false positive. No real transaction or on-chain change was made.

The durable validation report is at the repository root and its screenshots are in `web/evidence/`, so they are included in Git without changing the repository’s existing `artifacts/` exclusion.

## Final file budget

Production export: **1445388 bytes** across 14 files. Frontend source, assets, manifest, lockfile, tests and screenshot evidence: **688360 bytes**. Complete submitted file payload, including the unchanged original project: **3071588 bytes**, below **8,388,608 bytes**. No dependency directories, caches, package archives, submodules or browser traces are included. No ignore file was changed.

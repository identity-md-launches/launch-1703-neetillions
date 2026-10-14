# neetillions (NEETHOME)

A fixed-supply ERC-20 memecoin celebrating $NEET. The entire supply is minted once
to the immediate deployer in the constructor.


## Website

The dark, responsive $NEETHOME website is in `web/`, with its finished static export in `dist/`. It preserves the deployed token. No contract was deployed, replaced or modified for the site.

### Install, develop, preview and rebuild

Use Node.js 22.12+ (validated on Node 24.21.0) and npm. From the repository root:

```sh
npm --prefix web ci
npm --prefix web run dev
```

To regenerate and preview the production export:

```sh
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run preview -- --port 4173
```

Vite writes **`dist/` at the repository root**. Its base is `./`; scripts, CSS, font, favicon, wallet marks and the share image use relative paths. The production page was also checked under `/preview/`. Serve the entire `dist/` directory through HTTP(S); opening `index.html` as a `file:` URL does not support module loading. No backend, environment variables, private keys, relay or WalletConnect project ID is needed.

A build checks the derived Neetillions ABI against the deployment’s canonical Keccak hash before typechecking and bundling. Public deployment facts are preserved in `web/src/deployment.json`, so the build does not depend on the temporary `.imd/reads/` inputs. The exact source ABI is in `web/src/Neetillions.abi.json`. Contract build configuration and Solidity dependencies are unchanged.

### What the website reads and does

- **$NEETHOME / Robinhood Chain (4663):** `0x66d0963f8a9af27b15028d84DA8A1792999A840f`.
- **$NEET / Solana:** `Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump`.
- Prices refresh every **30 seconds** in a visible tab, with a manual refresh and visible source/fetch time. DEX Screener pairs are filtered by exact token and chain, then ranked by liquidity. An absent market cap is never replaced by FDV.
- $NEETHOME first tries an indexed DEX Screener quote and Blockscout’s token data. Its fallback reads the pinned Uniswap v4 pool’s current `sqrtPriceX96`, liquidity and total supply from Robinhood Chain, then converts IMD into USD using IMD’s matching DEX Screener quote. Since both currencies have 18 decimals, `NEETHOME/USD = IMD/USD / (sqrtPriceX96 / 2^96)^2`. The supply-based cap is explicitly estimated. A pool without active liquidity shows a **reference** price rather than claiming a traded quote.
- Fees refresh every **60 seconds**. The reader verifies chain, successful launch receipt and matching `Initialize` event, then requests every `Swap` log from block **88157730** through head minus 12 blocks. It splits rejected/large ranges, rejects duplicate or malformed logs and never publishes a partial history. Each negative input delta is multiplied by the event’s fee / 1,000,000. Fees in IMD and NEETHOME are marked to current USD prices. Nonzero totals are labeled estimates because swap-step rounding can differ and this is current valuation, not historic USD revenue. Gas, donations, other pools and payouts are excluded. A 45-second / 64-range budget bounds a scan; larger or unavailable histories display an error and retry. A public indexer would be needed if future history exceeds these limits.
- Buy/Sell links open **Uniswap** on Robinhood Chain with the verified IMD/NEETHOME direction selected in the URL. The site itself sends no approvals or swaps. Uniswap supplies the executable quote and asks for its own wallet connection; execution depends on its service and available liquidity.
- Wallet support: EIP-6963 named browser providers, mobile links for MetaMask/Coinbase/Rabby/Phantom, and Coinbase Smart Wallet, behind one connect control. Connected users can read their balance, switch/add the pinned chain, add the token to their wallet, and disconnect. Connection does not sign a transaction. Wallet reconnect uses wagmi’s local connection storage.
- The **50% buy $NEET / 40% burn / 10% dev** split is shown as the requested intended policy. The deployed fixed-supply token has no transfer tax, automatic fee distributor or burn entrypoint. The site does not claim that buybacks, burns or dev payouts have occurred.

During the live browser check on 2026-10-14, both USD displays loaded, the launch pool had zero active liquidity at its current tick, and the full-history query found **0 swaps**, yielding a measured **$0.00** in swap fees. These values are fetched at runtime, not seeded into the export. Failed refreshes retain the last known value with a stale label; first-load failures show unavailable states, never invented prices or zeros.

### Validation

```sh
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web test
# Install these browsers on a development machine if absent:
(cd web && npx playwright install chromium webkit)
npm --prefix web run test:browser
```

`web/tests/browser.mjs` serves the actual export at a gateway-like subpath, uses explicit API and EIP-6963 fixtures, and checks primary interactions in Chromium and WebKit without signing or sending transactions. It writes temporary evidence only to `test/scratch/interaction/`. The unit suite checks token/chain filtering, unavailable data, reference-price math, fee decoding, duplicate/reorg rejection and mobile URL encoding.

The final production build and typecheck passed, all 10 unit tests passed, and all 22 browser interaction groups passed across Chromium and WebKit. The pinned design probe passed 15 of 16 raw checks; its one header-wallet false positive is documented. Actual results and remaining limitations are recorded in [`VALIDATION.md`](VALIDATION.md). The implemented design, responsive rules and six-domain review are documented in [`DESIGN.md`](DESIGN.md) and the validation record. These are worker-side checks, not an independent certification.

The local font, favicon, original house illustration, wallet marks and 1200×630 PNG share card are included. To regenerate the share card from its local HTML source, run `npm --prefix web run share`, then rebuild. Its generator uses Playwright Chromium. Licenses and attribution are retained under `web/licenses/`.

### Delivery size and dependencies

Deliver the source, `web/package.json`, `web/package-lock.json`, documentation and **all of `dist/`**. Do not submit `web/node_modules/`, browser downloads, npm caches, test scratch output or package archives. Dependencies installed for checks are removed from this delivery; use `npm ci` to restore them. No ignore files or existing build/dependency files were changed. The submission is checked against the 8 MiB limit in the validation record.

### Reference sources

- [DEX Screener API](https://docs.dexscreener.com/api/reference): token-pair quotes and liquidity/market-cap fields.
- [Uniswap v4 PoolManager interface](https://github.com/Uniswap/v4-core/blob/main/src/interfaces/IPoolManager.sol): pool initialization and swap event definitions.
- [Uniswap chain metadata](https://github.com/Uniswap/interface/blob/main/packages/chains/src/chainMetadata/chainMetadata.ts): the Robinhood URL slug.
- [Robinhood Chain support](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet/): public chain information, consistent with the supplied network facts.
- [Rabby mobile universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts): `_cmd=open-dapp&dapp=`. The other wallet URLs follow the pinned connector reference.

---

The original contract documentation follows.

## Contract and behavior

| Parameter | Value |
| --- | --- |
| Solidity contract | `Neetillions` |
| Source | `src/Neetillions.sol` |
| Name | `neetillions` |
| Symbol | `NEETHOME` |
| Decimals | `18` |
| Whole-token supply | `1,000,000,000` |
| Base-unit supply | `1000000000000000000000000000` (`10^27`) |
| Constructor arguments | None (`[]`; ABI-encoded arguments are empty) |
| Initial recipient | Constructor `msg.sender` |

`Neetillions` inherits the vendored OpenZeppelin ERC-20 implementation. Its only
custom behavior is the constructor mint and the named `INITIAL_SUPPLY` constant.
Metadata and supply cannot be changed after deployment. There is no owner, minter,
proxy, initializer, pause, blacklist, seizure, tax, rebase, burn entrypoint, or
application contract. The token does not call outside contracts, consult an oracle,
or depend on time, block numbers, chain-specific precompiles, or network services.

Transfers deliver their full amount and return `true`. Invalid actions revert with
OpenZeppelin's ERC-6093 custom errors. Zero-value transfers to a nonzero address and
self-transfers are supported. Transfers to the zero address and approvals to a
zero spender revert. `approve` replaces the allowance; `transferFrom` consumes a
finite allowance, while `type(uint256).max` remains an unlimited allowance. The
deployer has no special spending privileges after the mint. `transferFrom` needs
an allowance even if its caller is the token holder.

Minting and transfers emit `Transfer`; explicit approvals emit `Approval`.
OpenZeppelin v5 does not emit an additional `Approval` when `transferFrom` spends
an allowance. Integrations should query `allowance` for its current value.

Assumptions: the brief requests ordinary ERC-20 transfers, with no additional
tokenomics or administrative features. The $NEET reference is descriptive; the
contract has no dependency on another token or entitlement to its assets.

## Reproducible build and checks

Use Foundry with Solidity **0.8.26**. The root `foundry.toml` pins the compiler,
Cancun EVM target, optimizer (200 runs), and `bytecode_hash = "none"`. FFI and
filesystem cheatcode permissions are disabled. No compiler binary is vendored.

```sh
forge build
FOUNDRY_FUZZ_SEED=0x84a9a9d761e03ccd2372a2fa0784a61c64aeaddf046f04fb0b0ab9fb0cdb69ae forge test
forge fmt --check
```

All Solidity dependencies and their licenses are ordinary files under `lib/`;
there are no submodules or dependency-install steps. A verifier with Foundry and
the pinned compiler already installed can build without network access.
`dependencies.json` records the exact upstream commits:

- OpenZeppelin Contracts v5.4.0: only ERC20 and its four required Solidity imports,
  plus its MIT license.
- forge-std v1.9.7: test support sources and its MIT/Apache licenses.

Tests do not require environment variables, an RPC, wallets, or files from `.imd/`.
The fuzz seed above is an optional runner setting, not a value read by any test.
The suite covers metadata, a single mint event, complete deployer allocation,
CREATE2 factory deployment, exact transfers, approval replacement/revocation,
finite and infinite allowances, self/zero transfers, invalid addresses,
insufficient balances/allowances, atomic rollback on failure, absent privileged
entrypoints, rejected native-currency payments, and the runtime opcode/size floor.
Fuzz tests exercise amounts, recipients, and deployers (512 cases each). A stateful
invariant campaign (128 runs, 64 calls each) compares balances and allowances to
an independent model across transfers, approvals, delegated spending, and failed
overspends, and checks conservation of the fixed supply.

`test/LaunchFlows.t.sol` checks token delivery for the supplied 10% / 88% / 2%
allocation, distributor claims, and transfers into and out of a simulated pool
balance. That fixture does **not** implement pricing or execute Uniswap swaps.
The supplied protected checks require the network's factory, PoolManager,
liquidity helper, owner-check harness, and resolved launch manifest. Those are
separate launch-verifier inputs, not dependencies of this token project; full
pool initialization and swap admission remain the launch verifier's checks.

## Deployment handoff

The artifact is `out/Neetillions.sol/Neetillions.json`. The launch deployer uses its
creation bytecode with no appended constructor arguments and no native currency.
There are no linked libraries or other contracts to deploy. The factory must be
the immediate deploying address: it receives all `10^27` base units. Deploying
through a different helper would give that helper the entire supply instead.
The constructor makes no external calls and needs no pre-existing chain state.

These launch parameters are supplied by the assignment, not discovered onchain:

| Launch parameter | Supplied value |
| --- | --- |
| Chain | Robinhood Chain, chain ID `4663` |
| Paired asset | IMD, `0x5f7bb59365ce557c26dbcaa4ee9d39a4b95b7127`, 18 decimals |
| Pool fee | `12500` (1.25%) |
| Tick spacing | `60` |
| Initial price provenance | `79228162514264337593543950336` |
| `economics.poolBps` | `8800` |
| `economics.initialMarketCapWei` | `2500000000000000000000` |
| `economics.remainderTo` | `0x82c3817faf5f8376aa163fcf1f0eb1e40f4e0245` |

The factory and launch infrastructure distribute 100,000,000 tokens (10%) to
the swarm distributor, allocate 880,000,000 (88%) to pool seeding, and send the
20,000,000-token (2%) remainder to the supplied recipient. The token constructor
only mints; it performs none of these transfers itself. The deployer derives the
actual opening pool price from the supplied market cap, supply, and final token
address. No token-level fee or fee exemption is needed for any launch flow.

The separate manifest step writes `launch.json` after acceptance. Its token
contract identifier is `Neetillions`, its constructor argument list is empty,
and its application contract list is empty. This project does not create a
manifest or broadcast any transaction.

## After launch

There are no owner settings, initialization calls, keepers, or backend services
to configure. IMD's launch infrastructure is responsible for deployment,
distribution, pool creation/seeding, and the production integration checks.
The deployment operator should verify the source with the exact pinned build
settings, confirm chain/address and metadata, reconcile the constructor mint and
distribution events, and publish the verified token address.

Holders control their balances and approvals. Interfaces should display 18
decimals, require deliberate spender approvals, and account for the standard
ERC-20 allowance replacement race (revoke an existing allowance before granting
a changed one). Unlimited approvals authorize future spending until revoked.

The contract has no recovery or rescue mechanism. Native-currency sends normally
revert; forcibly sent currency, other assets, or NEETHOME sent to the token
contract itself cannot be recovered. Operators cannot freeze holders, reverse
transfers, change the supply, or upgrade the contract. Chain availability and
external pool/distributor behavior are outside this token's control.

The local checks and source review are not an independent security audit. The
network's independent review and protected launch integration checks remain
release responsibilities. Slither and Mythril were not run.

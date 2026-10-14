# neetillions (NEETHOME)

A fixed-supply ERC-20 memecoin celebrating $NEET. The entire supply is minted once
to the immediate deployer in the constructor.

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

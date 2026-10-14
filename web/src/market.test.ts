import test from 'node:test'
import assert from 'node:assert/strict'
import { selectPair, parseBlockscout, formatPrice } from './market'
import { HOME_ADDRESS, NEET_ADDRESS } from './config'
import { POOL_ID, SWAP_TOPIC, priceFromSqrt, sumSwapFees } from './chain-data'
import { encodeAbiParameters, parseAbiParameters, type Hex } from 'viem'
import facts from './deployment.json'
import { OPEN_IN } from './open-in'

const pair = (changes: Record<string, unknown> = {}) => ({ chainId: 'solana', baseToken: { address: NEET_ADDRESS }, priceUsd: '0.03174', marketCap: 31_735_574, liquidity: { usd: 1_851_208 }, ...changes })
test('quotes match the exact Solana mint and select the most liquid pool', () => {
  const data = { pairs: [pair({ priceUsd: '0.9', liquidity: { usd: 1 } }), pair(), pair({ baseToken: { address: NEET_ADDRESS.toUpperCase() }, liquidity: { usd: 9999999 } }), pair({ chainId: 'ethereum', liquidity: { usd: 99999999 } })] }
  assert.equal(selectPair(data, 'neet')?.price, .03174)
})
test('home quotes reject wrong chains and quote-token matches', () => {
  assert.equal(selectPair({ pairs: [pair({ chainId: 'ethereum', baseToken: { address: HOME_ADDRESS } })] }, 'home'), null)
  assert.equal(selectPair({ pairs: [pair({ chainId: 'robinhood', quoteToken: { address: HOME_ADDRESS } })] }, 'home'), null)
  assert.equal(selectPair({ pairs: [pair({ chainId: 'robinhood', baseToken: { address: HOME_ADDRESS.toLowerCase() } })] }, 'home')?.price, .03174)
})
test('unavailable prices and market caps cannot become zero or FDV', () => {
  for (const value of [null, undefined, '', 'NaN', 'Infinity', 0, -1, {}]) assert.equal(selectPair({ pairs: [pair({ priceUsd: value })] }, 'neet'), null)
  const quote = selectPair({ pairs: [pair({ marketCap: null, fdv: 99_000_000 })] }, 'neet')
  assert.equal(quote?.marketCap, null)
  assert.equal(selectPair({ pairs: null }, 'neet'), null)
  assert.equal(selectPair({ pairs: [null] }, 'neet'), null)
})
test('Blockscout fallback requires the exact deployed token', () => {
  assert.equal(parseBlockscout({ address_hash: HOME_ADDRESS, exchange_rate: '0.2', circulating_market_cap: null })?.marketCap, null)
  assert.equal(parseBlockscout({ address_hash: NEET_ADDRESS, exchange_rate: '0.2' }), null)
  assert.equal(parseBlockscout({ address_hash: HOME_ADDRESS, exchange_rate: null }), null)
})
test('pool currency ordering yields correct USD price and rejects missing prices', () => {
  assert.equal(priceFromSqrt(2n ** 96n, 8), 8)
  assert.equal(priceFromSqrt(2n * 2n ** 96n, 8), 2)
  assert.throws(() => priceFromSqrt(0n, 8))
  assert.throws(() => priceFromSqrt(1n, NaN))
})
test('tiny positive prices remain visibly nonzero', () => {
  assert.notEqual(formatPrice(.00000000002), '$0.00')
  assert.match(formatPrice(.00000000002), /e-/)
})
function swap(amount0: bigint, amount1: bigint, fee: number, index = 0) {
  return { address: facts.network.network.uniswapV4.poolManager,
    topics: [SWAP_TOPIC, POOL_ID, '0x' + '0'.repeat(64)] as [Hex, ...Hex[]],
    data: encodeAbiParameters(parseAbiParameters('int128, int128, uint160, uint128, int24, uint24'), [amount0, amount1, 2n ** 96n, 1n, 0, fee]),
    blockNumber: '0x1' as Hex, transactionHash: ('0x' + '1'.repeat(64)) as Hex, logIndex: `0x${index.toString(16)}` as Hex }
}
test('cumulative fee estimate uses the negative input, never the output', () => {
  const sums = sumSwapFees([swap(-1000n * 10n ** 18n, 900n * 10n ** 18n, 12500), swap(900n * 10n ** 18n, -1000n * 10n ** 18n, 12500, 1)])
  assert.equal(sums.fee0, 125n * 10n ** 17n)
  assert.equal(sums.fee1, 125n * 10n ** 17n)
  assert.equal(sums.swaps, 2)
})
test('fee parser rejects duplicate, removed and wrong-pool events', () => {
  const log = swap(-1000n, 800n, 12500)
  assert.throws(() => sumSwapFees([log, log]))
  assert.throws(() => sumSwapFees([{ ...log, removed: true }]))
  assert.throws(() => sumSwapFees([{ ...log, topics: [SWAP_TOPIC, SWAP_TOPIC, log.topics[2]] }]))
})
test('no swaps produces a real zero only after caller verifies full history', () => {
  assert.deepEqual(sumSwapFees([]), { fee0: 0n, fee1: 0n, swaps: 0 })
})
test('wallet links preserve a static gateway subpath and query string', () => {
  const url = 'https://example.org/ipfs/site/?a=1&b=two#markets'
  for (const wallet of OPEN_IN) {
    const link = new URL(wallet.href(url))
    assert.equal(link.protocol, 'https:')
    if (wallet.id === 'rabby') { assert.equal(link.searchParams.get('_cmd'), 'open-dapp'); assert.equal(link.searchParams.get('dapp'), url) }
    if (wallet.id === 'coinbase') assert.equal(link.searchParams.get('cb_url'), url)
    if (wallet.id === 'phantom') assert.equal(decodeURIComponent(link.pathname.replace('/ul/browse/', '')), url)
  }
})

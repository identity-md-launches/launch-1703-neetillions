import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, decodeEventLog, keccak256, parseAbi, parseAbiParameters, toHex, type Address, type Hex } from 'viem'
import facts from './deployment.json'
import tokenAbi from './Neetillions.abi.json'

const net = facts.network.network
const deployment = facts.deployment
const pool = deployment.poolKey
export const POOL_ID = keccak256(encodeAbiParameters(parseAbiParameters('address, address, uint24, int24, address'), [pool.currency0 as Address, pool.currency1 as Address, pool.fee, pool.tickSpacing, pool.hooks as Address]))
export const START_BLOCK = BigInt(deployment.contracts[0].blockNumber)
export const STATE_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
])
export const POOL_EVENTS = parseAbi([
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)',
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
])
export const SWAP_TOPIC = keccak256(new TextEncoder().encode('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)'))
// The official endpoint supports historical logs; the public endpoint is a live-state fallback.
export async function rpc<T>(method: string, params: unknown[], signal: AbortSignal): Promise<T> {
  for (const url of [...net.rpcUrls].reverse()) {
    if (signal.aborted) throw new Error('Request cancelled')
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      if (!response.ok) continue
      const data = await response.json()
      if (data.error || data.result == null) continue
      return data.result as T
    } catch { /* Try the other pinned endpoint. Never substitute fabricated data. */ }
  }
  throw new Error('Robinhood Chain is unavailable. Try refreshing.')
}
export function priceFromSqrt(sqrtPriceX96: bigint, imdUsd: number): number {
  if (sqrtPriceX96 <= 0n || !Number.isFinite(imdUsd) || imdUsd <= 0) throw new Error('Invalid pool price')
  // Both currencies have 18 decimals. Currency0 is IMD; currency1 is NEETHOME.
  const ratio = Number(sqrtPriceX96) / 2 ** 96
  const value = imdUsd / (ratio * ratio)
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid USD estimate')
  return value
}
export async function readPool(signal: AbortSignal) {
  const blockHex = await rpc<Hex>('eth_blockNumber', [], signal)
  const [chainHex, code, slot, liquidity, supplyHex] = await Promise.all([
    rpc<Hex>('eth_chainId', [], signal),
    rpc<Hex>('eth_getCode', [deployment.contracts[0].address, blockHex], signal),
    rpc<Hex>('eth_call', [{ to: net.uniswapV4.stateView, data: encodeFunctionData({ abi: STATE_ABI, functionName: 'getSlot0', args: [POOL_ID] }) }, blockHex], signal),
    rpc<Hex>('eth_call', [{ to: net.uniswapV4.stateView, data: encodeFunctionData({ abi: STATE_ABI, functionName: 'getLiquidity', args: [POOL_ID] }) }, blockHex], signal),
    rpc<Hex>('eth_call', [{ to: deployment.contracts[0].address, data: encodeFunctionData({ abi: tokenAbi, functionName: 'totalSupply' }) }, blockHex], signal),
  ])
  if (Number(BigInt(chainHex)) !== net.chainId || code === '0x' || code.length < 4) throw new Error('Could not verify the token on Robinhood Chain')
  const slot0 = decodeFunctionResult({ abi: STATE_ABI, functionName: 'getSlot0', data: slot })
  const activeLiquidity = decodeFunctionResult({ abi: STATE_ABI, functionName: 'getLiquidity', data: liquidity })
  if (slot0[3] !== pool.fee) throw new Error('Pool fee differs from deployment')
  const totalSupply = BigInt(supplyHex)
  if (totalSupply <= 0n) throw new Error('Supply is unavailable')
  return { sqrtPriceX96: slot0[0], totalSupply, activeLiquidity, blockNumber: BigInt(blockHex) }
}
type RpcLog = { address: string; topics: [Hex, ...Hex[]]; data: Hex; removed?: boolean; blockNumber: Hex; transactionHash: Hex; logIndex: Hex }
export type FeeTotals = { fee0: bigint; fee1: bigint; swaps: number; throughBlock: bigint; fetchedAt: number }
export function sumSwapFees(logs: RpcLog[]): { fee0: bigint; fee1: bigint; swaps: number } {
  let fee0 = 0n, fee1 = 0n
  const seen = new Set<string>()
  for (const log of logs) {
    if (log.removed || log.address.toLowerCase() !== net.uniswapV4.poolManager || log.topics[1] !== POOL_ID) throw new Error('Unexpected pool log')
    const key = `${log.transactionHash}:${log.logIndex}`
    if (seen.has(key)) throw new Error('Duplicate pool log')
    seen.add(key)
    const { args } = decodeEventLog({ abi: POOL_EVENTS, eventName: 'Swap', data: log.data, topics: log.topics, strict: true })
    // v4 BalanceDelta is from the swapper's perspective: the input currency is negative.
    if (args.fee > 1_000_000 || (args.amount0 < 0n && args.amount1 < 0n)) throw new Error('Invalid swap amounts')
    if (args.amount0 < 0n) fee0 += (-args.amount0 * BigInt(args.fee)) / 1_000_000n
    if (args.amount1 < 0n) fee1 += (-args.amount1 * BigInt(args.fee)) / 1_000_000n
  }
  return { fee0, fee1, swaps: seen.size }
}
export async function fetchFees(signal: AbortSignal): Promise<FeeTotals> {
  const [chainHex, receipt, headHex] = await Promise.all([
    rpc<Hex>('eth_chainId', [], signal),
    rpc<{ status: Hex; blockNumber: Hex; logs: RpcLog[] }>('eth_getTransactionReceipt', [deployment.contracts[0].txHash], signal),
    rpc<Hex>('eth_blockNumber', [], signal),
  ])
  if (Number(BigInt(chainHex)) !== net.chainId || receipt.status !== '0x1' || BigInt(receipt.blockNumber) !== START_BLOCK) throw new Error('Pool history could not be verified')
  const init = receipt.logs.find(log => {
    if (log.address.toLowerCase() !== net.uniswapV4.poolManager || log.topics[1] !== POOL_ID) return false
    try {
      const event = decodeEventLog({ abi: POOL_EVENTS, eventName: 'Initialize', data: log.data, topics: log.topics, strict: true })
      return event.args.currency0.toLowerCase() === pool.currency0 && event.args.currency1.toLowerCase() === pool.currency1 && event.args.fee === pool.fee && event.args.tickSpacing === pool.tickSpacing && event.args.hooks.toLowerCase() === pool.hooks
    } catch { return false }
  })
  if (!init) throw new Error('Pool initialization could not be verified')
  // Leave 12 blocks for short reorgs. The scope and exact through-block are displayed.
  const throughBlock = BigInt(headHex) - 12n
  if (throughBlock < START_BLOCK) throw new Error('Waiting for the launch block to settle')
  let calls = 0
  async function range(from: bigint, to: bigint): Promise<RpcLog[]> {
    if (++calls > 64) throw new Error('Full fee history needs an indexer. No partial total is shown.')
    try {
      const logs = await rpc<RpcLog[]>('eth_getLogs', [{ address: net.uniswapV4.poolManager, fromBlock: toHex(from), toBlock: toHex(to), topics: [SWAP_TOPIC, POOL_ID] }], signal)
      if (!Array.isArray(logs)) throw new Error('Invalid logs response')
      // Split at common log caps so a truncated page cannot become a lifetime total.
      if (logs.length >= 1000) throw new Error('Log range too large')
      if (logs.some(log => BigInt(log.blockNumber) < from || BigInt(log.blockNumber) > to)) throw new Error('Logs outside requested range')
      return logs
    } catch (error) {
      if (signal.aborted || from >= to || calls >= 64) throw error
      const middle = (from + to) / 2n
      return [...await range(from, middle), ...await range(middle + 1n, to)]
    }
  }
  const logs = await range(START_BLOCK, throughBlock)
  return { ...sumSwapFees(logs), throughBlock, fetchedAt: Date.now() }
}

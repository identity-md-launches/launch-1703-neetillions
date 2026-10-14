import { useQuery } from '@tanstack/react-query'
import { HOME_ADDRESS, NEET_ADDRESS } from './config'
import facts from './deployment.json'
import { priceFromSqrt, readPool } from './chain-data'

export type TokenKind = 'home' | 'neet'
export type Quote = {
  price: number | null
  marketCap: number | null
  change: number | null
  fetchedAt: number
  source: 'DEX Screener' | 'Blockscout' | 'Pool + DEX Screener'
  estimated?: boolean
  hasActiveLiquidity?: boolean
  imdUsd?: number
  blockNumber?: bigint
}
type Pair = {
  chainId?: unknown
  baseToken?: { address?: unknown }
  priceUsd?: unknown
  marketCap?: unknown
  priceChange?: { h24?: unknown }
  liquidity?: { usd?: unknown }
}
const positive = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}
export function selectPair(payload: unknown, kind: TokenKind | 'imd'): Quote | null {
  if (!payload || typeof payload !== 'object') return null
  const pairs = (payload as { pairs?: unknown }).pairs
  if (!Array.isArray(pairs)) return null
  const matches = pairs.filter((p: Pair) => {
    if (!p || typeof p !== 'object' || typeof p.baseToken?.address !== 'string') return false
    return kind === 'neet'
      ? p.chainId === 'solana' && p.baseToken.address === NEET_ADDRESS
      : ['robinhood', 'robinhoodchain'].includes(String(p.chainId)) && p.baseToken.address.toLowerCase() === (kind === 'imd' ? facts.network.network.pairToken.address : HOME_ADDRESS.toLowerCase())
  }).filter((p: Pair) => positive(p.priceUsd) !== null)
    .sort((a: Pair, b: Pair) => (positive(b.liquidity?.usd) ?? 0) - (positive(a.liquidity?.usd) ?? 0))
  const pair: Pair | undefined = matches[0]
  if (!pair) return null
  return {
    price: positive(pair.priceUsd), marketCap: positive(pair.marketCap),
    change: typeof pair.priceChange?.h24 === 'number' && Number.isFinite(pair.priceChange.h24) ? pair.priceChange.h24 : null,
    fetchedAt: Date.now(), source: 'DEX Screener',
  }
}
export function parseBlockscout(payload: unknown): Quote | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.address_hash !== 'string' || p.address_hash.toLowerCase() !== HOME_ADDRESS.toLowerCase()) return null
  const price = positive(p.exchange_rate)
  if (!price) return null
  return { price, marketCap: positive(p.circulating_market_cap), change: null, fetchedAt: Date.now(), source: 'Blockscout' }
}
async function json(url: string, signal: AbortSignal): Promise<unknown> {
  const result = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), headers: { Accept: 'application/json' } })
  if (!result.ok) throw new Error(`Price source returned ${result.status}`)
  return result.json()
}
export async function fetchPoolQuote(signal: AbortSignal): Promise<Quote> {
  const [pool, payload] = await Promise.all([
    readPool(signal),
    json(`https://api.dexscreener.com/latest/dex/tokens/${facts.network.network.pairToken.address}`, signal),
  ])
  const imd = selectPair(payload, 'imd')
  if (!imd?.price) throw new Error('The IMD/USD reference price is unavailable. Try refreshing.')
  const price = priceFromSqrt(pool.sqrtPriceX96, imd.price)
  return { price, marketCap: price * Number(pool.totalSupply) / 10 ** facts.deployment.manifest.token.decimals, change: null, source: 'Pool + DEX Screener', fetchedAt: Date.now(), estimated: true, hasActiveLiquidity: pool.activeLiquidity > 0n, imdUsd: imd.price, blockNumber: pool.blockNumber }
}
export async function fetchQuote(kind: TokenKind, signal: AbortSignal): Promise<Quote> {
  const address = kind === 'home' ? HOME_ADDRESS : NEET_ADDRESS
  let responseFailed = false
  try {
    const pair = selectPair(await json(`https://api.dexscreener.com/latest/dex/tokens/${address}`, signal), kind)
    if (pair) return pair
  } catch { responseFailed = true }
  if (signal.aborted) throw new Error('Request cancelled')
  if (kind === 'home') {
    try {
      const quote = parseBlockscout(await json(`https://robinhoodchain.blockscout.com/api/v2/tokens/${HOME_ADDRESS}`, signal))
      if (quote) return quote
    } catch { responseFailed = true }
    return fetchPoolQuote(signal)
  }
  throw new Error(responseFailed ? 'Price sources are unavailable. Try refreshing.' : 'No USD price is indexed yet. Try again later.')
}
export function useQuote(kind: TokenKind) {
  return useQuery({
    queryKey: ['quote', kind], queryFn: ({ signal }) => fetchQuote(kind, signal),
    refetchInterval: 30_000, staleTime: 20_000, retry: 1, retryDelay: 1500,
    refetchIntervalInBackground: false,
  })
}
export function formatPrice(value: number): string {
  if (value < 0.000001) return `$${value.toPrecision(3)}`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 0.01 ? 8 : value < 1 ? 6 : 2 }).format(value)
}
export function formatCap(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

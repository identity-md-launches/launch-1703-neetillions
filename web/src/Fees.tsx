import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { fetchFees } from './chain-data'
import { fetchPoolQuote } from './market'
import { LINKS } from './config'
import { Icon } from './icons'

export function Fees({ now }: { now: number }) {
  const query = useQuery({
    queryKey: ['lifetime-pool-fees'],
    queryFn: async ({ signal }) => {
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(45_000)])
      const fees = await fetchFees(bounded)
      if (fees.fee0 === 0n && fees.fee1 === 0n) return { ...fees, usd: 0 }
      const quote = await fetchPoolQuote(bounded)
      if (!quote.imdUsd || !quote.price) throw new Error('USD conversion is unavailable')
      const usd = Number(formatUnits(fees.fee0, 18)) * quote.imdUsd + Number(formatUnits(fees.fee1, 18)) * quote.price
      if (!Number.isFinite(usd)) throw new Error('USD conversion is unavailable')
      return { ...fees, usd }
    }, staleTime: 45_000, refetchInterval: 60_000, retry: false,
  })
  const stale = !!query.data && (query.isError || now - query.data.fetchedAt > 120_000)
  const usd = query.data?.usd
  const amount = usd === undefined ? query.isFetching ? 'Checking history…' : 'Unavailable' : usd > 0 && usd < .01 ? '< $0.01' : usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <div className="fee-total" aria-busy={query.isFetching}>
    <h3>Total fees generated so far</h3>
    <p className="fee-amount">{amount}{usd !== undefined && <span>{query.data?.swaps ? 'USD · estimated' : 'USD'}</span>}</p>
    <p className="muted" role="status">{query.data ? <>{stale ? 'Stale total. ' : ''}{query.data.swaps.toLocaleString()} swaps in the launch pool.<br />Through block {query.data.throughBlock.toLocaleString()}.</> : query.isFetching ? 'Reading the launch pool’s full swap history.' : 'Full fee history could not be verified. Try again.'}</p>
    <div className="fee-source-actions"><a href={LINKS.homeExplorer} target="_blank" rel="noopener noreferrer" className="text-link">Check token activity <Icon name="arrow" width="16" height="16" /></a><button className="text-button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Checking' : 'Refresh fees'}</button></div>
  </div>
}

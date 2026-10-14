import { useEffect, useState } from 'react'
import { HOME_ADDRESS, LINKS } from './config'
import { useQuote, formatCap, formatPrice, type TokenKind } from './market'
import { HomeArt, Icon } from './icons'
import { Wallet } from './Wallet'
import { Fees } from './Fees'

function CopyAddress() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state !== 'copied') return
    const timeout = setTimeout(() => setState('idle'), 2500)
    return () => clearTimeout(timeout)
  }, [state])
  async function copy() {
    try { await navigator.clipboard.writeText(HOME_ADDRESS); setState('copied') }
    catch { setState('failed') }
  }
  return <div className="contract-section">
    <div className="contract-label"><span>$NEETHOME contract</span><span className="muted">Robinhood Chain</span></div>
    <div className="contract-row"><code>{HOME_ADDRESS}</code><button className="copy-button" onClick={() => void copy()} aria-label={state === 'copied' ? 'Address copied' : 'Copy $NEETHOME contract address'}><Icon name={state === 'copied' ? 'check' : 'copy'} /><span>{state === 'copied' ? 'Copied' : 'Copy'}</span></button></div>
    <span className={state === 'failed' ? 'copy-error' : 'sr-only'} role="status">{state === 'copied' ? 'Contract address copied to clipboard.' : state === 'failed' ? 'Copy unavailable. Select the full address above and copy it manually.' : ''}</span>
  </div>
}
function TokenCard({ kind, now }: { kind: TokenKind; now: number }) {
  const query = useQuote(kind)
  const data = query.data
  const home = kind === 'home'
  const stale = !!data && (query.isError || now - data.fetchedAt > 90_000)
  const stateLabel = stale ? 'Last known price' : data ? 'Latest quote' : query.isFetching ? 'Fetching price' : 'Price unavailable'
  return <article className={`token-card ${home ? 'home-token' : 'neet-token'}`} aria-labelledby={`${kind}-title`}>
    <div className="token-heading"><div className={`token-mark ${home ? 'home-mark' : 'neet-mark'}`} aria-hidden="true">{home ? <Icon name="home" width="28" height="28" /> : <svg viewBox="0 0 32 32" width="30" height="30" fill="none"><path d="M5 16C5 6 27 6 27 16v5c0 9-22 9-22 0Z" fill="#bed8c3"/><path d="m9 17 5 1m4 0 5-1m-10 7h6" stroke="#253c2b" strokeWidth="2" strokeLinecap="round"/></svg>}</div><div><h2 id={`${kind}-title`}>{home ? '$NEETHOME' : '$NEET'}</h2><p className="network-label">{home ? 'Robinhood Chain' : 'Solana'}</p></div><span className={`quote-state ${data && !stale ? 'current' : ''}`} title={stateLabel}><span className="status-dot" />{data && !stale ? data.estimated && !data.hasActiveLiquidity ? 'Reference' : 'Live' : stale ? 'Stale' : query.isFetching ? 'Loading' : 'No feed'}</span></div>
    <dl className="token-values"><div className="price-field"><dt>Price <span className="muted">USD{data?.estimated ? data.hasActiveLiquidity ? ' · spot' : ' · reference' : ''}</span></dt><dd className={`price ${!data ? 'empty-value' : ''}`}>{data?.price ? formatPrice(data.price) : <span aria-label={stateLabel}>—</span>}</dd></div><div className="cap-field"><dt>Market cap{data?.estimated ? ' (est.)' : ''}</dt><dd title={data?.marketCap?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}>{data?.marketCap ? formatCap(data.marketCap) : <span className="muted">Unavailable</span>}</dd></div></dl>
    <div className="quote-detail">{data?.change != null ? <span className={data.change >= 0 ? 'positive' : 'negative'}>{data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}% <span className="muted">24h</span></span> : <span className="muted">{home ? data?.estimated && !data.hasActiveLiquidity ? 'No active liquidity' : 'neetillions' : 'The original chill coin'}</span>}<a className="text-link" href={home ? LINKS.homeExplorer : LINKS.neetExplorer} target="_blank" rel="noopener noreferrer" aria-label={`View ${home ? '$NEETHOME' : '$NEET'} on ${home ? 'Explorer' : 'Solscan'} (opens in a new tab)`}>{home ? 'View on Explorer' : 'View on Solscan'}<Icon name="arrow" width="16" height="16" /></a></div>
    <div className="price-status" role="status">{data ? <><span>{stale ? 'Stale quote. ' : ''}{data.source} · fetched <time dateTime={new Date(data.fetchedAt).toISOString()}>{new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></span>{stale && <button className="text-button" onClick={() => void query.refetch()} disabled={query.isFetching}>Retry</button>}</> : <span>{query.isFetching ? 'Checking the latest market data…' : query.error?.message}</span>}</div>
  </article>
}
export function App() {
  const [now, setNow] = useState(Date.now())
  const home = useQuote('home')
  const neet = useQuote('neet')
  const refreshing = home.isFetching || neet.isFetching
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(interval) }, [])
  return <div className="site-shell" id="top">
    <a href="#markets" className="skip-link">Skip to token prices</a>
    <header className="site-header"><a className="wordmark" href="#top" aria-label="$NEETHOME home"><span className="brand-symbol"><Icon name="home" width="24" height="24" /></span><span>neethome<span className="wordmark-dot">.</span></span></a><Wallet /></header>
    <main>
      <section className="intro" aria-labelledby="headline"><div><h1 id="headline">A shitcoin to celebrate the most chill memecoin ever: <span>$NEET</span></h1><p>A little home for $NEET. On Robinhood Chain.</p></div><HomeArt /></section>
      <section id="markets" className="markets" aria-label="Token prices and trading">
        <div className="market-toolbar"><span><span className="status-dot" />Market watch <span className="muted refresh-label">· refreshes every 30s</span></span><button className="refresh-button" disabled={refreshing} onClick={() => { void home.refetch(); void neet.refetch() }} aria-label="Refresh token prices"><Icon name="refresh" width="16" height="16" /><span>{refreshing ? 'Refreshing' : 'Refresh'}</span></button></div>
        <div className="token-grid"><TokenCard kind="home" now={now} /><TokenCard kind="neet" now={now} /></div>
        <div className="trade-row"><div className="trade-actions"><a className="button primary" href={LINKS.buy} target="_blank" rel="noopener noreferrer">Buy $NEETHOME <Icon name="arrow" /></a><a className="button" href={LINKS.sell} target="_blank" rel="noopener noreferrer">Sell <Icon name="arrow" width="16" height="16" /></a></div><p className="trade-note">Trade on Uniswap <span className="muted">· opens in a new tab</span></p></div>
      </section>
      <details className="data-details"><summary>Price sources &amp; estimates</summary><p>Quotes refresh every 30 seconds while this tab is visible. $NEET uses the most liquid matching DEX Screener pair. $NEETHOME uses a matching indexed quote when available; otherwise its live IMD pool price is converted using IMD’s USD quote. The pool-based market cap is an estimate using the full on-chain supply, not independently verified circulating supply. An initialized pool with no active liquidity shows a reference price, not a traded quote. Pool prices are indicative; Uniswap gives the executable quote.</p></details>
      <CopyAddress />
      <section className="fees-section" aria-labelledby="fees-title"><div className="fees-intro"><h2 id="fees-title">Good fees. Chill intentions.</h2><p className="muted">The intended fee allocation keeps $NEET at the heart of it.</p></div>
        <div className="fee-layout"><div className="allocation"><div className="allocation-bar" aria-hidden="true"><span /><span /><span /></div><dl className="allocation-list"><div><dt><Icon name="leaf" /><span>Buy $NEET on Solana</span></dt><dd>50<span>%</span></dd></div><div><dt><Icon name="fire" /><span>Burn fees</span></dt><dd>40<span>%</span></dd></div><div><dt><Icon name="code" /><span>To the dev</span></dt><dd>10<span>%</span></dd></div></dl></div>
        <Fees now={now} /></div>
        <details className="fee-details"><summary>How does the fee allocation work?</summary><div><p>The intended split is 50% of fees used to buy $NEET on Solana, 40% of fees burned, and 10% sent to the dev.</p><p>The deployed $NEETHOME token has no transfer tax, burn function or automatic fee distributor. Its IMD trading pool has a 1.25% swap fee. The allocation above is a stated policy, not a verified automatic mechanism. Buybacks, burns and dev payments have not been verified here.</p><p>The fee total covers every swap in the launch pool from its verified initialization, excluding the newest 12 blocks. It estimates gross swap fees from each swap’s input and fee rate, valued at current USD prices. It is not a record of distributed fees. Network gas, other pools and donations are excluded; incomplete history is never shown as a total.</p></div></details>
      </section>
    </main>
    <footer><span className="footer-brand"><Icon name="home" />Make yourself at home.</span><nav aria-label="Token explorers"><a href={LINKS.homeExplorer} target="_blank" rel="noopener noreferrer">$NEETHOME explorer <Icon name="arrow" width="16" height="16" /></a><a href={LINKS.neetExplorer} target="_blank" rel="noopener noreferrer">$NEET on Solscan <Icon name="arrow" width="16" height="16" /></a></nav></footer>
  </div>
}

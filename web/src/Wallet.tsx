import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, type Connector } from 'wagmi'
import { formatUnits, getAddress, type Abi, type EIP1193Provider } from 'viem'
import abi from './Neetillions.abi.json'
import { chain, TOKEN_ADDRESS, walletAddChain } from './config'
import { OPEN_IN, isMobileBrowser } from './open-in'
import { Icon } from './icons'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
export function Wallet() {
  const { address, isConnected, chainId, connector } = useAccount()
  const { connectors, connect, isPending, variables, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const client = usePublicClient({ chainId: chain.id })
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [switching, setSwitching] = useState(false)
  const [adding, setAdding] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const wrongChain = isConnected && chainId !== chain.id
  const verification = useQuery({
    queryKey: ['deployment-code', chain.id, TOKEN_ADDRESS],
    enabled: isConnected,
    queryFn: async () => {
      if (!client || await client.getChainId() !== chain.id) throw new Error('Unable to verify Robinhood Chain')
      const code = await client.getCode({ address: TOKEN_ADDRESS })
      if (!code || code === '0x') throw new Error('Unable to verify the token contract')
      return true
    }, staleTime: 60_000, retry: 1,
  })
  const balance = useReadContract({
    abi: abi as Abi, address: TOKEN_ADDRESS, functionName: 'balanceOf', args: address ? [address] : undefined,
    chainId: chain.id, query: { enabled: !!address && verification.data === true, refetchInterval: 30_000 },
  })
  useEffect(() => {
    if (open) { dialog.current?.showModal(); document.body.style.overflow = 'hidden' }
    else { dialog.current?.close(); document.body.style.overflow = '' }
    return () => { document.body.style.overflow = '' }
  }, [open])
  useEffect(() => { if (isConnected) setOpen(false) }, [isConnected])
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus() }
  const named = connectors.some(c => c.type === 'injected' && c.id !== 'injected')
  const mobile = isMobileBrowser() && !named
  const listed = [...connectors.filter(c => c.type === 'injected'), ...connectors.filter(c => c.type !== 'injected')]
    .filter(c => !(c.id === 'injected' && named) && (!mobile || c.type !== 'injected'))
  const label = (c: Connector) => c.id === 'injected' ? 'Browser wallet' : c.id === 'coinbaseWalletSDK' ? (mobile ? 'Coinbase Smart Wallet' : 'Coinbase Wallet') : c.name
  async function switchChain() {
    if (!connector) return
    setMessage(''); setSwitching(true)
    try {
      const provider = await connector.getProvider() as EIP1193Provider
      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: walletAddChain.chainId }] }) }
      catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error
        await provider.request({ method: 'wallet_addEthereumChain', params: [walletAddChain] })
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: walletAddChain.chainId }] })
      }
    } catch { setMessage('Network switch was not completed. Try again in your wallet.') }
    finally { setSwitching(false) }
  }
  async function addToken() {
    if (!connector || wrongChain || !verification.data) return
    setMessage(''); setAdding(true)
    try {
      const provider = await connector.getProvider() as EIP1193Provider
      const added = await provider.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: TOKEN_ADDRESS, symbol: 'NEETHOME', decimals: 18 } } })
      setMessage(added ? '$NEETHOME added to your wallet.' : 'Token was not added. You can try again.')
    } catch { setMessage('Your wallet could not add this token. Copy its address from the page to add it manually.') }
    finally { setAdding(false) }
  }
  return <>
    <button ref={trigger} className="button wallet-button" onClick={() => { reset(); setMessage(''); setOpen(true) }}>
      <Icon name="wallet" />
      {wrongChain ? 'Switch to Robinhood Chain' : isConnected && address ? short(getAddress(address)) : 'Connect wallet'}
    </button>
    <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-heading" onCancel={close} onClose={() => setOpen(false)} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'))
      const first = targets[0], last = targets[targets.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }} onClick={event => {
      if (event.target === dialog.current) {
        const r = dialog.current.getBoundingClientRect()
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close()
      }
    }}>
      <div className="sheet-head"><h2 id="wallet-heading">{isConnected ? 'Your wallet' : 'Connect a wallet'}</h2><button className="icon-button" aria-label="Close wallet dialog" onClick={close}><Icon name="close" /></button></div>
      {isConnected && address ? <>
        <p className="muted">{wrongChain ? 'Switch networks to use $NEETHOME.' : 'Connected to Robinhood Chain'}</p>
        <code className="account-address">{getAddress(address)}</code>
        <div className="balance-row"><span>$NEETHOME balance</span><strong>{typeof balance.data === 'bigint' ? Number(formatUnits(balance.data, 18)).toLocaleString('en-US', { maximumFractionDigits: 4 }) : balance.isError || verification.isError ? 'Unavailable' : 'Loading…'}</strong></div>
        {(balance.isError || verification.isError) && <button className="text-button" onClick={() => { void verification.refetch(); void balance.refetch() }}>Retry balance</button>}
        {wrongChain ? <button className="button primary full" disabled={switching} onClick={() => void switchChain()}>{switching ? 'Switching…' : 'Switch to Robinhood Chain'}</button> : <button className="button full" disabled={!verification.data || adding} onClick={() => void addToken()}>{adding ? 'Adding token…' : 'Add $NEETHOME to wallet'}</button>}
        <button className="button full disconnect" onClick={() => { disconnect(); close() }}>Disconnect</button>
      </> : <>
        <p className="muted sheet-description">A little closer to home. Choose a wallet to connect on Robinhood Chain.</p>
        <div className="wallet-options">
          {mobile && OPEN_IN.map(wallet => <a key={wallet.id} className="wallet-row" href={wallet.href(location.href)}><img src={`./wallets/${wallet.id}.svg`} width="28" height="28" alt="" /><span>Open in {wallet.name}</span><Icon name="arrow" /></a>)}
          {listed.map(c => <button key={c.uid} className="wallet-row" disabled={isPending} onClick={() => {
            setMessage('')
            connect({ connector: c }, { onError: () => setMessage('Connection was not completed. Unlock your wallet and try again.') })
          }}>
            {c.icon || c.id === 'coinbaseWalletSDK' ? <img width="28" height="28" src={c.icon ?? './wallets/coinbase.svg'} alt="" /> : <Icon name="wallet" width="28" height="28" />}
            <span>{label(c)}{isPending && variables?.connector === c ? ' · opening…' : ''}</span><Icon name="chevron" />
          </button>)}
        </div>
        <p className="sheet-note muted">Connecting doesn’t move your funds.</p>
      </>}
      <p className="wallet-message" role="status">{message}</p>
    </dialog>
  </>
}

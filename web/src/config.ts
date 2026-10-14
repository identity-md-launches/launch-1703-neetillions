import { defineChain, type Address } from 'viem'
import { createConfig, http, fallback } from 'wagmi'
import { coinbaseWallet, injected } from 'wagmi/connectors'
import facts from './deployment.json'

// Display strings preserve the assignment's exact casing; addresses refer to the pinned deployment.
export const HOME_ADDRESS = '0x66d0963f8a9af27b15028d84DA8A1792999A840f' as const
export const NEET_ADDRESS = 'Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump' as const
export const TOKEN_ADDRESS = facts.deployment.contracts[0].address as Address
if (TOKEN_ADDRESS.toLowerCase() !== HOME_ADDRESS.toLowerCase()) throw new Error('Token address does not match deployment')

const net = facts.network.network
export const chain = defineChain({
  id: net.chainId,
  name: net.name,
  nativeCurrency: net.nativeCurrency,
  rpcUrls: { default: { http: net.rpcUrls } },
  blockExplorers: { default: { name: 'Robinhood Explorer', url: net.explorer } },
  testnet: net.testnet,
})
export const walletAddChain = facts.network.walletAddChain
export const config = createConfig({
  chains: [chain],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: '$NEETHOME', preference: 'all' })],
  transports: {
    [chain.id]: fallback(net.rpcUrls.map(url => http(url, { timeout: 10_000, retryCount: 0 }))),
  },
})

export const LINKS = {
  homeExplorer: `https://robinhoodchain.blockscout.com/token/${HOME_ADDRESS}`,
  neetExplorer: `https://solscan.io/token/${NEET_ADDRESS}`,
  homeMarket: `https://dexscreener.com/robinhood/${HOME_ADDRESS}`,
  neetMarket: `https://dexscreener.com/solana/${NEET_ADDRESS}`,
  buy: `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${net.pairToken.address}&outputCurrency=${HOME_ADDRESS}`,
  sell: `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${HOME_ADDRESS}&outputCurrency=${net.pairToken.address}`,
}

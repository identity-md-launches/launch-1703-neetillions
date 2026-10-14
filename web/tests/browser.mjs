import { chromium, webkit } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'
import { encodeAbiParameters, parseAbiParameters, encodeEventTopics, parseAbi, keccak256, toFunctionSelector } from 'viem'

const root = resolve(import.meta.dirname, '../../dist')
const output = resolve(import.meta.dirname, '../../test/scratch/interaction')
await mkdir(output, { recursive: true })
const facts = JSON.parse(await readFile(resolve(import.meta.dirname, '../src/deployment.json'), 'utf8'))
const net = facts.network.network, dep = facts.deployment, key = dep.poolKey
const home = '0x66d0963f8a9af27b15028d84DA8A1792999A840f', neet = 'Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump'
const poolId = keccak256(encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'), [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]))
const poolAbi = parseAbi(['event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)'])
const start = BigInt(dep.contracts[0].blockNumber), sqrt = 632n * 2n ** 96n
const init = { address: net.uniswapV4.poolManager,
  topics: encodeEventTopics({ abi: poolAbi, eventName: 'Initialize', args: { id: poolId, currency0: key.currency0, currency1: key.currency1 } }),
  data: encodeAbiParameters(parseAbiParameters('uint24,int24,address,uint160,int24'), [key.fee, key.tickSpacing, key.hooks, sqrt, 0]),
  blockNumber: `0x${start.toString(16)}`, logIndex: '0x0', transactionHash: dep.contracts[0].txHash }
const encodeUint = value => encodeAbiParameters(parseAbiParameters('uint256'), [value])
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://local').pathname)
  if (!path.startsWith('/preview/')) { res.writeHead(404); res.end(); return }
  const file = resolve(root, path.slice('/preview/'.length) || 'index.html')
  if (!file.startsWith(root + '/')) { res.writeHead(403); res.end(); return }
  try { const data = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(data) }
  catch { res.writeHead(404); res.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`, url = `${origin}/preview/`
const results = []
const check = (name, details = '') => { results.push({ name, passed: true, details }); console.log(`PASS ${name}${details ? ' · ' + details : ''}`) }
let browser
try {
  for (const [engine, type] of [['Chromium', chromium], ['WebKit', webkit]].filter(([name]) => !process.env.NEETHOME_BROWSER || name.toLowerCase() === process.env.NEETHOME_BROWSER)) {
    browser = await type.launch({ headless: true, ...(engine === 'WebKit' && process.env.NEETHOME_WEBKIT_EXECUTABLE ? { executablePath: process.env.NEETHOME_WEBKIT_EXECUTABLE } : {}) })
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const errors = [], missing = []
    let quotes = 0, failPrices = false, failHistory = false
    await context.route('**/*', async route => {
      const request = route.request(), target = new URL(request.url())
      if (target.origin === origin) return route.continue()
      const fulfill = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
      if (target.hostname === 'api.dexscreener.com') {
        quotes++
        if (failPrices) return route.fulfill({ status: 503, body: 'unavailable' })
        const address = target.pathname.split('/').pop()
        return fulfill({ pairs: address.toLowerCase() === home.toLowerCase() ? [] : [{ chainId: address === neet ? 'solana' : 'robinhood', baseToken: { address }, priceUsd: address === neet ? '0.03174' : '8.44', marketCap: 31735574, liquidity: { usd: 1851208 }, priceChange: { h24: 3.37 } }] })
      }
      if (target.hostname === 'robinhoodchain.blockscout.com') return fulfill({ address_hash: home, exchange_rate: null, circulating_market_cap: null })
      if (net.rpcUrls.some(endpoint => new URL(endpoint).hostname === target.hostname)) {
        const req = request.postDataJSON()
        const result = await (async () => {
          if (req.method === 'eth_chainId') return failHistory ? '0x1' : '0x1237'
          if (req.method === 'eth_blockNumber') return `0x${(start + 1200n).toString(16)}`
          if (req.method === 'eth_getCode') return '0x6001600055'
          if (req.method === 'eth_getTransactionReceipt') return { status: '0x1', blockNumber: `0x${start.toString(16)}`, logs: [init] }
          if (req.method === 'eth_getLogs') return []
          if (req.method === 'eth_call') {
            const data = req.params[0].data
            if (data.startsWith(toFunctionSelector('getSlot0(bytes32)'))) return encodeAbiParameters(parseAbiParameters('uint160,int24,uint24,uint24'), [sqrt, 0, 0, 12500])
            if (data.startsWith(toFunctionSelector('getLiquidity(bytes32)'))) return encodeUint(0n)
            if (data.startsWith('0x18160ddd')) return encodeUint(10n ** 27n)
            if (data.startsWith('0x70a08231')) return encodeUint(123n * 10n ** 18n)
          }
          throw new Error(`Unexpected mocked RPC ${req.method}`)
        })()
        return fulfill({ jsonrpc: '2.0', id: req.id, result })
      }
      if (/coinbase/.test(target.hostname)) return fulfill({})
      return route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) missing.push(response.url()) })
    await page.addInitScript(() => {
      // Clipboard behavior is tested without granting browser-specific OS permissions.
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { if (window.copyFails) throw new Error('Denied'); window.copiedValue = value } }, configurable: true })
    })
    await page.clock.install()
    await page.goto(url)
    await page.locator('.home-token .price').filter({ hasText: '$' }).waitFor()
    await page.locator('.neet-token .price').filter({ hasText: '$0.03174' }).waitFor()
    await page.locator('.fee-amount').filter({ hasText: '$0.00' }).waitFor()
    assert.match(await page.locator('.home-token').innerText(), /Reference/)
    assert.match(await page.locator('.home-token').innerText(), /No active liquidity/)
    assert.equal(await page.locator('h1').innerText(), 'A shitcoin to celebrate the most chill memecoin ever: $NEET')
    const share = await page.locator('meta[property="og:image"]').getAttribute('content')
    assert.equal((await fetch(new URL(share, url))).status, 200)
    const favicon = await page.locator('link[rel="icon"]').getAttribute('href')
    assert.equal((await fetch(new URL(favicon, url))).status, 200)
    check(`${engine}: live adapters render pool reference, supply estimate, token quote and verified fee zero`)
    for (const width of [320, 390, 620, 900, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`)
      for (const price of await page.locator('.price').all()) assert.ok(await price.evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1), `Price split across lines at ${width}px`)
      if (width === 390) {
        const buy = await page.getByRole('link', { name: 'Buy $NEETHOME', exact: true }).boundingBox()
        const product = await page.locator('.home-token').boundingBox()
        assert.ok(buy.y + buy.height < 844 && product.y < 844)
        await page.screenshot({ path: `${output}/${engine.toLowerCase()}-390-fixtures.png` })
      }
    }
    check(`${engine}: responsive widths 320, 390, 620, 900, 1440; mobile product and main action in first screen`)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Copy $NEETHOME contract address' }).click()
    assert.equal(await page.evaluate(() => window.copiedValue), home)
    await page.getByRole('button', { name: 'Address copied' }).waitFor()
    await page.evaluate(() => { window.copyFails = true })
    await page.getByRole('button', { name: 'Address copied' }).click()
    await page.getByText('Copy unavailable. Select the full address above and copy it manually.').waitFor()
    check(`${engine}: address copy success and recoverable clipboard failure`)
    await page.getByText('How does the fee allocation work?', { exact: true }).click()
    assert.equal(await page.locator('.fee-details').getAttribute('open'), '')
    assert.match(await page.locator('.fee-details').innerText(), /no transfer tax, burn function or automatic fee distributor/)
    for (const [name, input, output] of [['Buy $NEETHOME', net.pairToken.address, home], ['Sell', home, net.pairToken.address]]) {
      const link = page.getByRole('link', { name, exact: true })
      const href = new URL(await link.getAttribute('href'))
      assert.equal(href.hostname, 'app.uniswap.org'); assert.equal(href.searchParams.get('chain'), 'robinhood')
      assert.equal(href.searchParams.get('inputCurrency'), input); assert.equal(href.searchParams.get('outputCurrency'), output)
      assert.equal(await link.getAttribute('target'), '_blank')
    }
    assert.equal(await page.getByRole('link', { name: '$NEET on Solscan', exact: true }).getAttribute('href'), `https://solscan.io/token/${neet}`)
    check(`${engine}: fee disclosure and exact token, chain, buy/sell and explorer destinations`)
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', { name: 'Coinbase Wallet', exact: true }).waitFor()
    const dialogAxe = await new AxeBuilder({ page }).analyze()
    assert.deepEqual(dialogAxe.violations.map(v => `${v.id}: ${v.description}`), [])
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog'))) }
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Connect wallet')
    check(`${engine}: wallet dialog, keyboard focus trap/return, Escape, Coinbase entry and modal accessibility scan`)
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click()
    await page.mouse.click(5, 5)
    assert.equal(await page.getByRole('dialog').count(), 0)
    const beforeTimer = quotes
    const nextPoll = page.waitForResponse(response => response.url().includes(`/tokens/${neet}`))
    await page.clock.fastForward(31_000)
    await nextPoll
    await page.waitForFunction(() => !document.querySelector('.refresh-button').disabled)
    assert.ok(quotes > beforeTimer)
    check(`${engine}: 30-second auto-refresh runs with an advanced test clock`)
    const baseline = quotes
    await page.getByRole('button', { name: 'Refresh token prices' }).click()
    await page.waitForFunction(() => !document.querySelector('.refresh-button').disabled)
    assert.ok(quotes > baseline)
    failPrices = true
    await page.getByRole('button', { name: 'Refresh token prices' }).click()
    await page.locator('.neet-token .quote-state').filter({ hasText: 'Stale' }).waitFor({ timeout: 15000 })
    assert.match(await page.locator('.neet-token .price').innerText(), /0.03174/)
    failPrices = false
    await page.locator('.neet-token').getByRole('button', { name: 'Retry', exact: true }).click()
    await page.locator('.neet-token .quote-state').filter({ hasText: 'Live' }).waitFor()
    check(`${engine}: refresh fetches; failed refresh retains a labeled stale price; retry recovers`)
    failHistory = true
    await page.getByRole('button', { name: 'Refresh fees', exact: true }).click()
    await page.getByText('Stale total.', { exact: false }).waitFor()
    failHistory = false
    await page.getByRole('button', { name: 'Refresh fees', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.fee-total').innerText.includes('Stale total'))
    check(`${engine}: failed history never turns into a fabricated zero; cached total marked stale and retry recovers`)
    const axe = await new AxeBuilder({ page }).analyze()
    assert.deepEqual(axe.violations.map(v => `${v.id}: ${v.description}`), [])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await page.locator('.button.primary').evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; document.documentElement.dir = 'rtl' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(() => { document.documentElement.dir = 'ltr' })
    assert.deepEqual(errors, []); assert.deepEqual(missing, [])
    check(`${engine}: axe has zero violations; reduced motion, 200% text enlargement, RTL reflow; zero script/local resource errors`)
    await context.close()

    // Simulated EIP-6963 provider. No real account is connected and no transaction is sent.
    const walletContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await walletContext.route('**/*', route => {
      const target = new URL(route.request().url())
      if (target.origin === origin) return route.continue()
      if (net.rpcUrls.some(endpoint => new URL(endpoint).hostname === target.hostname)) {
        const req = route.request().postDataJSON()
        let result = req.method === 'eth_chainId' ? '0x1237' : req.method === 'eth_getCode' ? '0x60016000' : req.method === 'eth_call' ? encodeUint(123n * 10n ** 18n) : null
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: req.id, ...(result == null ? { error: { code: -32000, message: 'Mock unavailable' } } : { result }) }) })
      }
      return route.fulfill({ contentType: 'application/json', body: '{}' })
    })
    await walletContext.addInitScript(({ account }) => {
      window.walletCalls = []; window.rejectConnect = true; window.mockChain = '0x1'; window.added = false
      const listeners = new Map()
      const provider = { on: (name, fn) => { const handlers = listeners.get(name) ?? []; handlers.push(fn); listeners.set(name, handlers) }, removeListener: (name, fn) => listeners.set(name, (listeners.get(name) ?? []).filter(f => f !== fn)),
        request: async ({ method, params }) => {
          window.walletCalls.push({ method, params })
          if (method === 'eth_requestAccounts') { if (window.rejectConnect) throw Object.assign(new Error('User rejected request'), { code: 4001 }); return [account] }
          if (method === 'eth_accounts') return window.rejectConnect ? [] : [account]
          if (method === 'eth_chainId') return window.mockChain
          if (method === 'wallet_switchEthereumChain') { if (!window.added) throw Object.assign(new Error('Unknown chain'), { code: 4902 }); window.mockChain = params[0].chainId; for (const handler of listeners.get('chainChanged') ?? []) handler(window.mockChain); return null }
          if (method === 'wallet_addEthereumChain') { window.added = true; return null }
          if (method === 'wallet_watchAsset') return true
          if (method === 'wallet_getCapabilities') return {}
          throw Object.assign(new Error('Unsupported mock method'), { code: -32601 })
        },
      }
      window.ethereum = provider
      const detail = { info: { uuid: '0cf96241-3493-4b12-a8c8-b2ad305b4e11', name: 'Test browser wallet', icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"%3E%3Ccircle cx="14" cy="14" r="13" fill="purple"/%3E%3C/svg%3E', rdns: 'test.neethome.wallet' }, provider }
      addEventListener('eip6963:requestProvider', () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail })))
    }, { account: dep.manifest.economics.remainderTo })
    const walletPage = await walletContext.newPage()
    await walletPage.goto(url)
    await walletPage.getByRole('button', { name: 'Connect wallet', exact: true }).click()
    const named = walletPage.getByRole('button', { name: 'Test browser wallet', exact: true })
    await named.waitFor()
    assert.equal(await walletPage.getByRole('button', { name: 'Browser wallet', exact: true }).count(), 0)
    await named.click()
    await walletPage.getByText('Connection was not completed. Unlock your wallet and try again.').waitFor()
    await walletPage.evaluate(() => { window.rejectConnect = false })
    await named.click()
    const switchTrigger = walletPage.locator('.wallet-button').filter({ hasText: 'Switch to Robinhood Chain' })
    await switchTrigger.waitFor(); await switchTrigger.click()
    await walletPage.getByRole('dialog').getByRole('button', { name: 'Switch to Robinhood Chain', exact: true }).click()
    await walletPage.getByText('Connected to Robinhood Chain', { exact: true }).waitFor()
    const calls = await walletPage.evaluate(() => window.walletCalls)
    const add = calls.find(c => c.method === 'wallet_addEthereumChain')
    assert.deepEqual(add.params[0], facts.network.walletAddChain)
    await walletPage.getByRole('button', { name: 'Add $NEETHOME to wallet', exact: true }).click()
    await walletPage.getByText('$NEETHOME added to your wallet.', { exact: true }).waitFor()
    const watch = await walletPage.evaluate(() => window.walletCalls.find(c => c.method === 'wallet_watchAsset'))
    assert.equal(watch.params.options.address.toLowerCase(), home.toLowerCase())
    assert.equal(await walletPage.locator('.balance-row strong').innerText(), '123')
    await walletPage.getByRole('button', { name: 'Disconnect', exact: true }).click()
    await walletPage.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor()
    assert.equal((await walletPage.evaluate(() => window.walletCalls)).some(c => /sendTransaction|sign/i.test(c.method)), false)
    check(`${engine}: EIP-6963 named wallet, hidden generic row, rejection/retry, connection, add-chain fallback, balance, watchAsset and disconnect`)
    await walletContext.close()

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' })
    await phone.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ contentType: 'application/json', body: '{}' }))
    const phonePage = await phone.newPage(); await phonePage.goto(url)
    await phonePage.getByRole('button', { name: 'Connect wallet', exact: true }).click()
    for (const name of ['MetaMask', 'Coinbase Wallet', 'Rabby', 'Phantom']) await phonePage.getByRole('link', { name: `Open in ${name}`, exact: true }).waitFor()
    await phonePage.getByRole('button', { name: 'Coinbase Smart Wallet', exact: true }).waitFor()
    for (const row of await phonePage.locator('.wallet-row').all()) assert.ok((await row.boundingBox()).height >= 48)
    assert.equal(await phonePage.getByText('Injected', { exact: true }).count(), 0)
    check(`${engine}: mobile wallet links, local marks, 48px+ rows and Coinbase Smart Wallet`)
    await phone.close(); await browser.close(); browser = undefined
  }
  console.log(`\n${results.length} interaction groups passed; mocked APIs/providers, no real transactions.`)
  await import('node:fs/promises').then(fs => fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2)))
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }

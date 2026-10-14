import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto(new URL('share.html', import.meta.url).href)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: fileURLToPath(new URL('../public/share.png', import.meta.url)) })
  console.log('Generated local 1200 × 630 share.png')
} finally { await browser.close() }

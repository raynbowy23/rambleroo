// Dev helper: headless screenshots of app routes. Usage: node scripts/shots.mjs <outDir> <width>x<height> <path> [path...]
// A path may carry actions after '#': e.g. "/#click=text=Great River Road" or "/#wait=3000".
import { chromium } from '@playwright/test'

const [outDir, size, ...paths] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const base = process.env.BASE ?? 'http://127.0.0.1:5199'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`  [${m.type()}] ${m.text().slice(0, 300)}`)
})
page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message.slice(0, 300)}`))
let i = 0
for (const entry of paths) {
  const [path, ...actions] = entry.split('#')
  console.log(`${++i}. ${path} ${actions.join(' ')}`)
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  for (const a of actions) {
    const [k, v] = a.split(/=(.*)/s)
    if (k === 'click') await page.locator(v).first().click()
    else if (k === 'hover') await page.locator(v).first().hover()
    else if (k === 'type') await page.keyboard.type(v)
    else if (k === 'key') await page.keyboard.press(v)
    else if (k === 'scroll') await page.mouse.wheel(0, Number(v))
    else if (k === 'eval') await page.evaluate(v)
    else if (k === 'wait') await page.waitForTimeout(Number(v))
    await page.waitForTimeout(700)
  }
  await page.screenshot({ path: `${outDir}/${String(i).padStart(2, '0')}.png`, fullPage: process.env.FULL === '1' })
}
await browser.close()

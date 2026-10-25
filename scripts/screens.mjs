// Plays the opening of the game in a real browser at desktop and phone sizes
// and saves screenshots for replica-diff. Uses the locally installed Chrome.
//
//   npm run dev            (in another terminal)
//   node scripts/screens.mjs [baseUrl]

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/'
const out = 'replica/clone-screens'
mkdirSync(out, { recursive: true })

const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const browser = await chromium.launch({ channel: 'chrome' })
const problems = []

for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') problems.push(`[${size.name}] console: ${m.text()}`) })
  page.on('pageerror', e => problems.push(`[${size.name}] page error: ${e.message}`))
  const shot = name => page.screenshot({ path: `${out}/${name}-${size.name}.png` })
  const tab = label => page.getByRole('toolbar').getByRole('button', { name: label, exact: true }).click()

  await page.goto(base)
  await page.waitForTimeout(1500)
  await shot('S03-first-run')

  // S04: first program, run by hand until Loops is affordable
  await page.locator('.cm-content').first().click()
  await page.keyboard.type('harvest()')
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: 'Run main' }).click()
    await page.waitForTimeout(900)
  }
  await shot('S04-code-window')

  // S07: research tree, buy Loops
  await page.getByRole('button', { name: 'Research tree' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /^Loops/ }).click()
  await page.waitForTimeout(600)
  await shot('S07-research')

  // loop forever
  await tab('main.py')
  await page.locator('.cm-content').first().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('while True:\n')
  await page.keyboard.type('harvest()')
  await page.getByRole('button', { name: 'Run main' }).click()
  await page.waitForTimeout(4000)
  await shot('S03-running')

  // S05 output and S06 guide
  await tab('Output')
  await page.waitForTimeout(300)
  await shot('S05-output')
  await page.getByRole('button', { name: 'Field guide' }).first().click()
  await page.waitForTimeout(300)
  await shot('S06-guide')

  // an error, so the error states show
  await tab('main.py')
  await page.locator('.cm-content').first().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('harvest()\nmove(North)')
  await page.getByRole('button', { name: 'Stop main' }).click()
  await page.waitForTimeout(500)
  const labels = await page.locator('button[aria-label$=" main"]').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')))
  if (!labels.includes('Run main')) {
    console.log(`[${size.name}] after Stop the run button reads:`, labels, problems)
    await shot('debug')
  }
  await page.getByRole('button', { name: 'Run main' }).click()
  await page.waitForTimeout(1200)
  await shot('S04-error')

  // S01 menu
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.waitForTimeout(400)
  await shot('S01-menu')

  // a grown field from the dev preset, with the program running
  await page.goto(base + '?preset=mid')
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Run main' }).click()
  await page.waitForTimeout(5000)
  await shot('S03-midgame')
  await page.getByRole('button', { name: 'Research tree' }).click()
  await page.waitForTimeout(400)
  await shot('S07-midgame')

  await ctx.close()
}

await browser.close()
if (problems.length) {
  console.log(problems.join('\n'))
  process.exitCode = 1
} else {
  console.log(`screens saved to ${out}, no console errors`)
}

// Keyboard-only pass over the core loop: no mouse after the page loads.
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(process.argv[2] ?? 'http://localhost:5173/')
await page.waitForTimeout(1200)
const label = () => page.locator('button[aria-label$=" main"]').first().getAttribute('aria-label')
// Tab from the page start until the editor has focus
let reached = false
for (let i = 0; i < 40 && !reached; i++) {
  await page.keyboard.press('Tab')
  reached = await page.evaluate(() => !!document.activeElement?.closest('.cm-editor'))
}
console.log('editor reachable by Tab:', reached)
await page.keyboard.type('harvest()')
await page.keyboard.press('F5')
await page.waitForTimeout(800)
console.log('hay after F5:', await page.locator('[aria-label$="Hay"]').getAttribute('aria-label'))
await page.keyboard.press('Control+A')
await page.keyboard.type('print(1)\nprint(2)')
await page.keyboard.press('F10')
await page.waitForTimeout(300)
console.log('after F10:', await label())
await page.keyboard.press('Shift+F5')
await page.waitForTimeout(300)
console.log('after Shift+F5:', await label())
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()

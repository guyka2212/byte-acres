// The landing page's product screenshots: the real game, mid-run, on a farm
// with every late crop. Writes public/landing/farm-desktop.png and farm-phone.png.
//
//   npx vite --port 5173     (dev server, so presets work)
//   node scripts/landing-shots.mjs http://localhost:5173/

import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5173/'
const CODE = `# find the sunflower with the most petals
change_hat(Hats.Straw_Hat)
best = 0
for x in range(get_world_size()):
    for y in range(get_world_size()):
        if get_entity_type() == Entities.Sunflower:
            best = max(best, measure())
        move(North)
    move(East)
print("most petals:", best)`

const browser = await chromium.launch({ channel: 'chrome' })
for (const size of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.name === 'phone' ? 2 : 1 })
  const page = await ctx.newPage()
  await page.goto(`${base}?preset=crops`)
  await page.getByRole('button', { name: 'Run main' }).waitFor()
  const editor = page.getByRole('textbox', { name: 'main.py' })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await editor.evaluate((el, t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, CODE)
  await page.getByRole('button', { name: 'Run main' }).click()
  await page.waitForTimeout(2600)
  // lesson toasts are for players, not for the picture
  await page.addStyleTag({ content: '[role=status] { display: none !important }' })
  await page.screenshot({ path: `public/landing/farm-${size.name}.png` })
  await ctx.close()
}
console.log('wrote public/landing/farm-desktop.png and farm-phone.png')
await browser.close()

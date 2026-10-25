// Makes public/og.png (1200×630), the picture shown when a link to Byte Acres
// is shared: the real 3D farm from a preset, with the name and the pitch.
//
//   npx vite --port 5173     (dev server, so presets work)
//   node scripts/og-image.mjs http://localhost:5173/

import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/'
const browser = await chromium.launch({ channel: 'chrome' })

// 1. the farm alone: everything but the canvas hidden
const farm = await browser.newPage({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 2 })
await farm.goto(`${base}?preset=crops`)
await farm.waitForTimeout(2500)
await farm.addStyleTag({ content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }' })
await farm.waitForTimeout(400)
const shot = await farm.locator('canvas').screenshot()

// 2. the card around it, in the brand's colours and fonts
const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const tok = name => tokens.match(new RegExp(`--tk-color-${name}:\\s*([^;]+);`))[1].trim()
const card = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await card.goto(`${base}`) // for the self-hosted fonts
await card.setContent(`<!doctype html><html><head><style>
  ${await card.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText).filter(t => t.startsWith('@font-face')) } catch { return [] } }).join('\n'))}
  * { margin: 0; box-sizing: border-box }
  body { width: 1200px; height: 630px; background: ${tok('bg')}; color: ${tok('text')}; font-family: "Nunito Sans Variable", sans-serif; display: flex; overflow: hidden }
  .text { width: 520px; padding: 64px 0 64px 64px; display: flex; flex-direction: column; justify-content: center; gap: 22px }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 800 }
  .mark { width: 48px; height: 48px; border-radius: 12px; background: ${tok('accent')}; display: grid; place-items: center }
  .mark i { width: 18px; height: 18px; background: ${tok('bg')}; transform: rotate(45deg); border-radius: 3px }
  h1 { font-size: 46px; line-height: 1.1; font-weight: 800; letter-spacing: -0.5px }
  p { font-size: 24px; line-height: 1.4; color: ${tok('text-muted')} }
  code { font-family: "JetBrains Mono", monospace; color: ${tok('accent')}; font-size: 22px }
  .pic { flex: 1; position: relative }
  .pic img { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 760px; border-radius: 28px }
  .free { display: inline-block; padding: 6px 14px; border-radius: 999px; background: ${tok('accent')}; color: ${tok('bg')}; font-weight: 800; font-size: 20px; width: fit-content }
</style></head><body>
  <div class="text">
    <div class="brand"><span class="mark"><i></i></span>Byte Acres</div>
    <h1>Learn to code by teaching a drone to farm.</h1>
    <p>Real Python, one idea at a time. <code>harvest()</code> is your first line.</p>
    <span class="free">Free, with classes for schools</span>
  </div>
  <div class="pic"><img src="data:image/png;base64,${shot.toString('base64')}" alt=""></div>
</body></html>`)
await card.waitForTimeout(500)
await card.screenshot({ path: 'public/og.png' })
console.log('wrote public/og.png')
await browser.close()

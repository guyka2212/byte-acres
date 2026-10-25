// Checks the cloud backup UI against a build whose Supabase URL points at a
// closed local port: the panel shows, bad input is caught, and an
// unreachable server becomes a friendly message instead of a crash.
//
//   VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_PUBLISHABLE_KEY=x npx vite --port 5174
//   node scripts/cloud-ui-check.mjs http://localhost:5174/

import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5174/'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(base)
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Menu' }).click()
await page.waitForTimeout(300)

const panel = page.getByRole('region', { name: 'Cloud backup' })
console.log('panel visible:', await panel.isVisible())
await panel.getByLabel('Email').fill('not-an-email')
await panel.getByRole('button', { name: 'Email me a sign-in link' }).click()
await page.waitForTimeout(300)
console.log('bad email blocked by the browser:', await panel.getByLabel('Email').evaluate(el => !el.checkValidity()))

await panel.getByLabel('Email').fill('player@example.com')
await panel.getByRole('button', { name: 'Email me a sign-in link' }).click()
await page.waitForTimeout(2500)
console.log('message shown:', (await panel.innerText()).split('\n').filter(l => /Couldn't|Check your inbox|Too many/.test(l)))
await page.screenshot({ path: 'replica/clone-screens/S01-cloud-panel-desktop.png' })
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()

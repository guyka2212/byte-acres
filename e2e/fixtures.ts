// Shared test setup. Every test fails on a console error, an uncaught page
// error or a 5xx response. Helpers drive the game the way a player does,
// through roles and labels.

import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'

export const test = base.extend<{ problems: string[]; allowConsole: RegExp[] }>({
  allowConsole: [[], { option: true }],
  problems: [async ({ page, allowConsole }, use) => {
    const problems: string[] = []
    page.on('console', m => {
      if (m.type() === 'error' && !allowConsole.some(r => r.test(m.text()))) problems.push(`console: ${m.text()}`)
    })
    page.on('pageerror', e => problems.push(`page error: ${e.message}`))
    page.on('response', r => { if (r.status() >= 500) problems.push(`${r.status()} on ${r.url()}`) })
    await use(problems)
    expect(problems, 'console errors, page errors or 5xx during the test').toEqual([])
  }, { auto: true }],
})
export { expect }

/** open the game; `preset` is a dev-only starting farm */
export async function openGame(page: Page, preset?: 'mid' | 'rich') {
  await page.goto(preset ? `/app.html?preset=${preset}#/play/slot1` : '/app.html#/play/slot1')
  await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
}

/** replace a file's code, as if pasted (no auto-indent surprises) */
export async function setCode(page: Page, text: string, file = 'main') {
  // bring the file's window forward first, as a player would when windows overlap
  const tab = page.getByRole('toolbar').getByRole('button', { name: `${file}.py`, exact: true })
  if (await tab.count()) await tab.click()
  const editor = page.getByRole('textbox', { name: `${file}.py` })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await editor.evaluate((el, t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text)
}

export const runButton = (page: Page, file = 'main') => page.getByRole('button', { name: `Run ${file}` })
export const stopButton = (page: Page, file = 'main') => page.getByRole('button', { name: `Stop ${file}` })

export async function run(page: Page, file = 'main') {
  await runButton(page, file).click()
}
export async function waitIdle(page: Page, file = 'main') {
  await expect(runButton(page, file)).toBeVisible()
}

/** an item count from the resource bar ("1,240 Hay" -> 1240); 0 when not shown */
export async function count(page: Page, item: 'Hay' | 'Wood' | 'Carrots' | 'Water') {
  const el = page.getByRole('list', { name: 'Resources' }).getByLabel(new RegExp(` ${item}$`))
  if (!(await el.count())) return 0
  const label = (await el.getAttribute('aria-label')) ?? '0'
  return Number(label.split(' ')[0].replace(/,/g, ''))
}

/** click the toolbar tab or button that brings a window forward */
export async function show(page: Page, name: 'main.py' | 'Output' | 'Field guide' | 'Research tree' | 'Lessons') {
  if (name === 'Research tree' || name === 'Field guide' || name === 'Lessons') {
    await page.getByRole('toolbar').getByRole('button', { name, exact: true }).first().click()
  } else {
    // the Output tab is named "Output has warnings" while a warning is showing
    await page.getByRole('toolbar').getByRole('button', { name: new RegExp(`^${name.replace('.', '\\.')}`) }).click()
  }
}

export const output = (page: Page) => page.getByRole('log')

/** the red strip under the editor: "line 2 NameError: ..." (the Output link is just "line 2") */
export const errorStrip = (page: Page) => page.getByRole('button', { name: /^line \d+ \S/ })

/** serious or critical accessibility problems on the current screen */
export async function a11y(page: Page) {
  const r = await new AxeBuilder({ page }).analyze()
  return r.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
}

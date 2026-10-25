import { count, expect, openGame, run, runButton, setCode, stopButton, test, waitIdle } from './fixtures'
import type { Page } from '@playwright/test'

async function harvestTimes(page: Page, n: number) {
  const start = await count(page, 'Hay')
  for (let i = 0; i < 40 && (await count(page, 'Hay')) < start + n; i++) {
    await run(page)
    await page.waitForTimeout(450)
  }
  expect(await count(page, 'Hay')).toBe(start + n)
}

test.describe('F15 save and continue', () => {
  test('F15-H1 save, reload, everything is back', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await harvestTimes(page, 2)
    await page.keyboard.press('Control+S')
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
    await page.reload()
    await expect(runButton(page)).toBeVisible()
    await expect.poll(() => count(page, 'Hay')).toBe(2)
    await expect(page.getByRole('textbox', { name: 'main.py' })).toHaveText('harvest()')
  })

  test('F15-E1 reloading right after playing keeps that progress', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await harvestTimes(page, 3)
    await waitIdle(page)
    await page.reload() // no manual save, and well inside the autosave interval
    await expect(runButton(page)).toBeVisible()
    await expect.poll(() => count(page, 'Hay')).toBe(3)
    await expect(page.getByRole('textbox', { name: 'main.py' })).toHaveText('harvest()')
  })

  test('F15-E1b reloading mid-run stops the program and keeps the farm', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await harvestTimes(page, 6)
    await page.getByRole('toolbar').getByRole('button', { name: 'Research tree', exact: true }).first().click()
    await page.getByRole('button', { name: /^Loops/ }).click()
    await page.getByRole('toolbar').getByRole('button', { name: 'main.py', exact: true }).click()
    await setCode(page, 'while True:\n    harvest()')
    await run(page)
    await expect(stopButton(page)).toBeVisible()
    await page.waitForTimeout(2000)
    await page.reload()
    await expect(runButton(page)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'main.py' })).toContainText('while True:')
  })

  test('F15-E2 a second tab cannot overwrite newer progress', async ({ context }) => {
    const a = await context.newPage()
    await openGame(a)
    await setCode(a, 'harvest()')
    await harvestTimes(a, 2)
    await a.keyboard.press('Control+S')

    // a second tab is told the farm is open elsewhere, and doesn't load or save it
    const b = await context.newPage()
    await b.goto('/app.html#/play/slot1')
    const elsewhere = (p: Page) => p.getByRole('dialog', { name: 'Your farm is open in another tab' })
    await expect(elsewhere(b)).toBeVisible()

    await a.bringToFront()
    await harvestTimes(a, 2) // a now has 4
    await b.keyboard.press('Control+S') // must not write anything

    // taking over: a saves and steps aside, b continues from the newest farm
    await elsewhere(b).getByRole('button', { name: 'Play here instead' }).click()
    await expect(elsewhere(a)).toBeVisible()
    await expect(runButton(b)).toBeVisible()
    await expect.poll(() => count(b, 'Hay')).toBe(4)
  })

  test('F15-N1 start over: cancel keeps the farm, confirm clears it', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await harvestTimes(page, 1)
    await page.keyboard.press('Control+S')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('button', { name: 'Start this field over' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect.poll(() => count(page, 'Hay')).toBe(1)
    await page.getByRole('button', { name: 'Start this field over' }).click()
    await page.getByRole('button', { name: 'Delete and start over' }).click()
    await expect(runButton(page)).toBeVisible()
    await expect.poll(() => count(page, 'Hay')).toBe(0)
    // an empty editor shows only its placeholder
    await expect(page.getByRole('textbox', { name: 'main.py' })).not.toContainText('harvest()')
  })
})

test.describe('Engine start-up', () => {
  test.use({ allowConsole: [/Failed to load resource|net::ERR_FAILED|worker/i] })
  // BUG-007: if the simulation worker can't load, say so instead of looking alive
  test('ENG-N1 a worker that fails to load is reported, not silent', async ({ page }) => {
    await page.route(/worker/, route => route.abort())
    await page.goto('/app.html#/play/slot1')
    await expect(page.getByRole('alertdialog', { name: "The farm engine didn't start" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
  })
})

test.describe('Storage failures', () => {
  // BUG-006: a failed read is not "no save": play on, but never write over it
  test('F15-E3 unreadable storage: the game plays and saves nothing', async ({ page }) => {
    await page.addInitScript(() => {
      const writes: string[] = []
      ;(window as unknown as { __writes: string[] }).__writes = writes
      indexedDB.open = () => { throw new Error('storage unavailable') }
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function (k: string, v: string) { writes.push(k); return set.call(this, k, v) }
    })
    await openGame(page)
    await expect(page.getByRole('status').filter({ hasText: "Couldn't open your saved farm" })).toBeVisible()
    await setCode(page, 'harvest()')
    await run(page)
    await expect.poll(() => count(page, 'Hay')).toBe(1)
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')))
    const writes = await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)
    expect(writes.filter(k => k.startsWith('byte-acres:rescue'))).toEqual([])
  })
})

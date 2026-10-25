import { errorStrip, count, expect, openGame, output, run, runButton, setCode, show, stopButton, test, waitIdle } from './fixtures'

test.describe('F01 first program', () => {
  test('F01-H1 harvest() by hand gives hay', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await run(page)
    await expect.poll(() => count(page, 'Hay')).toBe(1)
    await waitIdle(page)
    await expect(page.getByRole('dialog', { name: 'Hint' })).toContainText('run it a few more times')
  })

  test('F01-H2 earn 6 hay, buy Loops, farm forever', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    for (let i = 0; i < 30 && (await count(page, 'Hay')) < 6; i++) {
      await run(page)
      await page.waitForTimeout(450)
    }
    expect(await count(page, 'Hay')).toBe(6)
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Loops unlocked' })).toBeVisible()
    await expect.poll(() => count(page, 'Hay')).toBe(0)
    await expect(page.getByRole('button', { name: /^Bigger field/ })).toBeVisible()

    await show(page, 'main.py')
    await setCode(page, 'while True:\n    harvest()')
    await run(page)
    await expect(stopButton(page)).toBeVisible()
    await expect.poll(() => count(page, 'Hay'), { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
  })

  test('F01-E1 an empty program finishes quietly', async ({ page }) => {
    await openGame(page)
    await run(page)
    await expect(output(page)).toContainText('Done. The drone is waiting for the next run.')
    await expect(output(page)).not.toContainText('Error')
  })

  test('F01-E2 emoji and accents survive print', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'print("🌱 café")')
    await run(page)
    await expect(output(page)).toContainText('🌱 café')
  })

  test('F01-E3 double-clicking Run does not double-harvest or crash', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await page.waitForTimeout(800)
    await runButton(page).dblclick()
    await page.waitForTimeout(1500)
    await waitIdle(page)
    expect(await count(page, 'Hay')).toBeLessThanOrEqual(1)
  })

  test('F01-E4 a 5,000-line program compiles and runs', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'x = 1\n'.repeat(5000) + 'print("done")')
    const t0 = Date.now()
    await run(page)
    await expect(output(page)).toContainText('done', { timeout: 30_000 })
    expect(Date.now() - t0).toBeLessThan(30_000)
  })

  test('F01-E5 the first loop works on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openGame(page, 'rich')
    await setCode(page, 'harvest()')
    await run(page)
    await expect.poll(() => count(page, 'Hay')).toBe(5001)
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Loops unlocked' })).toBeVisible()
    // one window at a time: the research tree is the only one showing
    await expect(page.getByRole('textbox', { name: 'main.py' })).toHaveCount(0)
  })

  test('F01-E6 keyboard only: Tab, F5, F10, Shift+F5', async ({ page }) => {
    await openGame(page)
    let reached = false
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab')
      reached = await page.evaluate(() => !!document.activeElement?.closest('.cm-editor'))
    }
    expect(reached).toBe(true)
    await page.keyboard.type('harvest()')
    await page.keyboard.press('F5')
    await expect.poll(() => count(page, 'Hay')).toBe(1)
    await page.keyboard.press('Control+A')
    await page.keyboard.type('print(1)')
    await page.keyboard.press('Enter')
    await page.keyboard.type('print(2)')
    await page.keyboard.press('F10')
    await expect(page.getByRole('button', { name: 'Resume main' })).toBeVisible()
    await page.keyboard.press('Shift+F5')
    await expect(runButton(page)).toBeVisible()
  })

  test('F01-N1 a loop before Loops explains what to unlock', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'while True:\n    harvest()')
    await run(page)
    const strip = errorStrip(page)
    await expect(strip).toContainText("Loops aren't unlocked yet")
    await expect(strip).toContainText('research tree')
  })

  test("F01-N2 can't buy what you can't afford", async ({ page }) => {
    await openGame(page)
    await show(page, 'Research tree')
    const loops = page.getByRole('button', { name: /^Loops/ })
    await expect(loops).toHaveAttribute('aria-disabled', 'true')
    await expect(loops).toHaveAccessibleDescription(/you have 0/)
    await loops.click({ force: true }) // a player can still click it; Playwright would wait for it to enable
    await page.waitForTimeout(500)
    await expect(page.getByRole('status').filter({ hasText: 'Loops unlocked' })).toHaveCount(0)
  })
})

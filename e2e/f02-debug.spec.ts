import { errorStrip, expect, openGame, output, run, runButton, setCode, show, stopButton, test } from './fixtures'

test.describe('F02 debug a program', () => {
  test('F02-H1 Step highlights the next line, Resume finishes', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'a = 1\nb = 2\nc = 3')
    const step = page.getByRole('button', { name: 'Step one line' })
    // the highlighted line has no role; CodeMirror's line class is the only handle
    const paused = page.locator('.cm-line-paused')
    await step.click()
    await expect(paused).toHaveText('b = 2')
    await step.click()
    await expect(paused).toHaveText('c = 3')
    await page.getByRole('button', { name: 'Resume main' }).click()
    await expect(runButton(page)).toBeVisible()
    await expect(output(page)).toContainText('Done. The drone is waiting for the next run.')
  })

  test('F02-E1 a runtime error names its line and stops the drone', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'move(North)\nmove(Up)')
    await run(page)
    await expect(errorStrip(page)).toContainText('Up')
    await expect(output(page).getByRole('listitem').filter({ hasText: 'Up' })).toBeVisible()
    await expect(runButton(page)).toBeVisible()
  })

  test('F02-E2 an infinite loop never freezes the page', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'while True:\n    pass')
    await run(page)
    await expect(stopButton(page)).toBeVisible()
    const t0 = Date.now()
    await show(page, 'Research tree')
    await show(page, 'Field guide')
    expect(Date.now() - t0).toBeLessThan(3000)
    await show(page, 'main.py')
    await stopButton(page).click()
    await expect(runButton(page)).toBeVisible({ timeout: 2000 })
  })

  test('F02-E3 editing code while it runs does not crash the editor', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'while True:\n    harvest()\n    move(North)')
    await run(page)
    await expect(stopButton(page)).toBeVisible()
    await setCode(page, 'print("new code")')
    await page.keyboard.type('\n# more typing while it runs')
    await page.waitForTimeout(1000)
    // still running the old program, editor still alive
    await expect(stopButton(page)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'main.py' })).toContainText('more typing')
  })

  test('F02-E4 the line link in Output brings the code forward', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'move(North)\nmove(Up)')
    await run(page)
    await show(page, 'Output')
    await output(page).getByRole('button', { name: 'line 2', exact: true }).click()
    const code = page.getByRole('dialog', { name: 'main.py' })
    const box = (await code.boundingBox())!
    const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[role=dialog]')?.getAttribute('aria-labelledby'), [box.x + box.width / 2, box.y + box.height / 2])
    expect(onTop).toBe(await code.getAttribute('aria-labelledby'))
  })

  test('F02-E5 a flood of output stays capped', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'i = 0\nwhile True:\n    quick_print("spam", i)\n    i += 1')
    await run(page)
    await page.waitForTimeout(5000)
    await show(page, 'Output')
    const rows = await output(page).getByRole('listitem').count()
    expect(rows).toBeLessThanOrEqual(301)
    expect(rows).toBeGreaterThan(50)
    await show(page, 'main.py')
    await stopButton(page).click()
  })
})

import { errorStrip, a11y, expect, openGame, run, setCode, show, test } from './fixtures'

// serious and critical axe findings, screen by screen
test.describe('A11Y every built screen', () => {
  test('first run: field, code, output, guide, hint', async ({ page }) => {
    await openGame(page)
    expect(await a11y(page)).toEqual([])
  })
  test('research tree with locked and affordable nodes', async ({ page }) => {
    await openGame(page, 'mid')
    await show(page, 'Research tree')
    expect(await a11y(page)).toEqual([])
  })
  test('running program and an error', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'move(North)\nmove(Up)')
    await run(page)
    await expect(errorStrip(page)).toBeVisible()
    expect(await a11y(page)).toEqual([])
  })
  test('pause menu', async ({ page }) => {
    await openGame(page)
    await page.getByRole('button', { name: 'Menu' }).click()
    expect(await a11y(page)).toEqual([])
  })
  test('phone layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openGame(page)
    expect(await a11y(page)).toEqual([])
  })
})

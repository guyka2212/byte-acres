import { count, expect, openGame, show, test } from './fixtures'

test.describe('F03 buy an unlock', () => {
  test('F03-H1 buying Loops: toast, bought state, new guide page', async ({ page }) => {
    await openGame(page, 'rich')
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Loops unlocked' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Loops/ }).getByLabel('Bought')).toBeVisible()
    await show(page, 'Field guide')
    await expect(page.getByRole('navigation', { name: 'Field guide pages' }).getByRole('button', { name: /Loops/ })).toBeVisible()
  })

  test('F03-E1 a double click buys once and charges once', async ({ page }) => {
    await openGame(page, 'rich')
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).dblclick()
    await expect.poll(() => count(page, 'Hay')).toBe(5000 - 6)
    await page.waitForTimeout(500)
    expect(await count(page, 'Hay')).toBe(5000 - 6)
  })

  test('F03-E2 levelled upgrades show their level and next cost', async ({ page }) => {
    await openGame(page, 'rich')
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).click()
    // the first lesson opens over the tree; a player brings the tree back
    await show(page, 'Research tree')
    const speed = page.getByRole('button', { name: /^Faster drone/ })
    await speed.click()
    await expect(speed.getByLabel('Level 1 of 5')).toBeVisible()
    await speed.click()
    await expect(speed.getByLabel('Level 2 of 5')).toBeVisible()
    await expect(speed).toHaveAccessibleDescription(/Wood|Carrots/)
  })
})

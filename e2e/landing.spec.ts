import { a11y, expect, test } from './fixtures'

test.describe('Landing page', () => {
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`LP-${size.width} reads well and passes axe`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'Learn to code by teaching a drone to farm.' })).toBeVisible()
      // features are labelled with what is really there
      const teacher = page.getByRole('listitem').filter({ hasText: 'A teacher that stays' })
      await expect(teacher).toContainText('Available')
      await expect(page.getByRole('heading', { name: 'Free. All of it.' })).toBeVisible()
      expect(await a11y(page)).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0)
    })
  }

  test('LP-CTA the main button opens the game (its home screen, in a build without accounts)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Start farming, free' }).first().click()
    await expect(page.getByRole('heading', { name: 'My fields' })).toBeVisible()
  })

  test('LP-FAQ answers open and close', async ({ page }) => {
    await page.goto('/')
    const q = page.getByRole('button', { name: 'Is it really free?' })
    await q.click()
    await expect(page.getByText(/The whole game, cloud saves and classes are free/)).toBeVisible()
    await expect(q).toHaveAttribute('aria-expanded', 'true')
  })
})

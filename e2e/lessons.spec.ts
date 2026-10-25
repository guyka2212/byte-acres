import { a11y, expect, openGame, run, setCode, show, test } from './fixtures'

test.describe('Lessons', () => {
  test('LS-H1 buying Loops opens its lesson; hints reveal one at a time; goals tick; the lesson completes', async ({ page }) => {
    await openGame(page, 'rich')
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).click()

    const lessons = page.getByRole('dialog', { name: 'Lessons' })
    await expect(lessons.getByRole('heading', { name: 'Make it repeat' })).toBeVisible()
    await expect(lessons.getByRole('listitem').filter({ hasText: 'Use a loop' }).getByLabel('not yet')).toBeVisible()

    await lessons.getByRole('button', { name: 'Need a hint?' }).click()
    await expect(lessons.getByText('A nudge')).toBeVisible()
    await lessons.getByRole('button', { name: 'Another hint' }).click()
    await lessons.getByRole('button', { name: 'Show me almost the answer' }).click()
    await expect(lessons.getByText('Almost the answer')).toBeVisible()
    expect(await a11y(page)).toEqual([])

    await setCode(page, 'while True:\n    harvest()')
    await run(page)
    await expect(page.getByRole('status').filter({ hasText: 'Lesson done: Make it repeat' })).toBeVisible({ timeout: 30_000 })
    await show(page, 'Lessons')
    await expect(lessons.getByText('Lesson done.')).toBeVisible()
  })

  test('LS-E1 progress survives a reload', async ({ page }) => {
    await openGame(page, 'rich')
    await show(page, 'Research tree')
    await page.getByRole('button', { name: /^Loops/ }).click()
    await page.getByRole('dialog', { name: 'Lessons' }).getByRole('button', { name: 'Need a hint?' }).click()
    await page.keyboard.press('Control+S')
    await page.waitForTimeout(500)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
    await show(page, 'Lessons')
    await expect(page.getByRole('dialog', { name: 'Lessons' }).getByText('A nudge')).toBeVisible()
  })
})

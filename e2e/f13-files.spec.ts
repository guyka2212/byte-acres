import { errorStrip, expect, openGame, output, run, setCode, test } from './fixtures'

test.describe('F13 code in two files', () => {
  test('F13-H1 import a function from a second file', async ({ page }) => {
    await openGame(page, 'mid')
    await page.getByRole('button', { name: 'New code file' }).click()
    await page.getByLabel('File name (without .py)').fill('tools')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('textbox', { name: 'tools.py' })).toBeVisible()
    await setCode(page, 'def double(x):\n    return x * 2', 'tools')
    await setCode(page, 'import tools\nprint(tools.double(21))')
    await run(page)
    await expect(output(page)).toContainText('42')
  })

  test('F13-N1 import before the Imports unlock says so', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'import tools')
    await run(page)
    await expect(errorStrip(page)).toContainText("Imports aren't unlocked yet")
  })

  test('F13-N2 importing a file that does not exist', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'import nothing_here')
    await run(page)
    await expect(errorStrip(page)).toContainText("no file called 'nothing_here'")
  })

  test('F13-H2 name a new file, then rename it', async ({ page }) => {
    await openGame(page, 'mid')
    await page.getByRole('button', { name: 'New code file' }).click()
    const name = page.getByLabel('File name (without .py)')
    await name.fill('2 bad')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Use letters, numbers and _ only')).toBeVisible()
    await name.fill('main')
    await expect(page.getByText("There's already a main.py.")).toBeVisible()
    await name.fill('helpers')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('textbox', { name: 'helpers.py' })).toBeVisible()
    await page.getByRole('button', { name: 'Rename helpers.py' }).click()
    await page.getByLabel('File name (without .py)').fill('farm_tools')
    await page.getByRole('button', { name: 'Rename' }).click()
    await expect(page.getByRole('textbox', { name: 'farm_tools.py' })).toBeVisible()
    await setCode(page, 'def three():\n    return 3', 'farm_tools')
    await setCode(page, 'import farm_tools\nprint(farm_tools.three())')
    await run(page)
    await expect(output(page)).toContainText('3')
  })

  test('F13-H3 download the code as a zip, and open a .py file', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'print("hello from main")')
    await page.getByRole('button', { name: 'Field settings' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download the code (.zip)' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/-code\.zip$/)
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Add .py files' }).click()
    await (await chooser).setFiles({ name: 'garden.py', mimeType: 'text/x-python', buffer: Buffer.from('def size():\r\n    return 9\r\n') })
    await expect(page.getByRole('status')).toContainText('Added garden.py')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
    await setCode(page, 'import garden\nprint(garden.size())')
    await run(page)
    await expect(output(page)).toContainText('9')
  })

  test('F13-H4 main.py can be renamed too, and a closed file keeps its tab', async ({ page }) => {
    await openGame(page)
    await page.getByRole('button', { name: 'Rename main.py' }).click()
    await page.getByLabel('File name (without .py)').fill('farm')
    await page.getByRole('button', { name: 'Rename' }).click()
    await expect(page.getByRole('textbox', { name: 'farm.py' })).toBeVisible()
    await setCode(page, 'print("still the main file")', 'farm')
    await page.getByRole('button', { name: 'Run farm' }).click()
    await expect(output(page)).toContainText('still the main file')
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'farm.py' })).toBeVisible()

    await page.getByRole('button', { name: 'New code file' }).click()
    await page.getByLabel('File name (without .py)').fill('extra')
    await page.getByRole('button', { name: 'Create' }).click()
    const extra = page.getByRole('dialog', { name: 'extra.py' })
    await extra.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('textbox', { name: 'extra.py' })).toHaveCount(0)
    await page.getByRole('toolbar').getByRole('button', { name: 'extra.py', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'extra.py' })).toBeVisible()
  })
})

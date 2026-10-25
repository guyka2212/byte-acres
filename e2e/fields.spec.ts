// Fields: the home screen lists every farm; each field has a ⋮ menu with its
// settings page (name, size cap, code files) and delete. Also the command
// book, autocomplete, the settings page and the 3D view.

import { a11y, count, expect, openGame, run, setCode, test } from './fixtures'

test.describe('FL fields and the home screen', () => {
  test('FL-H1 make a second field; the two keep their own farms', async ({ page }) => {
    await openGame(page)
    await setCode(page, 'harvest()')
    await run(page)
    await expect.poll(() => count(page, 'Hay')).toBeGreaterThan(0)

    await page.getByRole('button', { name: /^Home/ }).click()
    await expect(page.getByRole('heading', { name: 'My fields' })).toBeVisible()
    await page.getByRole('button', { name: 'New field' }).click()
    await page.getByLabel('Field name').fill('Carrot corner')
    await page.getByRole('button', { name: 'Create and play' }).click()

    await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Home/ })).toContainText('Carrot corner')
    expect(await count(page, 'Hay')).toBe(0) // a brand new farm

    await page.getByRole('button', { name: /^Home/ }).click()
    await expect(page.getByRole('button', { name: 'Play Carrot corner' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play My farm' })).toBeVisible()
    await a11y(page)
    await page.getByRole('button', { name: 'Play My farm' }).click()
    await expect.poll(() => count(page, 'Hay')).toBeGreaterThan(0)
  })

  test("FL-H2 a field's settings page: rename it, and cap how big it grows", async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'print("size", get_world_size())')
    await page.getByRole('button', { name: 'Field settings' }).click()
    await expect(page.getByRole('heading', { name: /settings$/ })).toBeVisible()
    const name = page.getByLabel('Field name')
    await name.fill('Big Valley')
    await page.getByRole('button', { name: 'Save name' }).click()
    await expect(page.getByRole('status')).toContainText('Name saved')

    const slider = page.getByRole('slider', { name: 'Biggest the field may grow' })
    await slider.focus()
    await page.keyboard.press('Home')
    await page.getByRole('button', { name: 'Save size' }).click()
    await expect(page.getByRole('status')).toContainText('1 × 1')
    await a11y(page)

    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Home/ })).toContainText('Big Valley')
    await run(page)
    await expect(page.getByRole('log')).toContainText('size 1')
  })

  test('FL-H3 the ⋮ menu deletes a field', async ({ page }) => {
    await page.goto('/app.html#/home')
    await page.getByRole('button', { name: 'New field' }).click()
    await page.getByLabel('Field name').fill('Short lived')
    await page.getByRole('button', { name: 'Create and play' }).click()
    await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
    await page.goto('/app.html#/home')
    await page.getByRole('button', { name: 'More for Short lived' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.getByRole('menuitem', { name: 'Delete field' }).click()
    await page.getByRole('button', { name: 'Delete field' }).click()
    await expect(page.getByRole('button', { name: 'Play Short lived' })).toHaveCount(0)
  })

  test("FL-H4 the ⋮ menu opens a field's settings, by keyboard too", async ({ page }) => {
    await openGame(page)
    await page.goto('/app.html#/home')
    const more = page.getByRole('button', { name: 'More for My farm' })
    await more.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Play' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'My farm: settings' })).toBeVisible()
  })

  test('FL-N1 a field needs a name', async ({ page }) => {
    await page.goto('/app.html#/home')
    await page.getByRole('button', { name: 'New field' }).click()
    await page.getByRole('button', { name: 'Create and play' }).click()
    await expect(page.getByText('Give it a name.')).toBeVisible()
  })
})

test.describe('CB the command book', () => {
  test('CB-H1 lists what is unlocked, and nothing that is not', async ({ page }) => {
    await openGame(page)
    await page.getByRole('button', { name: 'Command book' }).click()
    const book = page.getByRole('region', { name: 'The drone does' })
    await expect(book).toContainText('harvest()')
    await expect(book).toContainText('flip()')
    await expect(page.getByText('move(direction)')).toHaveCount(0)
    await expect(page.getByText(/more commands are waiting in the research tree/)).toBeVisible()
    await a11y(page)
  })

  test('CB-H2 grows with the research', async ({ page }) => {
    await openGame(page, 'mid')
    await page.getByRole('button', { name: 'Command book' }).click()
    await expect(page.getByText('move(direction)')).toBeVisible()
    await page.getByLabel('Search commands').fill('carrot')
    await expect(page.getByText('Entities.Carrot', { exact: true })).toBeVisible()
  })
})

test.describe('ST the settings page', () => {
  test('ST-H1 autocomplete can be switched off there', async ({ page }) => {
    await openGame(page)
    const editor = page.getByRole('textbox', { name: 'main.py' })
    await editor.click()
    await page.keyboard.type('har')
    await expect(page.getByRole('option', { name: /harvest/ })).toBeVisible()
    await page.getByRole('option', { name: /harvest/ }).click()
    await expect(editor).toContainText('harvest()')

    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    await page.getByRole('switch', { name: 'Suggest commands while I type' }).click()
    await a11y(page)
    await page.goBack()
    await page.getByRole('textbox', { name: 'main.py' }).click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('har')
    await page.waitForTimeout(400)
    await expect(page.getByRole('option', { name: /harvest/ })).toHaveCount(0)
  })

  test('3D-H1 the farm draws in 3D, and the flat view is one switch away', async ({ page }) => {
    await openGame(page, 'mid')
    const webgl = () => page.locator('canvas').first().evaluate(c => !!(c as HTMLCanvasElement).getContext('webgl2'))
    await expect.poll(webgl).toBe(true)
    await page.goto('/app.html#/settings')
    await page.getByRole('switch', { name: /3D farm/ }).click()
    await page.goto('/app.html?preset=mid#/play/slot1')
    await expect.poll(() => page.locator('canvas').first().evaluate(c => !!(c as HTMLCanvasElement).getContext('2d'))).toBe(true)
  })
})

test.describe('RT the research tree', () => {
  test('RT-H1 shows every idea in a tree, hidden ones as not yet discovered', async ({ page }) => {
    await openGame(page)
    await page.getByRole('toolbar').getByRole('button', { name: 'Research tree', exact: true }).click()
    const tree = page.getByRole('list', { name: 'Research tree' })
    await expect(tree.getByRole('button', { name: /Loops/ })).toBeVisible()
    expect(await tree.getByText('Not yet discovered').count()).toBeGreaterThan(20)
  })
})

test.describe('ED the editor and windows', () => {
  test('ED-H1 Ctrl+click a file name after import opens that file', async ({ page }) => {
    await openGame(page, 'mid')
    await page.getByRole('button', { name: 'New code file' }).click()
    await page.getByLabel('File name (without .py)').fill('helpers')
    await page.getByRole('button', { name: 'Create' }).click()
    await setCode(page, 'import helpers\nprint(1)')
    // bring main.py to the front, so helpers.py is behind it
    await page.getByRole('toolbar').getByRole('button', { name: 'main.py', exact: true }).click()
    const word = page.getByRole('textbox', { name: 'main.py' }).locator('.cm-module', { hasText: 'helpers' })
    await expect(word).toHaveCount(1)
    await word.click({ modifiers: ['Control'] })
    await expect(page.getByRole('toolbar').getByRole('button', { name: 'helpers.py', exact: true })).toHaveClass(/text-accent/)
  })

  test('ED-H2 a window resizes from its edges, and keeps its size after a reload', async ({ page }) => {
    await openGame(page)
    const win = page.getByRole('dialog', { name: 'Output' })
    const before = (await win.boundingBox())!
    const edge = win.locator('[data-resize="e"]')
    const e = (await edge.boundingBox())!
    await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2)
    await page.mouse.down()
    await page.mouse.move(e.x + 120, e.y + e.height / 2, { steps: 5 })
    await page.mouse.up()
    const s = (await win.locator('[data-resize="s"]').boundingBox())!
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
    await page.mouse.down()
    await page.mouse.move(s.x + s.width / 2, s.y + 60, { steps: 5 })
    await page.mouse.up()
    const after = (await win.boundingBox())!
    expect(after.width).toBeGreaterThan(before.width + 100)
    expect(after.height).toBeGreaterThan(before.height + 40)
    await page.waitForTimeout(500)
    await page.reload()
    const again = (await page.getByRole('dialog', { name: 'Output' }).boundingBox())!
    expect(Math.abs(again.width - after.width)).toBeLessThan(3)
  })
})

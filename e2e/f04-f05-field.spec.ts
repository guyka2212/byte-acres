import { count, expect, openGame, output, run, setCode, stopButton, test, waitIdle } from './fixtures'

test.describe('F04 expand and sweep', () => {
  test('F04-H1 the sweep program farms the whole field', async ({ page }) => {
    await openGame(page, 'mid')
    const wood0 = await count(page, 'Wood')
    await run(page) // the preset's mixed-farm program
    await expect(stopButton(page)).toBeVisible()
    await expect.poll(() => count(page, 'Wood'), { timeout: 20_000 }).toBeGreaterThan(wood0)
  })

  test('F04-E1 moving off the top wraps to the bottom', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'for i in range(get_world_size()):\n    move(North)\nprint(get_pos_y(), get_world_size())')
    await run(page)
    await expect(output(page)).toContainText('0 5')
  })
})

test.describe('F05 soil crops', () => {
  test('F05-H1 till then plant a carrot, charged in hay and wood', async ({ page }) => {
    await openGame(page, 'mid')
    await expect.poll(() => count(page, 'Hay')).toBeGreaterThan(0) // the preset's counts have arrived
    const hay0 = await count(page, 'Hay')
    await setCode(page, 'move(East)\nmove(North)\nwhile get_entity_type() != None and not can_harvest():\n    pass\nharvest()\nif get_ground_type() != Grounds.Soil:\n    till()\nprint(plant(Entities.Carrot), get_ground_type(), get_entity_type())')
    await run(page)
    await expect(output(page)).toContainText('True Grounds.Soil Entities.Carrot', { timeout: 20_000 })
    await waitIdle(page)
    expect(await count(page, 'Hay')).toBe(hay0 - 3)
  })

  test('F05-N1 a carrot on grassland is refused with a hint', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'move(East)\nprint(plant(Entities.Carrot))')
    await run(page)
    await expect(output(page)).toContainText('False')
    await expect(output(page)).toContainText('only grow on soil')
  })

  test('F05-E1 water makes a tile wetter and costs water', async ({ page }) => {
    await openGame(page, 'mid')
    await setCode(page, 'move(East)\nmove(North)\nbefore = get_water()\nn = num_items(Items.Water)\nuse_item(Items.Water)\nprint(get_water() > before, num_items(Items.Water) < n + 1)')
    await run(page)
    await expect(output(page)).toContainText('True True')
  })
})

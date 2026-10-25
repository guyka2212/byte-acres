// Runs against the cloud-enabled build on :4174 whose Supabase URL is a closed
// local port: every player needs an account there, and the server never answers.
import { a11y, expect, test } from './fixtures'

test.describe('AU sign-in required (server unreachable)', () => {
  // the browser itself logs the refused connection; that is the scenario, not a bug
  test.use({ allowConsole: [/Failed to load resource: net::ERR_(UNSAFE_PORT|CONNECTION_REFUSED)/] })

  test('AU-H1 the game asks for an account before anything else', async ({ page }) => {
    await page.goto('/app.html#/play/slot1')
    await expect(page.getByRole('heading', { name: 'Make your free account' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run main' })).toHaveCount(0)
    await a11y(page)
    await page.getByRole('tab', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('AU-E1 bad input is caught before anything is sent', async ({ page }) => {
    await page.goto('/app.html#/signup')
    await page.getByLabel('Name others see').fill('Sam')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password').fill('longenough')
    await page.getByRole('button', { name: 'Create account' }).last().click()
    expect(await page.getByLabel('Email').evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false)
    await page.getByLabel('Email').fill('sam@example.com')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).last().click()
    expect(await page.getByLabel('Password').evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false)
  })

  test('AU-E2 server down: a clear message, no crash', async ({ page }) => {
    await page.goto('/app.html#/signin')
    await page.getByLabel('Email').fill('player@example.com')
    await page.getByLabel('Password').fill('a-long-password')
    await page.getByRole('button', { name: 'Sign in' }).last().click()
    await expect(page.getByRole('alert')).toHaveText("Couldn't reach the server. Check your connection and try again.")
  })
})

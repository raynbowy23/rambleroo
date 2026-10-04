import { expect, test } from './fixtures'

test('sign-in is visible and signed-out trips stay in this browser', async ({ page, isMobile }) => {
  await page.route('**/api/auth/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  let writes = 0
  await page.route('**/api/data**', (route) => {
    writes++
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Sign in required"}' })
  })
  await page.addInitScript(() => {
    if (!localStorage.getItem('rambleroo.trip.v1'))
      localStorage.setItem(
        'rambleroo.trip.v1',
        JSON.stringify({ version: 1, state: { roads: [{ bywayId: 'local-road', addedAt: '2026-10-04T00:00:00.000Z' }] } }),
      )
  })
  await page.goto('/passport')
  const area = isMobile ? page.locator('main') : page.locator('header').first()
  await expect(area.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByText('Saved in this browser. Sign in to keep it on every device.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(area.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  const trip = await page.evaluate(() => JSON.parse(localStorage.getItem('rambleroo.trip.v1')!).state.roads)
  expect(trip).toHaveLength(1)
  expect(trip[0].bywayId).toBe('local-road')
  expect(writes).toBe(0)
})

test('email sign-in sends the Turnstile token with the request and confirms the link was sent', async ({ page, isMobile }) => {
  // A stand-in Turnstile that passes immediately; the real widget never loads in tests.
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("test-token"));return "w1"},remove(){},reset(){}}',
    }),
  )
  let captcha: string | null = null
  let body: { email?: string } = {}
  await page.route('**/api/auth/**', (route) => {
    const request = route.request()
    if (request.url().includes('/sign-in/magic-link')) {
      captcha = request.headers()['x-captcha-response'] ?? null
      body = request.postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":true}' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
  await page.goto('/passport')
  const area = isMobile ? page.locator('main') : page.locator('header').first()
  await area.getByRole('button', { name: 'Sign in', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Sign in to Rambleroo' })
  await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await dialog.getByLabel('Email').fill('traveller@example.com')
  await dialog.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(dialog.getByText(/We sent a sign-in link to/)).toBeVisible()
  expect(captcha).toBe('test-token')
  expect(body.email).toBe('traveller@example.com')
})

test('the sign-in dialog offers passkeys where the browser supports them', async ({ page, isMobile }) => {
  await page.route('**/api/auth/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'window.turnstile={render:()=>"w1",remove(){},reset(){}}' }),
  )
  await page.goto('/passport')
  const area = isMobile ? page.locator('main') : page.locator('header').first()
  await area.getByRole('button', { name: 'Sign in', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Sign in to Rambleroo' })
  const supported = await page.evaluate(() => 'PublicKeyCredential' in window)
  await expect(dialog.getByRole('button', { name: 'Sign in with a passkey' })).toHaveCount(supported ? 1 : 0)
})

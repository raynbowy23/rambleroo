import { readFileSync } from 'node:fs'
import { expect, test, type Page } from './fixtures'

const catalog = JSON.parse(readFileSync(new URL('../../public/data/catalog.json', import.meta.url), 'utf8'))
const roads = catalog.byways.slice(0, 2) as { id: string; name: string; mappedMiles: number }[]
const slug = 'abcdefghijklmnopqr'
const snapshot = { kind: 'trip', title: 'Autumn roads', roads: roads.map((road) => road.id) }

test('public snapshot shows ordered cards, miles and noindex with just one API request', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    // Signed out: the session check answers null; only the share itself returns the snapshot.
    return route.fulfill({ json: path.startsWith('/api/public/shares/') ? snapshot : null })
  })
  await page.goto(`/s/${slug}`)
  await expect(page.getByRole('heading', { name: 'Autumn roads' })).toBeVisible()
  await expect(page.locator('ol h2')).toHaveText(roads.map((road) => road.name))
  await expect(
    page.getByText(`2 roads · ${Math.round(roads.reduce((n, road) => n + road.mappedMiles, 0)).toLocaleString()} mapped miles`, {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  expect(requests).toEqual([`/api/public/shares/${slug}`])
  await page.getByRole('link', { name: 'Start your own trip on Rambleroo' }).click()
  await expect(page.getByRole('heading', { name: 'Your trip', exact: true })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
})

test('missing share has a friendly turned-off page', async ({ page }) => {
  await page.route('**/api/public/shares/**', (route) => route.fulfill({ status: 404, json: { error: 'Not found' } }))
  await page.goto(`/s/${slug}`)
  await expect(page.getByRole('heading', { name: 'This link was turned off' })).toBeVisible()
})

test('passport snapshot renders saved roads, visit dates and opted-in notes', async ({ page }) => {
  await page.route('**/api/public/shares/**', (route) =>
    route.fulfill({
      json: {
        ...snapshot,
        kind: 'passport',
        saved: [roads[0].id],
        visits: [{ bywayId: roads[0].id, date: '2026-10-03', note: 'A quiet afternoon' }],
      },
    }),
  )
  await page.goto(`/s/${slug}`)
  await expect(page.getByText('Saved road', { exact: true })).toBeVisible()
  await expect(page.getByText('A quiet afternoon')).toBeVisible()
  await expect(page.locator('time')).toHaveText('2026-10-03')
})

async function signedIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('rambleroo.passkey-offered.one', '1')
    localStorage.setItem('rambleroo.account.imported.one', 'true')
  })
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({
      json: route.request().url().includes('list-passkeys')
        ? []
        : {
            user: { id: 'one', name: 'Owner', email: 'owner@example.test' },
            session: { id: 'session', userId: 'one', expiresAt: '2099-01-01T00:00:00.000Z' },
          },
    }),
  )
  await page.route('**/api/data', (route) =>
    route.fulfill({
      json: {
        trip: { updatedAt: 1, json: { version: 1, roads: [{ bywayId: roads[0].id, addedAt: '2026-10-04' }] } },
        passport: { updatedAt: 1, json: { version: 1, saved: { [roads[0].id]: '2026-10-04' }, visits: [] } },
        garage: null,
        postcards: null,
      },
    }),
  )
}

for (const kind of ['trip', 'passport'] as const) {
  test(`${kind} dialog creates, copies and turns off a link with notes off by default`, async ({ page }) => {
    await signedIn(page)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            ;(window as unknown as { copied: string }).copied = text
          },
        },
      })
    })
    let body: unknown
    let shared = false
    let revoked = false
    await page.route('**/api/shares**', (route) => {
      if (route.request().method() === 'DELETE') {
        revoked = true
        return route.fulfill({ json: { ok: true } })
      }
      const share = { slug, kind, title: 'Fall getaway', created: 1791072000000, revoked: revoked ? 1791072000001 : null }
      if (route.request().method() === 'POST') {
        shared = true
        body = route.request().postDataJSON()
        return route.fulfill({ status: 201, json: share })
      }
      return route.fulfill({ json: shared ? [share] : [] })
    })
    await page.goto(`/${kind}`)
    // Signed in: the account button is in the header on desktop and on the passport page on phones; the trip page shows its share list.
    await expect(
      kind === 'trip'
        ? page.getByRole('heading', { name: 'Your share links' })
        : page.getByRole('button', { name: 'Owner', exact: true }).first(),
    ).toBeAttached()
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `Share your ${kind}` })
    await dialog.getByLabel('Title', { exact: true }).fill('Fall getaway')
    if (kind === 'passport') await expect(dialog.getByLabel('Include my notes')).not.toBeChecked()
    else await expect(dialog.getByLabel('Include my notes')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Create link' }).click()
    await expect(dialog.getByLabel('Share URL')).toHaveValue(new RegExp(`/s/${slug}$`))
    expect(body).toEqual({ kind, title: 'Fall getaway', includeNotes: false })
    await expect(dialog.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute('href', /^mailto:/)
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(`/s/${slug}`)
    await dialog.getByRole('button', { name: 'Close dialog' }).click()
    if (kind === 'passport') await page.goto('/trip')
    await page.getByRole('button', { name: 'Turn off', exact: true }).click()
    await expect(page.getByText('Fall getaway · Turned off')).toBeVisible()
    expect(revoked).toBe(true)
  })
}

test('signed-out Share opens sign-in and explains why', async ({ page }) => {
  await page.route('**/api/auth/**', (route) => route.fulfill({ json: null }))
  await page.goto('/trip')
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Sign in to Rambleroo' }).getByText('Sharing needs an account so you can turn your links off later.'),
  ).toBeVisible()
})

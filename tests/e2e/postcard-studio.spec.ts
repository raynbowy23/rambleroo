import { expect, test } from '@playwright/test'
const id = 'door-county-coastal-byway-81450'

test('your model and colour follow you from the passport to the strip', async ({ page }) => {
  await page.goto('/passport')
  const garage = page.getByRole('region', { name: 'Your car', exact: true })
  await garage.getByRole('radio', { name: 'camper', exact: true }).check()
  await garage.getByRole('button', { name: 'Sky blue', exact: true }).click()
  await garage.getByLabel('Plate', { exact: true }).fill('ROAD 23')
  await page.goto(`/byway/${id}/strip`)
  await expect(page.locator('[data-vehicle="camper"]')).toHaveAttribute('data-body', '#86b9d4')
  await page.getByRole('button', { name: 'Change your car' }).click()
  await expect(page.getByRole('radio', { name: 'camper', exact: true })).toBeChecked()
})

test('own photo stays local and removes credit; Commons restores mandatory credit', async ({ page }) => {
  await page.goto(`/byway/${id}`)
  await page.getByRole('button', { name: 'Customize', exact: true }).click()
  const studio = page.getByRole('dialog', { name: 'Customize postcard', exact: true })
  await studio.getByRole('radio', { name: 'Your photo', exact: true }).check()
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 20
    canvas.height = 20
    const context = canvas.getContext('2d')!
    context.fillStyle = '#86b9d4'
    context.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.setInputFiles('input[aria-label="Add your photo"]', {
    name: 'my-road.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await expect(studio.locator('[data-card-front] image')).toHaveAttribute('href', /^blob:/)
  await expect(studio.getByText('Wikimedia Commons', { exact: true })).toHaveCount(0)
  await studio.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Customize', exact: true }).click()
  await expect(studio.locator('[data-card-front] image')).toHaveAttribute('href', /^blob:/)
  await studio.getByRole('radio', { name: 'Photo', exact: true }).check()
  await expect(studio.getByRole('link', { name: 'Wikimedia Commons', exact: true })).toBeVisible()
  await expect(studio.getByText(/This photo's licence requires its credit/)).toBeVisible()
})

test('keeps a milestone postcard and its choices in the passport', async ({ page }) => {
  await page.goto(`/byway/${id}/strip`)
  await page.getByRole('button', { name: 'Postcard from Ephraim', exact: true }).first().click()
  const card = page.getByRole('dialog', { name: 'Postcard from Ephraim', exact: true })
  await card.getByRole('button', { name: 'Customize', exact: true }).click()
  const studio = page.getByRole('dialog', { name: 'Customize postcard', exact: true })
  await studio.getByLabel('Message for the back').fill('A quiet afternoon by the lake.')
  await studio.getByLabel('Lettering', { exact: true }).selectOption('script')
  await studio.getByRole('button', { name: 'Done', exact: true }).click()
  await card.getByRole('button', { name: 'Keep this postcard', exact: true }).click()
  await card.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Postcard from Ephraim, kept', exact: true })).toBeVisible()
  await page.goto('/passport')
  const postcards = page.getByRole('region', { name: 'Postcards', exact: true })
  await expect(postcards.getByRole('heading', { name: 'Ephraim', exact: true })).toBeVisible()
  await expect(postcards.locator('[data-lettering="script"]')).toHaveCount(1)
  await postcards.getByRole('button', { name: 'Turn over', exact: true }).click()
  await expect(postcards.getByLabel('Your note')).toHaveValue('A quiet afternoon by the lake.')
  await postcards.getByRole('button', { name: 'Remove postcard', exact: true }).click()
  await expect(postcards.getByRole('heading', { name: 'Ephraim', exact: true })).toHaveCount(0)
})

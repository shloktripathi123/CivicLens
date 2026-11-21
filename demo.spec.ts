import { test, expect } from '@playwright/test';

test('Civic Lens — search-engine walkthrough', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' });
  const scroll = async (top = 500) => {
    await page.evaluate((t) => window.scrollBy({ top: t, behavior: 'smooth' }), top);
    await page.waitForTimeout(2000);
  };

  // 1. Homepage search by ZIP, then open a result
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Who represents you');
  await page.waitForTimeout(3000);

  const home = page.getByRole('searchbox', { name: 'Search by name or place' });
  await home.click();
  await home.pressSequentially('97201', { delay: 150 });
  await home.press('Enter');
  const firstResult = page.getByRole('link', { name: /97201/ }).first();
  await expect(firstResult).toBeVisible();
  await page.waitForTimeout(3000);
  await scroll();

  await firstResult.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('97201');
  await page.waitForTimeout(4500);
  await scroll();
  await scroll();

  // 2. People tab search
  await nav.getByRole('link', { name: 'People' }).click();
  await expect(page).toHaveURL(/\/people/);
  await page.waitForTimeout(3000);

  const people = page.getByRole('searchbox', { name: 'Search for a person by name' });
  await people.click();
  await people.pressSequentially('Tina Kotek', { delay: 150 });
  await people.press('Enter');
  await expect(page.getByRole('link', { name: /Tina Kotek/ }).first()).toBeVisible();
  await page.waitForTimeout(3500);
  await scroll();

  // Open the profile and show the exhaustive "Full record" accordions
  await page.getByRole('link', { name: /Tina Kotek/ }).first().click();
  const full = page.getByRole('heading', { name: 'Full record' });
  await expect(full).toBeVisible();
  await full.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  // Every slot is present; empty ones show an explicit "None recorded" fallback
  for (const name of ['Identity', 'Affiliations', 'Bills passed and sponsored', 'Floor votes', 'Projects', 'Funding and financials', 'Third-party ratings']) {
    await expect(page.locator('.deep summary', { hasText: name })).toBeVisible();
  }
  const votes = page.locator('.deep details', { hasText: 'Floor votes' });
  await votes.locator('summary').click();
  await expect(votes.getByText(/No recorded history in our data/)).toBeVisible();
  await page.waitForTimeout(3500);
  await scroll();

  // 3. Elections tab
  await nav.getByRole('link', { name: 'Elections' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Elections and voting');
  await page.waitForTimeout(3000);

  const state = page.getByLabel(/State/);
  await state.click();
  await state.pressSequentially('OR', { delay: 150 });
  await state.press('Enter');
  await expect(page.getByRole('heading', { name: /Register and vote in OR/ })).toBeVisible();
  // New key dates: registration deadline, ballots mailed, drop boxes
  await expect(page.getByText('Voter registration deadline:')).toBeVisible();
  await expect(page.getByText('Drop boxes close:')).toBeVisible();
  await page.getByRole('heading', { name: 'Key dates' }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  await scroll();

  // 4. Bills tab search
  await nav.getByRole('link', { name: 'Bills' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bills');
  await page.waitForTimeout(3000);

  const bills = page.getByRole('textbox', { name: 'Search bills' });
  await bills.click();
  await bills.pressSequentially('Education', { delay: 150 });
  await bills.press('Enter');
  await expect(page).toHaveURL(/q=Education/);
  await page.waitForTimeout(4000);
  await scroll();
  await scroll();

  // 5. Places tab
  await nav.getByRole('link', { name: 'Places' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Browse by state');
  await page.waitForTimeout(3000);
  await scroll();
  await scroll();
});
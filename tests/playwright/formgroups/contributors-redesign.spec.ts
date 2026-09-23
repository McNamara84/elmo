import { test, expect } from '@playwright/test';

test('Contributors starts empty and shares contact status with Authors', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).contributorStack && (window as any).authorStack));
  test.skip((await page.locator('[data-contributor-add-type]').count()) < 2, 'Both Contributor types are required for this flow.');
  const cards = page.locator('[data-contributor-card]');
  const authorBadge = page.locator('[data-author-contact-summary]');
  const contributorBadge = page.locator('[data-contributor-contact-summary]');

  await expect(cards).toHaveCount(0);
  await expect(page.locator('[data-contributor-add-type="person"]')).toBeVisible();
  await expect(page.locator('[data-contributor-add-type="institution"]')).toBeVisible();
  await expect(authorBadge).toContainText(/contact|Kontakt/i);
  await expect(contributorBadge).toHaveText(await authorBadge.textContent() || '');

  await page.locator('[data-contributor-add-type="person"]').click();
  await cards.first().locator('[name="cbPersonLastname[]"]').fill('Doe');
  await page.evaluate(() => {
    const input = document.querySelector('[data-contributor-card] [name="cbPersonRoles[]"]') as HTMLInputElement & { _tagify?: any };
    if (input._tagify) input._tagify.addTags([{ value: 'Contact Person' }]);
    else input.value = '[{"value":"Contact Person"}]';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(authorBadge).toHaveClass(/text-bg-success/);
  await expect(contributorBadge).toHaveText(await authorBadge.textContent() || '');
  await expect(cards.first().locator('[data-contributor-contact-fields]')).toBeVisible();

  await page.locator('[data-contributor-add-type="institution"]').click();
  await cards.nth(1).locator('[name="cbOrganisationName[]"]').fill('Institute');
  await cards.nth(1).locator('[data-contributor-move-up]').click();
  await expect(cards.first().locator('[data-contributor-name]')).toHaveText('Institute');
  await cards.nth(1).locator('[data-contributor-remove]').click();
  await expect(authorBadge).toHaveClass(/text-bg-warning/);
  await expect(contributorBadge).toHaveText(await authorBadge.textContent() || '');
});

test('disabled institution contact role does not become active on restore', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  test.skip(await page.evaluate(() => (window as any).ELMO_FEATURES?.showContactInstitution === true),
    'This case applies only when institution contacts are disabled.');
  await page.evaluate(() => {
    (window as any).contributorStack.setContributors([{
      type: 'institution', institutionname: 'Institute', roles: ['Contact Person'],
      email: 'info@example.org', affiliations: []
    }]);
  });
  const payload = await page.evaluate(() => (window as any).contributorStack.collectPayload());
  expect(payload[0].roles).not.toContain('Contact Person');
  await expect(page.locator('[data-contributor-contact-summary]')).toHaveClass(/text-bg-warning/);
});

test('enabled institution contact role updates both headers', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  test.skip(await page.evaluate(() => (window as any).ELMO_FEATURES?.showContactInstitution !== true),
    'This case applies only when institution contacts are enabled.');
  await page.locator('[data-contributor-add-type="institution"]').click();
  const card = page.locator('[data-contributor-card]').first();
  await card.locator('[name="cbOrganisationName[]"]').fill('Institute');
  await page.evaluate(() => {
    const input = document.querySelector('[data-contributor-card] [name="cbOrganisationRoles[]"]') as HTMLInputElement & { _tagify?: any };
    if (input._tagify) input._tagify.addTags([{ value: 'Contact Person' }]);
    else input.value = '[{"value":"Contact Person"}]';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(card.locator('[data-contributor-contact-fields]')).toBeVisible();
  await expect(page.locator('[data-author-contact-summary]')).toHaveClass(/text-bg-success/);
  await expect(page.locator('[data-contributor-contact-summary]')).toHaveClass(/text-bg-success/);
});

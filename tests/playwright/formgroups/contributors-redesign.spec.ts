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

test('dragging the handle changes contributor order and saved payload', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  const cards = page.locator('[data-contributor-card]');
  await page.evaluate(() => (window as any).contributorStack.setContributors([
    { type: 'person', familyname: 'First', roles: [] },
    { type: 'person', familyname: 'Second', roles: [] }
  ]));
  await expect(cards).toHaveCount(2);
  await cards.first().locator('[data-contributor-toggle-edit]').click();
  await cards.nth(1).locator('[data-contributor-toggle-edit]').click();
  await cards.nth(1).locator('[data-contributor-drag]').dragTo(cards.first().locator('[data-contributor-drag]'));
  await expect(cards.first().locator('[data-contributor-name]')).toHaveText('Second');
  expect(await page.evaluate(() => (window as any).contributorStack.collectPayload().map((entry: any) => entry.familyname)))
    .toEqual(['Second', 'First']);
});

test('person role picker excludes institution-only roles', async ({ page }) => {
  await page.route('**/api/v2/vocabs/roles?type=*', route => {
    const type = new URL(route.request().url()).searchParams.get('type');
    const names = type === 'person' ? ['Researcher'] : type === 'institution' ? ['Distributor'] : ['Data Collector'];
    return route.fulfill({ json: names.map(name => ({ name })) });
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  await page.locator('[data-contributor-add-type="institution"]').click();
  await page.locator('[data-contributor-add-type="person"]').click();
  const roles = page.locator('[data-contributor-card][data-contributor-type="person"] [name="cbPersonRoles[]"]');
  await expect.poll(() => roles.evaluate((input: any) => input._tagify?.settings.whitelist)).toEqual(
    expect.arrayContaining(['Researcher', 'Data Collector', 'Contact Person'])
  );
  expect(await roles.evaluate((input: any) => input._tagify.settings.whitelist)).not.toContain('Distributor');
});

test('contact fields and editable affiliations follow the requested rows', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  await page.locator('[data-contributor-add-type="person"]').click();
  await page.locator('[data-contributor-add-type="institution"]').click();
  const person = page.locator('[data-contributor-card][data-contributor-type="person"]');
  const institution = page.locator('[data-contributor-card][data-contributor-type="institution"]');

  await page.evaluate(() => {
    const input = document.querySelector('[data-contributor-type="person"] [name="cbPersonRoles[]"]') as HTMLInputElement & { _tagify?: any };
    if (input._tagify) input._tagify.addTags([{ value: 'Contact Person' }]);
    else input.value = '[{"value":"Contact Person"}]';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(person.locator('[data-contributor-contact-fields]')).toBeVisible();
  expect(await person.locator('[data-contributor-edit-panel] > .row').evaluateAll(rows =>
    rows.map(row => Array.from(row.querySelectorAll('input')).map(input => input.name).filter(Boolean))
  )).toEqual([
    expect.arrayContaining(['cbORCID[]', 'cbPersonLastname[]', 'cbPersonFirstname[]', 'cbPersonRoles[]']),
    ['cbContactWebsite[]', 'cbContactEmail[]'],
    ['cbAffiliation[]', 'cbpRorIds[]']
  ]);
  await expect(person.locator('[data-contributor-affiliation-row] > .col-12')).toHaveCount(1);
  await expect(institution.locator('[data-contributor-affiliation-row] > .col-12')).toHaveCount(1);
  await expect(person.locator('[name="cbAffiliation[]"]')).toHaveAttribute('name', 'cbAffiliation[]');
  await expect(institution.locator('[name="OrganisationAffiliation[]"]')).toHaveAttribute('name', 'OrganisationAffiliation[]');
});

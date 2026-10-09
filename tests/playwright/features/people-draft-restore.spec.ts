import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const legacy = JSON.parse(readFileSync(path.resolve(__dirname, '../../fixtures/author-contributor-drafts/legacy.json'), 'utf8'));

async function checkPeopleIds(page: Page) {
  const errors = await page.evaluate(() => {
    const groups = document.querySelectorAll('[data-author-stack-formgroup], [data-contributor-formgroup]');
    const errors: string[] = [];
    groups.forEach(group => {
      group.querySelectorAll('[id]').forEach(element => {
        if (document.querySelectorAll(`[id="${element.id}"]`).length !== 1) errors.push(`Duplicate: ${element.id}`);
      });
      group.querySelectorAll('label[for], [aria-labelledby], [aria-describedby], [aria-controls]').forEach(element => {
        const references = ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls']
          .flatMap(attribute => (element.getAttribute(attribute) || '').split(/\s+/)).filter(Boolean);
        references.forEach(id => { if (!document.getElementById(id)) errors.push(`Missing: ${id}`); });
      });
    });
    return errors;
  });
  expect(errors).toEqual([]);
}

async function mockDraft(page: Page, values: Record<string, unknown>) {
  let record = { id: 'people-draft', updatedAt: '2026-01-01T12:00:00Z', payload: { values } };
  const writes: Record<string, any>[] = [];
  await page.route('**/api/v2/drafts**', async route => {
    const method = route.request().method();
    if (method === 'PUT' || method === 'POST') {
      const body = route.request().postDataJSON();
      writes.push(body.payload.values);
      record = { ...record, payload: body.payload };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
  });
  await page.goto('/');
  await expect(page.locator('#modal-restore-draft')).toBeVisible();
  await expect(page.locator('#modal-restore-draft')).toHaveCSS('opacity', '1');
  return writes;
}

test('old drafts survive migration, reordering, saving and a second restore', async ({ page }) => {
  test.slow();
  const writes = await mockDraft(page, legacy);
  await page.locator('#button-restore-apply').click();
  await expect(page.locator('#modal-restore-draft')).toBeHidden();
  await expect(page.locator('[data-author-card]')).toHaveCount(3);
  await expect(page.locator('[data-contributor-card]')).toHaveCount(3);
  expect(writes).toHaveLength(0);
  await checkPeopleIds(page);

  const initial = await page.evaluate(() => ({
    authors: (window as any).authorStack.collectPayload(),
    contributors: (window as any).contributorStack.collectPayload()
  }));
  expect(initial.authors[1]).toMatchObject({ isContact: true, email: 'last@example.org' });
  expect(initial.authors[0].affiliations).toEqual([
    { label: 'Institute, Berlin', rorId: '' }, { label: 'Lab', rorId: '04z8jg394' }
  ]);

  await page.locator('[data-author-card]').nth(2).locator('[data-author-move-up]').click();
  await page.locator('[data-contributor-card]').nth(2).locator('[data-contributor-move-up]').click();
  await expect.poll(() => writes.length, { timeout: 20000 }).toBeGreaterThan(0);
  const saved = writes.at(-1)!;
  expect(saved).not.toHaveProperty('familynames[]');
  expect(saved).not.toHaveProperty('cbOrganisationName[]');
  const expected = await page.evaluate(() => ({
    authors: (window as any).authorStack.collectPayload(),
    contributors: (window as any).contributorStack.collectPayload()
  }));
  expect(JSON.parse(saved.authorsPayload)).toEqual(expected.authors);
  expect(JSON.parse(saved.contributorsPayload)).toEqual(expected.contributors);

  await page.reload();
  await expect(page.locator('#modal-restore-draft')).toBeVisible();
  await expect(page.locator('#modal-restore-draft')).toHaveCSS('opacity', '1');
  await page.locator('#button-restore-apply').click();
  await expect(page.locator('#modal-restore-draft')).toBeHidden();
  const restored = await page.evaluate(() => ({
    authors: (window as any).authorStack.collectPayload(),
    contributors: (window as any).contributorStack.collectPayload()
  }));
  // Entry keys identify live DOM cards and are regenerated on a fresh page.
  const authorData = (entries: any[]) => entries.map(({ entryKey, ...entry }) => entry);
  expect(authorData(restored.authors)).toEqual(authorData(expected.authors));
  expect(restored.contributors).toEqual(expected.contributors);
  await checkPeopleIds(page);
});

test('damaged people payloads keep the original draft and form intact', async ({ page }) => {
  const writes = await mockDraft(page, { ...legacy, authorsPayload: '{' });
  await page.locator('#button-restore-apply').click();
  await expect(page.locator('#modal-restore-draft-description')).toContainText(/invalid|ungültig/i);
  await expect(page.locator('[data-author-card]')).toHaveCount(0);
  await expect(page.locator('[data-contributor-card]')).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test('restores ROR-only affiliations and equal labels without losing their identifiers', async ({ page }) => {
  test.slow();
  const affiliations = [
    { label: '', rorId: '04z8jg394' },
    { label: 'Shared label', rorId: '01bj3aw27' },
    { label: 'Shared label', rorId: '02nr0ka47' }
  ];
  const writes = await mockDraft(page, {
    'cbPersonLastname[]': ['Sparse'],
    'cbAffiliation[]': [JSON.stringify(affiliations)],
    'cbpRorIds[]': ['04z8jg394,01bj3aw27,02nr0ka47']
  });
  await page.locator('#button-restore-apply').click();
  await expect(page.locator('#modal-restore-draft')).toBeHidden();
  const card = page.locator('[data-contributor-card]');
  await expect(card.locator('.tagify__tag-text')).toHaveText(['04z8jg394', 'Shared label', 'Shared label']);
  expect(await page.evaluate(() => (window as any).contributorStack.collectPayload()[0].affiliations)).toEqual(affiliations);

  const editButton = card.locator('.tagify__tag__editBtn').first();
  await editButton.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await editButton.click();
  await expect(page.locator('#modal-affiliation-edit')).toBeVisible();
  await expect(page.locator('#input-affiliation-edit-value')).toHaveValue('');
  await page.locator('#input-affiliation-edit-value').fill('Recovered label');
  await page.locator('#button-affiliation-edit-save').click();
  await expect(page.locator('#modal-affiliation-edit')).toBeHidden();
  const expected = [{ label: 'Recovered label', rorId: '04z8jg394' }, ...affiliations.slice(1)];
  await expect.poll(() => writes.length, { timeout: 20000 }).toBeGreaterThan(0);
  expect(JSON.parse(writes.at(-1)!.contributorsPayload)[0].affiliations).toEqual(expected);
  await checkPeopleIds(page);
});

test('mixed cards keep unique IDs through repeated imports, type switches and reset', async ({ page }) => {
  await page.route('**/api/v2/drafts**', route => route.fulfill({ status: 204, body: '' }));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).authorStack && (window as any).contributorStack));
  for (let iteration = 0; iteration < 2; iteration++) {
    await page.evaluate(async () => {
      (window as any).authorStack.setAuthors([
        { type: 'person', familyname: 'Doe', isContact: true, email: 'doe@example.org', affiliations: [{ label: 'Lab', rorId: '04z8jg394' }] },
        { type: 'institution', institutionname: 'Institute' }
      ]);
      (window as any).contributorStack.setContributors([
        { type: 'institution', institutionname: 'Archive', roles: ['Distributor'] },
        { type: 'person', familyname: 'Smith', roles: ['Researcher'] }
      ]);
    });
    await checkPeopleIds(page);
    await page.locator('[data-contributor-add-type="institution"]').click();
    await page.locator('[data-contributor-card]').last().locator('[data-contributor-type-option="person"]').click();
    await page.locator('[data-author-card]').nth(1).locator('[data-author-remove]').click();
    await page.locator('[data-author-add-type="institution"]').click();
    await checkPeopleIds(page);
    await page.evaluate(async () => {
      const clear = await (window as any).loadClearInputFields();
      clear();
    });
    await expect(page.locator('[data-author-card], [data-contributor-card]')).toHaveCount(0);
    await checkPeopleIds(page);
  }
});

import { test, expect } from '@playwright/test';
import { navigateToHome, runAxeAudit } from '../utils';

// Keep pointer targets stable while the browser scrolls between card controls.
test.use({reducedMotion: 'reduce'});

for (const group of ['author', 'contributor']) {
  for (const type of ['person', 'institution']) {
    test(`${group} ${type}: shared ROR, free text, summary and pending decisions`, async ({ page }) => {
      await page.route('**/api/v2/affiliations/search**', route => route.fulfill({
        json: [{name: 'GFZ Helmholtz Centre for Geosciences', id: '04z8jg394'}, {name: 'University of Potsdam', id: '012m9bp23'}]
      }));
      await navigateToHome(page);
      await page.waitForFunction(() => Boolean((window as any).authorStack && (window as any).contributorStack));
      const supported = await page.evaluate(({group, type}) => (window as any)[`${group}Stack`].supportsType(type), {group, type});
      test.skip(!supported, 'Card type is disabled in this edition');
      await page.locator(`[data-${group}-add-type="${type}"]`).click();
      const card = page.locator(`[data-${group}-card]`).last();
      const input = card.locator('[data-affiliation-input]');
      const add = card.locator('[data-affiliation-add]');
      await expect(add).toBeDisabled();
      await expect(card.locator('[data-affiliation-search]')).toHaveCount(0);
      await input.fill('GFZ');
      const results = card.locator('[data-affiliation-result]');
      await expect(results).toHaveCount(2);
      await expect(input).not.toHaveAttribute('aria-activedescendant');
      await expect(card.locator('[data-affiliation-result].active')).toHaveCount(0);
      await input.press('Enter');
      await expect(card.locator('[data-affiliation-label]')).toHaveValue('GFZ');
      await expect(card.locator('[data-affiliation-ror]')).toBeHidden();
      await card.locator('[data-affiliation-remove]').click();
      await input.fill('GFZ');
      await expect(results).toHaveCount(2);
      await input.press('ArrowDown');
      await input.press('ArrowDown');
      await expect(results.nth(1)).toHaveClass(/active/);
      await input.press('ArrowUp');
      await expect(results.first()).toHaveAttribute('aria-selected', 'true');
      await expect(input).toHaveAttribute('aria-activedescendant', await results.first().getAttribute('id') as string);
      await expect(input).toBeFocused();
      if (type === 'person') await runAxeAudit(page, {configure: builder => builder.include(group === 'author' ? '#group-author' : '[data-contributor-formgroup]')});
      await input.press('Enter');
      await expect(card.locator('[data-affiliation-ror]')).toHaveText('04z8jg394');
      await card.locator('[data-affiliation-label]').fill('GFZ, Department');
      await expect(card.locator(`[data-${group}-summary-affiliations]`)).toContainText('GFZ, Department 04z8jg394');
      await input.fill('Freitext, ohne ROR');
      await input.press('Enter');
      await expect(card.locator('[data-affiliation-chip]')).toHaveCount(2);
      await card.locator('[data-affiliation-move-down]').first().click();
      await expect(card.locator('[data-affiliation-label]').last()).toHaveValue('GFZ, Department');
      await card.locator('[data-affiliation-remove]').first().click();
      await expect(card.locator('[data-affiliation-chip]')).toHaveCount(1);
      await input.fill('Unconfirmed input');
      await expect(card.locator('[data-affiliation-result]').first()).toBeVisible();
      await card.locator(`[data-${group}-toggle-edit]`).click();
      await expect(card.locator(`[data-${group}-toggle-edit]`)).toHaveAttribute('aria-expanded', 'false');
      await expect(input).toBeHidden();
      await page.locator('#button-form-save').click();
      await expect(page.locator('#modal-saveas')).toBeHidden();
      await expect(card.locator(`[data-${group}-toggle-edit]`)).toHaveAttribute('aria-expanded', 'true');
      await expect(card.locator('[data-affiliation-pending-warning]')).toBeVisible();
      await expect(input).toBeFocused();
      await card.locator('[data-affiliation-discard]').click();
      await expect(input).toBeEmpty();
      await card.locator(`[data-${group}-toggle-edit]`).click();
      await expect(card.locator(`[data-${group}-toggle-edit]`)).toHaveAttribute('aria-expanded', 'false');
      const affiliations = await page.evaluate(group => (window as any)[`${group}Stack`].collectPayload().at(-1).affiliations, group);
      expect(affiliations).toEqual([{label: 'GFZ, Department', rorId: '04z8jg394'}]);
    });
  }
}

test('failed ROR search keeps explicit free-text entry available', async ({ page }) => {
  await page.route('**/api/v2/affiliations/search**', route => route.fulfill({status: 503, json: {error: 'Unavailable'}}));
  await navigateToHome(page);
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  await page.locator('[data-contributor-add-type="person"]').click();
  const card = page.locator('[data-contributor-card]').last();
  await card.locator('[data-affiliation-input]').fill('Offline laboratory');
  const message = await page.evaluate(() => (window as any).elmo.translate('affiliations.error'));
  await expect(card.locator('[data-affiliation-status]')).toHaveText(message);
  await card.locator('[data-affiliation-add]').click();
  await expect(card.locator('[data-affiliation-label]')).toHaveValue('Offline laboratory');
  const affiliations = await card.locator('[data-affiliation-editor]').evaluate((element: any) => element.affiliationEditor.getAffiliations());
  expect(affiliations).toEqual([{label: 'Offline laboratory', rorId: ''}]);
});

test('autosave restores pending-only cards and requires explicit decisions after reload', async ({ page }) => {
  test.setTimeout(60000);
  let saved: any;
  await page.route('**/api/v2/affiliations/search**', route => route.fulfill({json: []}));
  await page.route('**/api/v2/drafts**', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill(saved ? {json: saved} : {status: 204, body: ''});
    } else if (request.method() === 'POST' || request.method() === 'PUT') {
      saved = {id: 'affiliation-browser-draft', updatedAt: new Date().toISOString(), payload: request.postDataJSON().payload};
      await route.fulfill({status: request.method() === 'POST' ? 201 : 200, json: {id: saved.id, updatedAt: saved.updatedAt}});
    } else await route.fulfill({status: 204, body: ''});
  });
  await navigateToHome(page);
  await page.waitForFunction(() => Boolean((window as any).authorStack && (window as any).contributorStack));
  await page.locator('[data-author-add-type="institution"]').click();
  await page.locator('[data-contributor-add-type="person"]').click();
  await page.locator('[data-author-card] [data-affiliation-input]').fill('Pending author institution');
  await page.locator('[data-contributor-card] [data-affiliation-input]').fill('Pending contributor person');
  await expect.poll(() => saved && JSON.parse(saved.payload.values.authorsPayload)[0]?._ui?.affiliationInput, {timeout: 25000}).toBe('Pending author institution');
  await expect.poll(() => saved && JSON.parse(saved.payload.values.contributorsPayload)[0]?._ui?.affiliationInput, {timeout: 25000}).toBe('Pending contributor person');
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.locator('#modal-restore-draft')).toBeVisible();
  await page.locator('#button-restore-apply').click();
  const author = page.locator('[data-author-card]');
  const contributor = page.locator('[data-contributor-card]');
  await expect(author.locator('[data-affiliation-input]')).toHaveValue('Pending author institution');
  await expect(contributor.locator('[data-affiliation-input]')).toHaveValue('Pending contributor person');
  const metadata = await page.evaluate(() => [(window as any).authorStack.collectPayload(), (window as any).contributorStack.collectPayload()]);
  expect(metadata).toEqual([[], []]);
  await page.locator('#button-form-save').click();
  await expect(author.locator('[data-affiliation-pending-warning]')).toBeVisible();
  await author.locator('[data-affiliation-discard]').click();
  await page.locator('#button-form-save').click();
  await expect(contributor.locator('[data-affiliation-pending-warning]')).toBeVisible();
  await contributor.locator('[data-affiliation-input]').press('Enter');
  await expect(contributor.locator('[data-affiliation-label]')).toHaveValue('Pending contributor person');
  const confirmed = await page.evaluate(() => (window as any).contributorStack.collectPayload());
  expect(confirmed[0].affiliations).toEqual([{label: 'Pending contributor person', rorId: ''}]);
  expect(confirmed[0]).not.toHaveProperty('_ui');
});

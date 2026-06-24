import { test, expect, type Locator, type Page } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';
import { completeMinimalDatasetForm, navigateToHome, runAxeAudit, SELECTORS } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';
const EDITED_AFFILIATION_LABEL = 'GFZ Helmholtz Centre for Geosciences, Potsdam';
const GFZ_ROR_ID = '04z8jg394';

test.describe('Authors redesign workflow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator('#button-author-add')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#button-authorinstitution-add')).toBeVisible({ timeout: 10000 });
  });

  test('exposes final card stack semantics for summary, edit, and action states', async ({ page }) => {
    test.slow();

    await completeMinimalDatasetForm(page);
    await page.locator('#button-authorinstitution-add').click();

    const authorsGroup = page.locator(SELECTORS.formGroups.authors);
    const authorsFormGroup = page.locator('#formgroup-authors');
    const personCard = authorsGroup.locator('[data-author-card][data-author-entry-type="person"]').first();
    const institutionCard = authorsGroup.locator('[data-author-card][data-author-entry-type="institution"]').first();

    await expect(authorsFormGroup.locator('[data-author-summary-count]')).toContainText(/entry|entries/i);
    await expect(authorsFormGroup.locator('[data-author-contact-summary]')).toContainText(/contact person/i);
    await expect(personCard.locator('[data-author-summary]')).toContainText('Carberry');
    await expect(personCard).toHaveAttribute('role', 'group');
    await expect(personCard).toHaveAttribute('aria-labelledby', /summary-name/);
    await expect(personCard.locator('[data-author-type-badge]')).toContainText(/person/i);
    await expect(personCard.locator('[data-author-contact-badge]')).toContainText(/contact person/i);
    await expect(personCard.locator('[data-author-contact-toggle]')).toContainText(/contact person/i);
    await expect.poll(() =>
      personCard.locator('input[name="givennames[]"]').evaluate((input) => input.hasAttribute('required'))
    ).toBe(false);
    await expect(personCard.locator('label[for^="input-author-firstname"] .red-star')).toHaveCount(0);
    await expect(personCard.locator('[data-author-actions]')).toBeVisible();
    await expect(personCard.locator('[data-author-move-up]')).toBeVisible();
    await expect(personCard.locator('[data-author-move-down]')).toBeVisible();
    await expect(personCard.locator('[data-author-edit-panel]')).toHaveClass(/collapse/);
    await expect(personCard.locator('[data-author-type-switcher]')).toBeVisible();
    await expect(personCard.locator('[data-author-type-option="person"]')).toHaveClass(/active/);
    await expect(personCard.locator('[data-author-type-option="institution"]')).toBeDisabled();

    await expect(institutionCard.locator('[data-author-summary]')).toBeVisible();
    await expect(institutionCard.locator('[data-author-type-badge]')).toContainText(/institution/i);
    await expect(institutionCard.locator('[data-author-contact-badge]')).toHaveCount(0);
    await expect(institutionCard.locator('[data-author-contact-toggle]')).toHaveCount(0);
    await expect(institutionCard.locator('[data-author-type-option="institution"]')).toHaveClass(/active/);

    await expect(personCard.locator('[data-author-edit-panel]')).toHaveClass(/show/);
    await personCard.locator('[data-author-toggle-edit]').click();
    await expect(personCard.locator('[data-author-edit-panel]')).not.toHaveClass(/show/);
    await personCard.locator('[data-author-toggle-edit]').click();
    await expect(personCard.locator('[data-author-edit-panel]')).toHaveClass(/show/);

    await institutionCard.locator('[data-author-toggle-edit]').click();
    await expect(institutionCard.locator('[data-author-edit-panel]')).not.toHaveClass(/show/);
    await institutionCard.locator('[data-author-toggle-edit]').click();
    await expect(personCard.locator('[data-author-edit-panel]')).toHaveClass(/show/);
    await expect(institutionCard.locator('[data-author-edit-panel]')).toHaveClass(/show/);

    await page.locator('#button-author-add').click();
    const newPersonCard = authorsGroup.locator('[data-author-card][data-author-entry-type="person"]').last();
    await expect(newPersonCard.locator('[data-author-edit-panel]')).toHaveClass(/show/);
    await expect(newPersonCard.locator('input[name="familynames[]"]')).toBeFocused();
    await expect(newPersonCard.locator('[data-author-type-option="institution"]')).toBeEnabled();

    await newPersonCard.locator('[data-author-type-option="institution"]').click();
    const switchedCard = authorsGroup.locator('[data-author-card]').last();
    await expect(switchedCard).toHaveAttribute('data-author-entry-type', 'institution');
    await expect(switchedCard.locator('[data-author-type-option="institution"]')).toHaveClass(/active/);
    await expect(switchedCard.locator('input[name="authorinstitutionName[]"]')).toBeFocused();

    await runAxeAudit(page, {
      configure: (builder) => builder.include('#formgroup-authors'),
    });
  });

  test('downloads XML with mixed creator order, contact person, and edited ROR affiliation', async ({ page }) => {
    test.slow();

    await completeMinimalDatasetForm(page);

    const authorsGroup = page.locator(SELECTORS.formGroups.authors);
    const firstPersonRow = authorsGroup.locator('[data-creator-row]').first();
    await setStructuredAffiliation(firstPersonRow.locator('input[name="personAffiliation[]"]'), {
      value: EDITED_AFFILIATION_LABEL,
      rorId: GFZ_ROR_ID,
    });

    await page.locator('#button-authorinstitution-add').click();
    const institutionRow = authorsGroup.locator('[data-authorinstitution-row]').first();
    await institutionRow.locator('input[name="authorinstitutionName[]"]').fill('European Plate Observatory');

    await page.locator('#button-author-add').click();
    const personRows = authorsGroup.locator('[data-creator-row]');
    await expect(personRows).toHaveCount(2);
    const secondPersonRow = personRows.nth(1);
    await fillPerson(secondPersonRow, {
      familyName: 'Smith',
      givenName: 'Alex',
      orcid: '0000-0003-1415-9265',
    });

    await moveEntryBefore(page, institutionRow, firstPersonRow);
    await expect.poll(() => getFilledAuthorTypes(page)).toEqual(['institution', 'person', 'person']);

    await runAxeAudit(page, {
      configure: (builder) => builder.include('#formgroup-authors'),
    });

    const parsedXml = await downloadXml(page);
    const resource = extractResourceNode(parsedXml);
    expect(resource).toBeTruthy();

    const creators = toArray(resource.creators?.creator);
    expect(creators.map((creator) => extractText(creator.creatorName))).toEqual([
      'European Plate Observatory',
      'Carberry, Josiah',
      'Smith, Alex',
    ]);

    const personCreator = creators.find((creator) => extractText(creator.creatorName) === 'Carberry, Josiah');
    expect(extractText(personCreator?.affiliation)).toBe(EDITED_AFFILIATION_LABEL);
    expect(personCreator?.affiliation?.affiliationIdentifier).toBe(`https://ror.org/${GFZ_ROR_ID}`);

    const contactPeople = toArray(resource.contributors?.contributor)
      .filter((contributor) => contributor.contributorType === 'ContactPerson');
    expect(contactPeople.map((contributor) => extractText(contributor.contributorName))).toContain('Carberry, Josiah');
    expect(contactPeople.some((contributor) => extractText(contributor.affiliation) === EDITED_AFFILIATION_LABEL)).toBe(true);
  });
});

async function fillPerson(row: Locator, data: { familyName: string; givenName: string; orcid: string }) {
  await row.locator('input[name="orcids[]"]').evaluate((element: HTMLInputElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, data.orcid);
  await row.locator('input[name="familynames[]"]').fill(data.familyName);
  await row.locator('input[name="givennames[]"]').fill(data.givenName);
}

async function setStructuredAffiliation(input: Locator, tag: { value: string; rorId: string }) {
  const row = input.locator('xpath=ancestor::*[@data-author-entry-row][1]');
  const editor = row.locator('[data-author-affiliation-editor]');
  await expect(editor).toBeVisible();

  if (await editor.locator('[data-author-affiliation-chip]').count() === 0) {
    await editor.locator('[data-author-affiliation-input]').fill(tag.value);
    await editor.locator('[data-author-affiliation-add]').click();
  }

  await input.evaluate((element: HTMLInputElement, structuredTag) => {
    const rowElement = element.closest('[data-author-entry-row]');
    const rorInput = rowElement?.querySelector('input[name="authorPersonRorIds[]"], input[name="authorInstitutionRorIds[]"]') as HTMLInputElement | null;
    const chip = rowElement?.querySelector('[data-author-affiliation-chip]') as HTMLElement | null;
    const labelInput = chip?.querySelector('[data-author-affiliation-label]') as HTMLInputElement | null;
    const rorSegment = chip?.querySelector('[data-author-affiliation-ror]') as HTMLElement | null;
    const tagValue = {
      value: structuredTag.value,
      label: structuredTag.value,
      rorId: structuredTag.rorId,
      id: structuredTag.rorId,
    };

    element.value = JSON.stringify([tagValue]);
    rorInput && (rorInput.value = structuredTag.rorId);
    if (chip) {
      chip.setAttribute('data-author-affiliation-ror-id', structuredTag.rorId);
    }
    if (labelInput) {
      labelInput.value = structuredTag.value;
    }
    if (rorSegment) {
      rorSegment.textContent = structuredTag.rorId;
      rorSegment.classList.remove('d-none');
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    (window as any).authorStack?.updatePayload?.();
  }, tag);

  await expect.poll(
    () => input.evaluate((element: HTMLInputElement) => JSON.parse(element.value || '[]').length),
    { timeout: 5000 },
  ).toBe(1);
  await expect(editor.locator('[data-author-affiliation-ror]').first()).toHaveText(tag.rorId);
}

async function moveEntryBefore(page: Page, sourceRow: Locator, targetRow: Locator) {
  const sourceElement = await sourceRow.elementHandle();
  const targetElement = await targetRow.elementHandle();
  if (!sourceElement || !targetElement) {
    throw new Error('Expected author rows to exist before reordering.');
  }

  await page.evaluate(([source, target]) => {
    const sourceRowElement = source as HTMLElement;
    const targetRowElement = target as HTMLElement;
    const parent = targetRowElement.parentElement;
    if (!parent || sourceRowElement.parentElement !== parent) {
      throw new Error('Expected author rows to share the same parent before reordering.');
    }

    parent.insertBefore(sourceRowElement, targetRowElement);
    (window as any).authorStack?.updatePayload?.();
  }, [sourceElement, targetElement]);
}

async function getFilledAuthorTypes(page: Page) {
  return page.evaluate(() => {
    const authors = JSON.parse((document.querySelector('#authors-payload') as HTMLInputElement)?.value || '[]');
    return authors.map((author: { type: string }) => author.type);
  });
}

async function downloadXml(page: Page) {
  let capturedBody = '';
  let capturedStatus = 0;

  await page.route(SAVE_ENDPOINT, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    capturedStatus = response.status();
    const body = await response.body();
    capturedBody = body.toString('utf-8');
    await route.fulfill({ response, body });
  });

  await page.locator('#button-form-save').click();
  const saveAsModal = page.locator(SELECTORS.modals.saveAs);
  await expect(saveAsModal).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#input-save-csrf-token')).not.toHaveValue('', { timeout: 5000 });
  await page.locator('#input-saveas-filename').fill('authors-redesign-workflow');

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/save/save_data.php') && response.request().method() === 'POST',
    { timeout: 30000 },
  );
  await page.locator('#button-saveas-save').click();
  await responsePromise;
  await page.unroute(SAVE_ENDPOINT);

  expect(capturedStatus).toBe(200);
  expect(capturedBody.trim().length).toBeGreaterThan(0);

  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  }).parse(capturedBody);
}

function extractResourceNode(parsedXml: any) {
  if (parsedXml?.resource) {
    return parsedXml.resource;
  }
  if (parsedXml?.envelope?.resource) {
    return parsedXml.envelope.resource;
  }
  const envelopeKey = Object.keys(parsedXml ?? {}).find((key) => key.endsWith(':envelope'));
  const envelope = envelopeKey ? parsedXml[envelopeKey] : null;
  if (!envelope) {
    return null;
  }
  const resourceKey = Object.keys(envelope).find((key) => key === 'resource' || key.endsWith(':resource'));
  return resourceKey ? envelope[resourceKey] : null;
}

function toArray(value: any) {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function extractText(value: any) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return value?.['#text'];
}

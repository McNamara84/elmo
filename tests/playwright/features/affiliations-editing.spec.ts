import { test, expect, type Page, type Locator } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';
import {
  completeMinimalDatasetForm,
  navigateToHome,
  runAxeAudit,
  waitForFormInteractionReady,
} from '../utils';

// ─── selectors ────────────────────────────────────────────────────────────────
const AUTHOR_GROUP     = '#group-author';
const SAVE_ENDPOINT    = '**/save/save_data.php';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Searches in the first author's dedicated affiliation editor, selects the first
 * result, and returns the selected label and short ROR id read from the DOM.
 */
async function selectAffiliationFromDropdown(
  page: Page,
  searchTerm: string,
): Promise<{ value: string; id: string }> {
  const authorRow = page
    .locator(`${AUTHOR_GROUP} [data-creator-row]`)
    .first();
  const editor = authorRow.locator('[data-author-affiliation-editor]');
  await expect(editor).toBeVisible({ timeout: 10_000 });

  const searchInput = editor.locator('[data-author-affiliation-input]');
  await searchInput.scrollIntoViewIfNeeded();
  await searchInput.fill(searchTerm);

  const firstResult = editor.locator('[data-author-affiliation-result]').first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });

  const selected = await firstResult.evaluate((element) => ({
    value: element.getAttribute('data-author-affiliation-label-value') || '',
    id: element.getAttribute('data-author-affiliation-ror-value') || '',
  }));

  const initialChipCount = await editor.locator('[data-author-affiliation-chip]').count();
  await firstResult.click();
  await expect(editor.locator('[data-author-affiliation-chip]')).toHaveCount(initialChipCount + 1, {
    timeout: 5_000,
  });

  return selected;
}

/**
 * Sets a confirmed affiliation when the label and ROR ID are known upfront.
 */
async function injectAffiliationTag(page: Page, row: Locator, tagData: {value: string; id: string}) {
  await row.locator('[data-affiliation-editor]').evaluate((element: any, data) => {
    element.affiliationEditor.setAffiliations([{label: data.value, rorId: data.id}]);
  }, tagData);
}

/**
 * Edits the matching confirmed affiliation label inline.
 */
async function editAffiliationLabel(
  page: Page,
  currentLabel: string,
  newLabel: string,
) {
  await page.evaluate(({ authorGroup, currentLabel, newLabel }) => {
    const input = Array.from(document.querySelectorAll<HTMLInputElement>(`${authorGroup} [data-author-affiliation-label]`))
      .find((element) => element.value === currentLabel);
    if (!input) {
      throw new Error(`Could not find author affiliation label input for ${currentLabel}`);
    }
    input.value = newLabel;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    (window as any).authorStack?.updatePayload?.();
  }, { authorGroup: AUTHOR_GROUP, currentLabel, newLabel });

  await expect.poll(() => page.evaluate(({ authorGroup, label }) => {
    return Array.from(document.querySelectorAll<HTMLInputElement>(`${authorGroup} [data-author-affiliation-label]`))
      .some((input) => input.value === label);
  }, { authorGroup: AUTHOR_GROUP, label: newLabel })).toBe(true);
}


/**
 * Opens the Save As modal, enters a filename, captures the save response,
 * and returns the raw XML string.
 */
async function saveAndGetXml(page: Page, filename: string): Promise<string> {
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
  await expect(page.locator('#modal-saveas')).toBeVisible({ timeout: 10_000 });
  await page.locator('#input-saveas-filename').fill(filename);
  await waitForFormInteractionReady(page, 'save');

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/save/save_data.php') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.locator('#button-saveas-save').click();
  await responsePromise;
  await page.unroute(SAVE_ENDPOINT);

  expect(capturedStatus).toBe(200);
  expect(capturedBody.trim().length).toBeGreaterThan(0);
  return capturedBody;
}

/**
 * Parses XML with fast-xml-parser (attributes exposed, no prefix) and returns
 * the first creator's affiliation list as a normalised array where every entry
 * exposes `.label` (display text) and `.id` (affiliationIdentifier or undefined).
 */
function parseAffiliations(xml: string): Array<{ label: string; id?: string }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (tagName) => ['affiliation', 'creator'].includes(tagName),
  });
  const doc = parser.parse(xml);
  const resource = doc?.envelope?.resource ?? doc?.resource ?? {};
  const creator = resource?.creators?.creator?.[0] ?? {};
  const raw: any[] = creator.affiliation ?? [];
  return raw.map((a: any) => ({
    label: typeof a === 'string' ? a : (a['#text'] ?? ''),
    id:    typeof a === 'object' ? a?.affiliationIdentifier : undefined,
  }));
}

// ─── tests ────────────────────────────────────────────────────────────────────

test.describe('Affiliation tag label editing', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({
      timeout: 15_000,
    });
  });

  /**
   * Test 1 – comprehensive:
   * - A tag selected from the whitelist initially carries a ROR id in the editor.
   * - Editing that tag's label preserves the original ROR id.
   * - A free-text tag (added without selecting from the dropdown) has no ROR id.
   */
  test(
    'whitelist-selected affiliation preserves ROR after manual label edit; free-text tag has no ROR',
    async ({ page }) => {
      test.slow();

      // Set up all required fields. completeMinimalDatasetForm adds one free-text
      // affiliation ('GFZ Helmholtz Centre for Geosciences', no ROR) for the author.
      await completeMinimalDatasetForm(page);

      // ── Step 1: select an institution from the whitelist ───────────────────
      const selected = await selectAffiliationFromDropdown(page, 'tu berlin');
      expect(selected.id, 'Whitelist tag must carry a ROR id').toMatch(/^[a-z0-9]{9}$/);

      // ── Step 2: rename the tag via the pencil icon ─────────────────────────
      const editedLabel = `${selected.value} (edited)`;
      await editAffiliationLabel(page, selected.value, editedLabel);

      await expect.poll(() => page.evaluate(({ authorGroup, label }) => {
        return Array.from(document.querySelectorAll<HTMLInputElement>(`${authorGroup} [data-author-affiliation-label]`))
          .some((input) => input.value === label);
      }, { authorGroup: AUTHOR_GROUP, label: editedLabel })).toBe(true);

      // ── Step 3: save and read the downloaded XML ───────────────────────────
      const xml = await saveAndGetXml(page, 'affil-test-rortag-edit');
      const affiliations = parseAffiliations(xml);

      // ── Assertions ─────────────────────────────────────────────────────────

      // Edited tag: label must reflect the rename and keep the selected ROR id
      const editedEntry = affiliations.find(a => a.label === editedLabel);
      expect(editedEntry, `Expected affiliation "${editedLabel}" in XML`).toBeDefined();
      expect(
        editedEntry?.id,
        'Edited tag must keep its ROR identifier after a manual label change',
      ).toBe(`https://ror.org/${selected.id}`);

      // Free-text tag (added by completeMinimalDatasetForm): no ROR
      const freeTextEntry = affiliations.find(
        a => a.label === 'GFZ Helmholtz Centre for Geosciences',
      );
      expect(
        freeTextEntry,
        'Free-text affiliation must appear in XML',
      ).toBeDefined();
      expect(
        freeTextEntry?.id,
        'Free-text affiliation must not carry an affiliationIdentifier',
      ).toBeUndefined();
    },
  );

  test(
    'empty edited author affiliation label allows the save dialog but blocks submission',
    async ({ page }) => {
      test.slow();

      await completeMinimalDatasetForm(page);

      const selected = await selectAffiliationFromDropdown(page, 'tu berlin');
      await editAffiliationLabel(page, selected.value, '');

      const authorRow = page.locator(`${AUTHOR_GROUP} [data-creator-row]`).first();
      const chip = authorRow
        .locator(`[data-author-affiliation-chip][data-author-affiliation-ror-id="${selected.id}"]`)
        .first();
      const labelInput = chip.locator('[data-author-affiliation-label]');
      const rorSegment = chip.locator('[data-author-affiliation-ror]');

      await expect(labelInput).toHaveValue('');
      await expect(rorSegment).toBeVisible();
      await expect(rorSegment).toHaveText(selected.id);

      await page.locator('#button-form-save').click();
      await expect(page.locator('#modal-saveas')).toBeVisible();
      await page.locator('#modal-saveas [data-bs-dismiss="modal"]').first().click();
      await expect(page.locator('#modal-saveas')).toBeHidden();
      await authorRow.locator('[data-author-toggle-edit]').click();
      await expect(labelInput).toBeHidden();
      await page.locator('#button-form-submit').click();

      await expect(page.locator('#modal-saveas')).not.toBeVisible();
      await expect(labelInput).toHaveClass(/is-invalid/);
      await expect(labelInput).toHaveAttribute('aria-invalid', 'true');
      await expect(chip.locator('[data-author-affiliation-invalid]')).toBeVisible();
      await expect(rorSegment).toBeVisible();
      await expect(rorSegment).toHaveText(selected.id);

      await runAxeAudit(page, {
        configure: (builder) => builder.include(AUTHOR_GROUP),
      });
    },
  );

  test('discarding pending contributor input keeps the confirmed label and ROR ID', async ({ page }) => {
    await completeMinimalDatasetForm(page);
    await page.locator('[data-contributor-add-type="institution"]').click();
    const row = page.locator('[data-contributor-type="institution"]').first();
    await injectAffiliationTag(page, row, {value: 'Technical University of Berlin', id: 'https://ror.org/01bj3aw27'});
    await row.locator('[data-affiliation-input]').fill('Text to discard');
    await row.locator('[data-contributor-toggle-edit]').click();
    await expect(row.locator('[data-affiliation-input]')).toBeHidden();
    await page.locator('#button-form-save').click();
    await row.locator('[data-affiliation-discard]').click();
    await expect(row.locator('[data-affiliation-label]')).toHaveValue('Technical University of Berlin');
    await expect(row.locator('[data-affiliation-ror]')).toHaveText('01bj3aw27');
  });

});

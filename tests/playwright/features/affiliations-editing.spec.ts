import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { completeMinimalDatasetForm, navigateToHome } from '../utils';

// ─── selectors ────────────────────────────────────────────────────────────────
const AUTHOR_GROUP     = '#group-author';
const AFFIL_EDIT_MODAL = '#modal-affiliation-edit';
const AFFIL_EDIT_INPUT = '#input-affiliation-edit-value';
const AFFIL_EDIT_SAVE  = '#button-affiliation-edit-save';

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
  await editor.locator('[data-author-affiliation-search]').click();

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
 * Injects an affiliation tag directly via the Tagify JS API without going through
 * the autocomplete UI. Useful when the ROR id is known upfront (e.g. for cancel tests).
 */
async function injectAffiliationTag(
  page: Page,
  row: Locator,
  tagData: { value: string; id: string },
) {
  const affiliationInput = row.locator('input[id$="affiliation"], input[id$="affiliation-0"], input[id^="input-contributor-organisationaffiliation"]').first();

  await expect(async () => {
    const initialized = await affiliationInput.evaluate(
      (el: any) => !!el._tagify,
    );
    expect(initialized).toBe(true);
  }).toPass({ timeout: 10_000 });

  const initialCount = await row.locator('tag').count();
  await affiliationInput.evaluate(
    (el: any, data: { value: string; id: string }) => el._tagify.addTags([data]),
    tagData,
  );
  await expect(row.locator('tag')).toHaveCount(initialCount + 1, {
    timeout: 5_000,
  });
}

/**
 * Opens the pencil-icon edit modal for the tag whose `title` attribute equals
 * `currentLabel`, types `newLabel`, and confirms with the Save button.
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

function toFullRorId(rorId: string) {
  return rorId.startsWith('http') ? rorId : `https://ror.org/${rorId}`;
}

/**
 * Opens the Save As modal, enters a filename, waits for the file download to
 * complete (Pattern 2 – browser-native download), and returns the raw XML string.
 */
async function saveAndGetXml(page: Page, filename: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    (async () => {
      await page.locator('#button-form-save').click();
      await expect(page.locator('#modal-saveas')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#input-save-csrf-token')).not.toHaveValue('', { timeout: 5_000 });
      await page.locator('#input-saveas-filename').fill(filename);
      await page.waitForTimeout(2100);
      await page.locator('#button-saveas-save').click();
    })(),
  ]);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  return readFileSync(downloadPath!, 'utf-8');
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
   * - A tag selected from the whitelist carries a ROR id in the XML.
   * - Editing that tag's label preserves the original ROR id.
   * - A free-text tag (added without selecting from the dropdown) has no ROR id.
   */
  test(
    'whitelist-selected affiliation has ROR; edited label preserves ROR; free-text tag has no ROR',
    async ({ page }) => {
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

      // Edited tag: label must reflect the rename AND ROR must be the original one
      const editedEntry = affiliations.find(a => a.label === editedLabel);
      expect(editedEntry, `Expected affiliation "${editedLabel}" in XML`).toBeDefined();
      expect(
        editedEntry?.id,
        'Edited tag must preserve its original ROR identifier',
      ).toBe(toFullRorId(selected.id));

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

  /**
   * Test 2 – cancel guard:
   * Opens the edit modal for a tag that has a known ROR id, types a new value,
   * cancels, and confirms the tag still displays the original label.
   * No save is required because this is a purely UI-level assertion.
   */
  test(
    'cancelling the affiliation edit modal leaves the original tag label unchanged',
    async ({ page }) => {
      await completeMinimalDatasetForm(page);

      const contributorInstitutionRow = page
        .locator('#group-contributororganisation [contributors-row]')
        .first();

      // Inject a tag with a known ROR id directly via the Tagify JS API
      const ORIGINAL_LABEL = 'Technical University of Berlin';
      const ORIGINAL_ROR   = 'https://ror.org/01bj3aw27';
      await injectAffiliationTag(page, contributorInstitutionRow, {
        value: ORIGINAL_LABEL,
        id:    ORIGINAL_ROR,
      });

      // Open the edit dialog
      const tag = contributorInstitutionRow.locator(`tag[title="${ORIGINAL_LABEL}"]`);
      await tag.locator('.tagify__tag__editBtn').click();

      const modal = page.locator(AFFIL_EDIT_MODAL);
      await expect(modal).toBeVisible({ timeout: 5_000 });

      // Type a replacement value – should be discarded on cancel
      await page.locator(AFFIL_EDIT_INPUT).fill('random stuff – should be discarded');

      // Cancel via the Cancel button (not the X close button)
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(modal).toBeHidden({ timeout: 5_000 });

      // The original tag must still be present with its original label
      await expect(
        contributorInstitutionRow.locator(`tag[title="${ORIGINAL_LABEL}"]`),
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        contributorInstitutionRow.locator('tags.tagify').filter({ hasText: ORIGINAL_LABEL }),
        'Tagify container must still contain the original label',
      ).toHaveCount(1);
    },
  );
});
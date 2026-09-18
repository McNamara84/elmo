import { createRequire } from 'node:module';
import path from 'node:path';
import type { Page } from '@playwright/test';

const require = createRequire(__filename);
const {
  getGgmsHtmlFieldIds,
  diffMissingHtmlIds,
}: {
  getGgmsHtmlFieldIds: (repoRoot?: string) => string[];
  diffMissingHtmlIds: (htmlIds: string[], ingestedIds: Iterable<string>) => string[];
} = require(path.join(__dirname, '../../helpers/ggmsFormFields.cjs'));

export { getGgmsHtmlFieldIds, diffMissingHtmlIds };

/**
 * GGM HTML field ids that currently hold a value after XML ingest.
 * Checkboxes/radios count when checked; other controls count when value is non-empty.
 */
export async function collectFilledGgmFieldIds(page: Page): Promise<string[]> {
  const htmlIds = getGgmsHtmlFieldIds();
  const filled = await page.evaluate((ids) => {
    const result: string[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        continue;
      }
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (el.checked) {
          result.push(id);
        }
      } else if (String(el.value || '').trim() !== '') {
        result.push(id);
      }
    }
    return result;
  }, htmlIds);
  return [...filled].sort();
}

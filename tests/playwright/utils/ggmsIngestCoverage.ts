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
 * Cloned repeating rows (data sources) use suffixed ids (`input-datasource-type-1`);
 * a filled clone counts as coverage for the template id.
 */
export async function collectFilledGgmFieldIds(page: Page): Promise<string[]> {
  const htmlIds = getGgmsHtmlFieldIds();
  const filled = await page.evaluate((ids) => {
    const isFilled = (el: Element): boolean => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        return false;
      }
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        return el.checked;
      }
      return String(el.value || '').trim() !== '';
    };

    const result: string[] = [];
    for (const id of ids) {
      const exact = document.getElementById(id);
      const clones = document.querySelectorAll(`[id^="${CSS.escape(id)}-"]`);
      const elements = [exact, ...clones].filter((el): el is Element => el != null);
      if (elements.some(isFilled)) {
        result.push(id);
      }
    }
    return result;
  }, htmlIds);
  return [...filled].sort();
}

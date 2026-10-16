import { expect, type Page } from '@playwright/test';
import * as fs from 'fs';

/** True once any Tagify instance on the page holds a tag with this label. */
function findTagifyTag(page: Page, label: string): Promise<boolean> {
  return page.evaluate((text: string) => {
    type TagifyInput = HTMLInputElement & { _tagify?: { value?: Array<{ value: string }> } };
    return Array.from(document.querySelectorAll<TagifyInput>('input')).some(
      (input) => input._tagify?.value?.some((tag) => tag.value.trim() === text),
    );
  }, label);
}

/**
 * Loads an XML file into the form through the application's own upload path.
 *
 * The Load button hands the file to loadXmlToForm(), which runs the DataCite
 * mappings, processKeywords() and – for ICGEM documents – icgemModule.loadIcgemXmlToForm().
 */
export async function uploadXmlIntoForm(page: Page, xmlPath: string, expectedSubjects: string[] = []): Promise<void> {
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`Upload source XML not found: ${xmlPath}`);
  }

  const loadButton = page.locator('#button-form-load');
  await loadButton.waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => typeof (window as any).thesauriReady?.then === 'function');
  // thesauriReady resolves after thesaurus inputs exist. XML upload then waits
  // only for the keyword vocabularies actually referenced by the uploaded XML.
  await page.waitForFunction(async () => {
    await (window as any).thesauriReady;
    return true;
  }, { timeout: 40_000 });
  await page.waitForFunction(() => {
    const science = document.querySelector('#input-sciencekeyword') as { _tagify?: unknown } | null;
    const platforms = document.querySelector('#input-platforms') as { _tagify?: unknown } | null;
    return Boolean(science?._tagify && platforms?._tagify);
  }, { timeout: 15_000 });

  await loadButton.click();

  const uploadModal = page.locator('#modal-uploadxml');
  await uploadModal.waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('#input-uploadxml-file').setInputFiles(xmlPath);

  // Model name is written at the start of loadIcgemXmlToForm. The upload
  // spinner stays up until loadXmlToForm returns, which is after keywords
  // and data sources are fully applied. Saving earlier persists whatever
  // happens to be in the POST at that moment (often satellite subjects only).
  await page.waitForFunction(
    () => {
      const modelName = document.querySelector<HTMLInputElement>('#input-model-name')?.value;
      const spinner = document.getElementById('upload-spinner-overlay');
      return Boolean(modelName) && Boolean(spinner?.classList.contains('d-none'));
    },
    { timeout: 60_000 },
  );

  // Wait until every imported subject is on a Tagify instance.
  for (const subject of expectedSubjects) {
    await expect
      .poll(() => findTagifyTag(page, subject), {
        message: `subject "${subject}" imported into a keyword field before save`,
        timeout: 20_000,
      })
      .toBe(true);
  }

  // The modal normally closes itself when showUploadToast fires; dismiss it via
  // the Bootstrap API when it does not, rather than blocking on the toast.
  if (await uploadModal.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const modalEl = document.getElementById('modal-uploadxml');
      if (!modalEl) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bsModal = (window as any).bootstrap?.Modal?.getInstance?.(modalEl);
      if (bsModal) bsModal.hide();
      else modalEl.classList.remove('show');
    });
    await uploadModal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

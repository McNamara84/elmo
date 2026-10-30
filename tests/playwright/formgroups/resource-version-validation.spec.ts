import { expect, test, type Page } from '@playwright/test';
import { completeMinimalDatasetForm, disableHelp, navigateToHome, registerGoogleMapsNoopRoute } from '../utils';
import en from '../../../lang/en.json';
import de from '../../../lang/de.json';
import fr from '../../../lang/fr.json';

const consoleProblems = new WeakMap<Page, string[]>();

async function completeDataset(page: Page) {
  await completeMinimalDatasetForm(page);
  await page.locator('#input-resourceinformation-language').selectOption({ label: 'English' });
  if (await page.locator('#input-model-type').isVisible()) {
    await page.locator('#input-model-type').selectOption({ label: 'Static' });
    await page.locator('#input-mathematical-representation').selectOption({ label: 'Spherical harmonics' });
    await page.locator('#input-file-format').selectOption({ label: 'icgem1.0' });
    await page.locator('#input-model-name').fill('VersionTestModel');
    await page.locator('#input-tide-system').selectOption({ label: 'Zero-tide' });
    await page.locator('#input-degree').fill('2');
    await page.locator('#input-errors').selectOption({ label: 'no' });
    await page.locator('#input-radius').fill('6.371E+06');
    await page.locator('#input-earth-gravity-constant').fill('3.986E+14');
  }
}

test.describe('Resource version validation (#873)', () => {
  test.beforeEach(async ({ page }) => {
    const problems: string[] = [];
    consoleProblems.set(page, problems);
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    // These version scenarios do not exercise external Maps or thesaurus services.
    await registerGoogleMapsNoopRoute(page);
    await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: {} }));
    await page.addInitScript(() => localStorage.setItem('userLanguage', 'en'));
    await navigateToHome(page);
    await page.waitForFunction(() => Boolean(window.resourceInformation?.setResourceInformation
      && window.elmo?.translations?.resourceInfo?.versionHint));
  });

  test.afterEach(async ({ page }) => {
    expect(consoleProblems.get(page), 'Browser console warnings, errors and uncaught exceptions').toEqual([]);
  });

  test('shows format errors immediately while typing and clears them on correction', async ({ page }) => {
    const input = page.locator('#input-resourceinformation-version');
    const feedback = page.locator('#resource-version-error');
    for (const value of ['1', '1.', '1.2.3', '1.2.3.4', 'v1.4', '-1.4', '1,4']) {
      await input.fill(value);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(feedback).toBeVisible();
      await expect(feedback).toHaveText(en.resourceInfo.versionInvalid);
      await expect(page.locator('#form-mde')).not.toHaveClass(/was-validated/);
    }
    for (const value of ['1.4', '12.3', '0.1', '1.10', '']) {
      await input.fill(value);
      await expect(input).toHaveAttribute('aria-invalid', 'false');
      await expect(feedback).not.toBeVisible();
      await expect(input).toHaveValue(value);
    }
    await expect(input).toHaveAttribute('data-empty', 'true');
    await expect(input).not.toHaveClass(/is-valid/);
  });

  test('normalizes outer whitespace on blur and updates the structured payload', async ({ page }) => {
    const input = page.locator('#input-resourceinformation-version');
    await input.fill(' 1.10 ');
    await expect(input).toHaveValue(' 1.10 ');
    await input.blur();
    await expect(input).toHaveValue('1.10');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect.poll(() => page.locator('#resource-information-payload').inputValue()
      .then(value => JSON.parse(value).version)).toBe('1.10');
    await input.fill('   ');
    await input.blur();
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('data-empty', 'true');
    await expect(page.locator('#resource-version-error')).not.toBeVisible();
  });

  test('restored drafts show the original invalid version and Clear removes the error', async ({ page }) => {
    await page.evaluate(async () => {
      const { default: AutosaveService } = await import('/js/services/autosaveService.js');
      const service = new AutosaveService('form-mde');
      service.applyDraftValues({ resourceInformationPayload: JSON.stringify({ version: '1.2.3', titles: [] }) });
    });
    const input = page.locator('#input-resourceinformation-version');
    await expect(input).toHaveValue('1.2.3');
    await expect(page.locator('#resource-version-error')).toBeVisible();
    await page.locator('#button-form-reset').click();
    await page.locator('#button-confirm-action').click();
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#resource-version-error')).not.toBeVisible();
  });

  test('keeps the hint and translated live error available when help icons are off', async ({ page }) => {
    const input = page.locator('#input-resourceinformation-version');
    await input.fill('1.2.3');
    await disableHelp(page);
    await expect(page.locator('#resource-version-hint')).toBeVisible();
    await expect(input).toHaveAttribute('aria-describedby', 'resource-version-hint resource-version-error');
    await expect(page.locator('#resource-version-error')).toHaveAttribute('aria-live', 'polite');
    for (const [language, translations] of [['de', de], ['fr', fr], ['en', en]] as const) {
      await page.locator('#bd-lang').click();
      await page.locator(`[data-bs-language-value="${language}"]`).click();
      await expect(page.locator('#resource-version-error')).toHaveText(translations.resourceInfo.versionInvalid);
      await expect(page.locator('#resource-version-error')).toBeVisible();
      await expect(page.locator('#resource-version-hint')).toHaveText(translations.resourceInfo.versionHint);
    }
  });

  test('a complete dataset blocks an invalid version, then accepts a correction or blank', async ({ page }) => {
    test.setTimeout(90_000);
    await completeDataset(page);
    const input = page.locator('#input-resourceinformation-version');
    const requests: string[] = [];
    await page.route('**/endpoints/send_xml_file.php', async route => {
      requests.push(route.request().url());
      await route.fulfill({ json: { success: true } });
    });
    await input.fill('1.2.3');
    await page.locator('#button-form-submit').click();
    await expect(page.locator('#modal-validation-failed')).toBeVisible();
    await expect(page.locator('#resource-version-error')).toHaveText(en.resourceInfo.versionInvalid);
    await expect(page.locator('#modal-submit')).not.toBeVisible();
    expect(requests).toEqual([]);
    await page.locator('#modal-validation-failed [data-bs-dismiss="modal"]').first().click();
    for (const value of ['1.10', '']) {
      await input.fill(value);
      await page.locator('#button-form-submit').click();
      await expect(page.locator('#modal-submit')).toBeVisible();
      await page.locator('#modal-submit [data-bs-dismiss="modal"]').first().click();
      await expect(page.locator('#modal-submit')).not.toBeVisible();
    }
  });

  test('rejects a version changed while confirming Submit without sending metadata', async ({ page }) => {
    test.setTimeout(90_000);
    await completeDataset(page);
    await page.locator('#button-form-submit').click();
    await expect(page.locator('#modal-submit')).toBeVisible();
    const requests: string[] = [];
    await page.route('**/endpoints/send_xml_file.php', async route => {
      requests.push(route.request().url());
      await route.fulfill({ json: { success: true } });
    });
    // Simulate a programmatic change without an input/blur event.
    await page.evaluate(() => { document.querySelector<HTMLInputElement>('#input-resourceinformation-version')!.value = '1.2.3.4'; });
    await page.locator('#input-submit-privacycheck').check();
    await page.locator('#button-submit-submit').click();
    await expect(page.locator('#modal-submit')).not.toBeVisible();
    await expect(page.locator('#modal-validation-failed')).toBeVisible();
    await expect(page.locator('#resource-version-error')).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('sends the latest valid version after waiting for the CSRF token', async ({ page }) => {
    test.setTimeout(90_000);
    await completeDataset(page);
    await page.locator('#input-resourceinformation-version').fill('1.4');
    await page.locator('#button-form-submit').click();
    await expect(page.locator('#modal-submit')).toBeVisible();
    let releaseToken!: () => void;
    let tokenRequested!: () => void;
    const tokenWait = new Promise<void>(resolve => { releaseToken = resolve; });
    const tokenRequest = new Promise<void>(resolve => { tokenRequested = resolve; });
    await page.route('**/api/csrf_token.php', async route => {
      tokenRequested();
      await tokenWait;
      await route.fulfill({ json: { token: 'version-dod-test-token' } });
    });
    let receiveMetadata!: (body: string) => void;
    const submittedMetadata = new Promise<string>(resolve => { receiveMetadata = resolve; });
    await page.route('**/endpoints/send_xml_file.php', async route => {
      receiveMetadata(route.request().postData() || '');
      await route.fulfill({ json: { success: true } });
    });
    await page.locator('#input-submit-privacycheck').check();
    await page.locator('#button-submit-submit').click();
    await tokenRequest;
    await page.evaluate(() => { document.querySelector<HTMLInputElement>('#input-resourceinformation-version')!.value = '1.10'; });
    releaseToken();
    const body = await submittedMetadata;
    const field = (name: string) => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r\\n]*)`))?.[1];
    expect(field('version')).toBe('1.10');
    expect(JSON.parse(field('resourceInformationPayload') || '{}').version).toBe('1.10');
    await expect(page.locator('#modal-submit')).not.toBeVisible();
    await expect(page.locator('#modal-notification')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { APP_BASE_URL, REPO_ROOT } from '../utils';
import { injectScript, injectStylesheet } from '../utils/assets';

const instrumentsFixture = [
    {
        pid: '21.11157/0001',
        pidType: 'Handle',
        name: 'Broadband Seismometer STS-2',
        instrumentTypes: ['Seismometer', 'Broadband']
    },
    {
        pid: '21.11157/0002',
        pidType: 'Handle',
        name: 'LaCoste-Romberg Gravimeter',
        instrumentTypes: ['Gravimeter']
    },
    {
        pid: '21.11157/0003',
        pidType: 'Handle',
        name: 'GPS Receiver Trimble NetR9',
        instrumentTypes: ['GNSS Receiver']
    }
];

const usedInstrumentsTemplate = readFileSync(
    path.join(REPO_ROOT, 'formgroups/usedInstruments.html'),
    'utf8'
);

// Minimal HTML harness – scripts are injected programmatically via injectScript()
// after page.goto() to avoid route-interception timing issues with <script src>.
const testHarnessMarkup = String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Used Instruments Test Harness</title>
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${usedInstrumentsTemplate}
      </form>
      <div id="help-usedinstruments-fg" role="note">Used instruments help text</div>
      <div id="help-usedinstruments-input" role="note">Instrument search help text</div>
    </main>
  </body>
</html>`;

/** Wait until the usedInstrumentsModule has been fully set on window. */
async function waitForUsedInstrumentsInit(page: import('@playwright/test').Page) {
    await page.waitForFunction(
        () => !!(window as any).usedInstrumentsModule,
        null,
        { timeout: 10000 }
    );
}

test.describe('Used Instruments form group', () => {
    test.beforeEach(async ({ page }) => {
        // Mock PID4INST API
        await page.route('**/api/v2/vocabs/pid4inst/instruments', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(instrumentsFixture)
            });
        });

        // Serve the test harness
        await page.route('**/test-used-instruments', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: testHarnessMarkup
            });
        });

        await page.goto(`${APP_BASE_URL}test-used-instruments`);

        // Inject stylesheets
        await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
        await injectStylesheet(page, 'node_modules/bootstrap-icons/font/bootstrap-icons.css');
        await injectStylesheet(page, 'node_modules/@yaireo/tagify/dist/tagify.css');

        // Inject dependencies in correct order
        await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
        await injectScript(page, 'node_modules/@yaireo/tagify/dist/tagify.js');
        await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');

        // Set up globals before loading the module
        await page.addScriptTag({
            content: `
                window.ELMO_FEATURES = { showUsedInstruments: true };
                window.translations = {
                    usedInstruments: {
                        title: 'Used Instruments',
                        placeholder: 'Search and select instruments...',
                        required: 'Please select at least one instrument.',
                        loading: 'Loading instrument list...',
                        unavailable: 'Instrument list currently unavailable.',
                        selected: 'selected instruments'
                    }
                };
            `
        });

        // Inject the module under test
        await injectScript(page, 'js/usedInstruments.js');

        // In case the module registered a DOMContentLoaded listener, fire it
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));

        // Wait until fully initialized
        await waitForUsedInstrumentsInit(page);
    });

    test('renders the form group with correct title and elements', async ({ page }) => {
        // Card header should contain the title
        const header = page.locator('.card-header b');
        await expect(header).toBeVisible();

        // Input element should exist
        const input = page.locator('#input-usedinstruments');
        await expect(input).toBeAttached();

        // Help icon should be present
        const helpIcon = page.locator('[data-help-section-id="help-usedinstruments-fg"]');
        await expect(helpIcon).toBeVisible();

        // Hidden inputs container should exist
        const hiddenContainer = page.locator('#usedinstruments-hidden-inputs');
        await expect(hiddenContainer).toBeAttached();
    });

    test('initializes Tagify on the input element', async ({ page }) => {
        // Tagify creates a visible wrapper element around the input
        const tagifyWrapper = page.locator('.tagify');
        await expect(tagifyWrapper).toBeVisible();
    });

    test('loads instruments from API and shows in dropdown', async ({ page }) => {
        // Focus on the Tagify input to trigger lazy loading
        await page.locator('.tagify__input').click();

        // Wait until the fixture data has been loaded into the Tagify whitelist
        await page.waitForFunction(() => {
            const input: any = document.querySelector('#input-usedinstruments');
            const tagify = input?._tagify;
            return !!tagify && Array.isArray(tagify.whitelist) && tagify.whitelist.length >= 3;
        }, null, { timeout: 10000 });

        // Type to trigger search
        await page.locator('.tagify__input').fill('Seis');

        // Wait for dropdown to show matching instruments
        const dropdownItems = page.locator('.tagify__dropdown__item');
        await expect(dropdownItems.first()).toBeVisible({ timeout: 10000 });

        // Should show at least the seismometer
        const count = await dropdownItems.count();
        expect(count).toBeGreaterThan(0);
    });

    test('creates hidden inputs when instrument is selected', async ({ page }) => {
        // Programmatically add an instrument
        await page.evaluate(() => {
            (window as any).usedInstrumentsModule.addInstrumentsByData([{
                pid: '21.11157/0001',
                pidType: 'Handle',
                name: 'Broadband Seismometer STS-2',
                instrumentTypes: ['Seismometer', 'Broadband']
            }]);
        });

        // Check hidden inputs were created
        await page.waitForFunction(() => {
            const container = document.getElementById('usedinstruments-hidden-inputs');
            return container && container.querySelectorAll('input[name="instrumentPid[]"]').length > 0;
        }, null, { timeout: 5000 });

        const pidValue = await page.locator('input[name="instrumentPid[]"]').first().inputValue();
        expect(pidValue).toBe('21.11157/0001');

        const pidTypeValue = await page.locator('input[name="instrumentPidType[]"]').first().inputValue();
        expect(pidTypeValue).toBe('Handle');
    });
});

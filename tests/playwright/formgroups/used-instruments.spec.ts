import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { APP_BASE_URL, registerStaticAssetRoutes, REPO_ROOT } from '../utils';

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

const testHarnessMarkup = String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Used Instruments Test Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.css" />
    <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css" />
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${usedInstrumentsTemplate}
      </form>
      <div id="help-usedinstruments-fg" role="note">Used instruments help text</div>
      <div id="help-usedinstruments-input" role="note">Instrument search help text</div>
    </main>
    <script>
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
    </script>
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/@yaireo/tagify/dist/tagify.min.js"></script>
    <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/usedInstruments.js"></script>
  </body>
</html>`;

test.describe('Used Instruments form group', () => {
    test.beforeEach(async ({ page }) => {
        await registerStaticAssetRoutes(page);

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
        // Tagify creates a wrapper element
        await page.waitForFunction(() => {
            const input = document.getElementById('input-usedinstruments');
            return input && input._tagify !== undefined;
        }, null, { timeout: 5000 });

        // The Tagify wrapper should be present
        const tagifyWrapper = page.locator('.tagify');
        await expect(tagifyWrapper).toBeVisible();
    });

    test('loads instruments from API and shows in dropdown', async ({ page }) => {
        // Wait for Tagify to initialize
        await page.waitForFunction(() => {
            const input = document.getElementById('input-usedinstruments');
            return input && input._tagify;
        }, null, { timeout: 5000 });

        // Focus on the Tagify input to trigger lazy loading
        await page.locator('.tagify__input').click();

        // Type to trigger search
        await page.locator('.tagify__input').fill('Seis');

        // Wait for dropdown to show matching instruments
        await page.waitForSelector('.tagify__dropdown__item', { timeout: 10000 });

        // Should show at least the seismometer
        const dropdownItems = page.locator('.tagify__dropdown__item');
        const count = await dropdownItems.count();
        expect(count).toBeGreaterThan(0);
    });

    test('creates hidden inputs when instrument is selected', async ({ page }) => {
        // Wait for Tagify to initialize
        await page.waitForFunction(() => {
            const input = document.getElementById('input-usedinstruments');
            return input && input._tagify;
        }, null, { timeout: 5000 });

        // Programmatically add an instrument
        await page.evaluate(() => {
            window.usedInstrumentsModule.addInstrumentsByData([{
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

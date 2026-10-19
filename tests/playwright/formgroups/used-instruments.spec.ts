import { test, expect, type Page } from '@playwright/test';
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

const instrumentApiRoute = '**/api/v2/vocabs/pid4inst/instruments';
type InstrumentFixture = typeof instrumentsFixture[number];

// Deliberately put type and substring matches before the desired name prefixes.
const searchFixture: InstrumentFixture[] = [
    { pid: '21/moses', pidType: 'Handle', name: 'MOSES 2026 WaddenSea', instrumentTypes: ['FTIR gas analyzer'] },
    { pid: '21/gasmet', pidType: 'Handle', name: 'GASMET - DX4000', instrumentTypes: ['FTIR gas analyzer'] },
    { pid: '21/agra', pidType: 'Handle', name: 'AGRA-Bewässerungsmenge', instrumentTypes: ['Flowmeter'] },
    { pid: '10.1234/sm-02', pidType: 'DOI', name: 'SM-02', instrumentTypes: [] },
    { pid: '21/sm-01', pidType: 'Handle', name: 'SM-01', instrumentTypes: [] },
    { pid: '21/sm', pidType: 'Handle', name: 'SM', instrumentTypes: [] },
    { pid: '21/station', pidType: 'Handle', name: 'Station GA-03', instrumentTypes: [] }
];

async function loadInstrumentFixture(page: Page, instruments = searchFixture) {
    await page.route(instrumentApiRoute, route => route.fulfill({ json: instruments }));
    const result = await page.evaluate(() => (window as any).usedInstrumentsModule.loadInstrumentsFromAPI());
    expect(result).toEqual({ success: true, dataLoaded: true });
}

async function deferInstrumentResponse(page: Page) {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(instrumentApiRoute, async route => {
        await pending;
        await route.fulfill({ json: searchFixture });
    });
    return release;
}

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
        await page.route(instrumentApiRoute, async route => {
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

    test('ranks exact names and stable name prefixes before other SM matches', async ({ page }) => {
        await loadInstrumentFixture(page);
        await page.locator('.tagify__input').fill('SM');

        await expect(page.locator('.tagify__dropdown__item strong')).toHaveText([
            'SM', 'SM-02', 'SM-01', 'GASMET - DX4000', 'AGRA-Bewässerungsmenge'
        ]);
    });

    test('ranks name prefixes and name substrings before GA type matches', async ({ page }) => {
        await loadInstrumentFixture(page);
        await page.locator('.tagify__input').fill('GA');

        await expect(page.locator('.tagify__dropdown__item strong')).toHaveText([
            'GASMET - DX4000', 'Station GA-03', 'MOSES 2026 WaddenSea'
        ]);
    });

    for (const { query, expected } of [
        { query: 'gas analyzer', expected: ['MOSES 2026 WaddenSea', 'GASMET - DX4000'] },
        { query: 'DX4000 GASMET', expected: ['GASMET - DX4000'] },
        { query: 'MOSES gas', expected: ['MOSES 2026 WaddenSea'] }
    ]) {
        test(`keeps type and multiword searches working: ${query}`, async ({ page }) => {
            await loadInstrumentFixture(page);
            await page.locator('.tagify__input').fill(query);

            await expect(page.locator('.tagify__dropdown__item strong')).toHaveText(expected);
        });
    }

    test('uses the same case and accent normalization for filtering and ranking', async ({ page }) => {
        await loadInstrumentFixture(page, [
            { ...searchFixture[0], name: 'xSM', instrumentTypes: [] },
            { ...searchFixture[1], name: 'ŚM-02', instrumentTypes: [] },
            { ...searchFixture[2], name: 'S\u0301M', instrumentTypes: [] }
        ]);
        await page.locator('.tagify__input').fill('sm');

        await expect(page.locator('.tagify__dropdown__item strong')).toHaveText(['S\u0301M', 'ŚM-02', 'xSM']);
    });

    test('sorts a name prefix into the visible 50 suggestions', async ({ page }) => {
        const weakerMatches = Array.from({ length: 50 }, (_, index) => ({
            ...searchFixture[1], pid: `21/weak-${index}`, name: `GASMET-${index}`
        }));
        await loadInstrumentFixture(page, [...weakerMatches, searchFixture[4]]);
        await page.locator('.tagify__input').fill('SM');

        const names = page.locator('.tagify__dropdown__item strong');
        await expect(names).toHaveCount(50);
        await expect(names.first()).toHaveText('SM-01');
        await expect(names.nth(1)).toHaveText('GASMET-0');
    });

    test('hides suggestions for an unmatched or cleared query', async ({ page }) => {
        await loadInstrumentFixture(page);
        const input = page.locator('.tagify__input');
        await input.fill('SM');
        await expect(page.locator('.tagify__dropdown')).toBeVisible();

        await input.fill('no-such-instrument');
        await expect(page.locator('.tagify__dropdown')).not.toBeVisible();
        await input.fill('SM');
        await expect(page.locator('.tagify__dropdown')).toBeVisible();
        await input.fill('');
        await expect(page.locator('.tagify__dropdown')).not.toBeVisible();
    });

    for (const method of ['mouse', 'keyboard'] as const) {
        test(`selects the correct instrument and PID type using the ${method}`, async ({ page }) => {
            await loadInstrumentFixture(page);
            const input = page.locator('.tagify__input');
            await input.fill('SM');
            await expect(page.locator('.tagify__dropdown__item strong').first()).toHaveText('SM');

            if (method === 'mouse') {
                await page.locator('.tagify__dropdown__item').filter({ hasText: /^SM-02$/ }).click();
            } else {
                await input.press('ArrowDown');
                await input.press('Enter');
            }

            await expect(page.locator('input[name="instrumentPid[]"]')).toHaveValue('10.1234/sm-02');
            await expect(page.locator('input[name="instrumentPidType[]"]')).toHaveValue('DOI');
            await input.fill('SM');
            await expect(page.locator('.tagify__dropdown__item strong')).toHaveText([
                'SM', 'SM-01', 'GASMET - DX4000', 'AGRA-Bewässerungsmenge'
            ]);
        });
    }

    test('shows the latest query after a delayed first response without more typing', async ({ page }) => {
        const release = await deferInstrumentResponse(page);
        try {
            const requested = page.waitForRequest(instrumentApiRoute);
            const input = page.locator('.tagify__input');
            await input.click();
            await requested;
            await input.fill('SM');
            await input.fill('GA');
            await expect(page.locator('.tagify')).toHaveClass(/tagify--loading/);
            release();

            await expect(page.locator('.tagify__dropdown__item strong')).toHaveText([
                'GASMET - DX4000', 'Station GA-03', 'MOSES 2026 WaddenSea'
            ]);
            await expect(page.locator('.tagify')).not.toHaveClass(/tagify--loading/);
            // The refreshed first option must also be selected correctly with Enter.
            await input.press('Enter');
            await expect(page.locator('input[name="instrumentPid[]"]')).toHaveValue('21/gasmet');
        } finally {
            release();
        }
    });

    for (const action of ['blur', 'clear'] as const) {
        test(`does not reopen suggestions after ${action} during loading`, async ({ page }) => {
            const release = await deferInstrumentResponse(page);
            try {
                const requested = page.waitForRequest(instrumentApiRoute);
                const input = page.locator('.tagify__input');
                await input.click();
                await requested;
                await input.fill('SM');
                if (action === 'blur') {
                    await page.locator('.card-header b').click();
                } else {
                    await input.fill('');
                }

                const response = page.waitForResponse(instrumentApiRoute);
                release();
                await response;
                await page.waitForFunction(() => {
                    const input: any = document.querySelector('#input-usedinstruments');
                    return input._tagify.whitelist.length > 0 && !input._tagify.state.isLoading;
                });
                await expect(page.locator('.tagify__dropdown')).not.toBeVisible();
            } finally {
                release();
            }
        });
    }

    test('retries a failed first request when the field is focused again', async ({ page }) => {
        let requests = 0;
        await page.route(instrumentApiRoute, route => {
            requests++;
            return requests === 1
                ? route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } })
                : route.fulfill({ json: searchFixture });
        });
        const response = page.waitForResponse(instrumentApiRoute);
        const input = page.locator('.tagify__input');
        await input.fill('GA');
        await response;
        await expect(page.locator('.tagify')).not.toHaveClass(/tagify--loading/);
        await expect(page.locator('.tagify__dropdown')).not.toBeVisible();

        await page.locator('.card-header b').click();
        await input.fill('GA');

        await expect(page.locator('.tagify__dropdown__item strong').first()).toHaveText('GASMET - DX4000');
        expect(requests).toBe(2);
    });

    test('keeps an imported PID fallback selected when instrument data loads', async ({ page }) => {
        await page.evaluate(() => {
            (window as any).usedInstrumentsModule.addInstrumentsByPid([
                { pid: '21/imported-unknown', pidType: 'Handle' }
            ]);
        });
        await loadInstrumentFixture(page);

        await expect(page.locator('.tagify__tag-text')).toHaveText('21/imported-unknown');
        await expect(page.locator('input[name="instrumentPid[]"]')).toHaveValue('21/imported-unknown');
        await page.locator('.tagify__input').fill('SM');
        await expect(page.locator('.tagify__dropdown__item strong').first()).toHaveText('SM');
    });
});

import path from 'path';
import { test, expect } from '@playwright/test';
import { navigateToHome, uploadXmlIntoForm } from '../../utils';

const GCMD_PLATFORMS_ROUTE = '**/api/v2/vocabs/thesauri/gcmd-platforms';

/**
 * Minimal mock GCMD Platforms vocabulary.
 * The root node id must match the rootNodeId configured in thesauri.js for
 * satellitePlatforms so that loadKeywordsForConfig finds it and builds the
 * whitelist from that sub-tree.
 */
const MOCK_GCMD_PLATFORMS = {
  data: [
    {
      id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
      text: 'Earth Observation Satellites',
      scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
      language: 'en',
      children: [
        {
          id: 'https://gcmd.earthdata.nasa.gov/kms/concept/gfz-1-mock',
          text: 'GFZ-1',
          scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
          language: 'en',
        },
      ],
    },
  ],
};

const MODEL_TYPES_MOCK = [
  { id: 1, name: 'Static', description: 'Static model' },
  { id: 2, name: 'Temporal', description: 'Temporal model' },
  { id: 3, name: 'Topographic', description: 'Topographic model' },
  { id: 4, name: 'Simulated', description: 'Simulated model' },
];

test.describe('GGMs Data Sources – satellite platform Tagify', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(GCMD_PLATFORMS_ROUTE, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GCMD_PLATFORMS),
      });
    });
    await page.route('**/api/v2/vocabs/modeltypes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MODEL_TYPES_MOCK),
      });
    });

    await navigateToHome(page);
    await expect(page.locator('#group-ggmspropertiesessential')).toBeVisible();
  });

  test('shows GFZ-1 in the Tagify whitelist suggestion when typing "gfz"', async ({ page }) => {
    // The GGMs Data Sources section must be rendered (requires showGGMsProperties=true in settings.php)
    const platformInput = page.locator('#input-datasource-platforms');
    await expect(platformInput).toBeAttached();

    // Wait for Tagify to initialise on the satellite platform input
    await page.waitForFunction(
      () => Boolean((document.querySelector('#input-datasource-platforms') as any)?._tagify),
      { timeout: 10_000 },
    );

    // Click the Tagify contenteditable area – this also triggers the on-demand
    // whitelist fetch (focus event registered in thesauri.js)
    const tagInput = page.locator('.visibility-datasources-satellite .tagify__input');
    await tagInput.click();

    // Wait until the whitelist has been populated from the mocked API response
    await page.waitForFunction(
      () => {
        const input = document.querySelector('#input-datasource-platforms') as any;
        return (input?._tagify?.settings?.whitelist?.length ?? 0) > 0;
      },
      { timeout: 10_000 },
    );

    // Type the search string – dropdown activates after ≥3 characters (enabled: 3)
    await tagInput.type('gfz');

    const dropdown = page.locator('.tagify__dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // At least one suggestion must contain "GFZ-1"
    const matchingSuggestion = dropdown
      .locator('.tagify__dropdown__item')
      .filter({ hasText: 'GFZ-1' })
      .first();

    await expect(matchingSuggestion).toBeVisible();
  });
});

test.describe('GGMs Data Sources – Elevation/Terrain type visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/vocabs/modeltypes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MODEL_TYPES_MOCK),
      });
    });

    await navigateToHome(page);
    await expect(page.locator('#group-ggmspropertiesessential')).toBeVisible();
  });

  test('Elevation/Terrain datasource type is only available for Topographic models', async ({ page }) => {
    const modelType = page.getByLabel('Model Type *');
    const typeSelect = page.locator('#input-datasource-type');
    const terrainOption = typeSelect.locator('option[value="T"]');

    await modelType.selectOption('Simulated');
    await expect(terrainOption).toHaveCount(0);

    await modelType.selectOption('Static');
    await expect(terrainOption).toHaveCount(0);

    await modelType.selectOption('Temporal');
    await expect(terrainOption).toHaveCount(0);

    await modelType.selectOption('Topographic');
    await expect(terrainOption).toHaveCount(1);
    await expect(terrainOption).toHaveText('Elevation/Terrain');

    // Newly added rows must also expose Elevation/Terrain only while Topographic.
    await page.locator('#button-datasource-add').click();
    const clonedTypeSelect = page.locator('#input-datasource-type-1');
    await expect(clonedTypeSelect.locator('option[value="T"]')).toHaveCount(1);

    await modelType.selectOption('Simulated');
    await expect(typeSelect.locator('option[value="T"]')).toHaveCount(0);
    await expect(clonedTypeSelect.locator('option[value="T"]')).toHaveCount(0);
  });
});

/**
 * icgem-testdata-defferent-datasources.xml holds four input data sources and
 * no satellite source: Ground data, Altimetry, Elevation/Terrain, Model.
 * Rows added into an empty stack are numbered from 0.
 */
const DIFFERENT_DATASOURCES_XML = path.join(
  __dirname,
  '../../flows/elmogem-specific/testDataIcgemRoundtrip/icgem-testdata-defferent-datasources.xml',
);

const EXPECTED_UPLOADED_SOURCES = [
  { type: 'G', details: 'Terrestrial', description: 'd1' },
  { type: 'A', details: 'Direct observations from altimetry satellites', description: 'd2' },
  { type: 'T', details: 'Bathymetry', description: 'd3' },
  {
    type: 'M',
    details: 'Global Gravitational Model',
    description: 'd4',
    name: 'GOCO7',
    identifier: '10.5880/GFZ.GRACEFO_06_GSM',
    identifierType: 'DOI',
  },
] as const;

test.describe('GGMs Data Sources – upload into an empty stack', () => {
  test('uploading into a form with the data source row deleted keeps only the file sources', async ({ page }) => {
    await navigateToHome(page);
    const rows = page.locator('#group-datasources [data-source-row]');
    await expect(rows).toHaveCount(1);

    await page.locator('#group-datasources .removeButton').click();
    await expect(rows).toHaveCount(0);

    await uploadXmlIntoForm(page, DIFFERENT_DATASOURCES_XML);

    await expect(rows).toHaveCount(EXPECTED_UPLOADED_SOURCES.length);
    await expect(page.locator('#input-datasource-type')).toHaveCount(0);
    await expect(page.locator('#input-datasource-type-4')).toHaveCount(0);

    for (let i = 0; i < EXPECTED_UPLOADED_SOURCES.length; i++) {
      const source = EXPECTED_UPLOADED_SOURCES[i];
      const row = rows.nth(i);

      await expect(row.locator('select[name="datasource_type[]"]')).toHaveValue(source.type);
      await expect(row.locator('select[name="datasource_type[]"]')).toHaveAttribute('id', `input-datasource-type-${i}`);
      await expect(row.locator('select[name="datasource_details[]"]')).toHaveValue(source.details);
      await expect(row.locator('textarea[name="datasource_description[]"]')).toHaveValue(source.description);

      if ('name' in source) {
        await expect(row.locator('input[name="dName[]"]')).toHaveValue(source.name);
        await expect(row.locator('input[name="dIdentifier[]"]')).toHaveValue(source.identifier);
        await expect(row.locator('select[name="dIdentifierType[]"]')).toHaveValue(source.identifierType);
      }
    }
  });
});

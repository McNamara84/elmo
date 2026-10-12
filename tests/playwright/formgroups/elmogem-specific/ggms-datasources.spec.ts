import path from 'path';
import { test, expect, type Locator, type Page } from '@playwright/test';
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

/** Rendered size of a remove button relative to its layout size (1 = unscaled). */
async function getRenderedScale(button: Locator): Promise<number> {
  return button.evaluate(element => {
    const htmlElement = element as HTMLElement;
    return element.getBoundingClientRect().width / htmlElement.offsetWidth;
  });
}

/** CI viewports round transformed sizes; a 10% band still separates 75% from full size. */
function expectWithinTenPercent(received: number, expected: number, message: string) {
  const tolerance = Math.abs(expected) * 0.1;
  expect(received, message).toBeGreaterThanOrEqual(expected - tolerance);
  expect(received, message).toBeLessThanOrEqual(expected + tolerance);
}

/**
 * Geometry of one data source entry relative to the surrounding card body and add button.
 * fieldInset is the gap between the card-body edge and the first field of the entry.
 */
async function measureDatasourceEntry(page: Page, rowIndex: number) {
  return page.evaluate(index => {
    const group = document.querySelector('#group-datasources') as HTMLElement;
    const row = group.querySelectorAll<HTMLElement>('[data-source-row]')[index];
    const cardBody = group.closest('.card-body') as HTMLElement;
    const columns = Array.from(row.children).filter(
      child => (child as HTMLElement).offsetParent !== null,
    ) as HTMLElement[];
    const removeColumn = columns[columns.length - 1];
    const lastFieldColumn = columns[columns.length - 2];
    const removeButton = removeColumn.querySelector('.removeButton') as HTMLElement;
    const addButton = document.querySelector('#button-datasource-add') as HTMLElement;

    const rowBox = row.getBoundingClientRect();
    const bodyBox = cardBody.getBoundingClientRect();
    const removeBox = removeButton.getBoundingClientRect();
    const lastFieldBox = (lastFieldColumn.querySelector('.input-group') ?? lastFieldColumn).getBoundingClientRect();
    const firstFieldBox = (columns[0].querySelector('.input-group') ?? columns[0]).getBoundingClientRect();
    const addBox = addButton.getBoundingClientRect();
    const firstRowBox = group.querySelector('[data-source-row]')!.getBoundingClientRect();

    return {
      fieldInset: firstFieldBox.left - bodyBox.left,
      rowSideGap: bodyBox.width - rowBox.width,
      removeInsideRow: removeBox.left >= rowBox.left && removeBox.right <= rowBox.right + 0.5,
      removeClearOfField: removeBox.left >= lastFieldBox.right - 0.5,
      addAlignedWithRows: Math.abs(addBox.left - firstRowBox.left) < 1,
      addBelowRows: addBox.top >= group.getBoundingClientRect().bottom,
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  }, rowIndex);
}

test.describe('GGMs Data Sources – responsive mobile layout', () => {
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

  test('remove buttons render at 75% on 320–375px phones and full size on wider screens', async ({ page }) => {
    const datasourceRows = page.locator('#group-datasources [data-source-row]');
    const fundingRows = page.locator('#group-fundingreference [funding-reference-row]');

    for (const { width, expectedScale } of [
      { width: 320, expectedScale: 0.75 },
      { width: 375, expectedScale: 0.75 },
      { width: 376, expectedScale: 1 },
      { width: 768, expectedScale: 1 },
    ]) {
      await page.setViewportSize({ width, height: 900 });

      // Rows created by the add listeners must pick up the scaling as well.
      await page.locator('#button-datasource-add').click();
      await page.locator('#button-fundingreference-add').click();
      await expect(datasourceRows).toHaveCount(2);
      await expect(fundingRows).toHaveCount(2);

      const removeButtons = [
        datasourceRows.nth(0).locator('.removeButton'),
        datasourceRows.nth(1).locator('.removeButton'),
        fundingRows.nth(1).locator('.removeButton'),
      ];
      for (const button of removeButtons) {
        expectWithinTenPercent(await getRenderedScale(button), expectedScale, `remove button scale at ${width}px`);
      }

      const entry = await measureDatasourceEntry(page, 1);
      expect(entry.removeInsideRow, `remove button stays inside its entry at ${width}px`).toBe(true);
      if (expectedScale < 1) {
        expect(entry.removeClearOfField, `scaled remove button does not cover the last field at ${width}px`).toBe(true);
      }
      expect(entry.addAlignedWithRows, `add button keeps its position at ${width}px`).toBe(true);
      expect(entry.addBelowRows, `add button stays below the entries at ${width}px`).toBe(true);

      // The remove listeners keep working on the scaled buttons.
      await removeButtons[1].click();
      await removeButtons[2].click();
      await expect(datasourceRows).toHaveCount(1);
      await expect(fundingRows).toHaveCount(1);
    }
  });

  test('data source entries use more of the card body below 769px and most on phones', async ({ page }) => {
    await page.locator('#button-datasource-add').click();
    const addedTypeSelect = page.locator('#input-datasource-type-1');
    await expect(addedTypeSelect).toBeVisible();

    const measureAt = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      return measureDatasourceEntry(page, 1);
    };

    for (const type of ['S', 'M']) {
      // The change listener re-orders and re-sizes the columns; the spacing must survive it.
      await addedTypeSelect.selectOption(type);

      const desktop = await measureAt(1024);
      const boundary = await measureAt(769);
      const tablet = await measureAt(768);
      const phone = await measureAt(375);
      const smallPhone = await measureAt(320);

      expect(boundary.fieldInset, `type ${type}: 769px keeps the desktop spacing`).toBeCloseTo(desktop.fieldInset, 0);
      expect(tablet.fieldInset, `type ${type}: tablet entries start closer to the card edge`).toBeLessThan(boundary.fieldInset);
      expect(phone.fieldInset, `type ${type}: phone entries start closer still`).toBeLessThan(tablet.fieldInset);
      expect(smallPhone.fieldInset, `type ${type}: 320px uses the phone spacing`).toBeCloseTo(phone.fieldInset, 0);
      expect(tablet.rowSideGap, `type ${type}: tablet entry leaves less card padding`).toBeLessThan(boundary.rowSideGap);
      expect(phone.rowSideGap, `type ${type}: phone entry leaves even less card padding`).toBeLessThan(tablet.rowSideGap);

      for (const [label, entry] of Object.entries({ desktop, boundary, tablet, phone, smallPhone })) {
        expect(entry.removeInsideRow, `type ${type} ${label}: remove button inside entry`).toBe(true);
        expect(entry.removeClearOfField, `type ${type} ${label}: remove button clear of last field`).toBe(true);
        expect(entry.addAlignedWithRows, `type ${type} ${label}: add button aligned with entries`).toBe(true);
        expect(entry.addBelowRows, `type ${type} ${label}: add button below entries`).toBe(true);
        expect(entry.horizontalScroll, `type ${type} ${label}: no horizontal scrolling`).toBe(false);
      }
    }
  });
});

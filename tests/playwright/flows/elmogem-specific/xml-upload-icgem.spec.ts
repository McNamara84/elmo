import { test, expect, type Page } from '@playwright/test';
import { navigateToHome } from '../../utils';

const GCMD_PLATFORMS_ROUTE = '**/api/v2/vocabs/thesauri/gcmd-platforms';

const PLATFORM = {
  grace: {
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/2e7aa2e6-9d25-4c6e-aef3-6e86d3773bac',
    path: 'Platforms > Space-based Platforms > Earth Observation Satellites > GRACE',
  },
  goce: {
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b4fc57c3-7f36-40dc-8067-8b1f4dff4e3d',
    path: 'Platforms > Space-based Platforms > Earth Observation Satellites > Earth Explorers > GOCE',
  },
  lageos: {
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/8124c4a5-fb77-455c-9ecd-3cf325fc12a9',
    path: 'Platforms > Space-based Platforms > Earth Observation Satellites > Laser Geodetic Satellite (LAGEOS) > LAGEOS-1',
  },
} as const;

const MOCK_GCMD_PLATFORMS = {
  data: [
    {
      id: 'platforms-root',
      text: 'Platforms',
      children: [
        {
          id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
          text: 'Space-based Platforms',
          children: [
            {
              id: 'https://gcmd.earthdata.nasa.gov/kms/concept/3466eed1-2fbb-49bf-ab0b-dc08731d502b',
              text: 'Earth Observation Satellites',
              children: [
                { id: PLATFORM.grace.id, text: 'GRACE' },
                {
                  id: 'earth-explorers',
                  text: 'Earth Explorers',
                  children: [{ id: PLATFORM.goce.id, text: 'GOCE' }],
                },
                {
                  id: 'laser-geodetic-satellite',
                  text: 'Laser Geodetic Satellite (LAGEOS)',
                  children: [{ id: PLATFORM.lageos.id, text: 'LAGEOS-1' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const ICGEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema">
  <grav:globalGravityProduct>
    <grav:harmonicCoefficientsModel>
      <grav:modelName>Issue 1191 regression</grav:modelName>
    </grav:harmonicCoefficientsModel>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
      <grav:satelliteValueName>${PLATFORM.grace.path}</grav:satelliteValueName>
      <grav:satelliteValueUri>${PLATFORM.grace.id}</grav:satelliteValueUri>
      <grav:satelliteSchemeName>NASA/GCMD Earth Platforms Keywords</grav:satelliteSchemeName>
      <grav:satelliteSchemeUri>https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms</grav:satelliteSchemeUri>
    </grav:inputDataSource>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
      <grav:satelliteValueName>${PLATFORM.goce.path}</grav:satelliteValueName>
      <grav:satelliteValueUri>${PLATFORM.goce.id}</grav:satelliteValueUri>
      <grav:satelliteSchemeName>NASA/GCMD Earth Platforms Keywords</grav:satelliteSchemeName>
      <grav:satelliteSchemeUri>https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms</grav:satelliteSchemeUri>
    </grav:inputDataSource>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
      <grav:satelliteValueName>${PLATFORM.lageos.path}</grav:satelliteValueName>
      <grav:satelliteValueUri>${PLATFORM.lageos.id}</grav:satelliteValueUri>
      <grav:satelliteSchemeName>NASA/GCMD Earth Platforms Keywords</grav:satelliteSchemeName>
      <grav:satelliteSchemeUri>https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms</grav:satelliteSchemeUri>
    </grav:inputDataSource>
  </grav:globalGravityProduct>
</grav:envelope>`;

async function loadIcgemDataIntoForm(page: Page, xml: string): Promise<void> {
  await page.evaluate(async (xmlText) => {
    const xmlDocument = new DOMParser().parseFromString(xmlText, 'application/xml');
    const icgemModule = (window as typeof window & {
      icgemModule?: { loadIcgemXmlToForm: (document: Document) => Promise<void> };
    }).icgemModule;

    if (!icgemModule) {
      throw new Error('ICGEM mapping module is not available');
    }

    await icgemModule.loadIcgemXmlToForm(xmlDocument);
  }, xml);
}

test('groups consecutive satellite keywords with empty descriptions into one row', async ({ page }) => {
  test.setTimeout(120_000);

  await page.route(GCMD_PLATFORMS_ROUTE, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GCMD_PLATFORMS),
    });
  });

  await navigateToHome(page);
  await page.waitForFunction(async () => {
    await (window as typeof window & { thesauriReady?: Promise<void> }).thesauriReady;
    const input = document.querySelector('input[name="satellite_platform[]"]') as
      (HTMLInputElement & { _tagify?: unknown }) | null;
    return Boolean((window as any).icgemModule?.loadIcgemXmlToForm && input?._tagify);
  }, undefined, { timeout: 60_000 });

  await loadIcgemDataIntoForm(page, ICGEM_XML);

  const rows = page.locator('#group-datasources .row[data-source-row]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator('textarea[name="datasource_description[]"]')).toHaveValue('');

  const tags = rows.first().locator('.tagify__tag');
  await expect(tags).toHaveCount(3);
  const tagText = (await tags.allTextContents()).join('\n');
  expect(tagText).toContain('GRACE');
  expect(tagText).toContain('GOCE');
  expect(tagText).toContain('LAGEOS-1');

  const hiddenValues = await rows.first().locator('input[name="satellite_platform[]"]').evaluate((input) => {
    const tagifyInput = input as HTMLInputElement & {
      _tagify?: { value?: Array<{ value: string; id: string }> };
    };
    return tagifyInput._tagify?.value ?? [];
  });
  expect(hiddenValues).toEqual([
    expect.objectContaining({ value: PLATFORM.grace.path, id: PLATFORM.grace.id }),
    expect.objectContaining({ value: PLATFORM.goce.path, id: PLATFORM.goce.id }),
    expect.objectContaining({ value: PLATFORM.lageos.path, id: PLATFORM.lageos.id }),
  ]);
});

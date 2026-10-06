import { test, expect, type Page } from '@playwright/test';
import { navigateToHome } from '../../utils';

const MASCON_UUID = 'https://gcmd.earthdata.nasa.gov/kms/concept/97576e51-28b5-4ae0-af33-fbb00fd5996b';
const MASCON_PATH = 'MASS CONCENTRATION (MASCON) MODELS';

const MATH_REPS_MOCK = [
  { id: 1, name: 'Spherical harmonics', description: 'Spherical harmonics' },
  { id: 2, name: 'Ellipsoidal harmonics', description: 'Ellipsoidal harmonics' },
  { id: 3, name: 'MASCON', description: 'Mass Concentration representation.' },
];

const MOCK_AVAILABILITY = {
  science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
  platforms: { available: false, displayName: 'GCMD Platforms' },
  instruments: { available: false, displayName: 'GCMD Instruments' },
  chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: false, displayName: 'GEMET' },
};

/**
 * Minimal GCMD Science Keywords tree that includes the MASCON concept as a
 * GGMs root node so whitelist lookup by UUID succeeds after lazy load.
 */
const MOCK_SCIENCE_KEYWORDS = {
  data: [
    {
      id: 'science-root',
      text: 'Science Keywords',
      scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
      language: 'en',
      children: [
        {
          id: 'earth-science-services',
          text: 'EARTH SCIENCE SERVICES',
          scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
          language: 'en',
          children: [
            {
              id: 'models',
              text: 'MODELS',
              scheme: 'GCMD',
              schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
              language: 'en',
              children: [
                {
                  id: MASCON_UUID,
                  text: MASCON_PATH,
                  scheme: 'GCMD',
                  schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
                  language: 'en',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

async function scienceKeywordTags(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector('#input-sciencekeyword') as HTMLInputElement & {
      _tagify?: { value: Array<{ value?: string; id?: string }> };
    };
    return input?._tagify?.value ?? [];
  });
}

test.describe('ELMO-GEM keyword auto-addition', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/vocabs/mathreps', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MATH_REPS_MOCK),
      });
    });
    await page.route('**/api/v2/vocabs/thesauri/availability', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_AVAILABILITY),
      });
    });
    await page.route('**/api/v2/vocabs/thesauri/gcmd-science-keywords', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SCIENCE_KEYWORDS),
      });
    });
  });

  test('adds and removes the MASCON science keyword by UUID', async ({ page }) => {
    await navigateToHome(page);

    await page.waitForFunction(
      () => ((document.querySelector('#input-mathematical-representation') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
      { timeout: 15_000 },
    );
    await page.waitForFunction(
      () => Boolean((document.querySelector('#input-sciencekeyword') as HTMLInputElement & { _tagify?: unknown })?._tagify),
      { timeout: 15_000 },
    );

    await page.locator('#input-mathematical-representation').selectOption({ label: 'MASCON' });

    await expect.poll(async () => {
      const tags = await scienceKeywordTags(page);
      return tags.some(tag => tag.id === MASCON_UUID);
    }, { timeout: 10_000 }).toBe(true);

    const added = await scienceKeywordTags(page);
    expect(added.filter(tag => tag.id === MASCON_UUID)).toHaveLength(1);

    await page.locator('#input-mathematical-representation').selectOption({ label: 'Spherical harmonics' });

    await expect.poll(async () => {
      const tags = await scienceKeywordTags(page);
      return tags.some(tag => tag.id === MASCON_UUID);
    }, { timeout: 10_000 }).toBe(false);
  });
});

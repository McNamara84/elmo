import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  navigateToHome, REPO_ROOT, registerGoogleMapsNoopRoute, waitForHomepageReady,
} from '../utils';

/**
 * DataCite XML for 10.5880/fidgeo.d.2025.001. Free keywords are listed before
 * GCMD science / instruments subjects. processKeywords() must wait for the
 * referenced vocabularies before addTags — including those free keywords.
 */
const XML_PATH = path.join(
  REPO_ROOT,
  'tests/fixtures/xml-import/lithogeochemistry-of-the-volcanic-sedimentary-datacite.xml',
);
const TITLE = 'Lithogeochemistry of the Volcanic-Sedimentary Complex and major and trace element contents in apatite from the Neves Corvo Cu-Zn-Pb(-Sn) deposit (Portugal)';

const SCIENCE_SCHEME = 'NASA/GCMD Earth Science Keywords';
const SCIENCE_SCHEME_URI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords';
const INSTRUMENTS_SCHEME = 'NASA/GCMD Instruments';
const INSTRUMENTS_SCHEME_URI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments';

type ThesaurusKeyword = {
  value: string;
  id: string;
  scheme: string;
  schemeURI: string;
  language: string;
};

const SCIENCE_KEYWORDS: ThesaurusKeyword[] = [{
  value: 'Science Keywords > EARTH SCIENCE > SOLID EARTH > GEOCHEMISTRY > GEOCHEMICAL PROPERTIES > CHEMICAL CONCENTRATIONS',
  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/12ed4fa0-27cc-4e05-a2b7-bbf2fde871f6',
  scheme: SCIENCE_SCHEME,
  schemeURI: SCIENCE_SCHEME_URI,
  language: 'en',
}];

const EXTRA_SCIENCE_KEYWORD: ThesaurusKeyword = {
  value: 'Science Keywords > EARTH SCIENCE > SOLID EARTH > GEOCHEMISTRY > GEOCHEMICAL PROPERTIES > MAJOR ELEMENTS',
  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/extra-major-elements',
  scheme: SCIENCE_SCHEME,
  schemeURI: SCIENCE_SCHEME_URI,
  language: 'en',
};

const INSTRUMENT_KEYWORDS: ThesaurusKeyword[] = [
  {
    value: 'Instruments > Earth Remote Sensing Instruments > Passive Remote Sensing > Spectrometers/Radiometers > Spectrometers > FTIR SPECTROMETER',
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/aa2c39cf-1c4c-437e-ae2d-29e6a77f1aa2',
    scheme: INSTRUMENTS_SCHEME,
    schemeURI: INSTRUMENTS_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'Instruments > In Situ/Laboratory Instruments > Probes > ELECTRON MICROPROBES',
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/ff2d6f74-959c-42f2-9905-dd942fd80598',
    scheme: INSTRUMENTS_SCHEME,
    schemeURI: INSTRUMENTS_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'Instruments > In Situ/Laboratory Instruments > Spectrometers/Radiometers > ICP-MS',
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/616bdf0f-8797-496b-af3d-50974baa470c',
    scheme: INSTRUMENTS_SCHEME,
    schemeURI: INSTRUMENTS_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'Instruments > In Situ/Laboratory Instruments > Spectrometers/Radiometers > LA-ICP-MS',
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/3e3d658f-1326-42b4-b3a8-3f897a8a2a42',
    scheme: INSTRUMENTS_SCHEME,
    schemeURI: INSTRUMENTS_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'Instruments > In Situ/Laboratory Instruments > Spectrometers/Radiometers > XRF',
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/665b8764-0c0a-4df7-96f1-4ddae0c6de18',
    scheme: INSTRUMENTS_SCHEME,
    schemeURI: INSTRUMENTS_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'Instruments > Solar/Space Observing Instruments > X-Ray/Gamma Ray Detectors > XRD',
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/41db9c48-4af8-40db-8632-a86983d81258',
    scheme: INSTRUMENTS_SCHEME,
    schemeURI: INSTRUMENTS_SCHEME_URI,
    language: 'en',
  },
];

const FREE_KEYWORDS = [
  'Geochemistry',
  'FOS: Earth and related environmental sciences',
  'hydrothermal alteration',
  'whole-rock chemistry',
  'apatite',
  'Florencite',
  'xenotime',
  'felsic volcanic rocks',
  'black shales',
  'trace elements in apatite',
  'Neves Corvo',
  'VMS mineralization',
];

type VocabNode = {
  id: string;
  text: string;
  scheme: string;
  schemeURI: string;
  language: string;
  children?: VocabNode[];
};

function vocabPayload(keywords: ThesaurusKeyword[]): { data: VocabNode[] } {
  const roots: VocabNode[] = [];
  keywords.forEach(keyword => {
    const parts = keyword.value.split(' > ');
    let level = roots;
    parts.forEach((text, index) => {
      const leaf = index === parts.length - 1;
      let node = level.find(item => item.text === text);
      if (!node) {
        node = {
          id: leaf ? keyword.id : `parent-${parts.slice(0, index + 1).join('--')}`,
          text,
          scheme: keyword.scheme,
          schemeURI: keyword.schemeURI,
          language: keyword.language,
        };
        level.push(node);
      }
      if (!leaf) {
        node.children ??= [];
        level = node.children;
      }
    });
  });
  return { data: roots };
}

const MOCK_AVAILABILITY = {
  science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
  platforms: { available: true, displayName: 'GCMD Platforms' },
  instruments: { available: true, displayName: 'GCMD Instruments' },
  chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: false, displayName: 'GEMET' },
};

type TagifyInput = HTMLInputElement & {
  _tagify?: { DOM?: { scope?: Element }; value?: ThesaurusKeyword[] };
};

async function keywordTags(page: Page, selector: string): Promise<ThesaurusKeyword[]> {
  return page.locator(selector).evaluate((input) => {
    const tags = (input as TagifyInput)._tagify?.value || [];
    return tags.map(tag => ({
      value: tag.value || '',
      id: tag.id || '',
      scheme: tag.scheme || '',
      schemeURI: tag.schemeURI || '',
      language: tag.language || '',
    }));
  });
}

async function freeKeywordValues(page: Page): Promise<string[]> {
  const tags = await keywordTags(page, '#input-freekeyword');
  return tags.map(tag => tag.value);
}

test('XML upload splits lithogeochemistry keywords into thesauri after the vocabularies load', async ({ page }) => {
  test.slow();
  await registerGoogleMapsNoopRoute(page);
  await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: MOCK_AVAILABILITY }));
  await page.route('**/api/v2/vocabs/thesauri/gcmd-science-keywords', route => route.fulfill({
    json: vocabPayload([...SCIENCE_KEYWORDS, EXTRA_SCIENCE_KEYWORD]),
  }));
  await page.route('**/api/v2/vocabs/thesauri/gcmd-instruments', route => route.fulfill({
    json: vocabPayload(INSTRUMENT_KEYWORDS),
  }));
  await page.route('**/api/v2/vocabs/thesauri/gcmd-platforms', route => route.fulfill({ json: { data: [] } }));

  await navigateToHome(page);
  await waitForHomepageReady(page);

  const xml = readFileSync(XML_PATH, 'utf8');
  expect(xml.indexOf('Geochemistry')).toBeLessThan(xml.indexOf('GCMD Instruments'));

  await page.locator('#button-form-load').click();
  const modal = page.locator('#modal-uploadxml');
  await expect(modal).toBeVisible();
  await page.setInputFiles('#input-uploadxml-file', {
    name: 'lithogeochemistry-of-the-volcanic-sedimentary-datacite.xml',
    mimeType: 'text/xml',
    buffer: Buffer.from(xml, 'utf8'),
  });

  await expect(page.locator('#upload-spinner-overlay')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#upload-spinner-overlay')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#input-resourceinformation-title')).toHaveValue(TITLE);

  await expect.poll(() => keywordTags(page, '#input-sciencekeyword')).toEqual(SCIENCE_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-instruments')).toEqual(INSTRUMENT_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-platforms')).toEqual([]);
  await expect.poll(async () => (await freeKeywordValues(page)).slice().sort()).toEqual([...FREE_KEYWORDS].sort());
});

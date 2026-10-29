import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import {
  navigateToHome, REPO_ROOT, registerGoogleMapsNoopRoute, waitForHomepageReady, waitForFormInteractionReady,
} from '../utils';

/**
 * Public DataCite lookup for 10.5880/fidgeo.d.2025.001, reduced to the
 * attributes ELMO's DOI proxy returns. Subjects keep DataCite's schemeUri /
 * valueUri names and the "GCMD Instruments" scheme label.
 */
const DOI = '10.5880/fidgeo.d.2025.001';
const LOOKUP = JSON.parse(readFileSync(
  path.join(REPO_ROOT, 'tests/fixtures/doi-prefill/10.5880-fidgeo.d.2025.001.json'),
  'utf8',
));

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

type SavedSubject = {
  text: string;
  subjectScheme: string;
  schemeURI: string;
  valueURI: string;
  lang: string;
};

const SCIENCE_KEYWORDS: ThesaurusKeyword[] = [{
  value: 'Science Keywords > EARTH SCIENCE > SOLID EARTH > GEOCHEMISTRY > GEOCHEMICAL PROPERTIES > CHEMICAL CONCENTRATIONS',
  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/12ed4fa0-27cc-4e05-a2b7-bbf2fde871f6',
  scheme: SCIENCE_SCHEME,
  schemeURI: SCIENCE_SCHEME_URI,
  language: 'en',
}];

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

// Every subject that is not a GCMD science or instruments keyword stays free.
// The prototype named the first three; the rest of the mocked record belongs here too.
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

function savedSubject(keyword: ThesaurusKeyword): SavedSubject {
  return {
    text: keyword.value,
    subjectScheme: keyword.scheme,
    schemeURI: keyword.schemeURI,
    valueURI: keyword.id,
    lang: keyword.language,
  };
}

const EXPECTED_SUBJECTS: SavedSubject[] = [
  ...SCIENCE_KEYWORDS.map(savedSubject),
  ...INSTRUMENT_KEYWORDS.map(savedSubject),
  ...FREE_KEYWORDS.map(text => ({
    text,
    subjectScheme: '',
    schemeURI: '',
    valueURI: '',
    lang: '',
  })),
];

function subjectKey(subject: SavedSubject): string {
  return JSON.stringify(subject);
}

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

test('DOI prefill splits keywords into thesauri and saves them in the XML', async ({ page }) => {
  test.slow();
  await registerGoogleMapsNoopRoute(page);
  await page.route(`**/api/v2/doi/lookup/${encodeURIComponent(DOI)}`, route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ json: LOOKUP });
  });

  await navigateToHome(page);
  await waitForHomepageReady(page);

  await page.locator('#input-resourceinformation-source-doi').fill(DOI);
  await page.locator('#button-resourceinformation-prefill-doi').click();
  await expect(page.locator('#modal-doi-prefill')).toBeVisible();
  await page.locator('#button-doi-prefill-confirm').click();
  await expect(page.locator('#modal-doi-prefill')).toBeHidden();
  await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0, { timeout: 60000 });

  await expect.poll(() => keywordTags(page, '#input-sciencekeyword')).toEqual(SCIENCE_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-instruments')).toEqual(INSTRUMENT_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-platforms')).toEqual([]);
  await expect.poll(async () => (await freeKeywordValues(page)).slice().sort()).toEqual([...FREE_KEYWORDS].sort());

  // start saving the form.
  await page.locator('#button-form-save').click();
  await expect(page.locator('#modal-saveas')).toBeVisible();
  await page.locator('#input-saveas-filename').fill('doi-keyword-thesauri');
  await waitForFormInteractionReady(page, 'save');
  const responsePromise = page.waitForResponse(response =>
    response.url().includes('/save/save_data.php') && response.request().method() === 'POST');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#button-saveas-save').click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);

  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const xml = Buffer.concat(chunks).toString('utf8');
  await test.info().attach('saved-metadata.xml', { body: xml, contentType: 'application/xml' });

  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  }).parse(xml);
  const resource = parsed.resource || parsed.envelope?.resource;
  expect(resource, `Expected a DataCite resource in the downloaded XML: ${xml.slice(0, 1000)}`).toBeTruthy();

  const subjectNodes = [resource.subjects?.subject].flat().filter(Boolean);
  const actual = subjectNodes.map((node): SavedSubject => {
    if (typeof node === 'string') {
      return { text: node, subjectScheme: '', schemeURI: '', valueURI: '', lang: '' };
    }
    return {
      text: node['#text'] || '',
      subjectScheme: node.subjectScheme || '',
      schemeURI: node.schemeURI || '',
      valueURI: node.valueURI || '',
      lang: node['xml:lang'] || node.lang || '',
    };
  });

  expect(actual.map(subjectKey).sort()).toEqual(EXPECTED_SUBJECTS.map(subjectKey).sort());
});

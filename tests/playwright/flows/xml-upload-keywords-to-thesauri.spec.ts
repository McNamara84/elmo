import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import {
  navigateToHome, REPO_ROOT, registerGoogleMapsNoopRoute, waitForFormInteractionReady, waitForHomepageReady,
} from '../utils';

/**
 * DataCite XML for 10.5880/gfz.4.6.2020.005. It covers free keywords and every
 * thesaurus supported by the shared ELMO editor, including GEMET.
 */
const XML_PATH = path.join(
  REPO_ROOT,
  'tests/fixtures/xml-import/seismic-data-from-the-hochvogel-summit-array-datacite.xml',
);
const TITLE = 'Seismic data from the Hochvogel summit array';

const SCIENCE_SCHEME = 'NASA/GCMD Earth Science Keywords';
const SCIENCE_SCHEME_URI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords';
const INSTRUMENTS_SCHEME = 'NASA/GCMD Instruments';
const INSTRUMENTS_SCHEME_URI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments';
const PLATFORMS_SCHEME = 'GCMD Platforms';
const PLATFORMS_SCHEME_URI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms';
const GEMET_SCHEME = 'GEMET - GEneral Multilingual Environmental Thesaurus';
const GEMET_SCHEME_URI = 'http://www.eionet.europa.eu/gemet/concept/';
const CHRONOSTRAT_SCHEME = 'International Chronostratigraphic Chart';
const CHRONOSTRAT_SCHEME_URI = 'http://resource.geosciml.org/vocabulary/timescale/gts2020';

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
  value: 'Science Keywords > EARTH SCIENCE > LAND SURFACE > GEOMORPHOLOGY',
  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/d35b9ba5-d018-48a5-8f0d-92b9c55b3279',
  scheme: SCIENCE_SCHEME,
  schemeURI: SCIENCE_SCHEME_URI,
  language: 'en',
}];

const INSTRUMENT_KEYWORDS: ThesaurusKeyword[] = [{
  value: 'Instruments > In Situ/Laboratory Instruments',
  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/ff564c87-78f2-47eb-a857-a4bdc0a71ae5',
  scheme: INSTRUMENTS_SCHEME,
  schemeURI: INSTRUMENTS_SCHEME_URI,
  language: 'en',
}];

const PLATFORM_KEYWORDS: ThesaurusKeyword[] = [{
  value: 'Platforms > In Situ Land-based Platforms > GEOPHYSICAL STATIONS/NETWORKS > SEISMOLOGICAL STATIONS',
  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/182fc560-a2b1-4c9d-9acf-febe0e1bf179',
  scheme: PLATFORMS_SCHEME,
  schemeURI: PLATFORMS_SCHEME_URI,
  language: 'en',
}];

const GEMET_KEYWORDS: ThesaurusKeyword[] = [
  {
    value: 'NATURAL ENVIRONMENT, ANTHROPIC ENVIRONMENT > ENVIRONMENT (natural environment, anthropic environment) > geophysical environment',
    id: 'http://www.eionet.europa.eu/gemet/group/13195',
    scheme: GEMET_SCHEME,
    schemeURI: GEMET_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'NATURAL ENVIRONMENT, ANTHROPIC ENVIRONMENT > ENVIRONMENT (natural environment, anthropic environment) > terrestrial environment',
    id: 'http://www.eionet.europa.eu/gemet/group/10198',
    scheme: GEMET_SCHEME,
    schemeURI: GEMET_SCHEME_URI,
    language: 'en',
  },
  {
    value: 'NATURAL ENVIRONMENT, ANTHROPIC ENVIRONMENT > ENVIRONMENT (natural environment, anthropic environment) > physical environment',
    id: 'http://www.eionet.europa.eu/gemet/group/10166',
    scheme: GEMET_SCHEME,
    schemeURI: GEMET_SCHEME_URI,
    language: 'en',
  },
];

const CHRONOSTRAT_KEYWORDS: ThesaurusKeyword[] = [{
  value: 'The Present',
  id: 'http://resource.geosciml.org/classifier/ics/ischart/Present',
  scheme: CHRONOSTRAT_SCHEME,
  schemeURI: CHRONOSTRAT_SCHEME_URI,
  language: 'en',
}];

const FREE_KEYWORDS = [
  'Environmental seismology',
  'rock mechanics',
  'rock stress',
  'natural hazard',
  'monitoring',
  'early warning',
  'compound material > sedimentary material > carbonate sedimentary material',
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
  chronostratigraphy: { available: true, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: true, displayName: 'GEMET' },
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
  ...PLATFORM_KEYWORDS.map(savedSubject),
  ...GEMET_KEYWORDS.map(savedSubject),
  ...CHRONOSTRAT_KEYWORDS.map(savedSubject),
  ...FREE_KEYWORDS.map(text => ({
    text,
    subjectScheme: '',
    schemeURI: '',
    valueURI: '',
    lang: '',
  })),
];

function parseSubjects(xml: string): SavedSubject[] {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  }).parse(xml);
  const resource = parsed.resource || parsed.envelope?.resource;
  expect(resource, `Expected a DataCite resource in the XML: ${xml.slice(0, 1000)}`).toBeTruthy();

  return [resource.subjects?.subject].flat().filter(Boolean).map((node): SavedSubject => {
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
}

function subjectKey(subject: SavedSubject): string {
  return JSON.stringify(subject);
}

test('XML upload splits Hochvogel keywords into every supported thesaurus', async ({ page }) => {
  test.slow();
  await registerGoogleMapsNoopRoute(page);
  await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: MOCK_AVAILABILITY }));
  await page.route('**/api/v2/vocabs/thesauri/gcmd-science-keywords', route => route.fulfill({
    json: vocabPayload(SCIENCE_KEYWORDS),
  }));
  await page.route('**/api/v2/vocabs/thesauri/gcmd-instruments', route => route.fulfill({
    json: vocabPayload(INSTRUMENT_KEYWORDS),
  }));
  await page.route('**/api/v2/vocabs/thesauri/gcmd-platforms', route => route.fulfill({
    json: vocabPayload(PLATFORM_KEYWORDS),
  }));
  await page.route('**/api/v2/vocabs/thesauri/gemet', route => route.fulfill({
    json: vocabPayload(GEMET_KEYWORDS),
  }));
  await page.route('**/api/v2/vocabs/thesauri/chronostrat-timescale', route => route.fulfill({
    json: vocabPayload(CHRONOSTRAT_KEYWORDS),
  }));

  await navigateToHome(page);
  await waitForHomepageReady(page);

  const xml = readFileSync(XML_PATH, 'utf8');
  expect(xml).toContain('GEMET - GEneral Multilingual Environmental Thesaurus');

  await page.locator('#button-form-load').click();
  const modal = page.locator('#modal-uploadxml');
  await expect(modal).toBeVisible();
  await page.setInputFiles('#input-uploadxml-file', {
    name: 'seismic-data-from-the-hochvogel-summit-array-datacite.xml',
    mimeType: 'text/xml',
    buffer: Buffer.from(xml, 'utf8'),
  });

  await page.waitForFunction(
    (title) => {
      const titleInput = document.querySelector<HTMLInputElement>('#input-resourceinformation-title');
      const spinner = document.querySelector('#upload-spinner-overlay');
      return titleInput?.value === title && spinner?.classList.contains('d-none');
    },
    TITLE,
    { timeout: 30_000 },
  );

  await expect.poll(() => keywordTags(page, '#input-sciencekeyword')).toEqual(SCIENCE_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-instruments')).toEqual(INSTRUMENT_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-platforms')).toEqual(PLATFORM_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-gemet')).toEqual(GEMET_KEYWORDS);
  await expect.poll(() => keywordTags(page, '#input-chronostratigraphy')).toEqual(CHRONOSTRAT_KEYWORDS);
  await expect.poll(async () => (await freeKeywordValues(page)).slice().sort()).toEqual([...FREE_KEYWORDS].sort());

  await page.locator('#button-form-save').click();
  await expect(page.locator('#modal-saveas')).toBeVisible();
  await page.locator('#input-saveas-filename').fill('hochvogel-keyword-thesauri');
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
  const savedXml = Buffer.concat(chunks).toString('utf8');
  await test.info().attach('saved-metadata.xml', { body: savedXml, contentType: 'application/xml' });

  const actualSubjects = parseSubjects(savedXml);
  expect(actualSubjects.map(subjectKey).sort()).toEqual(EXPECTED_SUBJECTS.map(subjectKey).sort());
});

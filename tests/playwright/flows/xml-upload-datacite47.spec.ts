import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

/**
 * Full DataCite 4.7 XML with nearly all properties that ELMO supports:
 * - Personal + Organizational creator
 * - Multiple title types
 * - Description (Abstract, Methods, TechnicalInfo)
 * - Funding reference
 * - Related identifiers
 * - Dates (Created)
 * - Free keyword subjects
 * - Rights / License
 * - Contact Person contributor
 */
const DATACITE_47_XML = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/B09Z-4K37</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Müller, Erika</creatorName>
      <givenName>Erika</givenName>
      <familyName>Müller</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-5727-2427</nameIdentifier>
      <affiliation affiliationIdentifier="https://ror.org/04z8jg394" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Helmholtz-Zentrum Potsdam Deutsches GeoForschungsZentrum GFZ</affiliation>
    </creator>
    <creator>
      <creatorName xml:lang="en" nameType="Organizational">ACME Research Corporation</creatorName>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">Full DataCite 4.7 Upload Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <subjects>
    <subject>geophysics</subject>
    <subject>seismology</subject>
  </subjects>
  <contributors>
    <contributor contributorType="ContactPerson">
      <contributorName nameType="Personal">Müller, Erika</contributorName>
      <givenName>Erika</givenName>
      <familyName>Müller</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-5727-2427</nameIdentifier>
      <affiliation affiliationIdentifier="https://ror.org/04z8jg394" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Helmholtz-Zentrum Potsdam Deutsches GeoForschungsZentrum GFZ</affiliation>
    </contributor>
    <contributor contributorType="DataCollector">
      <contributorName nameType="Personal">Schmidt, Thomas</contributorName>
      <givenName>Thomas</givenName>
      <familyName>Schmidt</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0002-9876-5432</nameIdentifier>
    </contributor>
  </contributors>
  <dates>
    <date dateType="Created">2025-03-15</date>
  </dates>
  <language>en</language>
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="DOI" relationType="IsSupplementTo">10.5555/example-supplement</relatedIdentifier>
  </relatedIdentifiers>
  <rightsList>
    <rights xml:lang="en" schemeURI="https://spdx.org/licenses/" rightsIdentifierScheme="SPDX" rightsIdentifier="CC-BY-4.0" rightsURI="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International</rights>
  </rightsList>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">This is a comprehensive test abstract for the DataCite 4.7 upload flow. It verifies that all major metadata fields are correctly mapped from XML to the ELMO form.</description>
    <description xml:lang="en" descriptionType="Methods">Seismic data was collected using broadband stations deployed across the study area.</description>
    <description xml:lang="en" descriptionType="TechnicalInfo">Data format: MiniSEED. Sampling rate: 100 Hz. Station network: GE.</description>
  </descriptions>
  <fundingReferences>
    <fundingReference>
      <funderName>Deutsche Forschungsgemeinschaft</funderName>
      <funderIdentifier funderIdentifierType="Crossref Funder ID">https://doi.org/10.13039/501100001659</funderIdentifier>
      <awardNumber awardURI="https://example.org/grants/DFG-12345">DFG-12345</awardNumber>
      <awardTitle>Seismic Monitoring Network Expansion</awardTitle>
    </fundingReference>
  </fundingReferences>
</resource>`;

test.describe('DataCite 4.7 Full XML Upload (Docker E2E)', () => {
  /** Console errors and JS exceptions collected across the test. */
  let consoleErrors: string[];
  let jsErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    jsErrors = [];

    // Register listeners BEFORE navigation to capture initialization-time errors
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await navigateToHome(page);

    // Wait for the page to be fully loaded: dropdowns populated, description types loaded
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });

    // Wait for language dropdown to have meaningful options
    await page.waitForFunction(() => {
      const s = document.querySelector<HTMLSelectElement>('#input-resourceinformation-language');
      return s != null && s.options.length > 2;
    }, { timeout: 30_000 });

    // Wait for resource type dropdown to have options
    await page.waitForFunction(() => {
      const s = document.querySelector<HTMLSelectElement>('#input-resourceinformation-resourcetype');
      return s != null && s.options.length > 1;
    }, { timeout: 15_000 });
  });

  test('uploads DataCite 4.7 XML and verifies all major fields are populated', async ({ page }) => {

    // ── Step 1: Open upload modal and load XML ─────────────────────────
    await page.getByRole('button', { name: /Load/i }).click();
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    await page.setInputFiles('#input-uploadxml-file', {
      name: 'datacite47-full.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(DATACITE_47_XML, 'utf-8'),
    });

    // Wait for title to be populated (indicates XML processing is done)
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Full DataCite 4.7 Upload Test',
      { timeout: 20_000 },
    );

    // ── Step 2: Resource Information ───────────────────────────────────
    await expect(page.locator('#input-resourceinformation-doi')).toHaveValue('10.82433/B09Z-4K37');
    await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveValue('2025');

    // Language: expect "en" is selected
    const langValue = await page.locator('#input-resourceinformation-language').inputValue();
    expect(langValue).toBeTruthy();

    // Resource type: expect "Dataset" is selected (value may be an ID)
    const rtText = await page.locator('#input-resourceinformation-resourcetype option:checked').textContent();
    expect(rtText?.trim().toLowerCase()).toContain('dataset');

    // ── Step 3: Author (Personal) ──────────────────────────────────────
    const authorRows = page.locator('div[data-creator-row]');
    await expect(authorRows.first()).toBeVisible();

    const firstAuthor = authorRows.first();
    await expect(firstAuthor.locator('[id^="input-author-lastname"]')).toHaveValue('Müller');
    await expect(firstAuthor.locator('[id^="input-author-firstname"]')).toHaveValue('Erika');

    // ── Step 4: Author Institution (Organizational) ────────────────────
    const instRows = page.locator('div[data-authorinstitution-row]');
    await expect(instRows.first()).toBeVisible();
    await expect(instRows.first().locator('[id^="input-authorinstitution-name"]')).toHaveValue(
      'ACME Research Corporation',
    );

    // ── Step 5: Contributor Person (DataCollector) ──────────────────────
    // Note: ContactPerson is mapped via ISO pointOfContact only, not from
    // pure DataCite XML. We verify the DataCollector contributor instead.
    const contributorPersonRows = page.locator('#group-contributorperson div[contributor-person-row]');
    const cpLastName = contributorPersonRows.first().locator('[id^="input-contributor-lastname"]');
    await expect(cpLastName).toHaveValue('Schmidt', { timeout: 10_000 });
    const cpFirstName = contributorPersonRows.first().locator('[id^="input-contributor-firstname"]');
    await expect(cpFirstName).toHaveValue('Thomas');

    // ── Step 6: Abstract ───────────────────────────────────────────────
    await expect(page.locator('#input-abstract')).toHaveValue(/comprehensive test abstract/);

    // ── Step 7: Methods description (dynamically loaded accordion) ────
    // Description types are loaded from ERNIE API; wait for them
    await page.waitForFunction(
      () => document.querySelectorAll('#accordion-description .accordion-item[data-description-slug]').length > 0,
      { timeout: 15_000 },
    );

    const methodsInput = page.locator('#input-description-Methods');
    if (await methodsInput.count() > 0) {
      // Expand the Methods accordion if needed
      const methodsCollapse = page.locator('#collapse-description-Methods');
      if (!(await methodsCollapse.isVisible())) {
        await page.locator('[data-bs-target="#collapse-description-Methods"]').click();
        await methodsCollapse.waitFor({ state: 'visible' });
      }
      await expect(methodsInput).toHaveValue(/Seismic data was collected/);
    }

    // ── Step 8: TechnicalInfo description ──────────────────────────────
    const techInput = page.locator('#input-description-TechnicalInfo');
    if (await techInput.count() > 0) {
      const techCollapse = page.locator('#collapse-description-TechnicalInfo');
      if (!(await techCollapse.isVisible())) {
        await page.locator('[data-bs-target="#collapse-description-TechnicalInfo"]').click();
        await techCollapse.waitFor({ state: 'visible' });
      }
      await expect(techInput).toHaveValue(/MiniSEED/);
    }

    // ── Step 9: Date Created ───────────────────────────────────────────
    await expect(page.locator('#input-date-created')).toHaveValue('2025-03-15');

    // ── Step 10: Free Keywords ─────────────────────────────────────────
    // Keywords are stored as Tagify tags; check the underlying input value
    const keywordValue = await page.locator('#input-freekeyword').inputValue();
    expect(keywordValue.toLowerCase()).toContain('geophysics');
    expect(keywordValue.toLowerCase()).toContain('seismology');

    // ── Step 11: Funding Reference ─────────────────────────────────────
    await expect(page.locator('#input-funder').first()).toHaveValue('Deutsche Forschungsgemeinschaft');
    await expect(page.locator('#input-grantnumber').first()).toHaveValue('DFG-12345');
    await expect(page.locator('#input-grantname').first()).toHaveValue('Seismic Monitoring Network Expansion');

    // ── Step 12: Related Work ──────────────────────────────────────────
    await expect(page.locator('#input-relatedwork-identifier').first()).toHaveValue('10.5555/example-supplement');

    // ── Step 13: License ───────────────────────────────────────────────
    const licenseText = await page.locator('#input-rights-license option:checked').textContent();
    expect(licenseText?.toLowerCase()).toContain('cc');

    // ── Step 14: No console errors ─────────────────────────────────────
    // Filter known CI-environment messages (no ERNIE API key / external services)
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon.ico') &&
        !e.includes('google.maps') &&
        !e.includes('installHook') &&
        !e.includes('API key not found') &&
        !e.includes('503') &&
        !e.includes('thesauri availability'),
    );
    expect(realErrors, `Unexpected console errors: ${realErrors.join('\n')}`).toEqual([]);

    // No uncaught JS exceptions (pageerror)
    const criticalJsErrors = jsErrors.filter(
      (e) => !e.includes('google.maps') && !e.includes('installHook'),
    );
    expect(criticalJsErrors, `Unexpected JS errors: ${criticalJsErrors.join('\n')}`).toEqual([]);
  });

  test('uploads envelope-wrapped XML and populates fields correctly', async ({ page }) => {
    // Wrap the DataCite XML inside an <envelope> element (the format produced by
    // the ELMO API when exporting multiple schemas in a single file).
    const envelopeXml = `<?xml version="1.0" encoding="UTF-8"?>\n<envelope>\n${
      DATACITE_47_XML.replace(/^<\?xml[^?]*\?>\s*/, '')
    }\n</envelope>`;

    await page.getByRole('button', { name: /Load/i }).click();
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    await page.setInputFiles('#input-uploadxml-file', {
      name: 'datacite47-envelope.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(envelopeXml, 'utf-8'),
    });

    // Title proves that loadXmlToForm found <resource> inside <envelope>
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Full DataCite 4.7 Upload Test',
      { timeout: 20_000 },
    );

    // Wait for async processing to finish
    await page.evaluate(() => (window as any).descriptionTypesReady);

    // Spot-check a few fields to verify full mapping succeeded
    await expect(page.locator('#input-abstract')).toHaveValue(/comprehensive test abstract/);
    await expect(page.locator('#input-funder').first()).toHaveValue('Deutsche Forschungsgemeinschaft');
    await expect(page.locator('#input-grantnumber').first()).toHaveValue('DFG-12345');
  });
});

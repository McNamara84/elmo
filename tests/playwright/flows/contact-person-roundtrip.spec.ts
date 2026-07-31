import { test, expect } from '@playwright/test';
import { navigateToHome, registerGoogleMapsNoopRoute } from '../utils';

/**
 * Envelope XML (DataCite + ISO) with a Contact Person.
 * Simulates the output of "Save As" in ELMO: the DataCite section has the
 * author as a ContactPerson contributor, and the ISO section carries the
 * email, website, and affiliation in pointOfContact.
 */
const ENVELOPE_XML_WITH_CP = `<?xml version="1.0" encoding="UTF-8"?>
<envelope>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/CP-TEST</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0002-1825-0097</nameIdentifier>
      <affiliation affiliationIdentifier="https://ror.org/04z8jg394" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Helmholtz-Zentrum Potsdam Deutsches GeoForschungsZentrum GFZ</affiliation>
    </creator>
    <creator>
      <creatorName nameType="Personal">Smith, John</creatorName>
      <givenName>John</givenName>
      <familyName>Smith</familyName>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">Contact Person Roundtrip Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <contributors>
    <contributor contributorType="ContactPerson">
      <contributorName nameType="Personal">Doe, Jane</contributorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0002-1825-0097</nameIdentifier>
    </contributor>
  </contributors>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">Test abstract for contact person roundtrip.</description>
  </descriptions>
</resource>

<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                 xmlns:gco="http://www.isotc211.org/2005/gco">
  <gmd:contact>
    <gmd:CI_ResponsibleParty>
      <gmd:individualName>
        <gco:CharacterString>Doe, Jane</gco:CharacterString>
      </gmd:individualName>
      <gmd:contactInfo>
        <gmd:CI_Contact>
          <gmd:address>
            <gmd:CI_Address>
              <gmd:electronicMailAddress>
                <gco:CharacterString>jane.doe@gfz-potsdam.de</gco:CharacterString>
              </gmd:electronicMailAddress>
            </gmd:CI_Address>
          </gmd:address>
        </gmd:CI_Contact>
      </gmd:contactInfo>
    </gmd:CI_ResponsibleParty>
  </gmd:contact>
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:pointOfContact>
        <gmd:CI_ResponsibleParty>
          <gmd:individualName>
            <gco:CharacterString>Doe, Jane</gco:CharacterString>
          </gmd:individualName>
          <gmd:contactInfo>
            <gmd:CI_Contact>
              <gmd:address>
                <gmd:CI_Address>
                  <gmd:electronicMailAddress>
                    <gco:CharacterString>jane.doe@gfz-potsdam.de</gco:CharacterString>
                  </gmd:electronicMailAddress>
                </gmd:CI_Address>
              </gmd:address>
              <gmd:onlineResource>
                <gmd:CI_OnlineResource>
                  <gmd:linkage>
                    <gmd:URL>https://www.gfz-potsdam.de/staff/jane.doe</gmd:URL>
                  </gmd:linkage>
                </gmd:CI_OnlineResource>
              </gmd:onlineResource>
            </gmd:CI_Contact>
          </gmd:contactInfo>
          <gmd:role>
            <gmd:CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_RoleCode"
                             codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
          </gmd:role>
        </gmd:CI_ResponsibleParty>
      </gmd:pointOfContact>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmd:MD_Metadata>
</envelope>`;

/**
 * Pure DataCite XML with a ContactPerson contributor but no ISO section.
 * Tests the fallback path that reads CP from DataCite.
 */
const DATACITE_ONLY_WITH_CP = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/CP-DC-ONLY</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Müller, Erika</creatorName>
      <givenName>Erika</givenName>
      <familyName>Müller</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-5727-2427</nameIdentifier>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">DataCite-Only CP Fallback Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <contributors>
    <contributor contributorType="ContactPerson">
      <contributorName nameType="Personal">Müller, Erika</contributorName>
      <givenName>Erika</givenName>
      <familyName>Müller</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-5727-2427</nameIdentifier>
    </contributor>
  </contributors>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">Abstract for DataCite-only CP test.</description>
  </descriptions>
</resource>`;

/**
 * Envelope XML where the CP name has trailing whitespace and different casing
 * in the ISO section vs what was loaded into the author rows from DataCite.
 * Tests that matching is robust (trim + case-insensitive).
 */
const ENVELOPE_XML_WHITESPACE_CASE_MISMATCH = `<?xml version="1.0" encoding="UTF-8"?>
<envelope>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/CP-MISMATCH</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">García, María</creatorName>
      <givenName>María</givenName>
      <familyName>García</familyName>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">Whitespace Case Mismatch Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <contributors>
    <contributor contributorType="ContactPerson">
      <contributorName nameType="Personal">García, María</contributorName>
      <givenName>María</givenName>
      <familyName>García</familyName>
    </contributor>
  </contributors>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">Mismatch test abstract.</description>
  </descriptions>
</resource>

<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                 xmlns:gco="http://www.isotc211.org/2005/gco">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:pointOfContact>
        <gmd:CI_ResponsibleParty>
          <gmd:individualName>
            <gco:CharacterString>garcía , maría </gco:CharacterString>
          </gmd:individualName>
          <gmd:contactInfo>
            <gmd:CI_Contact>
              <gmd:address>
                <gmd:CI_Address>
                  <gmd:electronicMailAddress>
                    <gco:CharacterString>maria.garcia@example.org</gco:CharacterString>
                  </gmd:electronicMailAddress>
                </gmd:CI_Address>
              </gmd:address>
            </gmd:CI_Contact>
          </gmd:contactInfo>
          <gmd:role>
            <gmd:CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_RoleCode"
                             codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
          </gmd:role>
        </gmd:CI_ResponsibleParty>
      </gmd:pointOfContact>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmd:MD_Metadata>
</envelope>`;

/**
 * Envelope XML with two authors and no contact person.
 * The CP checkbox should remain unchecked for all authors.
 */
const ENVELOPE_XML_WITHOUT_CP = `<?xml version="1.0" encoding="UTF-8"?>
<envelope>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/NO-CP</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Brown, Alice</creatorName>
      <givenName>Alice</givenName>
      <familyName>Brown</familyName>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">No Contact Person Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">No CP test abstract.</description>
  </descriptions>
</resource>

<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                 xmlns:gco="http://www.isotc211.org/2005/gco">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmd:MD_Metadata>
</envelope>`;

/**
 * Helper: upload an XML string via the Load modal.
 */
async function uploadXml(page: import('@playwright/test').Page, xmlContent: string, xmlFilename: string) {
  await page.locator('#button-form-load').click();
  const modal = page.locator('div#modal-uploadxml');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await page.setInputFiles('#input-uploadxml-file', {
    name: xmlFilename,
    mimeType: 'text/xml',
    buffer: Buffer.from(xmlContent, 'utf-8'),
  });
}

test.describe('Contact Person Roundtrip (Issue #1046)', () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await registerGoogleMapsNoopRoute(page);

    await navigateToHome(page);

    // Wait for the page to be fully loaded
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });

    // Wait for resource type dropdown to have options
    await page.waitForFunction(() => {
      const s = document.querySelector<HTMLSelectElement>('#input-resourceinformation-resourcetype');
      return s != null && s.options.length > 1;
    }, { timeout: 15_000 });
  });

  test('envelope XML: CP checkbox, email, and website are restored after load', async ({ page }) => {
    await uploadXml(page, ENVELOPE_XML_WITH_CP, 'cp-roundtrip.xml');

    // Wait for title to verify XML processing is complete
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Contact Person Roundtrip Test',
      { timeout: 20_000 },
    );

    // Verify authors are loaded
    const authorRows = page.locator('div[data-creator-row]');
    const firstAuthor = authorRows.nth(0);
    await expect(firstAuthor.locator('[id^="input-author-lastname"]')).toHaveValue('Doe');
    await expect(firstAuthor.locator('[id^="input-author-firstname"]')).toHaveValue('Jane');

    // Verify CP checkbox is checked for the first author (Jane Doe)
    const cpCheckbox = firstAuthor.locator('[id^="checkbox-author-contactperson"]');
    await expect(cpCheckbox).toBeChecked({ timeout: 10_000 });

    // Verify CP email is populated
    const cpEmail = firstAuthor.locator('input[name="cpEmail[]"]');
    await expect(cpEmail).toBeVisible();
    await expect(cpEmail).toHaveValue('jane.doe@gfz-potsdam.de');

    // Verify CP website is populated
    const cpWebsite = firstAuthor.locator('input[name="cpOnlineResource[]"]');
    await expect(cpWebsite).toBeVisible();
    await expect(cpWebsite).toHaveValue('https://www.gfz-potsdam.de/staff/jane.doe');

    // Verify the second author is NOT marked as CP
    const secondAuthor = authorRows.nth(1);
    await expect(secondAuthor.locator('[id^="input-author-lastname"]')).toHaveValue('Smith');
    const secondCpCheckbox = secondAuthor.locator('[id^="checkbox-author-contactperson"]');
    await expect(secondCpCheckbox).not.toBeChecked();

    // Verify contact-person-input is hidden for the second author
    await expect(secondAuthor.locator('.contact-person-input').first()).not.toBeVisible();
  });

  test('pure DataCite XML: CP checkbox is set via fallback (no email available)', async ({ page }) => {
    await uploadXml(page, DATACITE_ONLY_WITH_CP, 'cp-datacite-only.xml');

    // Wait for title to verify XML processing is complete
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'DataCite-Only CP Fallback Test',
      { timeout: 20_000 },
    );

    // Verify author is loaded
    const firstAuthor = page.locator('div[data-creator-row]').first();
    await expect(firstAuthor.locator('[id^="input-author-lastname"]')).toHaveValue('Müller');
    await expect(firstAuthor.locator('[id^="input-author-firstname"]')).toHaveValue('Erika');

    // Verify CP checkbox is checked (via DataCite fallback)
    const cpCheckbox = firstAuthor.locator('[id^="checkbox-author-contactperson"]');
    await expect(cpCheckbox).toBeChecked({ timeout: 10_000 });

    // CP fields should be visible (shown by fallback)
    await expect(firstAuthor.locator('.contact-person-input').first()).toBeVisible();

    // Email should be empty since DataCite doesn't carry it
    const cpEmail = firstAuthor.locator('input[name="cpEmail[]"]');
    await expect(cpEmail).toHaveValue('');
  });

  test('envelope XML: CP still matches with whitespace/case differences in ISO names', async ({ page }) => {
    await uploadXml(page, ENVELOPE_XML_WHITESPACE_CASE_MISMATCH, 'cp-mismatch.xml');

    // Wait for title
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Whitespace Case Mismatch Test',
      { timeout: 20_000 },
    );

    // Verify author row: DataCite provides the canonical form
    const firstAuthor = page.locator('div[data-creator-row]').first();
    await expect(firstAuthor.locator('[id^="input-author-lastname"]')).toHaveValue('García');
    await expect(firstAuthor.locator('[id^="input-author-firstname"]')).toHaveValue('María');

    // Despite ISO having "garcía , maría " the CP match should succeed
    const cpCheckbox = firstAuthor.locator('[id^="checkbox-author-contactperson"]');
    await expect(cpCheckbox).toBeChecked({ timeout: 10_000 });

    // Email should be populated from ISO
    const cpEmail = firstAuthor.locator('input[name="cpEmail[]"]');
    await expect(cpEmail).toHaveValue('maria.garcia@example.org');
  });

  test('envelope XML without CP: no author is marked as contact person', async ({ page }) => {
    await uploadXml(page, ENVELOPE_XML_WITHOUT_CP, 'no-cp.xml');

    // Wait for title
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'No Contact Person Test',
      { timeout: 20_000 },
    );

    // Verify author is loaded but NOT marked as CP
    const firstAuthor = page.locator('div[data-creator-row]').first();
    await expect(firstAuthor.locator('[id^="input-author-lastname"]')).toHaveValue('Brown');
    const cpCheckbox = firstAuthor.locator('[id^="checkbox-author-contactperson"]');
    await expect(cpCheckbox).not.toBeChecked();

    // CP fields should be hidden
    await expect(firstAuthor.locator('.contact-person-input').first()).not.toBeVisible();
  });

  test('no unexpected console errors during CP loading', async ({ page }) => {
    await uploadXml(page, ENVELOPE_XML_WITH_CP, 'cp-errors-check.xml');

    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Contact Person Roundtrip Test',
      { timeout: 20_000 },
    );

    await expect(page.locator('#input-uploadxml-file')).toBeEnabled();
    await expect(page.locator('#upload-spinner-overlay')).toHaveClass(/d-none/);

    // Filter known CI-environment messages
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
  });
});

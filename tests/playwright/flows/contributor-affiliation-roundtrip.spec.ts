import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

/**
 * XML with two contributor persons, each having an affiliation and ROR ID
 * but no ORCID. This reproduces the scenario from issue #1047.
 */
const XML_TWO_CONTRIBUTOR_PERSONS = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/CONTRIB-TEST</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">Contributor Affiliation Roundtrip Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <contributors>
    <contributor contributorType="DataCurator">
      <contributorName nameType="Personal">Schmidt, Hans</contributorName>
      <givenName>Hans</givenName>
      <familyName>Schmidt</familyName>
      <affiliation affiliationIdentifier="https://ror.org/04z8jg394" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Helmholtz-Zentrum Potsdam Deutsches GeoForschungsZentrum GFZ</affiliation>
    </contributor>
    <contributor contributorType="Researcher">
      <contributorName nameType="Personal">Mueller, Erika</contributorName>
      <givenName>Erika</givenName>
      <familyName>Mueller</familyName>
      <affiliation affiliationIdentifier="https://ror.org/01bj3aw27" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Technical University of Berlin</affiliation>
    </contributor>
  </contributors>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">Test abstract.</description>
  </descriptions>
</resource>`;

/**
 * XML with two contributor organisations, each having an affiliation and ROR ID.
 */
const XML_TWO_CONTRIBUTOR_ORGS = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://datacite.org/schema/kernel-4"
          xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.82433/CONTRIB-ORG-TEST</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">Contributor Org Affiliation Roundtrip Test</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2025</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <contributors>
    <contributor contributorType="HostingInstitution">
      <contributorName nameType="Organizational">GFZ German Research Centre for Geosciences</contributorName>
      <affiliation affiliationIdentifier="https://ror.org/04z8jg394" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Helmholtz-Zentrum Potsdam Deutsches GeoForschungsZentrum GFZ</affiliation>
    </contributor>
    <contributor contributorType="Distributor">
      <contributorName nameType="Organizational">Technical University of Berlin</contributorName>
      <affiliation affiliationIdentifier="https://ror.org/01bj3aw27" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">TU Berlin</affiliation>
    </contributor>
  </contributors>
  <descriptions>
    <description xml:lang="en" descriptionType="Abstract">Test abstract for orgs.</description>
  </descriptions>
</resource>`;

async function uploadXml(page: import('@playwright/test').Page, xmlContent: string, filename: string) {
  await page.locator('#button-form-load').click();
  const modal = page.locator('div#modal-uploadxml');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await page.setInputFiles('#input-uploadxml-file', {
    name: filename,
    mimeType: 'text/xml',
    buffer: Buffer.from(xmlContent, 'utf-8'),
  });
}

test.describe('Contributor Affiliation Roundtrip (Issue #1047)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });
  });

  test('second contributor person affiliation is loaded from XML', async ({ page }) => {
    // The contributor persons card contains [contributor-person-row] attribute
    const personContainer = page.locator('[contributor-person-row]').first().locator('..');
    test.skip(!(await personContainer.isVisible()), 'Contributor Persons form group is not enabled');

    await uploadXml(page, XML_TWO_CONTRIBUTOR_PERSONS, 'two-contributors.xml');

    // Wait for XML to be processed by checking title field
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Contributor Affiliation Roundtrip Test',
      { timeout: 20_000 },
    );

    // Verify first contributor person — select rows by the attribute selector
    const personRows = page.locator('[contributor-person-row]');
    const firstPerson = personRows.nth(0);
    await expect(firstPerson.locator('input[name="cbPersonLastname[]"]')).toHaveValue('Schmidt');
    await expect(firstPerson.locator('input[name="cbPersonFirstname[]"]')).toHaveValue('Hans');

    // Check first contributor affiliation via Tagify tag on the affiliation input
    const firstAffTags = firstPerson.locator('input[name="cbAffiliation[]"]').locator('..').locator('tags.tagify tag');
    await expect(firstAffTags.first()).toBeVisible({ timeout: 10_000 });
    await expect(firstAffTags.first()).toContainText('Helmholtz-Zentrum Potsdam');

    // Verify second contributor person
    const secondPerson = personRows.nth(1);
    await expect(secondPerson.locator('input[name="cbPersonLastname[]"]')).toHaveValue('Mueller');
    await expect(secondPerson.locator('input[name="cbPersonFirstname[]"]')).toHaveValue('Erika');

    // THIS IS THE BUG: second contributor's affiliation must also be loaded
    const secondAffTags = secondPerson.locator('input[name="cbAffiliation[]"]').locator('..').locator('tags.tagify tag');
    await expect(secondAffTags.first()).toBeVisible({ timeout: 10_000 });
    await expect(secondAffTags.first()).toContainText('Technical University of Berlin');

    // Verify ROR IDs are set for both contributors
    await expect(firstPerson.locator('input[name="cbpRorIds[]"]')).toHaveValue('04z8jg394');
    await expect(secondPerson.locator('input[name="cbpRorIds[]"]')).toHaveValue('01bj3aw27');
  });

  test('second contributor organisation affiliation is loaded from XML', async ({ page }) => {
    // Skip if contributor institutions form group is not visible
    const contributorOrgCard = page.locator('#group-contributororganisation');
    test.skip(!(await contributorOrgCard.isVisible()), 'Contributor Institutions form group is not enabled');

    await uploadXml(page, XML_TWO_CONTRIBUTOR_ORGS, 'two-contributor-orgs.xml');

    // Wait for XML to be processed
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue(
      'Contributor Org Affiliation Roundtrip Test',
      { timeout: 20_000 },
    );

    // Verify first organisation
    const orgRows = page.locator('#group-contributororganisation [contributors-row]');
    const firstOrg = orgRows.nth(0);
    await expect(firstOrg.locator('input[name="cbOrganisationName[]"]')).toHaveValue(
      'GFZ German Research Centre for Geosciences',
    );

    // Check first org affiliation via Tagify tag — target specifically the affiliation input's tags
    const firstAffTags = firstOrg.locator('input[name="OrganisationAffiliation[]"]').locator('..').locator('tags.tagify tag');
    await expect(firstAffTags.first()).toBeVisible({ timeout: 10_000 });
    await expect(firstAffTags.first()).toContainText('Helmholtz-Zentrum Potsdam');

    // Verify second organisation
    const secondOrg = orgRows.nth(1);
    await expect(secondOrg.locator('input[name="cbOrganisationName[]"]')).toHaveValue(
      'Technical University of Berlin',
    );

    // THIS IS THE BUG: second org's affiliation must also be loaded
    const secondAffTags = secondOrg.locator('input[name="OrganisationAffiliation[]"]').locator('..').locator('tags.tagify tag');
    await expect(secondAffTags.first()).toBeVisible({ timeout: 10_000 });
    await expect(secondAffTags.first()).toContainText('TU Berlin');

    // Verify ROR IDs
    await expect(firstOrg.locator('input[name="hiddenOrganisationRorId[]"]')).toHaveValue('04z8jg394');
    await expect(secondOrg.locator('input[name="hiddenOrganisationRorId[]"]')).toHaveValue('01bj3aw27');
  });
});

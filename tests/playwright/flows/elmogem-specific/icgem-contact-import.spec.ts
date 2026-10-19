import { test, expect } from '@playwright/test';
import { navigateToHome, registerGoogleMapsNoopRoute, waitForHomepageReady } from '../../utils';

const CONTACT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4">
  <dace:resource>
    <dace:creators>
      <dace:creator>
        <dace:creatorName nameType="Personal">Author, Ada</dace:creatorName>
        <dace:givenName>Ada</dace:givenName>
        <dace:familyName>Author</dace:familyName>
      </dace:creator>
    </dace:creators>
    <dace:titles><dace:title>Contact import regression</dace:title></dace:titles>
    <dace:publicationYear>2026</dace:publicationYear>
    <dace:resourceType resourceTypeGeneral="Dataset">Dataset</dace:resourceType>
    <dace:language>en</dace:language>
    <dace:contributors>
      <dace:contributor contributorType="ContactPerson">
        <dace:contributorName nameType="Personal">Author, Ada</dace:contributorName>
        <dace:givenName>Ada</dace:givenName>
        <dace:familyName>Author</dace:familyName>
      </dace:contributor>
      <dace:contributor contributorType="ContactPerson">
        <dace:contributorName nameType="Personal">Contact, Connie</dace:contributorName>
        <dace:givenName>Connie</dace:givenName>
        <dace:familyName>Contact</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID">https://orcid.org/0000-0002-1825-0097</dace:nameIdentifier>
        <dace:affiliation affiliationIdentifier="https://ror.org/04z8jg394" affiliationIdentifierScheme="ROR">GFZ</dace:affiliation>
      </dace:contributor>
      <dace:contributor contributorType="Researcher">
        <dace:contributorName nameType="Personal">Contact, Connie</dace:contributorName>
        <dace:givenName>Connie</dace:givenName>
        <dace:familyName>Contact</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID">0000-0002-1825-0097</dace:nameIdentifier>
      </dace:contributor>
    </dace:contributors>
  </dace:resource>
  <grav:globalGravityProduct>
    <grav:contact>
      <grav:address>ada@example.org</grav:address>
      <grav:onlineResource>https://ada.example.org</grav:onlineResource>
      <grav:address>connie@example.org</grav:address>
    </grav:contact>
    <grav:harmonicCoefficientsModel>
      <grav:modelName>Contact import regression</grav:modelName>
      <grav:modelType>Static</grav:modelType>
    </grav:harmonicCoefficientsModel>
  </grav:globalGravityProduct>
</grav:envelope>`;

test('uploads author and contributor contacts without adding the contributor to Authors', async ({ page }) => {
  await registerGoogleMapsNoopRoute(page);
  // This contact-only fixture does not need remote keyword vocabularies.
  await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: {} }));
  await page.route('**/api/v2/vocabs/titletypes', route => route.fulfill({
    json: [{ id: 1, name: 'Main Title' }, { id: 2, name: 'Alternative Title' }],
  }));
  await navigateToHome(page);
  await waitForHomepageReady(page);
  await page.waitForFunction(async () => {
    const app = window as any;
    await app.thesauriReady;
    return Boolean(app.authorStack && app.contributorStack && app.icgemModule
      && (document.querySelector('#input-freekeyword') as any)?._tagify);
  });

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  for (let attempt = 0; attempt < 2; attempt++) {
    // Dismiss the prior toast so a repeated import must produce fresh success feedback.
    if (attempt > 0) await page.locator('#toast-upload-feedback .btn-close').click();
    await page.locator('#button-form-load').click();
    await expect(page.locator('#modal-uploadxml')).toBeVisible();
    await page.locator('#input-uploadxml-file').setInputFiles({
      name: 'icgem-contacts.xml', mimeType: 'application/xml', buffer: Buffer.from(CONTACT_XML),
    });
    await expect(page.locator('#toast-upload-feedback')).toHaveClass(/text-bg-success/);
    await expect(page.locator('#toast-upload-feedback')).toBeVisible();
    await expect(page.locator('#modal-uploadxml')).toBeHidden();

    const author = page.locator('[data-author-card]');
    await expect(author).toHaveCount(1);
    await expect(author.locator('[name="familynames[]"]')).toHaveValue('Author');
    await expect(author.locator('[name="cpEmail[]"]')).toHaveValue('');
    await expect(author.locator('[name="cpOnlineResource[]"]')).toHaveValue('');

    const contributor = page.locator('[data-contributor-card]');
    await expect(contributor).toHaveCount(2);
    const cards = await contributor.evaluateAll((nodes) => nodes.map((node) => ({
      familyname: (node.querySelector('[name="cbPersonLastname[]"]') as HTMLInputElement | null)?.value || '',
      email: (node.querySelector('[name="cbContactEmail[]"]') as HTMLInputElement | null)?.value || '',
      website: (node.querySelector('[name="cbContactWebsite[]"]') as HTMLInputElement | null)?.value || '',
      contactVisible: !node.querySelector('[data-contributor-contact-fields]')?.classList.contains('d-none'),
    })));
    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        familyname: 'Author', email: 'ada@example.org', website: 'https://ada.example.org', contactVisible: true,
      }),
      expect.objectContaining({
        familyname: 'Contact', email: 'connie@example.org', website: '', contactVisible: true,
      }),
    ]));
    expect(cards).toHaveLength(2);

    const payload = await page.evaluate(() => (window as any).contributorStack.collectPayload());
    const ada = payload.find((entry: { familyname?: string }) => entry.familyname === 'Author');
    const connie = payload.find((entry: { familyname?: string }) => entry.familyname === 'Contact');
    expect(ada).toEqual(expect.objectContaining({
      type: 'person', familyname: 'Author', givenname: 'Ada',
      email: 'ada@example.org', website: 'https://ada.example.org',
      roles: ['Contact Person'],
    }));
    expect(connie).toEqual(expect.objectContaining({
      type: 'person', familyname: 'Contact', givenname: 'Connie',
      orcid: '0000-0002-1825-0097', email: 'connie@example.org', website: '',
      affiliations: [{ label: 'GFZ', rorId: '04z8jg394' }],
    }));
    expect(connie.roles).toEqual(expect.arrayContaining(['Contact Person', 'Researcher']));
    expect(connie.roles).toHaveLength(2);
  }

  expect(pageErrors).toEqual([]);
});

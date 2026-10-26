import { test, expect } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';
import { completeMinimalDatasetForm, navigateToHome, waitForFormInteractionReady } from '../utils';

test.use({reducedMotion: 'reduce'});

for (const format of ['xml', 'jsonld']) {
  test(`${format}: empty affiliation names use ROR URLs only in the downloaded file`, async ({page}) => {
    test.setTimeout(60000);
    let saved: any;
    await page.route('**/api/v2/drafts**', async route => {
      const request = route.request();
      if (request.method() === 'POST' || request.method() === 'PUT') {
        saved = request.postDataJSON().payload;
        await route.fulfill({json: {id: 'affiliation-export-draft', updatedAt: new Date().toISOString()}});
      } else await route.fulfill({status: 204, body: ''});
    });
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);
    await page.evaluate(() => {
      const affiliations = [{label: 'GFZ', rorId: '04z8jg394'}, {label: 'Department', rorId: ''}];
      (window as any).authorStack.setAuthors([
        {type: 'person', familyname: 'Export', givenname: 'Anna', isContact: true, email: 'anna@example.org', affiliations},
        {type: 'institution', institutionname: 'Export Institute', affiliations},
      ]);
      (window as any).contributorStack.setContributors([
        {type: 'person', familyname: 'Contributor', givenname: 'Jan', roles: ['Researcher'], affiliations},
        {type: 'institution', institutionname: 'Research Data Archive', roles: ['Hosting Institution'], affiliations},
      ]);
    });
    const cards = page.locator('[data-author-card], [data-contributor-card]');
    await expect(cards).toHaveCount(4);
    for (const card of await cards.all()) await card.locator('[data-affiliation-label]').first().fill('');

    if (format === 'jsonld') {
      await page.locator('#button-form-save-jsonld').click();
    } else await page.locator('#button-form-save').click();
    await expect(page.locator('#modal-saveas')).toBeVisible();
    await page.locator('#input-saveas-filename').fill(`incomplete-affiliations-${format}`);
    await waitForFormInteractionReady(page, 'save');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#button-saveas-save').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`incomplete-affiliations-${format}.${format}`);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString('utf8');

    if (format === 'xml') {
      const parsed = new XMLParser({
        ignoreAttributes: false, attributeNamePrefix: '',
        isArray: name => ['creator', 'contributor', 'affiliation'].includes(name),
      }).parse(body);
      const resource = parsed.envelope?.resource ?? parsed.resource;
      const contributors = resource.contributors.contributor.filter((entry: any) => entry.contributorType !== 'ContactPerson');
      expect(resource.creators.creator).toHaveLength(2);
      expect(contributors).toHaveLength(2);
      for (const entry of [...resource.creators.creator, ...contributors]) {
        expect(entry.affiliation[0]['#text']).toBe('https://ror.org/04z8jg394');
        expect(entry.affiliation[0].affiliationIdentifier).toBe('https://ror.org/04z8jg394');
        expect(entry.affiliation[1]).toBe('Department');
      }
    } else {
      const resource = JSON.parse(body);
      const contributors = resource.contributors.contributor.filter((entry: any) => entry.attrs.contributorType !== 'ContactPerson');
      expect(resource.creators.creator).toHaveLength(2);
      expect(contributors).toHaveLength(2);
      for (const entry of [...resource.creators.creator, ...contributors]) {
        expect(entry.affiliation[0].value).toBe('https://ror.org/04z8jg394');
        expect(entry.affiliation[0].attrs.affiliationIdentifier).toBe('https://ror.org/04z8jg394');
        expect(entry.affiliation[1]).toEqual({value: 'Department'});
      }
    }

    for (const card of await cards.all()) {
      await expect(card.locator('[data-affiliation-label]').first()).toBeEmpty();
      await expect(card.locator('[data-affiliation-ror]').first()).toHaveText('04z8jg394');
    }
    for (const field of ['authorsPayload', 'contributorsPayload']) {
      expect(JSON.parse(saved.values[field]).map((entry: any) => entry.affiliations[0])).toEqual([
        {label: '', rorId: '04z8jg394'}, {label: '', rorId: '04z8jg394'},
      ]);
    }
  });
}

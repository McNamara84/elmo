import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { APP_BASE_URL, REPO_ROOT, registerStaticAssetRoutes } from '../utils';

const contributorsMarkup = readFileSync(path.join(REPO_ROOT, 'formgroups/contributors.html'), 'utf8')
  .replace(/<\?php[\s\S]*?\?>/g, '');

test.beforeEach(async ({ page }) => {
  await registerStaticAssetRoutes(page);
  await page.route('**/contact-website-harness', route => route.fulfill({
    contentType: 'text/html',
    body: `<!DOCTYPE html>
      <html lang="en"><head><meta charset="utf-8"><title>Contact website validation</title>
        <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
      </head><body>
        <form id="form-mde">
          ${contributorsMarkup}
          <button type="submit">Submit test form</button>
        </form>
        <script>
          window.ELMO_FEATURES = { showContactInstitution: true };
          window.submitCount = 0;
          document.querySelector('form').addEventListener('submit', event => {
            event.preventDefault();
            window.submitCount++;
          });
        </script>
        <script src="node_modules/jquery/dist/jquery.min.js"></script>
        <script type="module" src="js/eventhandlers/formgroups/contributorStack.js"></script>
      </body></html>`,
  }));
  await page.goto(`${APP_BASE_URL}contact-website-harness`);
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
});

for (const type of ['person', 'institution']) {
  test(`${type} contact websites accept missing HTTP(S) and reject invalid addresses`, async ({ page }) => {
    await page.evaluate(contactType => {
      (window as any).contributorStack.setContributors([{
        type: contactType, familyname: 'Contact', givenname: 'Connie', institutionname: 'Institute',
        roles: ['Contact Person'], email: 'contact@example.org', website: 'www.whynot.com',
      }]);
    }, type);
    const website = page.locator('[name="cbContactWebsite[]"]');
    await expect(website).toBeVisible();
    await expect(website).toHaveValue('www.whynot.com');
    expect(await website.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true);

    const cases = [
      { value: '', valid: true },
      { value: 'www.whynot.com', valid: true },
      { value: 'example.org/profile', valid: true },
      { value: 'http://example.org/profile', valid: true },
      { value: 'https://example.org/profile?lang=en#contact', valid: true },
      { value: 'absolute-nonsense://https://git-scm.com/docs/git-submodule', valid: false },
      { value: 'javascript:alert(1)', valid: false },
      { value: 'not a website', valid: false },
    ];
    let submits = 0;
    for (const { value, valid } of cases) {
      await website.fill(value);
      expect(await website.evaluate((input: HTMLInputElement) => input.checkValidity()), value).toBe(valid);
      await page.getByRole('button', { name: 'Submit test form' }).click();
      if (valid) submits++;
      expect(await page.evaluate(() => (window as any).submitCount), value).toBe(submits);
      const payload = await page.evaluate(() => {
        const form = document.querySelector<HTMLFormElement>('#form-mde')!;
        return JSON.parse(String(new FormData(form).get('contributorsPayload')));
      });
      expect(payload[0].website).toBe(value);
    }
  });
}

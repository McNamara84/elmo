import { expect, test } from '@playwright/test';

const compatibilityAliases = [
  ['send_feedback_mail.php', 'endpoints/send_feedback_mail.php'],
  ['send_xml_file.php', 'endpoints/send_xml_file.php'],
  ['log_page_event.php', 'endpoints/log_page_event.php'],
  ['doc/privacyPolicy.html', 'doc/privacy-policy.html'],
] as const;

test.describe('Issue #357 legacy route compatibility', () => {
  for (const [legacyPath, canonicalPath] of compatibilityAliases) {
    test(`${legacyPath} behaves like ${canonicalPath} for a non-mutating request`, async ({ request }) => {
      const [legacyResponse, canonicalResponse] = await Promise.all([
        request.get(legacyPath),
        request.get(canonicalPath),
      ]);

      expect(legacyResponse.status()).toBe(canonicalResponse.status());
      expect(await legacyResponse.text()).toBe(await canonicalResponse.text());
      expect(legacyResponse.headers()['content-type']).toBe(canonicalResponse.headers()['content-type']);
    });
  }

  test('legacy API v1 route keeps returning a documented 410 response', async ({ request }) => {
    const response = await request.get('api.php');

    expect(response.status()).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('API v1'),
      documentation: 'api/v2/docs/index.html',
    });
  });

  test('CLI maintenance scripts are not exposed over HTTP', async ({ request }) => {
    for (const path of ['scripts/install.php', 'scripts/generate_xml_files.php']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });

  test('legacy and canonical favicon URLs return the same asset', async ({ request }) => {
    const [legacyResponse, canonicalResponse] = await Promise.all([
      request.get('favicon.ico'),
      request.get('assets/icons/favicon.ico'),
    ]);

    expect(legacyResponse.status()).toBe(200);
    expect(canonicalResponse.status()).toBe(200);
    expect(Buffer.compare(await legacyResponse.body(), await canonicalResponse.body())).toBe(0);
  });
});

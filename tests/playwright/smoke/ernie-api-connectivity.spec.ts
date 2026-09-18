import { test, expect } from '@playwright/test';

test.describe('ERNIE API Connectivity', () => {
  test('ERNIE API is alive (direct connectivity test)', async ({ page }) => {
    // This test confirms that ERNIE_URL is reachable directly from CI environment
    
    const ernieUrl = process.env.ERNIE_URL;
    if (!ernieUrl) {
      throw new Error('ERNIE_URL is not defined in the environment');
    }
    const ernieApiKey = process.env.ERNIE_API_KEY;
    if (!ernieApiKey) {
      throw new Error('ERNIE_API_KEY is not defined in the environment');
    }
    const docUrl = `${ernieUrl.replace(/\/$/, '')}/api/v1/doc`;
    console.log(`Testing ERNIE connectivity at: ${docUrl}`);

    const response = await page.request.get(docUrl, {
      headers: {
        'X-API-Key': process.env.ERNIE_API_KEY || ''
      }
    });

    // ERNIE should respond (200, 301, 404 all mean it's alive; 5xx or timeout = dead)
    expect(response.status()).toBeLessThan(500);
    console.log(`✅ ERNIE is alive (HTTP ${response.status()})`);
  });

  test('ELMO backend can fetch description types from ERNIE', async ({ page }) => {
    // This test confirms that:
    // 1. ELMO backend has ERNIE_URL and ERNIE_API_KEY configured
    // 2. ELMO can successfully call ERNIE API
    // 3. The response is valid
    
    const response = await page.request.get('/api/v2/vocabs/descriptiontypes');

    // Should return 200 OK
    expect(response.status()).toBe(200);

    // Response should be valid JSON
    const json = await response.json();
    expect(json).toBeDefined();
    expect(Array.isArray(json) || typeof json === 'object').toBe(true);

    console.log('✅ ELMO backend successfully fetched data from ERNIE');
  });

  test('ERNIE API returns expected description types structure', async ({ page }) => {
    const ernieUrl = process.env.ERNIE_URL;
    const response = await page.request.get(
      `${ernieUrl.replace(/\/$/, '')}/api/v1/description-types/elmo`,
      {
        headers: {
          'X-API-Key': process.env.ERNIE_API_KEY || ''
        }
      }
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    
    // Should be an array with items
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Each item should have expected fields
    if (data.length > 0) {
      const firstItem = data[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('name');
    }

    console.log(`✅ ERNIE returned ${data.length} description types`);
  });
});

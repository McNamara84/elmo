import { test, expect } from '@playwright/test';

test.describe('ERNIE API Connectivity', () => {
  test('ERNIE API is alive (direct connectivity test)', async ({ page }) => {
    // This test confirms that ERNIE_URL is reachable directly from CI environment
    
    const ernieUrl = process.env.ERNIE_URL;
    if (!ernieUrl) {
      test.skip();
      console.log('ℹ️  ERNIE_URL not set, skipping direct ERNIE test');
      return;
    }

    // Try to reach ERNIE's health/doc endpoint
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
    
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
    const response = await page.request.get(
      `${baseUrl}/api/v1/description-types/elmo`
    );

    // Should return 200 OK
    expect(response.status()).toBe(200);

    // Response should be valid JSON
    const json = await response.json();
    expect(json).toBeDefined();
    expect(Array.isArray(json) || typeof json === 'object').toBe(true);

    console.log('✅ ELMO backend successfully fetched data from ERNIE');
  });

  test('ERNIE API returns expected description types structure', async ({ page }) => {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
    const response = await page.request.get(
      `${baseUrl}/api/v1/description-types/elmo`
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

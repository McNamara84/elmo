import { test, expect } from '@playwright/test';
import { navigateToHome } from '../../utils';

const GCMD_PLATFORMS_ROUTE = '**/api/v2/vocabs/thesauri/gcmd-platforms';

/**
 * Mock GCMD Platforms vocabulary with the hierarchy expected by the datasource modal:
 * Space-based Platforms → Earth Observation Satellites → GRACE.
 * rootNodeId in thesauri.js filters to Space-based Platforms (b39a69b4…).
 */
const MOCK_GCMD_PLATFORMS = {
  data: [
    {
      id: 'platforms-root',
      text: 'Platforms',
      children: [
        {
          id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
          text: 'Space-based Platforms',
          children: [
            {
              id: 'https://gcmd.earthdata.nasa.gov/kms/concept/3466eed1-2fbb-49bf-ab0b-dc08731d502b',
              text: 'Earth Observation Satellites',
              children: [
                {
                  id: 'https://gcmd.earthdata.nasa.gov/kms/concept/2e7aa2e6-9d25-4c6e-aef3-6e86d3773bac',
                  text: 'GRACE',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test.describe('simplification of satellite modal interaction for ELMOGEM', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(GCMD_PLATFORMS_ROUTE, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GCMD_PLATFORMS),
      });
    });

    await navigateToHome(page);
    await expect(page.locator('#group-datasources')).toBeVisible();
  });

  test('opens datasource platforms modal with Space-based Platforms expanded but satellites collapsed', async ({ page }) => {
    await page.locator('#button-datasource-platforms').click();
    await expect(page.locator('#modal-platforms-datasource')).toBeVisible();

    const tree = page.locator('#jstree-platforms-datasource');
    await expect(tree.locator('.thesaurus-loading-spinner')).toHaveCount(0, { timeout: 10_000 });
    await expect(tree.locator('.jstree-container-ul')).toBeVisible({ timeout: 10_000 });

    const spaceBasedNode = tree.locator(
      '[id="https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847"]',
    );
    await expect(spaceBasedNode).toBeVisible();
    await expect(spaceBasedNode).toHaveClass(/jstree-open/);

    const satellitesNode = tree.locator(
      '[id="https://gcmd.earthdata.nasa.gov/kms/concept/3466eed1-2fbb-49bf-ab0b-dc08731d502b"]',
    );
    await expect(satellitesNode).toBeVisible();
    await expect(satellitesNode).toHaveClass(/jstree-closed/);

    const graceNode = tree.locator(
      '[id="https://gcmd.earthdata.nasa.gov/kms/concept/2e7aa2e6-9d25-4c6e-aef3-6e86d3773bac"]',
    );
    await expect(graceNode).toHaveCount(0);
  });

  test('expands a broader platform term on row click and selects the satellite below it', async ({ page }) => {
    await page.locator('#button-datasource-platforms').click();
    await expect(page.locator('#modal-platforms-datasource')).toBeVisible();

    const tree = page.locator('#jstree-platforms-datasource');
    await expect(tree.locator('.jstree-container-ul')).toBeVisible({ timeout: 10_000 });

    const satellitesNode = tree.locator(
      '[id="https://gcmd.earthdata.nasa.gov/kms/concept/3466eed1-2fbb-49bf-ab0b-dc08731d502b"]',
    );
    await expect(satellitesNode).toHaveClass(/jstree-closed/);

    // Clicking the row itself browses into the broader term rather than selecting it.
    await satellitesNode.locator('> .jstree-anchor').click();
    await expect(satellitesNode).toHaveClass(/jstree-open/);
    await expect(satellitesNode.locator('> .jstree-anchor')).not.toHaveClass(/jstree-clicked/);

    const graceAnchor = tree
      .locator('[id="https://gcmd.earthdata.nasa.gov/kms/concept/2e7aa2e6-9d25-4c6e-aef3-6e86d3773bac"]')
      .locator('> .jstree-anchor');
    await expect(graceAnchor).toBeVisible();

    await graceAnchor.click();
    await expect(graceAnchor).toHaveClass(/jstree-clicked/);

    const selectedKeywords = page.locator('#selected-keywords-platforms-ds li');
    await expect(selectedKeywords).toHaveCount(1);
    await expect(selectedKeywords.first()).toContainText('GRACE');
  });

  test('satellite platform input is js-required-on-submit and becomes required on Submit', async ({ page }) => {
    const platformInput = page.locator('#input-datasource-platforms');
    const tagifyWrapper = page.locator('.visibility-datasources-satellite .tagify');
    const invalidFeedback = page.locator('.visibility-datasources-satellite .invalid-feedback');

    await expect(platformInput).toHaveClass(/form-control/);
    await expect(platformInput).toHaveClass(/js-required-on-submit/);
    await expect(platformInput).not.toHaveAttribute('required');

    await page.locator('#button-form-submit').click();

    await expect(platformInput).toHaveAttribute('required', 'required');
    await expect(tagifyWrapper).toHaveClass(/is-invalid/);
    await expect(invalidFeedback).toBeVisible();
    await expect(invalidFeedback).toContainText('Provide the name of the Satellite here');
  });
});

import { test, expect, type Locator, type Page } from '@playwright/test';
import { navigateToHome } from '../../utils';

const GCMD_PLATFORMS_ROUTE = '**/api/v2/vocabs/thesauri/gcmd-platforms';

const NODE = {
  spaceBased: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
  satellites: 'https://gcmd.earthdata.nasa.gov/kms/concept/3466eed1-2fbb-49bf-ab0b-dc08731d502b',
  grace: 'https://gcmd.earthdata.nasa.gov/kms/concept/2e7aa2e6-9d25-4c6e-aef3-6e86d3773bac',
} as const;

const PATH = {
  spaceBased: 'Platforms > Space-based Platforms',
  satellites: 'Platforms > Space-based Platforms > Earth Observation Satellites',
  grace: 'Platforms > Space-based Platforms > Earth Observation Satellites > GRACE',
} as const;

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
          id: NODE.spaceBased,
          text: 'Space-based Platforms',
          children: [
            {
              id: NODE.satellites,
              text: 'Earth Observation Satellites',
              children: [
                {
                  id: NODE.grace,
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

function treeNode(tree: Locator, nodeId: string) {
  return tree.locator(`[id="${nodeId}"]`);
}

async function openDatasourcePlatformsModal(page: Page) {
  await page.locator('#button-datasource-platforms').click();
  await expect(page.locator('#modal-platforms-datasource')).toBeVisible();

  const tree = page.locator('#jstree-platforms-datasource');
  await expect(tree.locator('.thesaurus-loading-spinner')).toHaveCount(0, { timeout: 10_000 });
  await expect(tree.locator('.jstree-container-ul')).toBeVisible({ timeout: 10_000 });
  return tree;
}

async function getTagifyValues(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector('#input-datasource-platforms') as HTMLInputElement & {
      _tagify?: { value: Array<{ value: string }> };
    };
    return (input?._tagify?.value ?? []).map(tag => tag.value);
  });
}

function tagifyTags(page: Page) {
  return page.locator('#input-datasource-platforms').locator('..').locator('.tagify__tag');
}

function selectedKeywords(page: Page) {
  return page.locator('#selected-keywords-platforms-ds li');
}

/** Clicks the row label (anchor), not the checkbox, so broader terms browse instead of select. */
async function clickTreeRowLabel(node: Locator) {
  await node.locator('> .jstree-anchor').click();
}

function expectSelectedKeyword(page: Page, path: string, index = 0) {
  return expect(selectedKeywords(page).nth(index)).toContainText(path);
}

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
    await page.waitForFunction(
      () => Boolean((document.querySelector('#input-datasource-platforms') as any)?._tagify),
      { timeout: 10_000 },
    );
  });

  test('opens datasource platforms modal with Space-based Platforms expanded but satellites collapsed', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);

    const spaceBasedNode = treeNode(tree, NODE.spaceBased);
    await expect(spaceBasedNode).toBeVisible();
    await expect(spaceBasedNode).toHaveClass(/jstree-open/);

    const satellitesNode = treeNode(tree, NODE.satellites);
    await expect(satellitesNode).toBeVisible();
    await expect(satellitesNode).toHaveClass(/jstree-closed/);

    await expect(treeNode(tree, NODE.grace)).toHaveCount(0);
  });

  test('row label click on a broader term browses without selecting it', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);
    const satellitesNode = treeNode(tree, NODE.satellites);

    await expect(satellitesNode).toHaveClass(/jstree-closed/);
    await clickTreeRowLabel(satellitesNode);

    await expect(satellitesNode).toHaveClass(/jstree-open/);
    await expect(satellitesNode.locator('> .jstree-anchor')).not.toHaveClass(/jstree-clicked/);
    await expect(selectedKeywords(page)).toHaveCount(0);
    await expect(tagifyTags(page)).toHaveCount(0);

    await clickTreeRowLabel(satellitesNode);
    await expect(satellitesNode).toHaveClass(/jstree-closed/);
    await expect(selectedKeywords(page)).toHaveCount(0);
  });

  test('checkbox click selects a broader term and syncs sidebar and Tagify', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);
    const satellitesNode = treeNode(tree, NODE.satellites);

    await satellitesNode.locator('.jstree-checkbox').click();

    await expect(satellitesNode.locator('> .jstree-anchor')).toHaveClass(/jstree-clicked/);
    await expect(selectedKeywords(page)).toHaveCount(1);
    await expectSelectedKeyword(page, PATH.satellites);

    await expect(tagifyTags(page)).toHaveCount(1);
    await expect(tagifyTags(page).first()).toContainText('Earth Observation Satellites');
    await expect(await getTagifyValues(page)).toEqual([PATH.satellites]);
  });

  test('browse via row click then select leaf keeps tree, sidebar, and Tagify in sync', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);
    const satellitesNode = treeNode(tree, NODE.satellites);

    await clickTreeRowLabel(satellitesNode);
    await expect(satellitesNode).toHaveClass(/jstree-open/);

    const graceAnchor = treeNode(tree, NODE.grace).locator('> .jstree-anchor');
    await expect(graceAnchor).toBeVisible();
    await graceAnchor.click();

    await expect(graceAnchor).toHaveClass(/jstree-clicked/);
    await expect(selectedKeywords(page)).toHaveCount(1);
    await expectSelectedKeyword(page, PATH.grace);
    await expect(tagifyTags(page)).toHaveCount(1);
    await expect(tagifyTags(page).first()).toContainText('GRACE');
    await expect(await getTagifyValues(page)).toEqual([PATH.grace]);
  });

  test('selecting a broader term via checkbox still allows browsing into narrower terms', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);
    const satellitesNode = treeNode(tree, NODE.satellites);

    await satellitesNode.locator('.jstree-checkbox').click();
    await expectSelectedKeyword(page, PATH.satellites);

    await clickTreeRowLabel(satellitesNode);
    await expect(satellitesNode).toHaveClass(/jstree-open/);

    const graceAnchor = treeNode(tree, NODE.grace).locator('> .jstree-anchor');
    await graceAnchor.click();

    await expect(selectedKeywords(page)).toHaveCount(2);
    await expectSelectedKeyword(page, PATH.satellites);
    await expectSelectedKeyword(page, PATH.grace, 1);
    await expect(tagifyTags(page)).toHaveCount(2);

    const tagifyValues = await getTagifyValues(page);
    expect(tagifyValues).toHaveLength(2);
    expect(tagifyValues).toContain(PATH.satellites);
    expect(tagifyValues).toContain(PATH.grace);

    await expect(satellitesNode.locator('> .jstree-anchor')).toHaveClass(/jstree-clicked/);
    await expect(graceAnchor).toHaveClass(/jstree-clicked/);
  });

  test('removing a keyword from the sidebar clears Tagify and tree selection', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);

    await clickTreeRowLabel(treeNode(tree, NODE.satellites));
    await treeNode(tree, NODE.grace).locator('> .jstree-anchor').click();
    await expect(selectedKeywords(page)).toHaveCount(1);

    await selectedKeywords(page).first().locator('button').click();

    await expect(selectedKeywords(page)).toHaveCount(0);
    await expect(tagifyTags(page)).toHaveCount(0);
    await expect(await getTagifyValues(page)).toEqual([]);
    await expect(tree.locator('.jstree-clicked')).toHaveCount(0);
  });

  test('closing the modal keeps Tagify values and reopening restores tree selection', async ({ page }) => {
    const tree = await openDatasourcePlatformsModal(page);

    await clickTreeRowLabel(treeNode(tree, NODE.satellites));
    await treeNode(tree, NODE.grace).locator('> .jstree-anchor').click();
    await expect(await getTagifyValues(page)).toEqual([PATH.grace]);

    await page.locator('#modal-platforms-datasource .modal-footer button.btn-primary').click();
    await expect(page.locator('#modal-platforms-datasource')).toBeHidden();
    await expect(tagifyTags(page)).toHaveCount(1);
    await expect(tagifyTags(page).first()).toContainText('GRACE');

    const reopenedTree = await openDatasourcePlatformsModal(page);
    await expect(treeNode(reopenedTree, NODE.grace).locator('> .jstree-anchor')).toHaveClass(/jstree-clicked/);
    await expect(selectedKeywords(page)).toHaveCount(1);
    await expectSelectedKeyword(page, PATH.grace);
    await expect(await getTagifyValues(page)).toEqual([PATH.grace]);
  });
});

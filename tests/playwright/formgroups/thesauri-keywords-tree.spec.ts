import { test, expect, type Locator, type Page } from '@playwright/test';
import { navigateToHome } from '../utils';

const GCMD_PLATFORMS_ROUTE = '**/api/v2/vocabs/thesauri/gcmd-platforms';

const PLATFORM_NODE = {
  root: 'pl-1',
  airBased: 'pl-2',
  balloons: 'pl-3',
} as const;

const PLATFORM_PATH = {
  airBased: 'Platforms > Air-based Platforms',
  balloons: 'Platforms > Air-based Platforms > BALLOONS',
} as const;

const MOCK_AVAILABILITY = {
  science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
  platforms: { available: true, displayName: 'GCMD Platforms' },
  instruments: { available: true, displayName: 'GCMD Instruments' },
  chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: false, displayName: 'GEMET' },
};

const MOCK_PLATFORMS = {
  data: [
    {
      id: PLATFORM_NODE.root,
      text: 'Platforms',
      scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
      language: 'en',
      children: [
        {
          id: PLATFORM_NODE.airBased,
          text: 'Air-based Platforms',
          scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
          language: 'en',
          children: [
            {
              id: PLATFORM_NODE.balloons,
              text: 'BALLOONS',
              scheme: 'GCMD',
              schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms',
              language: 'en',
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

async function waitForPlatformsThesaurus(page: Page) {
  await expect(page.locator('#thesaurusKeywordsFormGroup')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#button-platforms-open')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(
    () => Boolean((document.querySelector('#input-platforms') as any)?._tagify),
    { timeout: 15_000 },
  );
}

async function scrollToPlatformsThesaurus(page: Page) {
  const platformsSection = page.locator('.thesaurus-input-item').filter({ hasText: 'GCMD Platforms' });
  await platformsSection.scrollIntoViewIfNeeded();
  await expect(platformsSection).toBeVisible();
}

async function openPlatformsThesaurusModal(page: Page) {
  await page.locator('#button-platforms-open').click();
  await expect(page.locator('#modal-platforms')).toBeVisible();

  const tree = page.locator('#jstree-platforms');
  await expect(tree.locator('.thesaurus-loading-spinner')).toHaveCount(0, { timeout: 10_000 });
  await expect(tree.locator('.jstree-container-ul')).toBeVisible({ timeout: 10_000 });
  return tree;
}

async function expandPlatformsRoot(tree: Locator) {
  const rootNode = treeNode(tree, PLATFORM_NODE.root);
  if (await treeNode(tree, PLATFORM_NODE.airBased).isVisible()) {
    return;
  }
  await rootNode.locator('> .jstree-anchor').click();
  await expect(treeNode(tree, PLATFORM_NODE.airBased)).toBeVisible();
}

async function clickTreeRowLabel(node: Locator) {
  await node.locator('> .jstree-anchor').click();
}

async function getPlatformsTagifyValues(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector('#input-platforms') as HTMLInputElement & {
      _tagify?: { value: Array<{ value: string }> };
    };
    return (input?._tagify?.value ?? []).map(tag => tag.value);
  });
}

function platformsTagifyTags(page: Page) {
  return page.locator('#input-platforms').locator('..').locator('.tagify__tag');
}

function platformsSelectedKeywords(page: Page) {
  return page.locator('#selected-keywords-platforms li');
}

function expectPlatformsSelectedKeyword(page: Page, path: string, index = 0) {
  return expect(platformsSelectedKeywords(page).nth(index)).toContainText(path);
}

test.describe('Thesauri Keywords tree browse, checkbox, and Tagify sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/vocabs/thesauri/availability', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_AVAILABILITY),
      });
    });
    await page.route(GCMD_PLATFORMS_ROUTE, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PLATFORMS),
      });
    });

    await navigateToHome(page);
    await waitForPlatformsThesaurus(page);
    await scrollToPlatformsThesaurus(page);
  });

  test('row label click on a broader term browses without selecting it', async ({ page }) => {
    const tree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(tree);

    const airBasedNode = treeNode(tree, PLATFORM_NODE.airBased);
    await expect(airBasedNode).toHaveClass(/jstree-closed/);

    await clickTreeRowLabel(airBasedNode);
    await expect(airBasedNode).toHaveClass(/jstree-open/);
    await expect(treeNode(tree, PLATFORM_NODE.balloons)).toBeVisible();
    await expect(airBasedNode.locator('> .jstree-anchor')).not.toHaveClass(/jstree-clicked/);
    await expect(platformsSelectedKeywords(page)).toHaveCount(0);
    await expect(platformsTagifyTags(page)).toHaveCount(0);

    await clickTreeRowLabel(airBasedNode);
    await expect(airBasedNode).toHaveClass(/jstree-closed/);
  });

  test('checkbox click selects a broader term and syncs sidebar and Tagify', async ({ page }) => {
    const tree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(tree);

    const airBasedNode = treeNode(tree, PLATFORM_NODE.airBased);
    await airBasedNode.locator('.jstree-checkbox').click();

    await expect(airBasedNode.locator('> .jstree-anchor')).toHaveClass(/jstree-clicked/);
    await expect(platformsSelectedKeywords(page)).toHaveCount(1);
    await expectPlatformsSelectedKeyword(page, PLATFORM_PATH.airBased);
    await expect(platformsTagifyTags(page)).toHaveCount(1);
    await expect(platformsTagifyTags(page).first()).toContainText('Air-based Platforms');
    await expect(await getPlatformsTagifyValues(page)).toEqual([PLATFORM_PATH.airBased]);
  });

  test('browse via row click then select leaf keeps tree, sidebar, and Tagify in sync', async ({ page }) => {
    const tree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(tree);

    const airBasedNode = treeNode(tree, PLATFORM_NODE.airBased);
    await clickTreeRowLabel(airBasedNode);
    await expect(airBasedNode).toHaveClass(/jstree-open/);

    const balloonsAnchor = treeNode(tree, PLATFORM_NODE.balloons).locator('> .jstree-anchor');
    await expect(balloonsAnchor).toBeVisible();
    await balloonsAnchor.click();

    await expect(balloonsAnchor).toHaveClass(/jstree-clicked/);
    await expect(platformsSelectedKeywords(page)).toHaveCount(1);
    await expectPlatformsSelectedKeyword(page, PLATFORM_PATH.balloons);
    await expect(platformsTagifyTags(page)).toHaveCount(1);
    await expect(platformsTagifyTags(page).first()).toContainText('BALLOONS');
    await expect(await getPlatformsTagifyValues(page)).toEqual([PLATFORM_PATH.balloons]);
  });

  test('selecting a broader term via checkbox still allows browsing into narrower terms', async ({ page }) => {
    const tree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(tree);

    const airBasedNode = treeNode(tree, PLATFORM_NODE.airBased);
    await airBasedNode.locator('.jstree-checkbox').click();
    await expectPlatformsSelectedKeyword(page, PLATFORM_PATH.airBased);

    await clickTreeRowLabel(airBasedNode);
    await expect(airBasedNode).toHaveClass(/jstree-open/);

    const balloonsAnchor = treeNode(tree, PLATFORM_NODE.balloons).locator('> .jstree-anchor');
    await balloonsAnchor.click();

    await expect(platformsSelectedKeywords(page)).toHaveCount(2);
    await expectPlatformsSelectedKeyword(page, PLATFORM_PATH.airBased);
    await expectPlatformsSelectedKeyword(page, PLATFORM_PATH.balloons, 1);
    await expect(platformsTagifyTags(page)).toHaveCount(2);

    const tagifyValues = await getPlatformsTagifyValues(page);
    expect(tagifyValues).toHaveLength(2);
    expect(tagifyValues).toContain(PLATFORM_PATH.airBased);
    expect(tagifyValues).toContain(PLATFORM_PATH.balloons);
  });

  test('removing a keyword from the sidebar clears Tagify and tree selection', async ({ page }) => {
    const tree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(tree);

    await clickTreeRowLabel(treeNode(tree, PLATFORM_NODE.airBased));
    await treeNode(tree, PLATFORM_NODE.balloons).locator('> .jstree-anchor').click();
    await expect(platformsSelectedKeywords(page)).toHaveCount(1);

    await platformsSelectedKeywords(page).first().locator('button').click();

    await expect(platformsSelectedKeywords(page)).toHaveCount(0);
    await expect(platformsTagifyTags(page)).toHaveCount(0);
    await expect(await getPlatformsTagifyValues(page)).toEqual([]);
    await expect(tree.locator('.jstree-clicked')).toHaveCount(0);
  });

  test('closing the modal keeps Tagify values and reopening restores tree selection', async ({ page }) => {
    const tree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(tree);

    await clickTreeRowLabel(treeNode(tree, PLATFORM_NODE.airBased));
    await treeNode(tree, PLATFORM_NODE.balloons).locator('> .jstree-anchor').click();
    await expect(await getPlatformsTagifyValues(page)).toEqual([PLATFORM_PATH.balloons]);

    await page.locator('#modal-platforms .modal-footer button.btn-primary').click();
    await expect(page.locator('#modal-platforms')).toBeHidden();
    await expect(platformsTagifyTags(page)).toHaveCount(1);
    await expect(platformsTagifyTags(page).first()).toContainText('BALLOONS');

    const reopenedTree = await openPlatformsThesaurusModal(page);
    await expandPlatformsRoot(reopenedTree);
    await expect(treeNode(reopenedTree, PLATFORM_NODE.balloons).locator('> .jstree-anchor')).toHaveClass(/jstree-clicked/);
    await expect(platformsSelectedKeywords(page)).toHaveCount(1);
    await expectPlatformsSelectedKeyword(page, PLATFORM_PATH.balloons);
    await expect(await getPlatformsTagifyValues(page)).toEqual([PLATFORM_PATH.balloons]);
  });
});

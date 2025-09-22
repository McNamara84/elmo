import { test, expect } from '@playwright/test';
import { disableHelp, enableHelp, expectNavbarVisible, navigateToHome } from '../utils';

test.describe('Resource Information Form Tests', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);

    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('Test Resource Information card visibility and structure', async ({ page }) => {
    const resourceInfoCard = page.locator('.card').first();
    await expect(resourceInfoCard).toBeVisible();

    const cardHeader = resourceInfoCard.locator('.card-header');
    await expect(cardHeader).toBeVisible();
    await expect(cardHeader.locator('b[data-translate="resourceInfo.title"]')).toBeVisible();
    await expect(cardHeader.locator('i.bi-question-circle-fill')).toBeVisible();

    await expect(resourceInfoCard.locator('.card-body')).toBeVisible();
  });

  test('Test all input fields functionality', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await expect(doiInput).toBeVisible();
    await doiInput.fill('10.1234/example.doi');
    await expect(doiInput).toHaveValue('10.1234/example.doi');
    await doiInput.clear();

    const yearInput = page.locator('#input-resourceinformation-publicationyear');
    await expect(yearInput).toBeVisible();
    await expect(yearInput).toHaveAttribute('required');
    await yearInput.fill('2024');
    await expect(yearInput).toHaveValue('2024');

    const versionInput = page.locator('#input-resourceinformation-version');
    await expect(versionInput).toBeVisible();
    await versionInput.fill('1.0');
    await expect(versionInput).toHaveValue('1.0');
    await versionInput.clear();

    const titleInput = page.locator('#input-resourceinformation-title');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveAttribute('required');
    await titleInput.fill('Test Dataset Title');
    await expect(titleInput).toHaveValue('Test Dataset Title');
  });

  test('Test dropdown fields functionality', async ({ page }) => {
    const resourceTypeSelect = page.locator('#input-resourceinformation-resourcetype');
    await expect(resourceTypeSelect).toBeVisible();
    await expect(resourceTypeSelect).toHaveAttribute('required');
    await resourceTypeSelect.selectOption('5');
    await expect(resourceTypeSelect).toHaveValue('5');

    const resourceTypeOptions = resourceTypeSelect.locator('option');
    const optionCount = await resourceTypeOptions.count();
    expect(optionCount).toBeGreaterThan(5);

    const languageSelect = page.locator('#input-resourceinformation-language');
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect).toHaveAttribute('required');
    await languageSelect.selectOption('1');
    await expect(languageSelect).toHaveValue('1');

    const languageOptions = languageSelect.locator('option');
    const languageCount = await languageOptions.count();
    expect(languageCount).toBeGreaterThanOrEqual(3);

    await expect(languageSelect.locator('option[value="1"]').first()).toHaveText('English');
    await expect(languageSelect.locator('option[value="2"]').first()).toHaveText('German');
    await expect(languageSelect.locator('option[value="3"]').first()).toHaveText('French');
  });

  test('Test add title button functionality', async ({ page }) => {
    const titleTypeContainers = page.locator('#container-resourceinformation-titletype');
    await expect(titleTypeContainers.first()).toHaveClass(/unvisible/);

    const addTitleButton = page.locator('#button-resourceinformation-addtitle');
    await expect(addTitleButton).toBeVisible();
    await addTitleButton.click();

    await page.waitForTimeout(500);

    const secondContainer = titleTypeContainers.nth(1);
    await expect(secondContainer).toBeVisible();

    const titleTypeSelect = page.locator('#input-resourceinformation-titletype').nth(1);
    await expect(titleTypeSelect).toBeVisible();
  });

  test('Test title type dropdown options', async ({ page }) => {
    await page.locator('#button-resourceinformation-addtitle').click();
    await page.waitForTimeout(500);

    const titleTypeSelect = page.locator('#input-resourceinformation-titletype').nth(1);
    const titleTypeOptions = titleTypeSelect.locator('option');
    const titleOptionCount = await titleTypeOptions.count();
    expect(titleOptionCount).toBeGreaterThanOrEqual(2);

    await expect(titleTypeSelect.locator('option[value="2"]').first()).toHaveText('Alternative Title');
    await expect(titleTypeSelect.locator('option[value="3"]').first()).toHaveText('Translated Title');

    await titleTypeSelect.selectOption('2');
    await expect(titleTypeSelect).toHaveValue('2');

    await titleTypeSelect.selectOption('3');
    await expect(titleTypeSelect).toHaveValue('3');
  });

  test('Test help icons visibility toggle', async ({ page }) => {
    const helpIcons = page.locator('.card').first().locator('i.bi-question-circle-fill');
    const iconCount = await helpIcons.count();
    expect(iconCount).toBeGreaterThan(0);

    await expect(page.locator('[data-help-section-id="help-resourceinformation-doi"]')).toBeVisible();
    await expect(page.locator('[data-help-section-id="help-resourceinformation-publicationyear"]')).toBeVisible();
    await expect(page.locator('[data-help-section-id="help-resourceinformation-resourcetype"]')).toBeVisible();

    await disableHelp(page);
    await page.waitForTimeout(1500);
    await enableHelp(page);

    await expect(helpIcons.first()).toBeVisible();
  });
});
import { test, expect } from "@playwright/test";

test.describe("Licenses and Rights", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("");
    await expect(page.locator(".navbar")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#input-rights-license")).toBeVisible();
  });

  test("License dropdown filters for software", async ({ page }) => {
    const licenseSelect = page.locator("#input-rights-license");

    // Wait for licenses to load
    await page.waitForFunction(() => document.querySelectorAll('#input-rights-license option').length > 0);
    const allOptions = licenseSelect.locator("option");
    const allCount = await allOptions.count();
    expect(allCount).toBeGreaterThan(4);

    // Switch resource type to Software
    const resourceType = page.locator("#input-resourceinformation-resourcetype");
    await resourceType.selectOption("12");
    // Wait for the dropdown to update
    await page.waitForFunction(() => document.querySelectorAll('#input-rights-license option').length === 4);

    const softwareOptions = licenseSelect.locator("option");
    await expect(softwareOptions).toHaveCount(4);

    const texts = await softwareOptions.allTextContents();
    expect(texts.join(" ")).toContain("MIT License");
    expect(texts.join(" ")).toContain("Apache License 2.0");
    expect(texts.join(" ")).not.toContain("Creative Commons Attribution 4.0");

    // Switch back to Dataset
    await resourceType.selectOption("5");
    await page.waitForFunction(() => document.querySelectorAll('#input-rights-license option').length > 4);
    await expect(licenseSelect.locator('option')).toHaveCount(allCount);
  });

  test("Help button displays rights help", async ({ page }) => {
    // Ensure help is on
    await page.locator('#bd-help').click();
    await page.locator('#buttonHelpOn').click();
    await page.waitForTimeout(500);

    // Open help for rights section
    await page.locator('[data-help-section-id="help-rights"]').click();
    const modal = page.locator('#helpModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-body')).toContainText('Licenses and Rights');
  });
});
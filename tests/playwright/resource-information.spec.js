import { test, expect } from "@playwright/test";

test.describe("Resource Information Form Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("");
    await expect(page.locator(".navbar")).toBeVisible({ timeout: 10000 });

    // Wait for the Resource Information card to be visible
    await expect(page.locator(".card").first()).toBeVisible();
  });

  test("Test Resource Information card visibility and structure", async ({ page }) => {
    // Check if Resource Information card is visible
    const resourceInfoCard = page.locator(".card").first();
    await expect(resourceInfoCard).toBeVisible();

    // Check card header
    const cardHeader = resourceInfoCard.locator(".card-header");
    await expect(cardHeader).toBeVisible();
    await expect(cardHeader.locator('b[data-translate="resourceInfo.title"]')).toBeVisible();

    // Check main help icon in header
    await expect(cardHeader.locator("i.bi-question-circle-fill")).toBeVisible();

    // Check card body
    await expect(resourceInfoCard.locator(".card-body")).toBeVisible();
  });

  test("Test all input fields functionality", async ({ page }) => {
    // Test DOI input field
    const doiInput = page.locator("#input-resourceinformation-doi");
    await expect(doiInput).toBeVisible();
    await doiInput.fill("10.1234/example.doi");
    await expect(doiInput).toHaveValue("10.1234/example.doi");
    await doiInput.clear();

    // Test Publication Year input field (required)
    const yearInput = page.locator("#input-resourceinformation-publicationyear");
    await expect(yearInput).toBeVisible();
    await expect(yearInput).toHaveAttribute("required");
    await yearInput.fill("2024");
    await expect(yearInput).toHaveValue("2024");

    // Test Version input field
    const versionInput = page.locator("#input-resourceinformation-version");
    await expect(versionInput).toBeVisible();
    await versionInput.fill("1.0");
    await expect(versionInput).toHaveValue("1.0");
    await versionInput.clear();

    // Test Title input field (required)
    const titleInput = page.locator("#input-resourceinformation-title");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveAttribute("required");
    await titleInput.fill("Test Dataset Title");
    await expect(titleInput).toHaveValue("Test Dataset Title");
  });
});

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
});

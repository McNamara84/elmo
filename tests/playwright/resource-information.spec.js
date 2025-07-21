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

  test("Test dropdown fields functionality", async ({ page }) => {
    // Test Resource Type dropdown (required)
    const resourceTypeSelect = page.locator("#input-resourceinformation-resourcetype");
    await expect(resourceTypeSelect).toBeVisible();
    await expect(resourceTypeSelect).toHaveAttribute("required");

    // Click to open dropdown and select an option
    await resourceTypeSelect.click();
    await resourceTypeSelect.selectOption("5"); // Dataset
    await expect(resourceTypeSelect).toHaveValue("5");

    // Verify multiple options are available
    const resourceTypeOptions = resourceTypeSelect.locator("option");
    const optionCount = await resourceTypeOptions.count();
    expect(optionCount).toBeGreaterThan(5); // Should have many resource type options

    // Test Language dropdown (required)
    const languageSelect = page.locator("#input-resourceinformation-language");
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect).toHaveAttribute("required");

    // Verify English option is available and can be selected
    await languageSelect.selectOption("1"); // English
    await expect(languageSelect).toHaveValue("1");

    // Verify multiple language options exist
    const languageOptions = languageSelect.locator("option");
    const langCount = await languageOptions.count();
    expect(langCount).toBeGreaterThanOrEqual(3); // English, German, French

    // Verify specific language options
    await expect(languageSelect.locator('option[value="1"]')).toHaveText("English");
    await expect(languageSelect.locator('option[value="2"]')).toHaveText("German");
    await expect(languageSelect.locator('option[value="3"]')).toHaveText("French");
  });

  test("Test add title button functionality", async ({ page }) => {
    // Initially, Title Type container should be hidden
    const titleTypeContainer = page.locator("#container-resourceinformation-titletype");
    await expect(titleTypeContainer).toHaveClass(/unvisible/);

    // Click the add title button
    const addTitleButton = page.locator("#button-resourceinformation-addtitle");
    await expect(addTitleButton).toBeVisible();
    await addTitleButton.click();

    // Wait a moment for potential JavaScript execution
    await page.waitForTimeout(500);

    // After clicking, Title Type container should become visible
    // Note: The actual behavior depends on your JavaScript implementation
    // This test assumes the JavaScript removes the 'unvisible' class
    // You may need to adjust this based on your actual implementation

    // Check if Title Type dropdown becomes available
    const titleTypeSelect = page.locator("#input-resourceinformation-titletype");
    await expect(titleTypeSelect).toBeVisible();
  });
});

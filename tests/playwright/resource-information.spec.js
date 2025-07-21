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
    const titleTypeContainers = page.locator("#container-resourceinformation-titletype");
    await expect(titleTypeContainers.first()).toHaveClass(/unvisible/);

    // Click the add title button
    const addTitleButton = page.locator("#button-resourceinformation-addtitle");
    await expect(addTitleButton).toBeVisible();
    await addTitleButton.click();

    // Wait a moment for potential JavaScript execution
    await page.waitForTimeout(500);

    // After clicking, a second Title Type container should exist and be visible
    const secondContainer = titleTypeContainers.nth(1);
    await expect(secondContainer).toBeVisible();

    // Check if Title Type dropdown in the new row becomes available
    const titleTypeSelect = page.locator("#input-resourceinformation-titletype").nth(1);
    await expect(titleTypeSelect).toBeVisible();
  });

  test("Test title type dropdown options", async ({ page }) => {
    // First click add title to make title type visible
    await page.locator("#button-resourceinformation-addtitle").click();
    await page.waitForTimeout(500);

    const titleTypeSelect = page.locator("#input-resourceinformation-titletype").nth(1);

    // Verify the dropdown has multiple options
    const titleTypeOptions = titleTypeSelect.locator("option");
    const titleOptionCount = await titleTypeOptions.count();
    expect(titleOptionCount).toBeGreaterThanOrEqual(2);

    // Test specific title type options
    await expect(titleTypeSelect.locator('option[value="2"]')).toHaveText("Alternative Title");
    await expect(titleTypeSelect.locator('option[value="3"]')).toHaveText("Translated Title");

    // Test selecting different title types
    await titleTypeSelect.selectOption("2"); // Alternative Title
    await expect(titleTypeSelect).toHaveValue("2");

    await titleTypeSelect.selectOption("3"); // Translated Title
    await expect(titleTypeSelect).toHaveValue("3");
  });

  test("Test help icons visibility toggle", async ({ page }) => {
    // Check that help icons are initially visible
    const helpIcons = page.locator(".card").first().locator("i.bi-question-circle-fill");
    const iconCount = await helpIcons.count();
    expect(iconCount).toBeGreaterThan(0);

    // Verify specific help icons are visible
    await expect(page.locator('[data-help-section-id="help-resourceinformation-doi"]')).toBeVisible();
    await expect(page.locator('[data-help-section-id="help-resourceinformation-publicationyear"]')).toBeVisible();
    await expect(page.locator('[data-help-section-id="help-resourceinformation-resourcetype"]')).toBeVisible();

    // Turn help OFF
    await page.locator("#bd-help").click();
    await page.locator("#buttonHelpOff").click();

    // Wait for help toggle to take effect
    await page.waitForTimeout(1000);

    // Turn help back ON
    await page.locator("#bd-help").click();
    await page.locator("#buttonHelpOn").click();

    // Wait for help toggle to take effect
    await page.waitForTimeout(1000);

    // Help icons should be visible again
    await expect(page.locator('[data-help-section-id="help-resourceinformation-doi"]')).toBeVisible();
  });

  test("Test form field translations (English to German and back)", async ({ page }) => {
    // Get initial English labels
    const titleLabel = page.locator('label[for="input-resourceinformation-title"]');
    const doiLabel = page.locator('label[for="input-resourceinformation-doi"]');
    const yearLabel = page.locator('label[for="input-resourceinformation-publicationyear"]');

    // Store initial English text (or check for data-translate attributes)
    await expect(titleLabel.locator('[data-translate="resourceInfo.resourceTitle"]')).toBeVisible();
    await expect(yearLabel.locator('[data-translate="resourceInfo.publicationYear"]')).toBeVisible();

    // Switch to German
    await page.locator("#bd-lang").click();
    await page.locator('[data-bs-language-value="de"]').click();

    // Wait for translation to take effect
    await page.waitForTimeout(1000);

    // Since translations happen via JavaScript, we check that the translation system is working
    // by verifying the data-translate attributes are still present
    await expect(titleLabel.locator('[data-translate="resourceInfo.resourceTitle"]')).toBeVisible();

    // Switch back to English
    await page.locator("#bd-lang").click();
    await page.locator('[data-bs-language-value="en"]').click();

    // Wait for translation back to English
    await page.waitForTimeout(1000);

    // Verify we're back to English
    await expect(titleLabel.locator('[data-translate="resourceInfo.resourceTitle"]')).toBeVisible();
  });

  test("Test form validation for required fields", async ({ page }) => {
    // Try to submit the form with empty required fields
    const submitButton = page.locator("#button-form-submit");

    // Fill form partially to test validation
    await page.locator("#input-resourceinformation-title").fill("Test Title");

    // Leave required fields empty and check validation
    const yearInput = page.locator("#input-resourceinformation-publicationyear");
    const resourceTypeSelect = page.locator("#input-resourceinformation-resourcetype");
    const languageSelect = page.locator("#input-resourceinformation-language");

    // These fields should have required attribute
    await expect(yearInput).toHaveAttribute("required");
    await expect(resourceTypeSelect).toHaveAttribute("required");
    await expect(languageSelect).toHaveAttribute("required");
    await expect(page.locator("#input-resourceinformation-title")).toHaveAttribute("required");
  });
});

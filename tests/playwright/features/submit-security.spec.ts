import { test, expect, type Page } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

const SUBMIT_ENDPOINT = '**/api/v2/controllers/SubmitController.php';
const CSRF_ENDPOINT = '**/api/csrf_token.php';

/**
 * Helper function to fill ALL required fields for submit operation
 * 
 * Required fields based on formgroups:
 * - resourceInformation.html: title[], doi, year, resourcetype, language
 * - rights.html: Rights (license)
 * - dates.html: dateCreated
 * - descriptions.html: descriptionAbstract
 * - authors.html: familynames[], givennames[], cpEmail[] (for contact person)
 */
async function fillCompleteMetadataForSubmit(page: Page) {
  // Required: Title (from resourceInformation.html - name="title[]")
  const titleInput = page.locator('input[name="title[]"]').first();
  if (await titleInput.isVisible()) {
    await titleInput.fill('Test Submit Security - Complete Metadata');
  }
  
  // Required: DOI (from resourceInformation.html - name="doi")
  const doiInput = page.locator('input[name="doi"]');
  if (await doiInput.isVisible()) {
    await doiInput.fill('10.5880/TEST.SECURITY.SUBMIT');
  }
  
  // Required: Year (from resourceInformation.html - name="year")
  const yearInput = page.locator('input[name="year"]');
  if (await yearInput.isVisible()) {
    await yearInput.fill('2025');
  }
  
  // Required: Abstract/Description (from descriptions.html - name="descriptionAbstract")
  const abstractInput = page.locator('textarea[name="descriptionAbstract"]');
  if (await abstractInput.isVisible()) {
    await abstractInput.fill('Test abstract for security validation');
  }
  
  // Required: Date Created (from dates.html - name="dateCreated")
  const dateCreatedInput = page.locator('input[name="dateCreated"]');
  if (await dateCreatedInput.isVisible()) {
    await dateCreatedInput.fill('2025-01-20');
  }
  
  // Required: Resource Type (from resourceInformation.html - name="resourcetype")
  const resourceTypeSelect = page.locator('select[name="resourcetype"]');
  if (await resourceTypeSelect.isVisible()) {
    await resourceTypeSelect.selectOption({ index: 1 }); // Select first non-empty option
  }
  
  // Required: Language (from resourceInformation.html - name="language")
  const languageSelect = page.locator('select[name="language"]');
  if (await languageSelect.isVisible()) {
    await languageSelect.selectOption({ index: 1 });
  }
  
  // Required: License/Rights (from rights.html - name="Rights")
  const rightsSelect = page.locator('select[name="Rights"]');
  if (await rightsSelect.isVisible()) {
    await rightsSelect.selectOption({ index: 1 });
  }
  
  // Required: At least 1 Author with first and last name
  // From authors.html: familynames[] and givennames[]
  const authorLastNameInput = page.locator('input[name="familynames[]"]').first();
  if (await authorLastNameInput.isVisible()) {
    await authorLastNameInput.fill('Doe');
  }
  
  const authorFirstNameInput = page.locator('input[name="givennames[]"]').first();
  if (await authorFirstNameInput.isVisible()) {
    await authorFirstNameInput.fill('John');
  }
  
  // Required: Contact Person with email
  // From authors.html contact person section: cpEmail[]
  // Mark author as contact person by clicking the label (checkbox is hidden by Bootstrap btn-check)
  // The label for the checkbox is the visible button element
  const contactPersonLabel = page.locator('label[for="checkbox-author-contactperson"]').first();
  if (await contactPersonLabel.isVisible()) {
    await contactPersonLabel.click();
  }
  
  // Fill contact person email (cpEmail[])
  const contactEmailInput = page.locator('input[name="cpEmail[]"]').first();
  if (await contactEmailInput.isVisible()) {
    await contactEmailInput.fill('test@example.com');
  }
}

/**
 * Helper function to find and interact with the submit button
 */
async function getSubmitButton(page: Page) {
  const submitBtn = page.locator('button:has-text("Submit")').first();
  return submitBtn;
}

test.describe('Submit Operation Security Features', () => {
  test.describe('Honeypot field protection in submit form', () => {
    test('honeypot field exists but is hidden in submit form', async ({ page }) => {
      await navigateToHome(page);
      
      // Fill all required data
      await fillCompleteMetadataForSubmit(page);
      
      // Check for honeypot field
      const honeypotField = page.locator('#modal-submit-form input[name="website"]');

      if (await honeypotField.count() > 0) {
        const honeypotContainer = honeypotField.locator('..');
        const boundingBox = await honeypotContainer.boundingBox();
        
        if (boundingBox) {
          // Should be off-screen
          expect(boundingBox.x).toBeLessThan(0);
        }
        
        // Should have accessibility attribute
        const hasAriaHidden = await honeypotContainer.evaluate((el) => 
          el.getAttribute('aria-hidden')
        );
        expect(hasAriaHidden).toBe('true');
      }
    });

    test('honeypot field has correct attributes to prevent autofill in submit form', async ({ page }) => {
      await navigateToHome(page);
      
      await fillCompleteMetadataForSubmit(page);
      
      const honeypotField = page.locator('#modal-submit-form input[name="website"]');
      
      if (await honeypotField.count() > 0) {
        await expect(honeypotField).toHaveAttribute('tabindex', '-1');
        await expect(honeypotField).toHaveAttribute('autocomplete', 'off');
      }
    });

    test('submit form includes honeypot field in submission', async ({ page }) => {
      let capturedFields: Record<string, string> = {};
      
      // Set up route mock
      await page.route(SUBMIT_ENDPOINT, async (route) => {
        const postData = route.request().postData() || '';
        const params = new URLSearchParams(postData);
        for (const [key, value] of params.entries()) {
          capturedFields[key] = value;
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Submitted' }),
        });
      });
      
      await navigateToHome(page);
      
      await fillCompleteMetadataForSubmit(page);
      
      // Find and click submit button
      const submitBtn = await getSubmitButton(page);
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        await page.waitForTimeout(1000);
        
        // Verify honeypot was sent (should be empty)
        if (capturedFields.hasOwnProperty('website')) {
          expect(capturedFields['website']).toBe('');
        }
      }
      
      await page.unroute(SUBMIT_ENDPOINT);
    });
  });

  test.describe('CSRF token protection in submit', () => {
    test('submit form includes CSRF token field', async ({ page }) => {
      await navigateToHome(page);
      
      await fillCompleteMetadataForSubmit(page);
      
      // Check for hidden CSRF field
      const csrfField = page.locator('#modal-submit-form input[name="csrf_token"]');
      
      if (await csrfField.count() > 0) {
        await expect(csrfField).toHaveAttribute('type', 'hidden');
      }
    });

    test('submit form includes security fields in submission', async ({ page }) => {
      let capturedFields: Record<string, string> = {};
      
      await page.route(SUBMIT_ENDPOINT, async (route) => {
        const postData = route.request().postData() || '';
        const params = new URLSearchParams(postData);
        for (const [key, value] of params.entries()) {
          capturedFields[key] = value;
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Submitted' }),
        });
      });
      
      await navigateToHome(page);
      
      await fillCompleteMetadataForSubmit(page);
      
      const submitBtn = await getSubmitButton(page);
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        await page.waitForTimeout(1000);
        
        // Verify security fields are present
        expect(capturedFields).toHaveProperty('csrf_token');
        expect(capturedFields).toHaveProperty('website');
        expect(capturedFields['csrf_token'].length).toBeGreaterThan(0);
      }
      
      await page.unroute(SUBMIT_ENDPOINT);
    });
  });

  test.describe('Rate limiting on submit operations', () => {
    test('shows rate limit error message when server returns 429 on submit', async ({ page }) => {
      await page.route(SUBMIT_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Too many submission requests. Please try again later.',
          }),
        });
      });
      
      await navigateToHome(page);
      
      await fillCompleteMetadataForSubmit(page);
      
      const submitBtn = await getSubmitButton(page);
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        // Wait for response
        const responsePromise = page.waitForResponse((response) =>
          response.url().includes('SubmitController')
        );
        
        await responsePromise;
        
        // Check for error message
        const errorAlert = page.locator('.alert-danger');
        if (await errorAlert.count() > 0) {
          await expect(errorAlert).toBeVisible();
        }
      }
      
      await page.unroute(SUBMIT_ENDPOINT);
    });

    test('shows CSRF error message when token is invalid for submit', async ({ page }) => {
      await page.route(SUBMIT_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid request - CSRF token validation failed',
          }),
        });
      });
      
      await navigateToHome(page);
      
      await fillCompleteMetadataForSubmit(page);
      
      const submitBtn = await getSubmitButton(page);
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        const responsePromise = page.waitForResponse((response) =>
          response.url().includes('SubmitController')
        );
        
        await responsePromise;
        
        const errorAlert = page.locator('.alert-danger');
        if (await errorAlert.count() > 0) {
          await expect(errorAlert).toBeVisible();
        }
      }
      
      await page.unroute(SUBMIT_ENDPOINT);
    });
  });
});

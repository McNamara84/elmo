import { expect, test } from '@playwright/test';

test.describe('Header Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
  });

  test('header contains GFZ and Data Services logos', async ({ page }) => {

    // Check GFZ logo
    const gfzLogo = page.locator('header img[alt="GFZ Logo"]');
    await expect(gfzLogo).toBeVisible();

    // Check Data Services logo
    const dataServicesLogo = page.locator('header img[alt="GFZ Data Services Logo"]');
    await expect(dataServicesLogo).toBeVisible();
  });

  test('header loads the optimized SVG logos with intrinsic dimensions', async ({ page }) => {
    const requestedLogoPaths = new Set<string>();
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.includes('/logos/')) {
        requestedLogoPaths.add(pathname);
      }
    });

    await page.reload({ waitUntil: 'load' });

    const gfzLogo = page.locator('header img[alt="GFZ Logo"]');
    const dataServicesLogo = page.locator('header img[alt="GFZ Data Services Logo"]');

    await expect(gfzLogo).toHaveAttribute('src', 'assets/logos/gfz-logo.svg');
    await expect(gfzLogo).toHaveAttribute('width', '2048');
    await expect(gfzLogo).toHaveAttribute('height', '694');

    await expect(dataServicesLogo).toHaveAttribute('src', 'assets/logos/gfz-data-services-logo.svg');
    await expect(dataServicesLogo).toHaveAttribute('width', '2048');
    await expect(dataServicesLogo).toHaveAttribute('height', '413');

    for (const logo of [gfzLogo, dataServicesLogo]) {
      await expect(logo).toBeVisible();
      const imageState = await logo.evaluate((element: HTMLImageElement) => ({
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
      }));
      expect(imageState.complete).toBe(true);
      expect(imageState.naturalWidth).toBeGreaterThan(0);
      expect(imageState.naturalHeight).toBeGreaterThan(0);

      const renderedBox = await logo.boundingBox();
      expect(renderedBox).not.toBeNull();
      const intrinsicRatio = imageState.naturalWidth / imageState.naturalHeight;
      const renderedRatio = renderedBox!.width / renderedBox!.height;
      expect(Math.abs(renderedRatio - intrinsicRatio)).toBeLessThan(0.02);
    }

    expect([...requestedLogoPaths].some(pathname => pathname.endsWith('/assets/logos/gfz-logo.svg'))).toBe(true);
    expect([...requestedLogoPaths].some(pathname => pathname.endsWith('/assets/logos/gfz-data-services-logo.svg'))).toBe(true);
    expect([...requestedLogoPaths].some(pathname => pathname.endsWith('/logos/GFZ-logo.png'))).toBe(false);
    expect([...requestedLogoPaths].some(pathname => pathname.endsWith('/logos/GFZ_Data_Services_logo.png'))).toBe(false);
  });

  test('header contains help, mode and language dropdowns', async ({ page }) => {

    const helpButton = page.locator('#bd-help');
    const modeButton = page.locator('#bd-theme');
    const langButton = page.locator('#bd-lang');

    await expect(helpButton).toBeVisible();
    await expect(modeButton).toBeVisible();
    await expect(langButton).toBeVisible();
  });

  test('subheader displays instance title', async ({ page }) => {

    // The subheader should contain the instance title
    const subheader = page.locator('section[aria-label="Page subheader"] .fs-5');
    await expect(subheader).toBeVisible();

    // Check that the title contains "ELMO" (common to all instances)
    await expect(subheader).toContainText('ELMO');
  });

  test('subheader title matches expected format', async ({ page }) => {

    const subheader = page.locator('section[aria-label="Page subheader"] .fs-5');
    const titleText = await subheader.textContent();

    // Title should match one of the valid instance titles
    const validTitles = [
      'ELMO – GFZ Metadata Editor',
      'ELMO MSL Edition – GFZ Metadata Editor',
      'ELMO ICGEM Edition – Alpha Version',
      'ELMO IGSN Edition – Alpha Version'
    ];

    expect(validTitles.some(title => titleText?.includes(title))).toBeTruthy();
  });

  test('GFZ logo links to gfz.de', async ({ page }) => {

    const gfzLogoLink = page.locator('header a[href="https://www.gfz.de/"]');
    await expect(gfzLogoLink).toBeVisible();
    await expect(gfzLogoLink).toHaveAttribute('target', '_blank');
  });

  test('Data Services logo links to dataservices.gfz.de', async ({ page }) => {

    const dataServicesLink = page.locator('header a[href="https://dataservices.gfz.de/web/"]');
    await expect(dataServicesLink).toBeVisible();
    await expect(dataServicesLink).toHaveAttribute('target', '_blank');
  });

});

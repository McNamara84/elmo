import { expect, type Page, type Route } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { APP_BASE_URL, CONTENT_TYPES, REPO_ROOT, STATIC_ASSET_ROUTE_PATTERNS } from './constants';

function getRepositoryRelativePath(pathname: string) {
  const trimmedPath = pathname.replace(/^\/+/, '');
  const basePath = new URL(APP_BASE_URL).pathname.replace(/^\/+|\/+$/g, '');

  if (basePath && (trimmedPath === basePath || trimmedPath.startsWith(`${basePath}/`))) {
    return trimmedPath.slice(basePath.length).replace(/^\/+/, '');
  }

  return trimmedPath;
}

export async function fulfillWithLocalAsset(route: Route) {
  const request = route.request();
  const url = new URL(request.url());

  if (!url.hostname.includes('localhost')) {
    await route.fallback();
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const repoRelativePath = getRepositoryRelativePath(pathname);
  const filePath = path.join(REPO_ROOT, repoRelativePath);

  try {
    const body = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';

    await route.fulfill({
      status: 200,
      body,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    console.warn(`Unable to serve asset for ${request.url()}:`, error);
    await route.fulfill({ status: 404, body: 'Not Found' });
  }
}

export async function registerStaticAssetRoutes(page: Page) {
  for (const pattern of STATIC_ASSET_ROUTE_PATTERNS) {
    await page.route(pattern, fulfillWithLocalAsset);
  }
}

export async function expectHelpSectionVisible(page: Page, helpSectionId: string) {
  await expect(page.locator(`[data-help-section-id="${helpSectionId}"]`)).toBeVisible();
}
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
  const baseUrl = new URL(APP_BASE_URL);

  // Check if this is a localhost request
  if (url.hostname.includes('localhost')) {
    const pathname = decodeURIComponent(url.pathname);
    const repoRelativePath = getRepositoryRelativePath(pathname);
    const filePath = path.join(REPO_ROOT, repoRelativePath);

    // Try to serve from local filesystem
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
      return;
    } catch (error) {
      // If running against a remote server, proxy the localhost request to the remote baseURL
      if (!baseUrl.hostname.includes('localhost')) {
        try {
          const remoteUrl = new URL(pathname, APP_BASE_URL).toString();
          const response = await route.fetch({ url: remoteUrl });
          await route.fulfill(response);
          return;
        } catch (proxyError) {
          console.warn(`Unable to proxy asset for ${request.url()} to ${APP_BASE_URL}:`, proxyError);
        }
      }
    }
  }

  // For non-localhost requests or failed local/proxy attempts, use default handling
  await route.fallback();
}

export async function registerStaticAssetRoutes(page: Page) {
  for (const pattern of STATIC_ASSET_ROUTE_PATTERNS) {
    await page.route(pattern, fulfillWithLocalAsset);
  }
}

export async function expectHelpSectionVisible(page: Page, helpSectionId: string) {
  await expect(page.locator(`[data-help-section-id="${helpSectionId}"]`)).toBeVisible();
}
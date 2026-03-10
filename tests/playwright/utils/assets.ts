import { expect, type Page, type Route } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { APP_BASE_URL, CONTENT_TYPES, REPO_ROOT, STATIC_ASSET_ROUTE_PATTERNS } from './constants';
// Not to make too much noise in logs
let assetServeCount = 0;
let assetLoadCount = 0;

function getRepositoryRelativePath(pathname: string) {
  const trimmedPath = pathname.replace(/^\/+/, '');
  const basePath = new URL(APP_BASE_URL).pathname.replace(/^\/+|\/+$/g, '');

  if (basePath && (trimmedPath === basePath || trimmedPath.startsWith(`${basePath}/`))) {
    return trimmedPath.slice(basePath.length).replace(/^\/+/, '');
  }

  return trimmedPath;
}

async function fetchRemoteAsset(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        resolve(null);
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

export async function fulfillWithLocalAsset(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const baseUrl = new URL(APP_BASE_URL);

  // Check if this is a request to serve from local assets (either localhost or the baseURL hostname)
  const isLocalhostRequest = url.hostname.includes('localhost');
  const isBaseUrlHostRequest = url.hostname === baseUrl.hostname && url.protocol === baseUrl.protocol;

  if (isLocalhostRequest || isBaseUrlHostRequest) {
    const pathname = decodeURIComponent(url.pathname);
    const repoRelativePath = getRepositoryRelativePath(pathname);
    const filePath = path.join(REPO_ROOT, repoRelativePath);

    // Try to serve from local filesystem first
    try {
      const body = await fs.readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';

      assetServeCount++;
      await route.fulfill({
        status: 200,
        body,
        headers: {
          'content-type': contentType,
        },
      });
      return;
    } catch (error) {
      // If file not found locally and we're testing against a remote server, try proxying
      if (!baseUrl.hostname.includes('localhost') && isBaseUrlHostRequest) {
        try {
          const remoteUrl = url.toString();
          console.log(`📍 Proxying to remote: ${pathname} -> ${remoteUrl}`);
          const body = await fetchRemoteAsset(remoteUrl);
          
          if (body) {
            const extension = path.extname(pathname).toLowerCase();
            const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';

            await route.fulfill({
              status: 200,
              body,
              headers: {
                'content-type': contentType,
              },
            });
            return;
          } else {
            console.warn(`⚠️ Failed to fetch remote asset: ${remoteUrl}`);
          }
        } catch (proxyError) {
          console.warn(`❌ Error proxying asset: ${pathname}`, proxyError);
        }
      } else {
        console.log(`📁 File not found locally: ${filePath}`);
      }
    }
  }

  // For non-matching requests or failed local/proxy attempts, use default handling
  await route.fallback();
}

/**
 * Load file content from either local filesystem or remote server
 * @param filePath Relative path from REPO_ROOT (e.g., 'node_modules/jquery/dist/jquery.min.js')
 * @returns File content as string
 */
export async function loadFileContent(filePath: string): Promise<string> {
  const fullPath = path.join(REPO_ROOT, filePath);
  
  try {
    // Try local filesystem first
    const content = await fs.readFile(fullPath, 'utf-8');
    assetLoadCount++;
    return content;
  } catch (error) {
    // If local file doesn't exist and we're testing against remote, try fetching
    const baseUrl = new URL(APP_BASE_URL);
    if (!baseUrl.hostname.includes('localhost')) {
      try {
        const remoteUrl = new URL(filePath, APP_BASE_URL).toString();
        console.log(`🌐 Fetching from remote: ${filePath}`);
        const buffer = await fetchRemoteAsset(remoteUrl);
        
        if (buffer) {
          return buffer.toString('utf-8');
        }
      } catch (remoteError) {
        console.warn(`⚠️ Failed to fetch from remote: ${filePath}`, remoteError);
      }
    }
    
    throw new Error(`Failed to load file: ${filePath} (local: ${fullPath})`);
  }
}

/**
 * Inject a script into the page by loading content from filesystem or remote
 * @param page Playwright page object
 * @param filePath Relative path from REPO_ROOT (e.g., 'node_modules/jquery/dist/jquery.min.js')
 */
export async function injectScript(page: Page, filePath: string): Promise<void> {
  const content = await loadFileContent(filePath);
  await page.addScriptTag({ content });
}

/**
 * Inject a stylesheet into the page by loading content from filesystem or remote
 * @param page Playwright page object
 * @param filePath Relative path from REPO_ROOT (e.g., 'node_modules/bootstrap/dist/css/bootstrap.min.css')
 */
export async function injectStylesheet(page: Page, filePath: string): Promise<void> {
  const content = await loadFileContent(filePath);
  await page.addStyleTag({ content });
}

export async function registerStaticAssetRoutes(page: Page) {
  assetServeCount = 0;
  assetLoadCount = 0;
  for (const pattern of STATIC_ASSET_ROUTE_PATTERNS) {
    await page.route(pattern, fulfillWithLocalAsset);
  }
  console.log(`📦 Asset routes registered (${STATIC_ASSET_ROUTE_PATTERNS.length} patterns)`);
}

export async function expectHelpSectionVisible(page: Page, helpSectionId: string) {
  await expect(page.locator(`[data-help-section-id="${helpSectionId}"]`)).toBeVisible();
}
// playwright-global-setup.js
const { chromium } = require('playwright');
const fs = require('fs');

module.exports = async () => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8000';
  const seedUrl = `${baseUrl}/tests/seed_session.php`;
  const storageFile = 'playwright/.auth/session-storage.json';

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(seedUrl, { waitUntil: 'networkidle', timeout: 10000 });
    // Warte kurz, damit Server Session setzt
    await page.waitForTimeout(200);
    // Speichere storageState (enthält Cookies + LocalStorage) in Datei
    await context.storageState({ path: storageFile });
    console.log('Saved session storage to', storageFile);
  } catch (err) {
    console.error('Error in globalSetup seeding:', err);
  } finally {
    await browser.close();
  }
};

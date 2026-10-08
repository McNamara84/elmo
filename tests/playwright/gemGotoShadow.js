/**
 * Loaded only for ELMO-GEM, via NODE_OPTIONS in playwright.gem.config.ts.
 * Shadows page.goto('/') so it keeps the baseURL path (for example /elmo/)
 * instead of opening the host root. Other variants never load this file.
 */
const playwright = require('playwright-core');

const shadowed = Symbol('gemGotoShadow');

function shadowPage(page) {
  if (!page || page.goto[shadowed]) {
    return page;
  }
  const originalGoto = page.goto.bind(page);
  const goto = async function gemShadowedGoto(url, options) {
    // '/' is resolved against the origin, which drops a base path such as /elmo/.
    // An empty URL is resolved against baseURL and keeps that path.
    return originalGoto(url === '/' ? '' : url, options);
  };
  goto[shadowed] = true;
  page.goto = goto;
  return page;
}

function shadowContext(context) {
  if (!context || context.newPage[shadowed]) {
    return context;
  }
  const originalNewPage = context.newPage.bind(context);
  const newPage = async function gemShadowedNewPage(options) {
    return shadowPage(await originalNewPage(options));
  };
  newPage[shadowed] = true;
  context.newPage = newPage;
  context.on('page', shadowPage);
  return context;
}

function shadowBrowser(browser) {
  if (!browser || browser.newContext[shadowed]) {
    return browser;
  }
  const originalNewContext = browser.newContext.bind(browser);
  const newContext = async function gemShadowedNewContext(options) {
    return shadowContext(await originalNewContext(options));
  };
  newContext[shadowed] = true;
  browser.newContext = newContext;
  if (typeof browser.newPage === 'function') {
    const originalNewPage = browser.newPage.bind(browser);
    browser.newPage = async function gemShadowedBrowserNewPage(options) {
      return shadowPage(await originalNewPage(options));
    };
  }
  return browser;
}

function shadowBrowserType(browserType) {
  if (!browserType || browserType.launch[shadowed]) {
    return;
  }
  const originalLaunch = browserType.launch.bind(browserType);
  const launch = async function gemShadowedLaunch(options) {
    return shadowBrowser(await originalLaunch(options));
  };
  launch[shadowed] = true;
  browserType.launch = launch;
  if (typeof browserType.connect === 'function') {
    const originalConnect = browserType.connect.bind(browserType);
    browserType.connect = async function gemShadowedConnect(...args) {
      return shadowBrowser(await originalConnect(...args));
    };
  }
}

for (const name of ['chromium', 'firefox', 'webkit']) {
  shadowBrowserType(playwright[name]);
}

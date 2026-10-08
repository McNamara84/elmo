/**
 * Loaded only for ELMO-GEM, via NODE_OPTIONS in playwright.gem.config.ts.
 * On an ICGEM host, page.goto('/') is sent to /elmo/ so the editor opens
 * instead of the site root. Localhost and CI keep goto('/').
 */
const playwright = require('playwright-core');

const shadowed = Symbol('gemGotoShadow');

function baseURL(page) {
  const fromContext = page.context()?._options?.baseURL;
  if (typeof fromContext === 'string' && fromContext) {
    return fromContext;
  }
  return process.env.BASE_URL || '';
}

function shadowPage(page) {
  if (!page || page.goto[shadowed]) {
    return page;
  }
  const originalGoto = page.goto.bind(page);
  const goto = async function gemShadowedGoto(url, options) {
    const target = url === '/' && baseURL(page).toLowerCase().includes('icgem') ? '/elmo/' : url;
    return originalGoto(target, options);
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

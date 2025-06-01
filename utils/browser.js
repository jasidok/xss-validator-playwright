/**
 * Browser resource management utilities for XSS Validator
 * This module provides functions for optimizing browser resource usage
 */

const { chromium, firefox, webkit } = require('playwright');
const {checkBrowserInstallation} = require('../scripts/install-browsers');

// Map to store browser instances by type
const browsers = new Map();

// Map to store browser contexts by ID
const contexts = new Map();

// Default browser launch options
const defaultLaunchOptions = {
  headless: true,
  args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'],
  timeout: 30000
};

// Default context options
const defaultContextOptions = {
  viewport: { width: 1280, height: 720 },
  ignoreHTTPSErrors: true,
  javaScriptEnabled: true,
  bypassCSP: true
};

/**
 * Checks if browsers are properly installed and provides helpful error messages
 * @returns {Promise<Object>} - Object with installation status and available browsers
 */
async function checkBrowsersAvailable() {
    try {
        const browsers = ['chromium', 'firefox', 'webkit'];
        const availableBrowsers = [];
        const errors = [];

        for (const browserName of browsers) {
            try {
                const browserInstance = getBrowserInstance(browserName);
                const executablePath = browserInstance.executablePath();

                if (executablePath) {
                    availableBrowsers.push(browserName);
                } else {
                    errors.push(`${browserName}: Executable not found`);
                }
            } catch (error) {
                errors.push(`${browserName}: ${error.message}`);
            }
        }

        return {
            available: availableBrowsers,
            errors,
            isInstalled: availableBrowsers.length > 0
        };
    } catch (error) {
        return {
            available: [],
            errors: [`General error: ${error.message}`],
            isInstalled: false
        };
    }
}

/**
 * Gets the browser instance for a given browser type
 * @param {string} browserType - Browser type ('chromium', 'firefox', 'webkit')
 * @returns {Object} - Playwright browser instance
 */
function getBrowserInstance(browserType) {
    const type = browserType.toLowerCase();

    switch (type) {
        case 'firefox':
            return firefox;
        case 'webkit':
            return webkit;
        case 'chromium':
        default:
            return chromium;
    }
}

/**
 * Gets or creates a browser instance of the specified type
 * @param {string} browserType - Browser type ('chromium', 'firefox', 'webkit')
 * @param {Object} options - Browser launch options
 * @returns {Promise<Object>} - Playwright browser instance
 */
async function getBrowser(browserType = 'chromium', options = {}) {
  const type = browserType.toLowerCase();
  
  // Check if browser instance already exists
  if (browsers.has(type)) {
    return browsers.get(type);
  }

    // Check if browsers are available before trying to launch
    const browserCheck = await checkBrowsersAvailable();

    if (!browserCheck.isInstalled) {
        const errorMessage = `
❌ Playwright browsers are not installed!

Available installation options:
1. Run: npm run setup
2. Run: npx playwright install --with-deps
3. Run: npx playwright install --with-deps ${type}

For CI/CD environments:
- Add "npx playwright install --with-deps" to your pipeline
- Set SKIP_BROWSER_INSTALL=true to skip automatic installation

Errors found:
${browserCheck.errors.map(err => `  - ${err}`).join('\n')}

See docs/troubleshooting.md for more help.
    `.trim();

        throw new Error(errorMessage);
  }

    if (!browserCheck.available.includes(type)) {
        const availableText = browserCheck.available.length > 0
            ? `Available browsers: ${browserCheck.available.join(', ')}`
            : 'No browsers available';

        throw new Error(`
❌ Browser '${type}' is not installed!

${availableText}

To install ${type}:
npm run setup:${type}

To install all browsers:
npm run setup
    `.trim());
    }

    // Select the browser type
    const playwrightBrowser = getBrowserInstance(type);

    // Merge default options with provided options
  const launchOptions = { ...defaultLaunchOptions, ...options };

    try {
        // Launch the browser
        const browser = await playwrightBrowser.launch(launchOptions);

        // Store the browser instance
        browsers.set(type, browser);

        return browser;
    } catch (error) {
        if (error.message.includes('Executable doesn\'t exist')) {
            throw new Error(`
❌ Browser executable not found for '${type}'!

This usually means the browser was not properly installed.

Try reinstalling:
1. npm run setup:${type}
2. Or: npx playwright install --with-deps ${type}

If the problem persists, see docs/troubleshooting.md
      `.trim());
        }

        // Re-throw the original error with additional context
        throw new Error(`Failed to launch ${type} browser: ${error.message}`);
    }
}

/**
 * Creates a new browser context with optimized resource usage
 * @param {Object} browser - Playwright browser instance
 * @param {Object} options - Context options
 * @returns {Promise<Object>} - Playwright browser context
 */
async function createContext(browser, options = {}) {
  // Merge default options with provided options
  const contextOptions = { ...defaultContextOptions, ...options };
  
  // Create a new context
  const context = await browser.newContext(contextOptions);
  
  // Generate a unique ID for the context
  const contextId = `context-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Store the context
  contexts.set(contextId, context);
  
  return { context, contextId };
}

/**
 * Gets a browser context by ID or creates a new one
 * @param {string} contextId - Context ID
 * @param {Object} browser - Playwright browser instance
 * @param {Object} options - Context options
 * @returns {Promise<Object>} - Object containing context and contextId
 */
async function getContext(contextId, browser, options = {}) {
  // Check if context exists
  if (contextId && contexts.has(contextId)) {
    return { context: contexts.get(contextId), contextId, isExisting: true };
  }
  
  // Create a new context
  const { context, contextId: newContextId } = await createContext(browser, options);
  
  return { context, contextId: newContextId, isExisting: false };
}

/**
 * Closes a browser context and removes it from the contexts map
 * @param {string} contextId - Context ID
 * @returns {Promise<boolean>} - Whether the context was successfully closed
 */
async function closeContext(contextId) {
  if (contexts.has(contextId)) {
    const context = contexts.get(contextId);
    await context.close();
    contexts.delete(contextId);
    return true;
  }
  return false;
}

/**
 * Closes a browser instance and removes it from the browsers map
 * @param {string} browserType - Browser type ('chromium', 'firefox', 'webkit')
 * @returns {Promise<boolean>} - Whether the browser was successfully closed
 */
async function closeBrowser(browserType = 'chromium') {
  const type = browserType.toLowerCase();
  
  if (browsers.has(type)) {
    const browser = browsers.get(type);
    await browser.close();
    browsers.delete(type);
    return true;
  }
  return false;
}

/**
 * Closes all browser instances and contexts
 * @returns {Promise<void>}
 */
async function closeAll() {
  // Close all contexts
  for (const contextId of contexts.keys()) {
    await closeContext(contextId);
  }
  
  // Close all browsers
  for (const browserType of browsers.keys()) {
    await closeBrowser(browserType);
  }
}

/**
 * Creates a new page with optimized resource settings
 * @param {Object} context - Playwright browser context
 * @param {Object} options - Page options
 * @returns {Promise<Object>} - Playwright page
 */
async function createPage(context, options = {}) {
  // Create a new page
  const page = await context.newPage();
  
  // Apply resource optimization settings
  if (options.blockImages) {
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());
  }
  
  if (options.blockCss) {
    await page.route('**/*.css', route => route.abort());
  }
  
  if (options.blockFonts) {
    await page.route('**/*.{woff,woff2,ttf,otf,eot}', route => route.abort());
  }
  
  if (options.blockMedia) {
    await page.route('**/*.{mp4,webm,ogg,mp3,wav,flac,aac}', route => route.abort());
  }
  
  // Set JavaScript and DOM optimization
  if (options.optimizeMemory) {
    await page.evaluate(() => {
      // Clear timers
      const highestTimeoutId = setTimeout(() => {}, 0);
      for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i);
        clearInterval(i);
      }
      
      // Clear console
      console.clear();
      
      // Garbage collection hint (not guaranteed to run)
      if (window.gc) {
        window.gc();
      }
    });
  }
  
  return page;
}

/**
 * Gets statistics about browser resource usage
 * @returns {Object} - Browser resource statistics
 */
function getBrowserStats() {
  return {
    activeBrowsers: browsers.size,
    activeContexts: contexts.size,
    browserTypes: Array.from(browsers.keys())
  };
}

module.exports = {
  getBrowser,
  createContext,
  getContext,
  closeContext,
  closeBrowser,
  closeAll,
  createPage,
  getBrowserStats
};

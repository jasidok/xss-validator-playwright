/**
 * Session management utilities for XSS Validator
 * This module provides functions for saving, loading, and managing browser sessions
 */

const fs = require('fs');
const path = require('path');
const { chromium, firefox, webkit } = require('playwright');

// Directory for storing session data
const SESSION_DIR = path.join(__dirname, '..', 'sessions');

// Ensure the sessions directory exists
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Map to store active browser contexts by session ID
const activeSessions = new Map();

/**
 * Creates a new browser context with the specified options
 * @param {string} browser - Browser type ('chromium', 'firefox', 'webkit')
 * @param {Object} options - Browser context options
 * @param {Object} launchOptions - Browser launch options
 * @returns {Promise<Object>} - Object containing browser and context instances
 */
async function createBrowserContext(browser = 'chromium', options = {}, launchOptions = {}) {
  let browserType;
  switch (browser.toLowerCase()) {
    case 'firefox':
      browserType = firefox;
      break;
    case 'webkit':
      browserType = webkit;
      break;
    case 'chromium':
    default:
      browserType = chromium;
      break;
  }

  // Default resource optimization options
  const defaultLaunchOptions = {
    // Use low-end device settings to reduce resource usage
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      // Removed '--single-process' flag as it can cause stability issues
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-sandbox'
    ],
    // Reduce memory usage by limiting JavaScript memory
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=512'
    }
  };

  // Merge default options with provided options
  const mergedLaunchOptions = { ...defaultLaunchOptions, ...launchOptions };

  const browserInstance = await browserType.launch(mergedLaunchOptions);
  const context = await browserInstance.newContext(options);

  return { browser: browserInstance, context };
}

// Maximum number of pages to keep in the pool per session
const MAX_PAGES_PER_SESSION = 5;

/**
 * Creates a new session or returns an existing one
 * @param {string} sessionId - Unique identifier for the session
 * @param {string} browser - Browser type ('chromium', 'firefox', 'webkit')
 * @param {Object} options - Browser context options
 * @param {Object} launchOptions - Browser launch options
 * @returns {Promise<Object>} - Object containing browser, context, and page instances
 */
async function getSession(sessionId, browser = 'chromium', options = {}, launchOptions = {}) {
  // If session exists and is for the same browser type, return it
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    if (session.browserType === browser.toLowerCase()) {
      let page;

      // Check if there are any available pages in the pool
      if (session.pagePool && session.pagePool.length > 0) {
        // Get a page from the pool
        page = session.pagePool.pop();

        // Reset the page state
        try {
          await page.goto('about:blank');
          await page.evaluate(() => {
            // Clear any JavaScript variables
            localStorage.clear();
            sessionStorage.clear();
          });
        } catch (error) {
          // If page is not usable, create a new one
          console.warn(`Could not reuse page from pool: ${error.message}`);
          page = await session.context.newPage();
        }
      } else {
        // Create a new page if pool is empty
        page = await session.context.newPage();
      }

      return { 
        browser: session.browser, 
        context: session.context, 
        page,
        isExisting: true,
        // Return a function to release the page back to the pool
        releasePage: async () => {
          try {
            // Check if the session still exists
            if (!activeSessions.has(sessionId)) {
              console.warn(`Session ${sessionId} no longer exists, closing page`);
              await page.close();
              return;
            }

            // Get the current session (it might have changed)
            const currentSession = activeSessions.get(sessionId);

            // Check if the page is still valid
            let isPageValid = true;
            try {
              // Try a simple operation to check if the page is still usable
              await page.evaluate(() => true);
            } catch (pageError) {
              console.warn(`Page is no longer valid: ${pageError.message}`);
              isPageValid = false;
            }

            if (isPageValid && currentSession.pagePool.length < MAX_PAGES_PER_SESSION) {
              // Reset the page state before adding it back to the pool
              try {
                await page.goto('about:blank');
                await page.evaluate(() => {
                  // Clear any JavaScript variables
                  localStorage.clear();
                  sessionStorage.clear();
                });
                currentSession.pagePool.push(page);
              } catch (resetError) {
                console.warn(`Could not reset page state: ${resetError.message}`);
                await page.close();
              }
            } else {
              // Close the page if it's invalid or the pool is full
              await page.close();
            }
          } catch (error) {
            console.warn(`Error releasing page: ${error.message}`);
            // Try to close the page as a last resort
            try {
              await page.close();
            } catch (closeError) {
              console.error(`Failed to close page: ${closeError.message}`);
            }
          }
        }
      };
    } else {
      // If browser type is different, close the existing session
      await closeSession(sessionId);
    }
  }

  // Create a new browser context with resource optimization
  const { browser: browserInstance, context } = await createBrowserContext(browser, options, launchOptions);
  const page = await context.newPage();

  // Store the session with an empty page pool
  activeSessions.set(sessionId, {
    browser: browserInstance,
    context,
    browserType: browser.toLowerCase(),
    pagePool: [] // Initialize an empty page pool
  });

  return { 
    browser: browserInstance, 
    context, 
    page,
    isExisting: false,
    // Return a function to release the page back to the pool
    releasePage: async () => {
      try {
        // Check if the session still exists
        if (!activeSessions.has(sessionId)) {
          console.warn(`Session ${sessionId} no longer exists, closing page`);
          await page.close();
          return;
        }

        // Get the current session (it might have changed)
        const currentSession = activeSessions.get(sessionId);

        // Check if the page is still valid
        let isPageValid = true;
        try {
          // Try a simple operation to check if the page is still usable
          await page.evaluate(() => true);
        } catch (pageError) {
          console.warn(`Page is no longer valid: ${pageError.message}`);
          isPageValid = false;
        }

        if (isPageValid && currentSession.pagePool.length < MAX_PAGES_PER_SESSION) {
          // Reset the page state before adding it back to the pool
          try {
            await page.goto('about:blank');
            await page.evaluate(() => {
              // Clear any JavaScript variables
              localStorage.clear();
              sessionStorage.clear();
            });
            currentSession.pagePool.push(page);
          } catch (resetError) {
            console.warn(`Could not reset page state: ${resetError.message}`);
            await page.close();
          }
        } else {
          // Close the page if it's invalid or the pool is full
          await page.close();
        }
      } catch (error) {
        console.warn(`Error releasing page: ${error.message}`);
        // Try to close the page as a last resort
        try {
          await page.close();
        } catch (closeError) {
          console.error(`Failed to close page: ${closeError.message}`);
        }
      }
    }
  };
}

/**
 * Closes a session and removes it from active sessions
 * @param {string} sessionId - Unique identifier for the session
 * @returns {Promise<boolean>} - Whether the session was successfully closed
 */
async function closeSession(sessionId) {
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);

    // Close all pages in the page pool
    if (session.pagePool && session.pagePool.length > 0) {
      for (const page of session.pagePool) {
        try {
          await page.close();
        } catch (error) {
          console.warn(`Error closing pooled page: ${error.message}`);
        }
      }
      // Clear the page pool
      session.pagePool = [];
    }

    // Force garbage collection if possible
    if (global.gc) {
      try {
        global.gc();
      } catch (error) {
        console.warn(`Error forcing garbage collection: ${error.message}`);
      }
    }

    // Close the context and browser
    try {
      await session.context.close();
    } catch (error) {
      console.warn(`Error closing context: ${error.message}`);
    }

    try {
      await session.browser.close();
    } catch (error) {
      console.warn(`Error closing browser: ${error.message}`);
    }

    activeSessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Saves session state to a file
 * @param {string} sessionId - Unique identifier for the session
 * @param {Object} context - Playwright browser context
 * @returns {Promise<string>} - Path to the saved session file
 */
async function saveSessionState(sessionId, context) {
  const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`);

  // Get storage state (cookies, localStorage)
  const storageState = await context.storageState();

  // Save to file
  fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));

  return sessionPath;
}

/**
 * Loads session state from a file
 * @param {string} sessionId - Unique identifier for the session
 * @returns {Object|null} - Session state object or null if not found
 */
function loadSessionState(sessionId) {
  const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`);

  if (fs.existsSync(sessionPath)) {
    const data = fs.readFileSync(sessionPath, 'utf8');
    return JSON.parse(data);
  }

  return null;
}

/**
 * Checks if a session exists
 * @param {string} sessionId - Unique identifier for the session
 * @returns {boolean} - Whether the session exists
 */
function sessionExists(sessionId) {
  return activeSessions.has(sessionId) || fs.existsSync(path.join(SESSION_DIR, `${sessionId}.json`));
}

/**
 * Lists all available sessions
 * @returns {Array<string>} - Array of session IDs
 */
function listSessions() {
  const files = fs.readdirSync(SESSION_DIR);
  return files
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
}

/**
 * Deletes a session file
 * @param {string} sessionId - Unique identifier for the session
 * @returns {boolean} - Whether the session file was successfully deleted
 */
function deleteSessionFile(sessionId) {
  const sessionPath = path.join(SESSION_DIR, `${sessionId}.json`);

  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
    return true;
  }

  return false;
}

/**
 * Closes all active sessions
 * @returns {Promise<number>} - Number of sessions closed
 */
async function closeAllSessions() {
  const sessionIds = Array.from(activeSessions.keys());
  let closedCount = 0;

  for (const sessionId of sessionIds) {
    const closed = await closeSession(sessionId);
    if (closed) closedCount++;
  }

  return closedCount;
}

module.exports = {
  getSession,
  closeSession,
  saveSessionState,
  loadSessionState,
  sessionExists,
  listSessions,
  deleteSessionFile,
  closeAllSessions
};

const { chromium, firefox, webkit } = require('playwright');
const { generateJSONReport, generateHTMLReport } = require('./reports');
const { updatePayloadEffectiveness, getMostEffectivePayloads } = require('./payloads/effectiveness');
const { selectSmartPayloads } = require('./payloads/smartSelection');
const { loadConfig, updateConfig } = require('./config');
const { retryPageOperation } = require('./utils/retry');
const { 
  getSession, 
  closeSession, 
  saveSessionState, 
  loadSessionState, 
  sessionExists 
} = require('./utils/session');
const {
  generateCacheKey,
  cacheExists,
  getCachedResult,
  cacheResult,
  clearCache,
  getCacheStats
} = require('./utils/cache');

/**
 * Authenticates with a website using credentials
 * @param {Object} page - Playwright page object
 * @param {Object} authConfig - Authentication configuration
 * @param {string} authConfig.url - URL of the login page
 * @param {string} authConfig.usernameSelector - CSS selector for the username field
 * @param {string} authConfig.passwordSelector - CSS selector for the password field
 * @param {string} authConfig.submitSelector - CSS selector for the login button
 * @param {string} authConfig.username - Username to use
 * @param {string} authConfig.password - Password to use
 * @param {Function} authConfig.isLoggedInCheck - Optional function to check if login was successful
 * @returns {Promise<boolean>} - Whether authentication was successful
 */
async function authenticate(page, authConfig) {
    try {
        // Validate inputs
        if (!page) {
            console.error('Authentication failed: Page object is null or undefined');
            return false;
        }

        if (!authConfig) {
            console.error('Authentication failed: Auth configuration is null or undefined');
            return false;
        }

        if (!authConfig.url) {
            console.error('Authentication failed: Login URL is not provided');
            return false;
        }

        if (!authConfig.usernameSelector || !authConfig.passwordSelector || !authConfig.submitSelector) {
            console.error('Authentication failed: Required selectors are not provided');
            return false;
        }

        if (!authConfig.username || !authConfig.password) {
            console.error('Authentication failed: Credentials are not provided');
            return false;
        }

        // Navigate to the login page
        try {
            await page.goto(authConfig.url, { timeout: 30000 });
        } catch (navError) {
            console.error(`Authentication failed: Could not navigate to login page: ${navError.message}`);
            return false;
        }

        // Fill in the username
        try {
            await page.fill(authConfig.usernameSelector, authConfig.username);
        } catch (userError) {
            console.error(`Authentication failed: Could not fill username field: ${userError.message}`);
            return false;
        }

        // Fill in the password
        try {
            await page.fill(authConfig.passwordSelector, authConfig.password);
        } catch (passError) {
            console.error(`Authentication failed: Could not fill password field: ${passError.message}`);
            return false;
        }

        // Click the login button
        try {
            await page.click(authConfig.submitSelector);
        } catch (clickError) {
            console.error(`Authentication failed: Could not click login button: ${clickError.message}`);
            return false;
        }

        // Wait for navigation to complete
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
        } catch (waitError) {
            // This is not necessarily an error, as some login forms don't navigate
            console.warn(`Navigation after login did not complete: ${waitError.message}`);
        }

        // Check if login was successful
        if (authConfig.isLoggedInCheck) {
            try {
                return await authConfig.isLoggedInCheck(page);
            } catch (checkError) {
                console.error(`Authentication check failed: ${checkError.message}`);
                return false;
            }
        }

        // Default check: just assume it worked if we got here
        return true;
    } catch (error) {
        console.error('Authentication failed:', error);
        return false;
    }
}

/**
 * Detects XSS vulnerabilities in a web page by testing various payloads
 * @param {string} url - The URL of the page to test
 * @param {string} inputFieldSelector - CSS selector for the input field
 * @param {Array|Object} customPayloads - Custom payloads to use instead of defaults
 * @param {Object} options - Additional options for the detection
 * @param {string} options.browser - Browser to use ('chromium', 'firefox', 'webkit')
 * @param {string} options.submitSelector - CSS selector for the submit button
 * @param {number} options.timeout - Timeout in milliseconds for waiting after submission
 * @param {boolean} options.verifyExecution - Whether to verify JavaScript execution
 * @param {Object} options.auth - Authentication configuration (optional)
 * @param {string} options.auth.url - URL of the login page
 * @param {string} options.auth.usernameSelector - CSS selector for the username field
 * @param {string} options.auth.passwordSelector - CSS selector for the password field
 * @param {string} options.auth.submitSelector - CSS selector for the login button
 * @param {string} options.auth.username - Username to use
 * @param {string} options.auth.password - Password to use
 * @param {Function} options.auth.isLoggedInCheck - Optional function to check if login was successful
 * @param {Object} options.session - Session configuration (optional)
 * @param {string} options.session.id - Session ID to use (if not provided, a new session will be created)
 * @param {boolean} options.session.save - Whether to save the session state after testing
 * @param {boolean} options.session.reuse - Whether to reuse an existing session if available
 * @param {boolean} options.session.closeAfter - Whether to close the session after testing
 * @param {Object} options.cache - Cache configuration (optional)
 * @param {boolean} options.cache.enabled - Whether to use caching
 * @param {number} options.cache.maxAge - Maximum age of cache entries in milliseconds (0 = no expiration)
 * @param {boolean} options.cache.verbose - Whether to log cache hits and misses
 * @param {Object} options.report - Reporting configuration (optional)
 * @param {string} options.report.format - Report format ('json', 'html', or 'both')
 * @param {string} options.report.outputDir - Directory to save the report
 * @param {string} options.report.filename - Base filename for the report (without extension)
 * @returns {Promise<Object>} - Object containing results and report paths
 */
async function detectXSS(url, inputFieldSelector, customPayloads = null, options = {}) {
    // Load configuration from file
    const fileConfig = loadConfig();

    // Set timestamp for report filename if not provided
    if (fileConfig.report && fileConfig.report.filename === 'xss-report') {
        fileConfig.report.filename = `xss-report-${new Date().toISOString().replace(/:/g, '-')}`;
    }

    // Merge configurations: file config < provided options
    const mergedOptions = { ...fileConfig, ...options };

    // If options were provided, update the saved configuration (excluding report filename)
    if (Object.keys(options).length > 0) {
        const optionsToSave = { ...options };
        // Don't save the timestamp in the filename
        if (optionsToSave.report && optionsToSave.report.filename) {
            optionsToSave.report = { ...optionsToSave.report, filename: 'xss-report' };
        }
        updateConfig(optionsToSave);
    }

    // Set up session handling
    let browser, context, page;
    let sessionWasReused = false;

    // Check if session options are provided
    if (mergedOptions.session) {
        const sessionId = mergedOptions.session.id || `xss-validator-${Date.now()}`;
        const shouldReuseSession = mergedOptions.session.reuse && sessionExists(sessionId);

        if (shouldReuseSession && mergedOptions.logging && mergedOptions.logging.verbose) {
            console.log(`Attempting to reuse existing session: ${sessionId}`);
        }

        // Load existing session state if available
        let sessionState = null;
        if (shouldReuseSession) {
            sessionState = loadSessionState(sessionId);
            if (sessionState && mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`Loaded session state for: ${sessionId}`);
            }
        }

        // Create browser context options
        const contextOptions = {};
        if (sessionState) {
            contextOptions.storageState = sessionState;
        }

        // Browser resource optimization options
        const launchOptions = mergedOptions.browserOptions || {
            // Use low-end device settings to reduce resource usage
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-sandbox'
            ]
        };

        // Get or create session with resource optimization
        const sessionResult = await getSession(
            sessionId, 
            mergedOptions.browser, 
            contextOptions,
            launchOptions
        );

        browser = sessionResult.browser;
        context = sessionResult.context;
        page = sessionResult.page;
        sessionWasReused = sessionResult.isExisting;

        // Store the releasePage function for cleanup
        const releasePage = sessionResult.releasePage;

        // Store session ID in options for later use
        mergedOptions.session.id = sessionId;

        if (mergedOptions.logging && mergedOptions.logging.verbose) {
            console.log(`Session ${sessionWasReused ? 'reused' : 'created'}: ${sessionId}`);
        }
    } else {
        // If no session options, create a new browser and context with resource optimization
        let browserType;
        switch (mergedOptions.browser.toLowerCase()) {
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

        // Browser resource optimization options
        const launchOptions = mergedOptions.browserOptions || {
            // Use low-end device settings to reduce resource usage
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-sandbox'
            ]
        };

        browser = await browserType.launch(launchOptions);
        context = await browser.newContext();
        page = await context.newPage();
    }

    // Results array to store detected vulnerabilities
    const results = [];

    try {
        // Authenticate if auth options are provided
        if (mergedOptions.auth) {
            const authSuccess = await authenticate(page, mergedOptions.auth);
            if (!authSuccess) {
                console.error('Authentication failed. Continuing without authentication.');
            } else {
                console.log('Authentication successful.');
            }
        }

        // Navigate to the target URL with navigation timeout
        const navigationTimeout = mergedOptions.timeouts ? mergedOptions.timeouts.navigation : 30000;
        await page.goto(url, { timeout: navigationTimeout });

        // Set up JavaScript execution detection if enabled
        if (mergedOptions.verifyExecution) {
            await page.addInitScript(() => {
                window.__xssDetected = false;

                // Override alert, confirm, prompt functions
                const originalAlert = window.alert;
                const originalConfirm = window.confirm;
                const originalPrompt = window.prompt;

                window.alert = function() {
                    window.__xssDetected = true;
                    return originalAlert.apply(this, arguments);
                };

                window.confirm = function() {
                    window.__xssDetected = true;
                    return originalConfirm.apply(this, arguments);
                };

                window.prompt = function() {
                    window.__xssDetected = true;
                    return originalPrompt.apply(this, arguments);
                };

                // Create a MutationObserver to detect DOM changes that might indicate XSS
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            for (const node of mutation.addedNodes) {
                                if (node.nodeName === 'SCRIPT' || 
                                    (node.nodeType === 1 && node.hasAttribute('onload')) ||
                                    (node.nodeType === 1 && node.hasAttribute('onerror'))) {
                                    window.__xssDetected = true;
                                }
                            }
                        }
                    }
                });

                observer.observe(document, { 
                    childList: true, 
                    subtree: true, 
                    attributes: true, 
                    attributeFilter: ['onload', 'onerror', 'src'] 
                });
            });
        }

        // Process payloads based on their format (array or categorized object)
        let payloadsToTest = [];

        // Check if smart payload selection is enabled
        if (mergedOptions.smartPayloadSelection && mergedOptions.smartPayloadSelection.enabled) {
            // Use smart payload selection
            console.log(`Using smart payload selection for browser: ${mergedOptions.browser}`);

            try {
                // Get smart payloads based on context analysis
                payloadsToTest = await selectSmartPayloads({
                    url,
                    page,
                    inputFieldSelector,
                    browser: mergedOptions.browser,
                    limit: mergedOptions.smartPayloadSelection.limit || 10,
                    useEffectiveness: mergedOptions.effectiveness && mergedOptions.effectiveness.useEffectivePayloads,
                    customPayloads
                });

                console.log(`Selected ${payloadsToTest.length} smart payloads based on context analysis`);
            } catch (error) {
                console.error('Error using smart payload selection:', error);
                console.log('Falling back to standard payload selection');
                // Reset payloadsToTest to use standard selection as fallback
                payloadsToTest = [];
            }
        }

        // If smart payload selection is not enabled or failed, use standard selection
        if (payloadsToTest.length === 0) {
            if (mergedOptions.effectiveness && mergedOptions.effectiveness.useEffectivePayloads) {
                // Use the most effective payloads if enabled
                console.log(`Using the ${mergedOptions.effectiveness.limit} most effective payloads for browser: ${mergedOptions.browser}`);
                const effectivePayloads = getMostEffectivePayloads(
                    mergedOptions.effectiveness.limit, 
                    mergedOptions.browser.toLowerCase()
                );

                if (effectivePayloads.length > 0) {
                    payloadsToTest = effectivePayloads.map(p => p.payload);
                    console.log(`Found ${payloadsToTest.length} effective payloads with scores:`);
                    effectivePayloads.forEach(p => {
                        console.log(`  ${p.payload}: Execution: ${(p.executionScore * 100).toFixed(1)}%, Reflection: ${(p.reflectionScore * 100).toFixed(1)}%, Tests: ${p.totalTests}`);
                    });
                } else {
                    console.log('No effectiveness data found, using default or custom payloads');
                }
            }

            // If no effective payloads or not using effectiveness, use custom or default payloads
            if (payloadsToTest.length === 0) {
                if (customPayloads) {
                    if (Array.isArray(customPayloads)) {
                        // If customPayloads is an array, use it directly
                        payloadsToTest = customPayloads;
                    } else if (typeof customPayloads === 'object') {
                        // If customPayloads is a categorized object, flatten it
                        for (const category of customPayloads) {
                            // Check if the payload is compatible with the selected browser
                            if (category.browser_compatibility && 
                                category.browser_compatibility.includes(mergedOptions.browser.toLowerCase())) {
                                payloadsToTest = payloadsToTest.concat(category.payloads);
                            }
                        }
                    }
                } else {
                    // Default payloads if none provided
                    payloadsToTest = [
                        '<script>alert(1)</script>',
                        '<img src=x onerror=alert(1)>',
                        'javascript:alert(1)'
                    ];
                }
            }
        }

        // Progress tracking variables
        const totalPayloads = payloadsToTest.length;
        let processedPayloads = 0;

        // Show initial progress if enabled
        if (mergedOptions.logging && mergedOptions.logging.showProgress) {
            console.log(`Starting XSS detection with ${totalPayloads} payloads...`);
            console.log(`Progress: 0/${totalPayloads} (0%)`);
        }

        for (const payload of payloadsToTest) {
            // Check if caching is enabled and if the result is already in the cache
            let cachedResult = null;
            let cacheKey = null;

            if (mergedOptions.cache && mergedOptions.cache.enabled) {
                cacheKey = generateCacheKey(url, inputFieldSelector, payload, mergedOptions);

                if (cacheExists(cacheKey, mergedOptions.cache.maxAge)) {
                    cachedResult = getCachedResult(cacheKey);

                    if (cachedResult && mergedOptions.cache.verbose) {
                        console.log(`Cache hit for payload: ${payload}`);
                    }
                } else if (mergedOptions.cache.verbose) {
                    console.log(`Cache miss for payload: ${payload}`);
                }
            }

            // If we have a cached result, use it instead of running the test
            if (cachedResult) {
                if (cachedResult.detected || cachedResult.executed) {
                    results.push({
                        payload,
                        reflected: cachedResult.detected,
                        executed: cachedResult.executed,
                        url,
                        timestamp: cachedResult.timestamp,
                        fromCache: true
                    });

                    console.log(`XSS detected from cache with payload: ${payload}`);
                    console.log(`  Reflected: ${cachedResult.detected}, Executed: ${cachedResult.executed}`);
                }

                // Update progress tracking
                processedPayloads++;

                // Show progress update if enabled and interval is reached
                if (mergedOptions.logging && mergedOptions.logging.showProgress && 
                    processedPayloads % mergedOptions.logging.progressUpdateInterval === 0) {
                    const progressPercent = ((processedPayloads / totalPayloads) * 100).toFixed(1);
                    console.log(`Progress: ${processedPayloads}/${totalPayloads} (${progressPercent}%)`);
                }

                continue; // Skip to the next payload
            }

            // Reset the XSS detection flag
            if (mergedOptions.verifyExecution) {
                await page.evaluate(() => {
                    window.__xssDetected = false;
                });
            }

            // Verbose logging for current payload
            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`\nTesting payload: ${payload}`);
            }

            // Determine if retry is enabled for input operations
            const shouldRetryInput = mergedOptions.retry && 
                                    mergedOptions.retry.enabled && 
                                    mergedOptions.retry.operations.includes('input');

            // Get action timeout
            const actionTimeout = mergedOptions.timeouts ? mergedOptions.timeouts.action : 10000;

            // Enter the payload into the input field with retry if enabled
            if (shouldRetryInput) {
                await retryPageOperation(
                    page, 
                    async (p) => {
                        // Set timeout for the action
                        await p.fill(inputFieldSelector, payload, { timeout: actionTimeout });
                    },
                    {
                        maxAttempts: mergedOptions.retry.maxAttempts,
                        delay: mergedOptions.retry.delay,
                        exponentialBackoff: mergedOptions.retry.exponentialBackoff,
                        onRetry: (attempt, delay, error) => {
                            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                                console.log(`  Retrying input fill (attempt ${attempt}/${mergedOptions.retry.maxAttempts}) after ${delay}ms delay. Error: ${error.message}`);
                            }
                        }
                    }
                );
            } else {
                await page.fill(inputFieldSelector, payload, { timeout: actionTimeout });
            }

            // Submit the form or trigger an event to send the input
            // Try different submission methods based on the form type
            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`  Attempting to submit the form...`);
            }

            // Determine if retry is enabled for submission operations
            const shouldRetrySubmission = mergedOptions.retry && 
                                         mergedOptions.retry.enabled && 
                                         mergedOptions.retry.operations.includes('submission');

            // Retry options for submission
            const submissionRetryOptions = shouldRetrySubmission ? {
                maxAttempts: mergedOptions.retry.maxAttempts,
                delay: mergedOptions.retry.delay,
                exponentialBackoff: mergedOptions.retry.exponentialBackoff,
                onRetry: (attempt, delay, error) => {
                    if (mergedOptions.logging && mergedOptions.logging.verbose) {
                        console.log(`  Retrying form submission (attempt ${attempt}/${mergedOptions.retry.maxAttempts}) after ${delay}ms delay. Error: ${error.message}`);
                    }
                }
            } : null;

            try {
                // Method 1: Try clicking the submit button if specified
                if (mergedOptions.submitSelector) {
                    if (shouldRetrySubmission) {
                        try {
                            await retryPageOperation(page, async (p) => {
                                const submitButton = await p.$(mergedOptions.submitSelector);
                                if (!submitButton) {
                                    throw new Error('Submit button not found');
                                }
                                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                                    console.log(`  Method 1: Clicking submit button with selector: ${mergedOptions.submitSelector}`);
                                }
                                await submitButton.click();
                            }, submissionRetryOptions);
                        } catch (error) {
                            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                                console.log(`  Method 1 failed: ${error.message}`);
                            }
                            throw error; // Re-throw to try other methods
                        }
                    } else {
                        const submitButton = await page.$(mergedOptions.submitSelector);
                        if (submitButton) {
                            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                                console.log(`  Method 1: Clicking submit button with selector: ${mergedOptions.submitSelector}`);
                            }
                            await submitButton.click();
                        } else {
                            // If submit button not found, try other methods
                            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                                console.log(`  Method 1 failed: Submit button not found with selector: ${mergedOptions.submitSelector}`);
                            }
                            throw new Error('Submit button not found');
                        }
                    }
                } else {
                    if (mergedOptions.logging && mergedOptions.logging.verbose) {
                        console.log(`  Method 1 skipped: No submit selector specified`);
                    }
                    throw new Error('No submit selector specified');
                }
            } catch (submitError) {
                try {
                    // Method 2: Try pressing Enter in the input field
                    if (mergedOptions.logging && mergedOptions.logging.verbose) {
                        console.log(`  Method 2: Pressing Enter in the input field`);
                    }

                    if (shouldRetrySubmission) {
                        await retryPageOperation(
                            page, 
                            async (p) => await p.press(inputFieldSelector, 'Enter'),
                            submissionRetryOptions
                        );
                    } else {
                        await page.press(inputFieldSelector, 'Enter');
                    }
                } catch (enterError) {
                    try {
                        // Method 3: Try submitting the form directly
                        if (mergedOptions.logging && mergedOptions.logging.verbose) {
                            console.log(`  Method 3: Submitting the form directly via JavaScript`);
                        }

                        let formSubmitted;
                        if (shouldRetrySubmission) {
                            formSubmitted = await retryPageOperation(page, async (p) => {
                                return await p.evaluate((selector) => {
                                    const input = document.querySelector(selector);
                                    if (input) {
                                        const form = input.closest('form');
                                        if (form) {
                                            form.submit();
                                            return true;
                                        }
                                    }
                                    return false;
                                }, inputFieldSelector);
                            }, submissionRetryOptions);
                        } else {
                            formSubmitted = await page.evaluate((selector) => {
                                const input = document.querySelector(selector);
                                if (input) {
                                    const form = input.closest('form');
                                    if (form) {
                                        form.submit();
                                        return true;
                                    }
                                }
                                return false;
                            }, inputFieldSelector);
                        }

                        if (mergedOptions.logging && mergedOptions.logging.verbose && !formSubmitted) {
                            console.log(`  Method 3 failed: No form found for the input`);
                        }
                    } catch (formError) {
                        // Method 4: Try triggering a change event on the input
                        if (mergedOptions.logging && mergedOptions.logging.verbose) {
                            console.log(`  Method 4: Triggering a change event on the input`);
                        }

                        let eventTriggered;
                        if (shouldRetrySubmission) {
                            eventTriggered = await retryPageOperation(page, async (p) => {
                                return await p.evaluate((selector) => {
                                    const input = document.querySelector(selector);
                                    if (input) {
                                        const event = new Event('change', { bubbles: true });
                                        input.dispatchEvent(event);
                                        return true;
                                    }
                                    return false;
                                }, inputFieldSelector);
                            }, submissionRetryOptions);
                        } else {
                            eventTriggered = await page.evaluate((selector) => {
                                const input = document.querySelector(selector);
                                if (input) {
                                    const event = new Event('change', { bubbles: true });
                                    input.dispatchEvent(event);
                                    return true;
                                }
                                return false;
                            }, inputFieldSelector);
                        }

                        if (mergedOptions.logging && mergedOptions.logging.verbose && !eventTriggered) {
                            console.log(`  Method 4 failed: Could not trigger event on the input`);
                        }
                    }
                }
            }

            // Determine if retry is enabled for navigation operations
            const shouldRetryNavigation = mergedOptions.retry && 
                                         mergedOptions.retry.enabled && 
                                         mergedOptions.retry.operations.includes('navigation');

            // Wait for navigation or timeout
            try {
                // Get appropriate timeouts
                const navigationTimeout = mergedOptions.timeouts ? mergedOptions.timeouts.navigation : 30000;
                const waitTimeout = mergedOptions.timeouts ? mergedOptions.timeouts.waitFor : 5000;

                if (shouldRetryNavigation) {
                    await retryPageOperation(page, async (p) => {
                        await Promise.race([
                            p.waitForNavigation({ timeout: navigationTimeout }),
                            p.waitForTimeout(waitTimeout)
                        ]);
                    }, {
                        maxAttempts: mergedOptions.retry.maxAttempts,
                        delay: mergedOptions.retry.delay,
                        exponentialBackoff: mergedOptions.retry.exponentialBackoff,
                        onRetry: (attempt, delay, error) => {
                            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                                console.log(`  Retrying navigation wait (attempt ${attempt}/${mergedOptions.retry.maxAttempts}) after ${delay}ms delay. Error: ${error.message}`);
                            }
                        },
                        // Don't retry timeout errors, as they're expected if no navigation occurs
                        shouldRetry: (error) => !error.message.includes('timeout')
                    });
                } else {
                    await Promise.race([
                        page.waitForNavigation({ timeout: navigationTimeout }),
                        page.waitForTimeout(waitTimeout)
                    ]);
                }
            } catch (timeoutError) {
                // Ignore timeout errors, as they're expected if no navigation occurs
            }

            let detected = false;
            let executionVerified = false;

            // Check if the payload is reflected in the page content
            const content = await page.content();
            if (content.includes(payload)) {
                detected = true;
                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                    console.log(`  Payload reflected in page content`);
                }
            } else if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`  Payload not reflected in page content`);
            }

            // Check if JavaScript was actually executed
            if (mergedOptions.verifyExecution) {
                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                    console.log(`  Checking for JavaScript execution...`);
                }

                // Get execution timeout
                const executionTimeout = mergedOptions.timeouts ? mergedOptions.timeouts.execution : 2000;

                // Wait a bit to allow for JavaScript execution
                await page.waitForTimeout(executionTimeout);

                executionVerified = await page.evaluate(() => window.__xssDetected);
                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                    console.log(`  JavaScript execution ${executionVerified ? 'detected' : 'not detected'}`);
                }
            }

            // Track payload effectiveness if enabled
            if (mergedOptions.effectiveness.track) {
                updatePayloadEffectiveness(
                    payload, 
                    detected, 
                    executionVerified, 
                    mergedOptions.browser.toLowerCase()
                );
            }

            // Record the result
            if (detected || executionVerified) {
                const result = {
                    payload,
                    reflected: detected,
                    executed: executionVerified,
                    url,
                    timestamp: new Date().toISOString()
                };

                results.push(result);
                console.log(`XSS detected with payload: ${payload}`);
                console.log(`  Reflected: ${detected}, Executed: ${executionVerified}`);

                // Cache the result if caching is enabled
                if (mergedOptions.cache && mergedOptions.cache.enabled && cacheKey) {
                    const cacheData = {
                        detected,
                        executed: executionVerified,
                        timestamp: new Date().toISOString()
                    };

                    const cached = cacheResult(cacheKey, cacheData);

                    if (mergedOptions.cache.verbose) {
                        if (cached) {
                            console.log(`  Result cached with key: ${cacheKey}`);
                        } else {
                            console.log(`  Failed to cache result with key: ${cacheKey}`);
                        }
                    }
                }
            } else if (mergedOptions.cache && mergedOptions.cache.enabled && cacheKey) {
                // Cache negative results too if caching is enabled
                const cacheData = {
                    detected: false,
                    executed: false,
                    timestamp: new Date().toISOString()
                };

                cacheResult(cacheKey, cacheData);

                if (mergedOptions.cache.verbose) {
                    console.log(`  Negative result cached with key: ${cacheKey}`);
                }
            }

            // Update progress tracking
            processedPayloads++;

            // Show progress update if enabled and interval is reached
            if (mergedOptions.logging && mergedOptions.logging.showProgress && 
                processedPayloads % mergedOptions.logging.progressUpdateInterval === 0) {
                const progressPercent = ((processedPayloads / totalPayloads) * 100).toFixed(1);
                console.log(`Progress: ${processedPayloads}/${totalPayloads} (${progressPercent}%)`);
            }

            // Additional verbose logging
            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`  Result: ${detected || executionVerified ? 'Vulnerable' : 'Not vulnerable'}`);
                if (!detected && !executionVerified) {
                    console.log(`  Reflected: ${detected}, Executed: ${executionVerified}`);
                }
            }
        }
    } catch (error) {
        console.error('Error during XSS detection:', error);
    } finally {
        // Show final progress if enabled
        if (mergedOptions.logging && mergedOptions.logging.showProgress) {
            console.log(`\nDetection completed. Processed ${processedPayloads}/${totalPayloads} payloads (100%)`);
            console.log(`Found ${results.length} vulnerabilities.`);
        }

        // Handle session saving and closing
        if (mergedOptions.session) {
            // Release the page back to the pool if available
            if (releasePage) {
                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                    console.log(`Releasing page back to the pool for session: ${mergedOptions.session.id}`);
                }
                try {
                    await releasePage();
                } catch (releaseError) {
                    console.error(`Failed to release page: ${releaseError.message}`);
                    // Try to close the page directly as a fallback
                    try {
                        await page.close();
                    } catch (closeError) {
                        console.warn(`Error closing page: ${closeError.message}`);
                    }
                }
            } else {
                // If releasePage is not available, close the page directly
                try {
                    await page.close();
                } catch (error) {
                    console.warn(`Error closing page: ${error.message}`);
                }
            }

            // Save session state if requested
            if (mergedOptions.session.save) {
                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                    console.log(`Saving session state for: ${mergedOptions.session.id}`);
                }
                await saveSessionState(mergedOptions.session.id, context);
            }

            // Close session if requested or if not reusing
            if (mergedOptions.session.closeAfter) {
                if (mergedOptions.logging && mergedOptions.logging.verbose) {
                    console.log(`Closing session: ${mergedOptions.session.id}`);
                }
                await closeSession(mergedOptions.session.id);
            } else if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`Keeping session active: ${mergedOptions.session.id}`);
            }
        } else {
            // If no session options, close the browser as before
            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log('\nClosing browser...');
            }

            // Close the page, context, and browser instance
            try {
                await page.close();
            } catch (error) {
                console.warn(`Error closing page: ${error.message}`);
            }

            try {
                await context.close();
            } catch (error) {
                console.warn(`Error closing context: ${error.message}`);
            }

            try {
                await browser.close();
            } catch (error) {
                console.warn(`Error closing browser: ${error.message}`);
            }

            // Force garbage collection if possible
            if (global.gc) {
                try {
                    global.gc();
                } catch (error) {
                    console.warn(`Error forcing garbage collection: ${error.message}`);
                }
            }

            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log('Browser closed.');
            }
        }
    }

    // Generate reports if requested
    const reportPaths = {};

    if (mergedOptions.report && mergedOptions.report.format) {
        if (mergedOptions.logging && mergedOptions.logging.verbose) {
            console.log(`\nGenerating reports in format: ${mergedOptions.report.format}`);
        }

        const { format, outputDir, filename } = mergedOptions.report;

        if (format === 'json' || format === 'both') {
            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`Generating JSON report...`);
            }

            const jsonPath = `${outputDir}/${filename}.json`;
            await generateJSONReport(results, jsonPath, mergedOptions);
            reportPaths.json = jsonPath;
            console.log(`JSON report generated at: ${jsonPath}`);
        }

        if (format === 'html' || format === 'both') {
            if (mergedOptions.logging && mergedOptions.logging.verbose) {
                console.log(`Generating HTML report...`);
            }

            const htmlPath = `${outputDir}/${filename}.html`;
            await generateHTMLReport(results, htmlPath, mergedOptions);
            reportPaths.html = htmlPath;
            console.log(`HTML report generated at: ${htmlPath}`);
        }

        if (mergedOptions.logging && mergedOptions.logging.verbose) {
            console.log(`Report generation completed.`);
        }
    } else if (mergedOptions.logging && mergedOptions.logging.verbose) {
        console.log(`\nNo reports requested. Skipping report generation.`);
    }

    return {
        results,
        reportPaths
    };
}

/**
 * Detects XSS vulnerabilities across multiple pages or inputs in parallel
 * @param {Array<Object>} testConfigs - Array of test configurations
 * @param {string} testConfigs[].url - The URL of the page to test
 * @param {string} testConfigs[].inputFieldSelector - CSS selector for the input field
 * @param {Array|Object} [testConfigs[].customPayloads] - Custom payloads to use instead of defaults
 * @param {Object} [testConfigs[].options] - Additional options for the detection (same as detectXSS)
 * @param {Object} [globalOptions] - Global options that apply to all tests
 * @param {number} [globalOptions.concurrency] - Maximum number of concurrent tests (default: 5)
 * @param {boolean} [globalOptions.stopOnFirstVulnerability] - Whether to stop testing when a vulnerability is found
 * @param {boolean} [globalOptions.shareSession] - Whether to share a session between tests
 * @param {Object} [globalOptions.cache] - Cache configuration
 * @param {boolean} [globalOptions.cache.enabled] - Whether to use caching
 * @param {number} [globalOptions.cache.maxAge] - Maximum age of cache entries in milliseconds
 * @param {boolean} [globalOptions.cache.verbose] - Whether to log cache hits and misses
 * @returns {Promise<Array<Object>>} - Array of results from each test
 */
async function detectXSSParallel(testConfigs, globalOptions = {}) {
    // Default global options
    const mergedGlobalOptions = {
        concurrency: 5,
        stopOnFirstVulnerability: false,
        shareSession: false,
        cache: {
            enabled: false,
            maxAge: 0,
            verbose: false
        },
        ...globalOptions
    };

    // If cache options are provided, merge them with defaults
    if (globalOptions.cache) {
        mergedGlobalOptions.cache = {
            ...mergedGlobalOptions.cache,
            ...globalOptions.cache
        };
    }

    // Load configuration from file
    const fileConfig = loadConfig();

    // Validate test configurations
    if (!Array.isArray(testConfigs) || testConfigs.length === 0) {
        throw new Error('testConfigs must be a non-empty array of test configurations');
    }

    // Prepare results array
    const results = [];

    // Create a shared session ID if sharing sessions
    const sharedSessionId = mergedGlobalOptions.shareSession ? `shared-session-${Date.now()}` : null;

    // Log start of parallel testing
    console.log(`Starting parallel XSS detection for ${testConfigs.length} targets with concurrency ${mergedGlobalOptions.concurrency}`);

    // Process tests in batches to control concurrency
    for (let i = 0; i < testConfigs.length; i += mergedGlobalOptions.concurrency) {
        // Get the current batch of tests
        const batch = testConfigs.slice(i, i + mergedGlobalOptions.concurrency);

        console.log(`Processing batch ${Math.floor(i / mergedGlobalOptions.concurrency) + 1}/${Math.ceil(testConfigs.length / mergedGlobalOptions.concurrency)} (${batch.length} tests)`);

        // Run the batch in parallel
        const batchPromises = batch.map(async (config, index) => {
            try {
                // Prepare options for this test
                const testOptions = { ...config.options };

                // If sharing sessions, set the session options
                if (mergedGlobalOptions.shareSession) {
                    testOptions.session = {
                        ...(testOptions.session || {}),
                        id: sharedSessionId,
                        reuse: true,
                        save: true,
                        closeAfter: false
                    };
                }

                // If caching is enabled in global options, set the cache options
                if (mergedGlobalOptions.cache && mergedGlobalOptions.cache.enabled) {
                    testOptions.cache = {
                        ...(testOptions.cache || {}),
                        enabled: mergedGlobalOptions.cache.enabled,
                        maxAge: mergedGlobalOptions.cache.maxAge,
                        verbose: mergedGlobalOptions.cache.verbose
                    };
                }

                // Add browser resource optimization options
                testOptions.browserOptions = {
                    ...(testOptions.browserOptions || {}),
                    args: [
                        '--disable-gpu',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-extensions',
                        '--disable-background-networking',
                        '--disable-default-apps',
                        '--disable-sync',
                        '--disable-translate',
                        '--hide-scrollbars',
                        '--metrics-recording-only',
                        '--mute-audio',
                        '--no-sandbox'
                    ]
                };

                // Log the current test
                console.log(`[Test ${i + index + 1}/${testConfigs.length}] Testing ${config.url} with selector ${config.inputFieldSelector}`);

                // Run the test
                const result = await detectXSS(
                    config.url,
                    config.inputFieldSelector,
                    config.customPayloads || null,
                    testOptions
                );

                // Add test info to the result
                result.testInfo = {
                    index: i + index,
                    url: config.url,
                    inputFieldSelector: config.inputFieldSelector
                };

                // Check if we should stop on first vulnerability
                if (mergedGlobalOptions.stopOnFirstVulnerability && result.results.length > 0) {
                    console.log(`Vulnerability found in test ${i + index + 1}. Stopping further tests.`);
                    return { result, stopTesting: true };
                }

                return { result, stopTesting: false };
            } catch (error) {
                console.error(`Error in test ${i + index + 1}:`, error);
                return { 
                    result: { 
                        results: [], 
                        reportPaths: {},
                        error: error.message,
                        testInfo: {
                            index: i + index,
                            url: config.url,
                            inputFieldSelector: config.inputFieldSelector
                        }
                    }, 
                    stopTesting: false 
                };
            }
        });

        // Wait for all tests in the batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Process the results
        for (const { result, stopTesting } of batchResults) {
            results.push(result);

            // If we should stop testing, break out of the loop
            if (stopTesting) {
                break;
            }
        }

        // If we should stop testing, break out of the loop
        if (batchResults.some(r => r.stopTesting)) {
            break;
        }
    }

    // Close the shared session if it was used
    if (mergedGlobalOptions.shareSession && sharedSessionId) {
        console.log(`Closing shared session: ${sharedSessionId}`);
        try {
            await closeSession(sharedSessionId);
        } catch (error) {
            console.error(`Error closing shared session: ${error.message}`);
        }
    }

    // Log completion
    console.log(`Parallel XSS detection completed. Tested ${results.length}/${testConfigs.length} targets.`);

    // Count total vulnerabilities found
    const totalVulnerabilities = results.reduce((total, result) => total + (result.results ? result.results.length : 0), 0);
    console.log(`Found ${totalVulnerabilities} vulnerabilities in total.`);

    return results;
}

// Usage examples:
// detectXSS('http://example.com', '#search-input', null, { browser: 'firefox', verifyExecution: true });
// 
// detectXSSParallel([
//   { url: 'http://example.com/page1', inputFieldSelector: '#search' },
//   { url: 'http://example.com/page2', inputFieldSelector: 'input[name="q"]' }
// ], { concurrency: 2 });

module.exports = { detectXSS, detectXSSParallel };

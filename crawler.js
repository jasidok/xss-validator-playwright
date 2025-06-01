const { chromium, firefox, webkit } = require('playwright');

/**
 * Crawls a website to discover testable input fields
 * @param {string} url - The starting URL to crawl
 * @param {Object} options - Crawling options
 * @param {string} options.browser - Browser to use ('chromium', 'firefox', 'webkit')
 * @param {number} options.maxDepth - Maximum crawl depth
 * @param {number} options.maxPages - Maximum number of pages to crawl
 * @param {Array} options.excludePatterns - URL patterns to exclude
 * @param {boolean} options.stayOnDomain - Whether to stay on the same domain
 * @param {boolean} options.followExternalLinks - Whether to follow external links
 * @param {Object} options.auth - Authentication configuration
 * @returns {Promise<Array>} - Array of discovered input fields with their URLs and selectors
 */
async function crawlWebsite(url, options = {}) {
    // Default options
    const defaultOptions = {
        browser: 'chromium',
        maxDepth: 3,
        maxPages: 50,
        excludePatterns: [],
        stayOnDomain: true,
        followExternalLinks: false,
        auth: null
    };

    // Merge options
    const mergedOptions = { ...defaultOptions, ...options };

    // Select the browser based on the option
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

    // Launch browser and open a new page
    const browser = await browserType.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set up authentication if provided
    if (mergedOptions.auth) {
        try {
            await page.goto(mergedOptions.auth.url);
            await page.fill(mergedOptions.auth.usernameSelector, mergedOptions.auth.username);
            await page.fill(mergedOptions.auth.passwordSelector, mergedOptions.auth.password);
            await page.click(mergedOptions.auth.submitSelector);
            await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
            console.log('Authentication successful');
        } catch (error) {
            console.error('Authentication failed:', error);
        }
    }

    // Extract domain from URL for same-domain check
    const urlObj = new URL(url);
    const baseDomain = urlObj.hostname;

    // Set to track visited URLs
    const visited = new Set();
    
    // Array to store discovered input fields
    const inputFields = [];
    
    // Queue of pages to visit with their depth
    const queue = [{ url, depth: 0 }];
    
    // Counter for visited pages
    let visitedCount = 0;

    // Process queue until empty or limits reached
    while (queue.length > 0 && visitedCount < mergedOptions.maxPages) {
        // Get next URL from queue
        const { url: currentUrl, depth } = queue.shift();
        
        // Skip if already visited or exceeds max depth
        if (visited.has(currentUrl) || depth > mergedOptions.maxDepth) {
            continue;
        }
        
        // Mark as visited
        visited.add(currentUrl);
        visitedCount++;
        
        console.log(`Crawling (${visitedCount}/${mergedOptions.maxPages}): ${currentUrl}`);
        
        try {
            // Navigate to the URL
            await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
            
            // Find all input fields on the page
            const inputs = await discoverInputFields(page);
            
            // Add discovered inputs to the result array
            for (const input of inputs) {
                inputFields.push({
                    url: currentUrl,
                    ...input
                });
            }
            
            // If we've reached max depth, don't collect more links
            if (depth >= mergedOptions.maxDepth) {
                continue;
            }
            
            // Find all links on the page
            const links = await page.$$eval('a[href]', anchors => 
                anchors.map(a => a.href)
            );
            
            // Process each link
            for (const link of links) {
                try {
                    // Skip if it's not a web URL
                    if (!link.startsWith('http')) {
                        continue;
                    }
                    
                    // Check if we should exclude this URL
                    if (mergedOptions.excludePatterns.some(pattern => link.includes(pattern))) {
                        continue;
                    }
                    
                    // Check if we should stay on the same domain
                    if (mergedOptions.stayOnDomain) {
                        const linkObj = new URL(link);
                        if (linkObj.hostname !== baseDomain) {
                            // Skip if not on the same domain and we're not following external links
                            if (!mergedOptions.followExternalLinks) {
                                continue;
                            }
                        }
                    }
                    
                    // Add to queue if not visited
                    if (!visited.has(link)) {
                        queue.push({ url: link, depth: depth + 1 });
                    }
                } catch (error) {
                    console.error(`Error processing link ${link}:`, error);
                }
            }
        } catch (error) {
            console.error(`Error crawling ${currentUrl}:`, error);
        }
    }
    
    // Close browser
    await browser.close();
    
    console.log(`Crawling completed. Visited ${visitedCount} pages and found ${inputFields.length} input fields.`);
    
    return inputFields;
}

/**
 * Discovers input fields on a page
 * @param {Object} page - Playwright page object
 * @returns {Promise<Array>} - Array of discovered input fields with their selectors and types
 */
async function discoverInputFields(page) {
    // Find all input elements, textareas, and contenteditable elements
    const inputElements = await page.$$eval(
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, [contenteditable="true"]',
        elements => elements.map(el => {
            // Get a unique selector for this element
            function getUniqueSelector(element) {
                // Try id first
                if (element.id) {
                    return `#${element.id}`;
                }
                
                // Try name attribute
                if (element.name) {
                    const nameSelector = `[name="${element.name}"]`;
                    // Check if it's unique
                    if (document.querySelectorAll(nameSelector).length === 1) {
                        return nameSelector;
                    }
                }
                
                // Try to build a selector with classes
                if (element.className && typeof element.className === 'string') {
                    const classes = element.className.trim().split(/\s+/);
                    if (classes.length > 0) {
                        const classSelector = `.${classes.join('.')}`;
                        // Check if it's unique
                        if (document.querySelectorAll(classSelector).length === 1) {
                            return classSelector;
                        }
                    }
                }
                
                // Fallback to a more complex selector
                const tagName = element.tagName.toLowerCase();
                let selector = tagName;
                
                // Add parent information if needed
                let current = element;
                let depth = 0;
                const maxDepth = 3; // Limit depth to avoid overly complex selectors
                
                while (document.querySelectorAll(selector).length > 1 && depth < maxDepth) {
                    const parent = current.parentElement;
                    if (!parent) break;
                    
                    let parentSelector = parent.tagName.toLowerCase();
                    if (parent.id) {
                        parentSelector = `#${parent.id}`;
                    } else if (parent.className && typeof parent.className === 'string') {
                        const classes = parent.className.trim().split(/\s+/);
                        if (classes.length > 0) {
                            parentSelector = `.${classes.join('.')}`;
                        }
                    }
                    
                    selector = `${parentSelector} > ${selector}`;
                    current = parent;
                    depth++;
                }
                
                return selector;
            }
            
            // Get element type
            let type = el.tagName.toLowerCase();
            if (type === 'input') {
                type = el.type || 'text';
            } else if (el.hasAttribute('contenteditable')) {
                type = 'contenteditable';
            }
            
            // Get form information if available
            let formSelector = null;
            let submitSelector = null;
            
            if (el.form) {
                // Try to get a selector for the form
                if (el.form.id) {
                    formSelector = `#${el.form.id}`;
                } else if (el.form.className && typeof el.form.className === 'string') {
                    const classes = el.form.className.trim().split(/\s+/);
                    if (classes.length > 0) {
                        formSelector = `.${classes.join('.')}`;
                    }
                } else {
                    formSelector = 'form';
                }
                
                // Try to find a submit button
                const submitButton = el.form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
                if (submitButton) {
                    submitSelector = getUniqueSelector(submitButton);
                }
            }
            
            return {
                selector: getUniqueSelector(el),
                type,
                formSelector,
                submitSelector,
                isVisible: el.offsetParent !== null, // Check if element is visible
                attributes: {
                    id: el.id || null,
                    name: el.name || null,
                    placeholder: el.placeholder || null
                }
            };
        })
    );
    
    // Filter out invisible elements
    return inputElements.filter(input => input.isVisible);
}

/**
 * Tests discovered input fields for XSS vulnerabilities
 * @param {Array} inputFields - Array of discovered input fields
 * @param {Function} testFunction - Function to test each input field
 * @param {Object} options - Options for testing
 * @returns {Promise<Array>} - Array of test results
 */
async function testDiscoveredInputs(inputFields, testFunction, options = {}) {
    const results = [];
    
    for (let i = 0; i < inputFields.length; i++) {
        const input = inputFields[i];
        console.log(`Testing input ${i + 1}/${inputFields.length}: ${input.url} - ${input.selector}`);
        
        try {
            // Use the provided test function (e.g., detectXSS)
            const testOptions = {
                ...options,
                submitSelector: input.submitSelector
            };
            
            const result = await testFunction(input.url, input.selector, null, testOptions);
            
            results.push({
                input,
                result
            });
        } catch (error) {
            console.error(`Error testing input ${input.url} - ${input.selector}:`, error);
            results.push({
                input,
                error: error.message
            });
        }
    }
    
    return results;
}

module.exports = {
    crawlWebsite,
    discoverInputFields,
    testDiscoveredInputs
};
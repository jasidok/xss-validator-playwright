/**
 * Smart payload selection module for XSS Validator
 * This module provides functions for selecting the most effective payloads
 * based on context, browser, and historical effectiveness data.
 */

const fs = require('fs');
const path = require('path');
const { CONTEXT_TYPES, ATTRIBUTE_TYPES, generatePayloads } = require('./generator');
const { getPayloadEffectiveness } = require('./effectiveness');

// Load categorized payloads
const CATEGORIZED_PAYLOADS_PATH = path.join(__dirname, 'categorized.json');
let categorizedPayloads = [];
try {
  if (fs.existsSync(CATEGORIZED_PAYLOADS_PATH)) {
    const fileContent = fs.readFileSync(CATEGORIZED_PAYLOADS_PATH, 'utf8');
    try {
      categorizedPayloads = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('Error parsing categorized payloads JSON:', parseError);
      console.error('This is likely due to invalid JSON syntax in the categorized.json file.');
      // Continue with empty categorizedPayloads array
    }
  }
} catch (error) {
  console.error('Error reading categorized payloads file:', error);
}

/**
 * Analyzes a URL to determine the most likely context for XSS
 * @param {string} url - The URL to analyze
 * @returns {string} - The most likely context type
 */
function analyzeUrlForContext(url) {
  // Check for URL parameters that might indicate specific contexts
  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  // Check for JavaScript-related parameters
  const jsParams = ['callback', 'jsonp', 'function', 'js', 'script'];
  for (const param of jsParams) {
    if (params.has(param)) {
      return CONTEXT_TYPES.JS;
    }
  }

  // Check for URL-related parameters
  const urlParams = ['url', 'redirect', 'return', 'next', 'target', 'path', 'goto'];
  for (const param of urlParams) {
    if (params.has(param)) {
      return CONTEXT_TYPES.URL;
    }
  }

  // Check for CSS-related parameters
  const cssParams = ['style', 'css', 'theme', 'color'];
  for (const param of cssParams) {
    if (params.has(param)) {
      return CONTEXT_TYPES.CSS;
    }
  }

  // Default to HTML context
  return CONTEXT_TYPES.HTML;
}

/**
 * Analyzes page content to determine the most likely context for XSS
 * @param {string} content - The page content to analyze
 * @param {string} inputFieldSelector - The selector for the input field
 * @returns {Object} - The most likely context type and attribute type if applicable
 */
async function analyzePageForContext(page, inputFieldSelector) {
  try {
    // Validate inputs
    if (!page) {
      console.error('Error: Page object is null or undefined');
      return { contextType: CONTEXT_TYPES.HTML };
    }

    if (!inputFieldSelector) {
      console.error('Error: Input field selector is null or undefined');
      return { contextType: CONTEXT_TYPES.HTML };
    }

    // Get the input field element
    let inputField;
    try {
      inputField = await page.$(inputFieldSelector);
    } catch (selectorError) {
      console.error(`Error finding input field with selector "${inputFieldSelector}":`, selectorError);
      return { contextType: CONTEXT_TYPES.HTML };
    }

    if (!inputField) {
      console.warn(`Input field not found with selector: ${inputFieldSelector}`);
      return { contextType: CONTEXT_TYPES.HTML };
    }

    // Check if the input field is inside a script tag
    let isInScript;
    try {
      isInScript = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return false;

        let parent = element.parentElement;
        while (parent) {
          if (parent.tagName === 'SCRIPT') {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      }, inputFieldSelector);
    } catch (scriptError) {
      console.error('Error checking if input is in script tag:', scriptError);
      isInScript = false;
    }

    if (isInScript) {
      return { contextType: CONTEXT_TYPES.JS };
    }

    // Check if the input field is inside a style tag
    let isInStyle;
    try {
      isInStyle = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return false;

        let parent = element.parentElement;
        while (parent) {
          if (parent.tagName === 'STYLE') {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      }, inputFieldSelector);
    } catch (styleError) {
      console.error('Error checking if input is in style tag:', styleError);
      isInStyle = false;
    }

    if (isInStyle) {
      return { contextType: CONTEXT_TYPES.CSS };
    }

    // Check if the input field is an attribute value
    let attributeInfo;
    try {
      attributeInfo = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return null;

        // Check if the element has any attributes
        if (element.attributes.length > 0) {
          // Check for event handler attributes
          for (const attr of element.attributes) {
            if (attr.name.startsWith('on')) {
              return { isAttribute: true, type: 'event-handler' };
            }
          }

          // Check for other attributes
          return { isAttribute: true, type: 'attribute' };
        }

        return { isAttribute: false };
      }, inputFieldSelector);
    } catch (attrError) {
      console.error('Error checking input attributes:', attrError);
      attributeInfo = null;
    }

    if (attributeInfo && attributeInfo.isAttribute) {
      if (attributeInfo.type === 'event-handler') {
        return { 
          contextType: CONTEXT_TYPES.ATTRIBUTE, 
          attributeType: ATTRIBUTE_TYPES.EVENT_HANDLER 
        };
      } else {
        // Default to unquoted attribute
        return { 
          contextType: CONTEXT_TYPES.ATTRIBUTE, 
          attributeType: ATTRIBUTE_TYPES.UNQUOTED 
        };
      }
    }

    // Check if the input field is used in a URL
    let isInUrl;
    try {
      isInUrl = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return false;

        // Check if the element is an anchor or has href attribute
        return element.tagName === 'A' || element.hasAttribute('href') || 
               element.hasAttribute('src') || element.hasAttribute('action');
      }, inputFieldSelector);
    } catch (urlError) {
      console.error('Error checking if input is in URL context:', urlError);
      isInUrl = false;
    }

    if (isInUrl) {
      return { contextType: CONTEXT_TYPES.URL };
    }

    // Default to HTML context
    return { contextType: CONTEXT_TYPES.HTML };
  } catch (error) {
    console.error('Error analyzing page for context:', error);
    return { contextType: CONTEXT_TYPES.HTML };
  }
}

/**
 * Selects the most effective payloads based on context and browser
 * @param {Object} options - Options for payload selection
 * @param {string} options.url - The URL of the page to test
 * @param {Object} options.page - The Playwright page object
 * @param {string} options.inputFieldSelector - The selector for the input field
 * @param {string} options.browser - The browser being used
 * @param {number} options.limit - Maximum number of payloads to return
 * @param {boolean} options.useEffectiveness - Whether to use effectiveness data
 * @param {Array|Object} options.customPayloads - Custom payloads to include
 * @returns {Promise<Array>} - Array of selected payloads
 */
async function selectSmartPayloads(options) {
  const {
    url,
    page,
    inputFieldSelector,
    browser = 'chromium',
    limit = 10,
    useEffectiveness = true,
    customPayloads = null
  } = options;

  // Step 1: Analyze the context
  const urlContext = analyzeUrlForContext(url);
  const pageContext = await analyzePageForContext(page, inputFieldSelector);

  // Use page context if available, otherwise use URL context
  const contextType = pageContext.contextType || urlContext;
  const attributeType = pageContext.attributeType || ATTRIBUTE_TYPES.UNQUOTED;

  console.log(`Smart payload selection: Detected context ${contextType}${
    contextType === CONTEXT_TYPES.ATTRIBUTE ? ` (${attributeType})` : ''
  }`);

  // Step 2: Get payloads for the detected context
  let contextPayloads = [];

  // First try to get payloads from categorized.json
  for (const category of categorizedPayloads) {
    // Check if the category is relevant to the context
    const isRelevant = 
      (contextType === CONTEXT_TYPES.HTML && category.category === 'Basic') ||
      (contextType === CONTEXT_TYPES.ATTRIBUTE && category.category === 'AttributeBreaking') ||
      (contextType === CONTEXT_TYPES.JS && category.category === 'JavaScript_Context') ||
      (contextType === CONTEXT_TYPES.URL && category.category === 'URL_Context') ||
      (contextType === CONTEXT_TYPES.CSS && category.category === 'CSS_Context') ||
      (contextType === CONTEXT_TYPES.ATTRIBUTE && attributeType === ATTRIBUTE_TYPES.EVENT_HANDLER && 
       category.category === 'EventHandlers');

    // Check if the category is compatible with the browser
    const isCompatible = !category.browser_compatibility || 
                         category.browser_compatibility.includes(browser.toLowerCase());

    if (isRelevant && isCompatible) {
      contextPayloads = contextPayloads.concat(category.payloads);
    }
  }

  // If no payloads found in categorized.json, generate them
  if (contextPayloads.length === 0) {
    if (contextType === CONTEXT_TYPES.ATTRIBUTE) {
      contextPayloads = generatePayloads(contextType, { attributeType });
    } else {
      contextPayloads = generatePayloads(contextType);
    }
  }

  // Step 3: Add browser-specific payloads
  for (const category of categorizedPayloads) {
    if (category.browser_compatibility && 
        category.browser_compatibility.length === 1 && 
        category.browser_compatibility[0] === browser.toLowerCase()) {
      contextPayloads = contextPayloads.concat(category.payloads);
    }
  }

  // Step 4: Add custom payloads if provided
  if (customPayloads) {
    if (Array.isArray(customPayloads)) {
      contextPayloads = contextPayloads.concat(customPayloads);
    } else if (typeof customPayloads === 'object') {
      for (const category of customPayloads) {
        if (!category.browser_compatibility || 
            category.browser_compatibility.includes(browser.toLowerCase())) {
          contextPayloads = contextPayloads.concat(category.payloads);
        }
      }
    }
  }

  // Step 5: Remove duplicates
  contextPayloads = [...new Set(contextPayloads)];

  // Step 6: Sort by effectiveness if enabled
  if (useEffectiveness) {
    const payloadsWithScores = contextPayloads.map(payload => {
      const effectiveness = getPayloadEffectiveness(payload, browser.toLowerCase());
      return {
        payload,
        ...effectiveness
      };
    });

    // Sort by execution score (primary) and reflection score (secondary)
    payloadsWithScores.sort((a, b) => {
      if (b.executionScore !== a.executionScore) {
        return b.executionScore - a.executionScore;
      }
      return b.reflectionScore - a.reflectionScore;
    });

    // Extract just the payloads
    contextPayloads = payloadsWithScores.map(p => p.payload);
  }

  // Step 7: Ensure diversity by including at least one payload from each major category
  const ensureDiversity = (payloads, limit) => {
    const categories = {
      script: false,
      img: false,
      svg: false,
      iframe: false,
      event: false,
      attribute: false,
      url: false
    };

    const result = [];

    // First pass: add one payload from each major category
    for (const payload of payloads) {
      if (result.length >= limit) break;

      if (payload.includes('<script') && !categories.script) {
        result.push(payload);
        categories.script = true;
      } else if (payload.includes('<img') && !categories.img) {
        result.push(payload);
        categories.img = true;
      } else if (payload.includes('<svg') && !categories.svg) {
        result.push(payload);
        categories.svg = true;
      } else if (payload.includes('<iframe') && !categories.iframe) {
        result.push(payload);
        categories.iframe = true;
      } else if ((payload.includes('onload') || payload.includes('onerror') || 
                 payload.includes('onclick') || payload.includes('onmouseover')) && 
                 !categories.event) {
        result.push(payload);
        categories.event = true;
      } else if ((payload.includes('"') || payload.includes("'")) && !categories.attribute) {
        result.push(payload);
        categories.attribute = true;
      } else if ((payload.includes('javascript:') || payload.includes('data:')) && !categories.url) {
        result.push(payload);
        categories.url = true;
      }
    }

    // Second pass: add remaining payloads up to the limit
    for (const payload of payloads) {
      if (result.length >= limit) break;
      if (!result.includes(payload)) {
        result.push(payload);
      }
    }

    return result;
  };

  // Apply diversity algorithm
  const diversePayloads = ensureDiversity(contextPayloads, limit);

  // If we still don't have enough payloads, add some from other contexts
  if (diversePayloads.length < limit) {
    const otherContexts = Object.values(CONTEXT_TYPES).filter(c => c !== contextType);
    let additionalPayloads = [];

    for (const otherContext of otherContexts) {
      if (diversePayloads.length + additionalPayloads.length >= limit) break;

      const otherPayloads = generatePayloads(otherContext);
      additionalPayloads = additionalPayloads.concat(otherPayloads);
    }

    // Add additional payloads up to the limit
    for (const payload of additionalPayloads) {
      if (diversePayloads.length >= limit) break;
      if (!diversePayloads.includes(payload)) {
        diversePayloads.push(payload);
      }
    }
  }

  console.log(`Smart payload selection: Selected ${diversePayloads.length} payloads for context ${contextType}`);

  return diversePayloads.slice(0, limit);
}

module.exports = {
  analyzeUrlForContext,
  analyzePageForContext,
  selectSmartPayloads
};

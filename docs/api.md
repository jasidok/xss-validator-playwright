# XSS Validator API Documentation

This document provides detailed information about the XSS Validator API, including functions, parameters, and usage examples.

## Table of Contents

1. [Core Functions](#core-functions)
   - [detectXSS](#detectxss)
   - [detectXSSParallel](#detectxssparallel)
2. [Configuration Options](#configuration-options)
   - [Browser Options](#browser-options)
   - [Session Options](#session-options)
   - [Cache Options](#cache-options)
   - [Logging Options](#logging-options)
   - [Timeout Options](#timeout-options)
   - [Retry Options](#retry-options)
   - [Effectiveness Options](#effectiveness-options)
   - [Smart Payload Selection Options](#smart-payload-selection-options)
   - [Report Options](#report-options)
3. [Payload Management](#payload-management)
   - [Custom Payloads](#custom-payloads)
   - [Categorized Payloads](#categorized-payloads)
   - [Payload Effectiveness](#payload-effectiveness)
   - [Smart Payload Selection](#smart-payload-selection)
4. [Authentication](#authentication)
5. [Session Management](#session-management)
6. [Reporting](#reporting)

## Core Functions

### detectXSS

Detects XSS vulnerabilities in a web page by testing various payloads.

```javascript
const { detectXSS } = require('xss-validator');

async function runTest() {
  const result = await detectXSS(
    'https://example.com/search',
    '#search-input',
    null,
    {
      browser: 'chromium',
      verifyExecution: true,
      smartPayloadSelection: {
        enabled: true,
        limit: 10
      },
      report: {
        format: 'html',
        outputDir: './reports',
        filename: 'xss-report'
      }
    }
  );
  
  console.log(`Found ${result.results.length} vulnerabilities`);
}
```

#### Parameters

- `url` (string, required): The URL of the page to test
- `inputFieldSelector` (string, required): CSS selector for the input field
- `customPayloads` (Array|Object, optional): Custom payloads to use instead of defaults
- `options` (Object, optional): Additional options for the detection

#### Return Value

Returns a Promise that resolves to an object containing:
- `results`: Array of detected vulnerabilities
- `reportPaths`: Object with paths to generated reports

### detectXSSParallel

Detects XSS vulnerabilities across multiple pages or inputs in parallel.

```javascript
const { detectXSSParallel } = require('xss-validator');

async function runParallelTests() {
  const results = await detectXSSParallel([
    {
      url: 'https://example.com/page1',
      inputFieldSelector: '#search',
      options: {
        browser: 'chromium',
        verifyExecution: true
      }
    },
    {
      url: 'https://example.com/page2',
      inputFieldSelector: 'input[name="q"]',
      options: {
        browser: 'firefox',
        verifyExecution: true
      }
    }
  ], {
    concurrency: 2,
    stopOnFirstVulnerability: true,
    shareSession: true
  });
  
  console.log(`Tested ${results.length} targets`);
}
```

#### Parameters

- `testConfigs` (Array, required): Array of test configurations
  - `url` (string, required): The URL of the page to test
  - `inputFieldSelector` (string, required): CSS selector for the input field
  - `customPayloads` (Array|Object, optional): Custom payloads to use
  - `options` (Object, optional): Options for this specific test
- `globalOptions` (Object, optional): Global options that apply to all tests
  - `concurrency` (number, optional): Maximum number of concurrent tests (default: 5)
  - `stopOnFirstVulnerability` (boolean, optional): Whether to stop testing when a vulnerability is found
  - `shareSession` (boolean, optional): Whether to share a session between tests
  - `cache` (Object, optional): Cache configuration

#### Return Value

Returns a Promise that resolves to an array of results from each test.

## Configuration Options

### Browser Options

Options for controlling browser behavior:

```javascript
{
  browser: 'chromium', // 'chromium', 'firefox', or 'webkit'
  browserOptions: {
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox'
      // Other Chromium/Firefox/WebKit launch arguments
    ],
    headless: true
  },
  verifyExecution: true // Whether to verify JavaScript execution
}
```

### Session Options

Options for session management:

```javascript
{
  session: {
    id: 'my-session', // Session ID (if not provided, a new one will be created)
    reuse: true, // Whether to reuse an existing session if available
    save: true, // Whether to save the session state after testing
    closeAfter: false // Whether to close the session after testing
  }
}
```

### Cache Options

Options for caching test results:

```javascript
{
  cache: {
    enabled: true, // Whether to use caching
    maxAge: 3600000, // Maximum age of cache entries in milliseconds (1 hour)
    verbose: true // Whether to log cache hits and misses
  }
}
```

### Logging Options

Options for controlling logging behavior:

```javascript
{
  logging: {
    verbose: true, // Whether to log detailed information
    showProgress: true, // Whether to show progress updates
    progressUpdateInterval: 5 // Update progress every N payloads
  }
}
```

### Timeout Options

Options for controlling timeouts:

```javascript
{
  timeouts: {
    navigation: 30000, // Navigation timeout in milliseconds
    action: 10000, // Action timeout in milliseconds
    waitFor: 5000, // Wait timeout in milliseconds
    execution: 2000 // JavaScript execution verification timeout in milliseconds
  }
}
```

### Retry Options

Options for retrying operations:

```javascript
{
  retry: {
    enabled: true, // Whether to enable retries
    maxAttempts: 3, // Maximum number of retry attempts
    delay: 1000, // Delay between retries in milliseconds
    exponentialBackoff: true, // Whether to use exponential backoff
    operations: ['input', 'submission', 'navigation'] // Operations to retry
  }
}
```

### Effectiveness Options

Options for tracking and using payload effectiveness:

```javascript
{
  effectiveness: {
    track: true, // Whether to track payload effectiveness
    useEffectivePayloads: true, // Whether to use the most effective payloads
    limit: 10 // Maximum number of effective payloads to use
  }
}
```

### Smart Payload Selection Options

Options for smart payload selection:

```javascript
{
  smartPayloadSelection: {
    enabled: true, // Whether to enable smart payload selection
    limit: 10 // Maximum number of payloads to select
  }
}
```

### Report Options

Options for generating reports:

```javascript
{
  report: {
    format: 'both', // 'json', 'html', or 'both'
    outputDir: './reports', // Directory to save reports
    filename: 'xss-report' // Base filename for reports (without extension)
  }
}
```

## Payload Management

### Custom Payloads

You can provide custom payloads as an array:

```javascript
const customPayloads = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>'
];

await detectXSS('https://example.com', '#input', customPayloads);
```

### Categorized Payloads

You can also provide categorized payloads as an object:

```javascript
const categorizedPayloads = [
  {
    category: 'Basic',
    description: 'Simple XSS payloads',
    browser_compatibility: ['chromium', 'firefox', 'webkit'],
    payloads: [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>'
    ]
  },
  {
    category: 'AttributeBreaking',
    description: 'Payloads for breaking out of attributes',
    browser_compatibility: ['chromium', 'firefox'],
    payloads: [
      '"><script>alert(1)</script>',
      "' onclick='alert(1)'"
    ]
  }
];

await detectXSS('https://example.com', '#input', categorizedPayloads);
```

### Payload Effectiveness

The tool tracks the effectiveness of payloads based on:
- Reflection: Whether the payload is reflected in the page
- Execution: Whether the payload is actually executed

This data is used to prioritize payloads in future tests when `useEffectivePayloads` is enabled.

### Smart Payload Selection

Smart payload selection analyzes the target URL and page content to determine the most likely context for XSS (HTML, attribute, JavaScript, URL, CSS) and selects the most appropriate payloads for that context.

To enable smart payload selection:

```javascript
await detectXSS('https://example.com', '#input', null, {
  smartPayloadSelection: {
    enabled: true,
    limit: 10
  }
});
```

## Authentication

You can test protected pages by providing authentication options:

```javascript
await detectXSS('https://example.com/protected', '#input', null, {
  auth: {
    url: 'https://example.com/login',
    usernameSelector: '#username',
    passwordSelector: '#password',
    submitSelector: '#login-button',
    username: 'testuser',
    password: 'testpassword',
    isLoggedInCheck: async (page) => {
      return await page.isVisible('#logout-button');
    }
  }
});
```

## Session Management

The tool provides session management to maintain state between requests:

```javascript
// First test with session saving
const result1 = await detectXSS('https://example.com/page1', '#input', null, {
  session: {
    id: 'my-session',
    save: true,
    closeAfter: false
  }
});

// Second test reusing the session
const result2 = await detectXSS('https://example.com/page2', '#input', null, {
  session: {
    id: 'my-session',
    reuse: true,
    save: true,
    closeAfter: true
  }
});
```

## Reporting

The tool can generate detailed reports in JSON and HTML formats:

```javascript
await detectXSS('https://example.com', '#input', null, {
  report: {
    format: 'both', // 'json', 'html', or 'both'
    outputDir: './reports',
    filename: 'xss-report'
  }
});
```

The reports include:
- Vulnerability details (payload, reflection, execution)
- Test configuration
- Timestamp
- URL and input field information
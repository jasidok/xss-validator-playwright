# XSS Validator Troubleshooting Guide

This guide provides solutions for common issues you might encounter when using the XSS Validator tool.

## Table of Contents
- [Installation Issues](#installation-issues)
- [Browser Automation Issues](#browser-automation-issues)
- [Detection Issues](#detection-issues)
- [Performance Issues](#performance-issues)
- [Authentication Issues](#authentication-issues)
- [Session Handling Issues](#session-handling-issues)
- [Reporting Issues](#reporting-issues)
- [Common Error Messages](#common-error-messages)

## Installation Issues

### Node.js Version Compatibility

**Issue**: Error messages about unsupported Node.js version.

**Solution**: 
- Ensure you're using Node.js version 18 or higher as required by Playwright v1.52.0
- Check your Node.js version with: `node --version`
- If needed, upgrade Node.js using a version manager like nvm:
  ```bash
  nvm install 18
  nvm use 18
  ```

### Playwright Browser Installation Failures

**Issue**: Errors when installing Playwright browsers.

**Solution**:

- Use the built-in setup command:
  ```bash
  xss-validator setup
  ```
- Or check browser status first:
  ```bash
  xss-validator setup --check
  ```
- Install specific browsers:
  ```bash
  xss-validator setup --install chromium
  xss-validator setup --install firefox
  xss-validator setup --install webkit
  xss-validator setup --install all
  ```
- Force reinstallation if needed:
  ```bash
  xss-validator setup --install chromium --force
  ```
- Try running the browser installation with elevated privileges:
  ```bash
  sudo npx playwright install
  ```
- Alternative installation methods:
  ```bash
  npm run setup              # Install all browsers
  npm run setup:chromium     # Install Chromium only
  npm run setup:firefox      # Install Firefox only
  npm run setup:webkit       # Install WebKit only
  ```
- If on Linux, ensure you have the necessary dependencies:
  ```bash
  sudo apt-get install libgbm-dev libxkbcommon-x11-0 libgtk-3-0 libasound2
  ```
- Check your network connection and proxy settings if downloads fail

### Automatic Browser Installation

The tool now automatically installs Playwright browsers during npm install. You can control this behavior:

- **Skip automatic installation**: Set environment variable `SKIP_BROWSER_INSTALL=true`
- **Install specific browsers**: Set environment variable `BROWSERS=chromium,firefox`
- **CI/CD environments**: The installation is automatically skipped in CI environments

## Browser Automation Issues

### Browser Fails to Launch

**Issue**: Error messages like "Browser failed to launch" or "Timeout waiting for browser to launch".

**Solution**:
- Try running with the `--no-sandbox` flag (already included in the default configuration)
- Ensure you have sufficient system resources (memory, disk space)
- Check if another instance of the browser is already running
- Try a different browser engine (Firefox or WebKit instead of Chromium)

### Element Not Found

**Issue**: Errors like "Element not found" or "Timeout waiting for selector".

**Solution**:
- Verify the selector is correct using browser developer tools
- Increase the timeout values:
  ```javascript
  const options = {
    timeouts: {
      navigation: 60000,  // 60 seconds
      action: 30000,      // 30 seconds
      waitFor: 10000      // 10 seconds
    }
  };
  ```
- Use the retry mechanism:
  ```javascript
  const options = {
    retry: {
      enabled: true,
      maxAttempts: 3,
      delay: 1000,
      operations: ['input', 'submission', 'navigation']
    }
  };
  ```

## Detection Issues

### False Negatives (Missing Vulnerabilities)

**Issue**: The tool doesn't detect known XSS vulnerabilities.

**Solution**:
- Enable JavaScript execution verification:
  ```javascript
  const options = { verifyExecution: true };
  ```
- Try different payload sets or create custom payloads for the specific context
- Increase the execution timeout to allow more time for DOM manipulation:
  ```javascript
  const options = { timeouts: { execution: 5000 } };
  ```
- Check if the page uses a Content Security Policy (CSP) that blocks script execution

### False Positives (Incorrect Detections)

**Issue**: The tool reports vulnerabilities that don't actually exist.

**Solution**:
- Verify the results manually by checking if the payload is actually executed
- Disable reflection-only detection and rely on execution verification:
  ```javascript
  const options = { 
    verifyExecution: true,
    requireExecution: true  // Only report vulnerabilities if execution is verified
  };
  ```

## Performance Issues

### Slow Execution

**Issue**: Tests take too long to complete.

**Solution**:
- Enable caching to avoid redundant tests:
  ```javascript
  const options = {
    cache: {
      enabled: true,
      maxAge: 3600000  // 1 hour
    }
  };
  ```
- Use parallel testing for multiple targets:
  ```javascript
  const results = await detectXSSParallel(testConfigs, { concurrency: 5 });
  ```
- Use smart payload selection to reduce the number of tests:
  ```javascript
  const options = {
    smartPayloadSelection: {
      enabled: true,
      limit: 10
    }
  };
  ```
- Reduce the number of payloads being tested
- Use headless mode (enabled by default)

### High Memory Usage

**Issue**: The tool consumes excessive memory.

**Solution**:
- Reduce concurrency when running parallel tests
- Close browser instances after each test
- Run tests in smaller batches
- Ensure you're not storing large amounts of data in memory

## Authentication Issues

### Authentication Failures

**Issue**: The tool fails to authenticate with the target site.

**Solution**:
- Verify your credentials are correct
- Check if the site has anti-automation measures
- Implement a custom `isLoggedInCheck` function:
  ```javascript
  const authConfig = {
    // ... other auth options
    isLoggedInCheck: async (page) => {
      // Custom logic to verify login success
      return await page.isVisible('#user-profile');
    }
  };
  ```
- Try using session handling to reuse an authenticated session:
  ```javascript
  const options = {
    session: {
      id: 'my-session',
      save: true,
      reuse: true
    }
  };
  ```

### Session Expiration

**Issue**: The session expires during testing.

**Solution**:
- Implement session refresh logic
- Reduce the number of payloads to complete testing before session expiration
- Use parallel testing with a shared session to complete tests faster

## Session Handling Issues

### Session State Not Saved

**Issue**: Session state is not being saved between tests.

**Solution**:
- Ensure the session directory exists and is writable
- Verify you've set `save: true` in the session options
- Check for error messages related to session saving

### Session Not Reused

**Issue**: The tool doesn't reuse an existing session.

**Solution**:
- Ensure you're using the same session ID
- Verify you've set `reuse: true` in the session options
- Check if the session file exists and is valid
- Ensure you're using the same browser for all tests in the session

## Reporting Issues

### Report Generation Failures

**Issue**: The tool fails to generate reports.

**Solution**:
- Ensure the output directory exists and is writable:
  ```javascript
  const fs = require('fs');
  if (!fs.existsSync('./reports')) {
    fs.mkdirSync('./reports', { recursive: true });
  }
  ```
- Check for error messages related to report generation
- Try a different report format (JSON instead of HTML)

### Missing Information in Reports

**Issue**: Reports are missing expected information.

**Solution**:
- Ensure you're using the latest version of the tool
- Check if you need to enable additional options to capture the desired information
- Consider creating a custom report template

## Common Error Messages

### "Protocol error (Runtime.callFunctionOn): Target closed"

**Issue**: The browser was closed unexpectedly.

**Solution**:
- Increase timeouts
- Check for system resource constraints
- Implement retry logic
- Ensure the page isn't navigating away or refreshing during the test

### "Error: net::ERR_NAME_NOT_RESOLVED"

**Issue**: DNS resolution failure.

**Solution**:
- Check your internet connection
- Verify the URL is correct
- Try using an IP address instead of a hostname
- Check your DNS settings

### "Error: Navigation timeout of X ms exceeded"

**Issue**: Page took too long to load.

**Solution**:
- Increase the navigation timeout:
  ```javascript
  const options = { timeouts: { navigation: 60000 } };
  ```
- Check if the site is responding slowly or is down
- Verify your internet connection

### "Error: Execution context was destroyed"

**Issue**: The JavaScript execution context was destroyed during the test.

**Solution**:
- This often happens when the page navigates or refreshes
- Implement retry logic
- Adjust your test to account for page navigation
- Use event listeners to detect when the page is stable

## Getting Additional Help

If you're still experiencing issues after trying the solutions in this guide:

1. Check the project's GitHub repository for open and closed issues
2. Enable verbose logging to get more detailed information:
   ```javascript
   const options = { logging: { verbose: true } };
   ```
3. Create a minimal reproducible example
4. Submit an issue with detailed information about your environment and the problem

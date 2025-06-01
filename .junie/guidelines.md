# XSS Validator Development Guidelines

This document provides guidelines and instructions for developing and working with the XSS Validator tool.

## Build/Configuration Instructions

### Prerequisites
- Node.js version 18 or higher (required by Playwright v1.52.0)
- npm (Node Package Manager)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

### Project Structure
- `xssValidator.js` - Main module containing the XSS detection functionality
- `payloads/` - Directory for storing XSS payload files
- `tests/` - Directory containing test scripts

## Testing Information

### Running Tests
1. Create test scripts in the `tests/` directory
2. Run a test using Node.js:
   ```bash
   node tests/your-test-script.js
   ```

### Example Test
```javascript
const { detectXSS } = require('../xssValidator');

async function runTest() {
  try {
    // Test against a demo site that allows input reflection
    await detectXSS('https://xss-game.appspot.com/level1/frame', '#query');

    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
```

### Adding New Tests
1. Create a new JavaScript file in the `tests/` directory
2. Import the `detectXSS` function from xssValidator.js
3. Call the function with appropriate parameters:
   - URL of the page to test
   - CSS selector for the input field

### Creating and Using Custom Payloads
To extend the tool with custom XSS payloads:
1. Create a JSON file in the `payloads/` directory
2. Format the file as an array of strings, each containing an XSS payload
3. Load the payloads in your test script:
   ```javascript
   const fs = require('fs');
   const customPayloads = JSON.parse(fs.readFileSync('payloads/custom.json', 'utf8'));
   ```
4. Pass the custom payloads to the detectXSS function:
   ```javascript
   await detectXSS('https://example.com', '#input-field', customPayloads);
   ```

The tool comes with a sample payload file at `payloads/common.json` that contains a variety of XSS payloads for different contexts. You can use this as a starting point for creating your own custom payload files.

## Development Guidelines

### Code Style
- Use async/await for asynchronous operations
- Follow standard JavaScript naming conventions:
  - camelCase for variables and functions
  - PascalCase for classes
- Add comments for complex logic
- Use meaningful variable and function names

### Extending the Tool
To add new detection methods:
1. Modify the `detectXSS` function in xssValidator.js or create new specialized functions
2. Consider adding parameters for:
   - Custom timeout values
   - Form submission selectors
   - Detection methods

### Debugging Tips
- Use Playwright's `headless: false` option to see the browser during execution:
  ```javascript
  const browser = await chromium.launch({ headless: false });
  ```
- Add screenshots for debugging:
  ```javascript
  await page.screenshot({ path: 'screenshot.png' });
  ```
- Use longer timeouts for complex pages:
  ```javascript
  await page.waitForTimeout(5000); // 5 seconds
  ```

### Performance Considerations
- Use a headless browser for faster execution when not debugging
- Consider running tests in parallel for multiple targets
- Implement proper error handling and timeouts to prevent hanging tests

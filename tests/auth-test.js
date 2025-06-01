const { detectXSS } = require('../xssValidator');

/**
 * This example demonstrates how to use the XSS validator with authentication
 * to test protected pages for XSS vulnerabilities.
 */
async function runAuthTest() {
  try {
    // Define authentication configuration
    const authConfig = {
      url: 'https://example.com/login', // Replace with actual login page URL
      usernameSelector: '#username',    // Replace with actual username field selector
      passwordSelector: '#password',    // Replace with actual password field selector
      submitSelector: '#login-button',  // Replace with actual login button selector
      username: 'testuser',             // Replace with actual test username
      password: 'testpassword',         // Replace with actual test password
      
      // Optional function to check if login was successful
      isLoggedInCheck: async (page) => {
        // Check for elements that indicate successful login
        // For example, a profile link or a welcome message
        return await page.isVisible('#user-profile');
      }
    };

    // Configure the XSS detection with authentication
    const options = {
      browser: 'chromium',
      verifyExecution: true,
      auth: authConfig,
      // Enable verbose logging to see authentication progress
      logging: {
        verbose: true,
        showProgress: true,
        progressUpdateInterval: 1
      },
      // Generate an HTML report of the results
      report: {
        format: 'html',
        outputDir: './reports',
        filename: `auth-test-report-${new Date().toISOString().replace(/:/g, '-')}`
      }
    };

    // Run the XSS detection on a protected page
    // Replace with an actual protected page URL and input field selector
    const results = await detectXSS(
      'https://example.com/protected-page',
      '#search-input',
      null, // Use default payloads
      options
    );

    console.log('Test completed successfully');
    console.log(`Found ${results.results.length} vulnerabilities`);
    
    if (results.reportPaths.html) {
      console.log(`Report generated at: ${results.reportPaths.html}`);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runAuthTest();
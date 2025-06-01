const { detectXSS } = require('../xssValidator');

/**
 * This example demonstrates how to use the XSS validator with session handling
 * to maintain state between requests and test multiple pages within the same session.
 */
async function runSessionHandlingTest() {
  try {
    console.log('Starting session handling test');
    
    // Create a unique session ID
    const sessionId = `xss-session-${Date.now()}`;
    console.log(`Using session ID: ${sessionId}`);
    
    // First test: Login to a site and establish a session
    console.log('\n=== Step 1: Login and establish session ===');
    
    // Authentication configuration
    const authConfig = {
      url: 'https://example.com/login', // Replace with actual login page URL
      usernameSelector: '#username',    // Replace with actual username field selector
      passwordSelector: '#password',    // Replace with actual password field selector
      submitSelector: '#login-button',  // Replace with actual login button selector
      username: 'testuser',             // Replace with actual test username
      password: 'testpassword',         // Replace with actual test password
      isLoggedInCheck: async (page) => {
        return await page.isVisible('#user-profile');
      }
    };
    
    // Session configuration for the first test
    const sessionOptions = {
      session: {
        id: sessionId,
        reuse: false,     // Don't try to reuse (it's the first test)
        save: true,       // Save the session state after testing
        closeAfter: false // Keep the session open for the next test
      },
      browser: 'chromium',
      verifyExecution: true,
      auth: authConfig,
      logging: {
        verbose: true
      }
    };
    
    // Run the first test to establish the session
    console.log('Logging in and testing the first page...');
    const firstResults = await detectXSS(
      'https://example.com/profile', // Replace with actual protected page URL
      '#search-input',               // Replace with actual input field selector
      null,                          // Use default payloads
      sessionOptions
    );
    
    console.log(`First test completed. Found ${firstResults.results.length} vulnerabilities.`);
    
    // Second test: Use the established session to test another page
    console.log('\n=== Step 2: Reuse session for another page ===');
    
    // Update session configuration to reuse the existing session
    const secondSessionOptions = {
      session: {
        id: sessionId,
        reuse: true,      // Reuse the session from the first test
        save: true,       // Save the updated session state
        closeAfter: false // Keep the session open for potential future tests
      },
      browser: 'chromium',
      verifyExecution: true,
      // No need for auth config as we're reusing the session
      logging: {
        verbose: true
      }
    };
    
    // Run the second test using the established session
    console.log('Testing the second page with the same session...');
    const secondResults = await detectXSS(
      'https://example.com/settings', // Replace with another protected page URL
      '#search-settings',             // Replace with actual input field selector
      null,                           // Use default payloads
      secondSessionOptions
    );
    
    console.log(`Second test completed. Found ${secondResults.results.length} vulnerabilities.`);
    
    // Third test: Final test and close the session
    console.log('\n=== Step 3: Final test and close session ===');
    
    // Update session configuration to close the session after testing
    const finalSessionOptions = {
      session: {
        id: sessionId,
        reuse: true,     // Reuse the session from previous tests
        save: false,     // No need to save as we're closing
        closeAfter: true // Close the session after this test
      },
      browser: 'chromium',
      verifyExecution: true,
      logging: {
        verbose: true
      },
      // Generate a report for the final test
      report: {
        format: 'html',
        outputDir: './reports',
        filename: `session-test-report-${new Date().toISOString().replace(/:/g, '-')}`
      }
    };
    
    // Run the final test and close the session
    console.log('Testing the final page and closing the session...');
    const finalResults = await detectXSS(
      'https://example.com/dashboard', // Replace with another protected page URL
      '#search-dashboard',             // Replace with actual input field selector
      null,                            // Use default payloads
      finalSessionOptions
    );
    
    console.log(`Final test completed. Found ${finalResults.results.length} vulnerabilities.`);
    
    // Summarize the results
    const totalVulnerabilities = 
      firstResults.results.length + 
      secondResults.results.length + 
      finalResults.results.length;
    
    console.log('\n=== Session Testing Summary ===');
    console.log(`Session ID: ${sessionId}`);
    console.log(`Total pages tested: 3`);
    console.log(`Total vulnerabilities found: ${totalVulnerabilities}`);
    console.log('Session handling test completed successfully');
    
    if (finalResults.reportPaths.html) {
      console.log(`Report for final test generated at: ${finalResults.reportPaths.html}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runSessionHandlingTest();
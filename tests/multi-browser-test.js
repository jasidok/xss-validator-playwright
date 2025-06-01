const { detectXSS } = require('../xssValidator');

/**
 * This example demonstrates how to use the XSS validator with multiple browsers
 * to test for browser-specific XSS vulnerabilities.
 */
async function runMultiBrowserTest() {
  // Target URL and selector to test
  const targetUrl = 'https://xss-game.appspot.com/level1/frame';
  const inputSelector = '#query';
  
  // List of browsers to test
  const browsers = ['chromium', 'firefox', 'webkit'];
  
  // Results storage
  const allResults = {};
  
  try {
    console.log('Starting multi-browser XSS testing');
    
    // Test each browser sequentially
    for (const browser of browsers) {
      console.log(`\n=== Testing with ${browser} ===`);
      
      // Configure browser-specific options
      const options = {
        browser: browser,
        verifyExecution: true,
        // Enable logging
        logging: {
          verbose: false,
          showProgress: true,
          progressUpdateInterval: 5
        },
        // Generate a browser-specific report
        report: {
          format: 'both', // Generate both HTML and JSON reports
          outputDir: './reports',
          filename: `${browser}-test-report-${new Date().toISOString().replace(/:/g, '-')}`
        },
        // Use browser-specific timeouts (WebKit might need longer timeouts)
        timeouts: {
          navigation: browser === 'webkit' ? 45000 : 30000,
          action: browser === 'webkit' ? 15000 : 10000,
          waitFor: browser === 'webkit' ? 7000 : 5000
        }
      };
      
      // Run the XSS detection with the current browser
      const results = await detectXSS(
        targetUrl,
        inputSelector,
        null, // Use default payloads
        options
      );
      
      // Store results for this browser
      allResults[browser] = {
        vulnerabilities: results.results.length,
        details: results.results,
        reportPaths: results.reportPaths
      };
      
      console.log(`${browser} test completed. Found ${results.results.length} vulnerabilities.`);
      if (results.reportPaths.html) {
        console.log(`HTML report: ${results.reportPaths.html}`);
      }
      if (results.reportPaths.json) {
        console.log(`JSON report: ${results.reportPaths.json}`);
      }
    }
    
    // Display summary of all browser results
    console.log('\n=== Multi-Browser Test Summary ===');
    for (const browser in allResults) {
      console.log(`${browser}: ${allResults[browser].vulnerabilities} vulnerabilities found`);
    }
    
    // Compare results to find browser-specific vulnerabilities
    console.log('\n=== Browser-Specific Vulnerabilities ===');
    for (const browser in allResults) {
      const browserVulns = allResults[browser].details.map(v => v.payload);
      
      // Find payloads that only worked in this browser
      const uniqueVulns = browserVulns.filter(payload => {
        return Object.keys(allResults)
          .filter(b => b !== browser)
          .every(otherBrowser => 
            !allResults[otherBrowser].details.some(v => v.payload === payload)
          );
      });
      
      if (uniqueVulns.length > 0) {
        console.log(`\nVulnerabilities unique to ${browser}:`);
        uniqueVulns.forEach(payload => console.log(`- ${payload}`));
      } else {
        console.log(`\nNo vulnerabilities unique to ${browser}`);
      }
    }
    
    console.log('\nMulti-browser test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runMultiBrowserTest();
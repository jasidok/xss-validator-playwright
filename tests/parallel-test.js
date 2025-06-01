const { detectXSSParallel } = require('../xssValidator');

/**
 * This example demonstrates how to use the XSS validator to test multiple pages
 * or inputs in parallel for improved performance.
 */
async function runParallelTest() {
  try {
    console.log('Starting parallel XSS testing');
    
    // Define multiple test configurations
    const testConfigs = [
      {
        url: 'https://xss-game.appspot.com/level1/frame',
        inputFieldSelector: '#query',
        options: {
          browser: 'chromium',
          verifyExecution: true,
          report: {
            format: 'json',
            outputDir: './reports',
            filename: 'level1-report'
          }
        }
      },
      {
        url: 'https://xss-game.appspot.com/level2/frame',
        inputFieldSelector: 'input[name="query"]',
        options: {
          browser: 'firefox',
          verifyExecution: true,
          report: {
            format: 'json',
            outputDir: './reports',
            filename: 'level2-report'
          }
        }
      },
      {
        url: 'https://xss-game.appspot.com/level3/frame',
        inputFieldSelector: '#query',
        options: {
          browser: 'webkit',
          verifyExecution: true,
          report: {
            format: 'json',
            outputDir: './reports',
            filename: 'level3-report'
          }
        }
      }
    ];
    
    // Global options for parallel testing
    const globalOptions = {
      // Number of tests to run concurrently
      concurrency: 2,
      
      // Whether to stop testing when a vulnerability is found
      stopOnFirstVulnerability: false,
      
      // Whether to share a session between tests (useful for testing multiple pages on the same site)
      shareSession: false,
      
      // Cache configuration to avoid redundant tests
      cache: {
        enabled: true,
        maxAge: 3600000, // 1 hour in milliseconds
        verbose: true
      }
    };
    
    // Run the parallel tests
    const results = await detectXSSParallel(testConfigs, globalOptions);
    
    // Process and display the results
    console.log('\n=== Parallel Test Results ===');
    
    let totalVulnerabilities = 0;
    
    results.forEach((result, index) => {
      const testConfig = testConfigs[index];
      const vulnerabilities = result.results ? result.results.length : 0;
      totalVulnerabilities += vulnerabilities;
      
      console.log(`\nTest ${index + 1}: ${testConfig.url}`);
      console.log(`  Browser: ${testConfig.options.browser}`);
      console.log(`  Input selector: ${testConfig.inputFieldSelector}`);
      console.log(`  Vulnerabilities found: ${vulnerabilities}`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      
      if (result.reportPaths && result.reportPaths.json) {
        console.log(`  Report: ${result.reportPaths.json}`);
      }
      
      // Display the detected vulnerabilities
      if (vulnerabilities > 0) {
        console.log('  Detected payloads:');
        result.results.forEach(vuln => {
          console.log(`    - ${vuln.payload} (Reflected: ${vuln.reflected}, Executed: ${vuln.executed})`);
        });
      }
    });
    
    console.log(`\nTotal vulnerabilities found across all tests: ${totalVulnerabilities}`);
    console.log('Parallel test completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runParallelTest();
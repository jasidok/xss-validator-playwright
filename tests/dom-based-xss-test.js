const { detectXSS } = require('../xssValidator');
const fs = require('fs');

/**
 * This example demonstrates how to use the XSS validator to detect DOM-based XSS vulnerabilities,
 * which occur when JavaScript dynamically modifies the DOM in an unsafe way.
 */
async function runDOMBasedXSSTest() {
  try {
    console.log('Starting DOM-based XSS detection test');
    
    // Load DOM-specific payloads
    // These payloads are specifically designed to trigger DOM-based XSS
    // For example, they might target common JavaScript functions like document.write, innerHTML, etc.
    let domPayloads;
    try {
      // Check if we have a DOM-specific payload file
      if (fs.existsSync('payloads/dom-xss.json')) {
        domPayloads = JSON.parse(fs.readFileSync('payloads/dom-xss.json', 'utf8'));
        console.log(`Loaded ${domPayloads.length} DOM-specific payloads`);
      } else {
        // If not, create some example DOM-specific payloads
        console.log('No DOM-specific payload file found, using example payloads');
        domPayloads = [
          // Location-based payloads (target window.location processing)
          "javascript:alert(1)",
          "data:text/html,<script>alert(1)</script>",
          
          // DOM manipulation payloads
          "<img src=x onerror=alert(1)>",
          "<div onmouseover='alert(1)'>Hover me</div>",
          
          // Event handler payloads
          "' onmouseover='alert(1)",
          "\" onmouseover=\"alert(1)",
          
          // Encoded payloads that might bypass filters
          "<img src=x onerror=\\u0061lert(1)>",
          "<svg><script>alert&#40;1&#41;</script></svg>",
          
          // Hash/fragment-based payloads
          "#<img src=x onerror=alert(1)>",
          "#javascript:alert(1)"
        ];
      }
    } catch (error) {
      console.error('Error loading DOM payloads:', error);
      // Fallback to default payloads
      domPayloads = null;
    }
    
    // Configure options specifically for DOM-based XSS detection
    const options = {
      browser: 'chromium',
      // Enable JavaScript execution verification (critical for DOM-based XSS)
      verifyExecution: true,
      // Use longer timeouts for DOM manipulation to take effect
      timeouts: {
        navigation: 30000,
        action: 10000,
        waitFor: 5000,
        // Add a longer execution timeout to allow for DOM manipulation
        execution: 3000
      },
      // Enable verbose logging to see detailed information
      logging: {
        verbose: true,
        showProgress: true,
        progressUpdateInterval: 1
      },
      // Generate a report
      report: {
        format: 'html',
        outputDir: './reports',
        filename: `dom-xss-report-${new Date().toISOString().replace(/:/g, '-')}`
      }
    };
    
    // Target a page known to be vulnerable to DOM-based XSS
    // For example, a page that takes input from URL parameters and inserts it into the DOM
    // Replace with an actual vulnerable page for testing
    const targetUrl = 'https://xss-game.appspot.com/level2/frame';
    const inputSelector = 'input[name="query"]';
    
    console.log(`Testing ${targetUrl} for DOM-based XSS vulnerabilities`);
    
    // Run the XSS detection with DOM-specific configuration
    const results = await detectXSS(
      targetUrl,
      inputSelector,
      domPayloads,
      options
    );
    
    // Process the results
    console.log(`\nTest completed. Found ${results.results.length} vulnerabilities.`);
    
    if (results.results.length > 0) {
      console.log('\nDetected DOM-based XSS vulnerabilities:');
      results.results.forEach((vuln, index) => {
        console.log(`\n${index + 1}. Payload: ${vuln.payload}`);
        console.log(`   Reflected: ${vuln.reflected}, Executed: ${vuln.executed}`);
        console.log(`   Timestamp: ${vuln.timestamp}`);
      });
    }
    
    if (results.reportPaths.html) {
      console.log(`\nDetailed report generated at: ${results.reportPaths.html}`);
    }
    
    console.log('\nDOM-based XSS detection test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runDOMBasedXSSTest();
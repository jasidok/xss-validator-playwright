const { detectXSS } = require('../xssValidator');
const fs = require('fs');

/**
 * This script is designed to run XSS tests in a CI/CD environment.
 * It can be used with GitHub Actions, GitLab CI, Jenkins, CircleCI, or other CI/CD platforms.
 */
async function runCITests() {
  try {
    console.log('Starting XSS validation in CI environment');
    
    // Ensure reports directory exists
    if (!fs.existsSync('./reports')) {
      fs.mkdirSync('./reports', { recursive: true });
    }
    
    // Configure options for CI environment
    const options = {
      browser: 'chromium',
      verifyExecution: true,
      // Generate both HTML and JSON reports
      report: {
        format: 'both',
        outputDir: './reports',
        filename: 'xss-report'
      },
      // Optimize for CI environment
      browserOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--headless',
          '--disable-gpu'
        ]
      },
      // Enable logging but not too verbose
      logging: {
        verbose: false,
        showProgress: true,
        progressUpdateInterval: 5
      }
    };
    
    // Load test targets from environment variables or use defaults
    // Format: comma-separated list of URL:selector pairs
    // Example: "https://example.com/page1:#search,https://example.com/page2:input[name='q']"
    let testTargets = [];
    
    if (process.env.XSS_TEST_TARGETS) {
      testTargets = process.env.XSS_TEST_TARGETS.split(',').map(target => {
        const [url, selector] = target.split(':');
        return { url, selector };
      });
      console.log(`Loaded ${testTargets.length} test targets from environment variables`);
    } else {
      // Default test targets (replace with your actual targets)
      testTargets = [
        { url: 'https://example.com/page1', selector: '#search' },
        { url: 'https://example.com/page2', selector: 'input[name="q"]' }
      ];
      console.log('Using default test targets');
    }
    
    // Track overall results
    let totalVulnerabilities = 0;
    const vulnerableUrls = [];
    
    // Run tests for each target
    for (const [index, target] of testTargets.entries()) {
      console.log(`\nTesting target ${index + 1}/${testTargets.length}: ${target.url}`);
      console.log(`Using selector: ${target.selector}`);
      
      // Check if authentication is required for this target
      if (process.env.XSS_AUTH_REQUIRED === 'true' && 
          process.env.XSS_AUTH_URL && 
          process.env.XSS_AUTH_USERNAME && 
          process.env.XSS_AUTH_PASSWORD) {
        
        console.log('Authentication required for this target');
        
        // Add authentication configuration
        options.auth = {
          url: process.env.XSS_AUTH_URL,
          usernameSelector: process.env.XSS_AUTH_USERNAME_SELECTOR || '#username',
          passwordSelector: process.env.XSS_AUTH_PASSWORD_SELECTOR || '#password',
          submitSelector: process.env.XSS_AUTH_SUBMIT_SELECTOR || '#login-button',
          username: process.env.XSS_AUTH_USERNAME,
          password: process.env.XSS_AUTH_PASSWORD
        };
      } else {
        // Remove auth config if it was set for a previous target
        if (options.auth) {
          delete options.auth;
        }
      }
      
      // Set a unique report filename for each target
      options.report.filename = `xss-report-${index + 1}`;
      
      // Run the test
      try {
        const results = await detectXSS(
          target.url,
          target.selector,
          null, // Use default payloads
          options
        );
        
        // Process results
        const vulnerabilityCount = results.results.length;
        totalVulnerabilities += vulnerabilityCount;
        
        console.log(`Completed testing ${target.url}`);
        console.log(`Found ${vulnerabilityCount} vulnerabilities`);
        
        if (vulnerabilityCount > 0) {
          vulnerableUrls.push({
            url: target.url,
            count: vulnerabilityCount,
            reportPath: results.reportPaths.html || results.reportPaths.json
          });
        }
        
        // Create a summary file for this target
        fs.writeFileSync(
          `./reports/summary-${index + 1}.json`, 
          JSON.stringify({
            url: target.url,
            selector: target.selector,
            vulnerabilities: vulnerabilityCount,
            timestamp: new Date().toISOString()
          }, null, 2)
        );
      } catch (testError) {
        console.error(`Error testing ${target.url}:`, testError);
        // Continue with next target instead of failing the entire run
      }
    }
    
    // Create overall summary
    const summary = {
      totalTargets: testTargets.length,
      totalVulnerabilities,
      vulnerableTargets: vulnerableUrls.length,
      timestamp: new Date().toISOString(),
      vulnerableUrls
    };
    
    fs.writeFileSync('./reports/summary.json', JSON.stringify(summary, null, 2));
    
    // Generate a simple HTML summary
    const htmlSummary = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>XSS Validation Summary</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { margin-bottom: 20px; }
        .vulnerable { color: #c00; }
        .safe { color: #0a0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>XSS Validation Summary</h1>
      <div class="summary">
        <p>Tested ${testTargets.length} targets on ${new Date().toLocaleString()}</p>
        <p class="${totalVulnerabilities > 0 ? 'vulnerable' : 'safe'}">
          Found ${totalVulnerabilities} vulnerabilities across ${vulnerableUrls.length} targets
        </p>
      </div>
      
      <h2>Results by Target</h2>
      <table>
        <tr>
          <th>#</th>
          <th>URL</th>
          <th>Status</th>
          <th>Vulnerabilities</th>
          <th>Report</th>
        </tr>
        ${testTargets.map((target, i) => {
          const vulnerable = vulnerableUrls.find(v => v.url === target.url);
          return `
          <tr>
            <td>${i + 1}</td>
            <td>${target.url}</td>
            <td class="${vulnerable ? 'vulnerable' : 'safe'}">${vulnerable ? 'Vulnerable' : 'Safe'}</td>
            <td>${vulnerable ? vulnerable.count : 0}</td>
            <td>${vulnerable ? `<a href="${vulnerable.reportPath}">View Report</a>` : 'N/A'}</td>
          </tr>
          `;
        }).join('')}
      </table>
    </body>
    </html>
    `;
    
    fs.writeFileSync('./reports/summary.html', htmlSummary);
    
    console.log('\nCI testing completed');
    console.log(`Tested ${testTargets.length} targets`);
    console.log(`Found ${totalVulnerabilities} vulnerabilities across ${vulnerableUrls.length} targets`);
    console.log('Summary reports generated in ./reports/');
    
    // Exit with error code if vulnerabilities were found
    if (totalVulnerabilities > 0) {
      console.error('XSS vulnerabilities detected! Check the reports for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('CI test failed:', error);
    process.exit(1);
  }
}

runCITests();
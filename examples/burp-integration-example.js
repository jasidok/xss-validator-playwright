#!/usr/bin/env node

/**
 * Example script demonstrating the Burp Integration Server
 *
 * This script shows how to:
 * 1. Send HTTP responses to the server for XSS analysis
 * 2. Process multiple payloads with different browsers
 * 3. Analyze the enhanced detection results
 */

const axios = require('axios');
const base64 = require('base64-js');

// Server configuration
const SERVER_URL = 'http://127.0.0.1:8093';

/**
 * Example HTML response with XSS vulnerability
 */
const VULNERABLE_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <h1>Search Results</h1>
    <p>You searched for: PAYLOAD_HERE</p>
    <div id="results">
        <script>
            var searchTerm = "PAYLOAD_HERE";
            document.getElementById('results').innerHTML = searchTerm;
        </script>
    </div>
</body>
</html>
`;

/**
 * Test payloads with different XSS techniques
 */
const TEST_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<input onfocus=alert("XSS") autofocus>',
    '<details open ontoggle=alert("XSS")>',
    '<marquee onstart=alert("XSS")>',
    '<body onload=alert("XSS")>'
];

/**
 * Available browsers for testing
 */
const BROWSERS = ['chromium', 'firefox', 'webkit'];

/**
 * Test a single payload with the server
 */
async function testPayload(url, html, payload, browser = 'chromium') {
    try {
        // Replace placeholder with actual payload
        const htmlWithPayload = html.replace(/PAYLOAD_HERE/g, payload);

        // Encode data as required by the server
        const requestData = {
            'http-response': Buffer.from(htmlWithPayload).toString('base64'),
            'http-url': Buffer.from(url).toString('base64'),
            'http-headers': Buffer.from('').toString('base64'),
            'payload': payload,
            'browser': browser
        };

        console.log(`🧪 Testing payload with ${browser}: ${payload.substring(0, 50)}${payload.length > 50 ? '...' : ''}`);

        const response = await axios.post(SERVER_URL, requestData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
        });

        const result = response.data;

        // Display results
        console.log(`📊 Result (${response.status}):`);
        console.log(`   Detected: ${result.value > 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Message: ${result.msg}`);

        if (result.enhanced) {
            console.log(`   Severity: ${result.enhanced.severity}`);
            console.log(`   Confidence: ${(result.enhanced.confidence * 100).toFixed(1)}%`);
            console.log(`   Detection Methods: ${result.enhanced.detectionMethods.join(', ')}`);
            console.log(`   Analysis Time: ${result.enhanced.timing?.analysisTime || 'N/A'}ms`);
        }

        console.log('');
        return result;

    } catch (error) {
        console.error(`❌ Error testing payload: ${error.message}`);
        return null;
    }
}

/**
 * Check if the server is healthy
 */
async function checkServerHealth() {
    try {
        console.log('🏥 Checking server health...');
        const response = await axios.get(`${SERVER_URL}/health`, {timeout: 5000});
        const health = response.data;

        console.log(`✅ Server is healthy!`);
        console.log(`   Status: ${health.status}`);
        console.log(`   Available Browsers: ${health.availableBrowsers.join(', ')}`);
        console.log(`   Active Requests: ${health.activeRequests}/${health.maxConcurrentPages}`);
        console.log(`   Uptime: ${health.uptime.toFixed(1)}s`);
        console.log('');

        return true;
    } catch (error) {
        console.error(`❌ Server health check failed: ${error.message}`);
        console.error(`   Make sure the server is running: node start-burp-server.js`);
        return false;
    }
}

/**
 * Run a comprehensive test suite
 */
async function runTestSuite() {
    console.log('🚀 XSS Validator Burp Integration Example\n');

    // Check server health first
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        process.exit(1);
    }

    const testUrl = 'http://example.com/search?q=test';
    const results = [];

    console.log(`📝 Testing ${TEST_PAYLOADS.length} payloads across ${BROWSERS.length} browsers...\n`);

    // Test each payload with each browser
    for (const payload of TEST_PAYLOADS) {
        for (const browser of BROWSERS) {
            const result = await testPayload(testUrl, VULNERABLE_HTML, payload, browser);
            if (result) {
                results.push({
                    payload,
                    browser,
                    detected: result.value > 0,
                    severity: result.enhanced?.severity || 'none',
                    confidence: result.enhanced?.confidence || 0,
                    methods: result.enhanced?.detectionMethods || []
                });
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Summary
    console.log('📈 Test Summary:');
    console.log('================');

    const totalTests = results.length;
    const detected = results.filter(r => r.detected).length;
    const byBrowser = {};
    const bySeverity = {};

    // Group by browser
    for (const browser of BROWSERS) {
        const browserResults = results.filter(r => r.browser === browser);
        const browserDetected = browserResults.filter(r => r.detected).length;
        byBrowser[browser] = {
            total: browserResults.length,
            detected: browserDetected,
            rate: ((browserDetected / browserResults.length) * 100).toFixed(1)
        };
    }

    // Group by severity
    for (const result of results) {
        if (result.detected) {
            bySeverity[result.severity] = (bySeverity[result.severity] || 0) + 1;
        }
    }

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Detected XSS: ${detected} (${((detected / totalTests) * 100).toFixed(1)}%)`);
    console.log('');

    console.log('By Browser:');
    for (const [browser, stats] of Object.entries(byBrowser)) {
        console.log(`  ${browser}: ${stats.detected}/${stats.total} (${stats.rate}%)`);
    }
    console.log('');

    console.log('By Severity:');
    for (const [severity, count] of Object.entries(bySeverity)) {
        console.log(`  ${severity}: ${count}`);
    }

    // Show some detailed examples
    const highConfidenceResults = results.filter(r => r.detected && r.confidence > 0.8);
    if (highConfidenceResults.length > 0) {
        console.log('\n🎯 High Confidence Detections:');
        highConfidenceResults.slice(0, 3).forEach(result => {
            console.log(`  Payload: ${result.payload}`);
            console.log(`  Browser: ${result.browser}`);
            console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
            console.log(`  Methods: ${result.methods.join(', ')}`);
            console.log('');
        });
    }

    console.log('✅ Example completed successfully!');
}

/**
 * Show usage information
 */
function showUsage() {
    console.log('XSS Validator Burp Integration Example');
    console.log('');
    console.log('Usage:');
    console.log('  node examples/burp-integration-example.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  test                 Run the full test suite (default)');
    console.log('  health              Check server health');
    console.log('  single <payload>    Test a single payload');
    console.log('  help                Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node examples/burp-integration-example.js');
    console.log('  node examples/burp-integration-example.js health');
    console.log('  node examples/burp-integration-example.js single "<script>alert(1)</script>"');
}

/**
 * Main function
 */
async function main() {
    const command = process.argv[2] || 'test';

    switch (command) {
        case 'test':
            await runTestSuite();
            break;

        case 'health':
            await checkServerHealth();
            break;

        case 'single':
            const payload = process.argv[3];
            if (!payload) {
                console.error('❌ Please provide a payload to test');
                console.log('Example: node examples/burp-integration-example.js single "<script>alert(1)</script>"');
                process.exit(1);
            }

            const isHealthy = await checkServerHealth();
            if (isHealthy) {
                await testPayload('http://example.com/test', VULNERABLE_HTML, payload, 'chromium');
            }
            break;

        case 'help':
        case '--help':
        case '-h':
            showUsage();
            break;

        default:
            console.error(`❌ Unknown command: ${command}`);
            showUsage();
            process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    process.exit(1);
});

// Run the example
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Example failed:', error);
        process.exit(1);
    });
}

module.exports = {
    testPayload,
    checkServerHealth,
    runTestSuite
};
#!/usr/bin/env node

/**
 * Burp Suite XSS Validator Server Launcher
 *
 * This script provides a streamlined way to start the XSS Validator server
 * specifically optimized for Burp Suite integration.
 *
 * Features:
 * - Pre-configured optimal settings for Burp Suite
 * - Automatic dependency checking
 * - Browser availability verification
 * - Clear setup instructions
 * - Health monitoring
 */

const {spawn} = require('child_process');
const {existsSync} = require('fs');
const path = require('path');

// ANSI color codes for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Configuration optimized for Burp Suite integration
const BURP_CONFIG = {
    host: '127.0.0.1',
    port: 8093,
    maxPages: 3,  // Conservative for Burp Suite usage
    browser: 'chromium',  // Most reliable for Burp testing
    debug: false,
    quiet: false,
    logLevel: 'info'
};

/**
 * Print colored output
 */
function print(text, color = 'reset') {
    console.log(`${colors[color]}${text}${colors.reset}`);
}

/**
 * Print section header
 */
function printHeader(text) {
    print('\n' + '='.repeat(60), 'cyan');
    print(`  ${text}`, 'bright');
    print('='.repeat(60), 'cyan');
}

/**
 * Print step with icon
 */
function printStep(step, text, status = 'info') {
    const icons = {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        rocket: '🚀'
    };

    print(`${icons[status]} Step ${step}: ${text}`, status === 'error' ? 'red' : 'reset');
}

/**
 * Check if required dependencies exist
 */
function checkDependencies() {
    printStep(1, 'Checking dependencies...', 'info');

    const requiredFiles = [
        'package.json',
        'node_modules',
        'burp-integration-server-v2.js'
    ];

    const missing = requiredFiles.filter(file => !existsSync(file));

    if (missing.length > 0) {
        printStep(1, `Missing dependencies: ${missing.join(', ')}`, 'error');
        print('\n💡 To fix this, run:', 'yellow');
        print('   npm install', 'bright');
        process.exit(1);
    }

    printStep(1, 'All dependencies found', 'success');
}

/**
 * Check if Playwright browsers are installed
 */
async function checkBrowsers() {
    printStep(2, 'Checking Playwright browsers...', 'info');

    return new Promise((resolve) => {
        const check = spawn('npx', ['playwright', '--version'], {stdio: 'pipe'});

        check.on('close', (code) => {
            if (code === 0) {
                printStep(2, 'Playwright is installed', 'success');
                resolve(true);
            } else {
                printStep(2, 'Playwright browsers not found', 'warning');
                print('\n💡 To install browsers, run:', 'yellow');
                print('   npx playwright install', 'bright');
                print('   or: npm run setup', 'bright');
                resolve(false);
            }
        });

        check.on('error', () => {
            printStep(2, 'Playwright not found', 'error');
            resolve(false);
        });
    });
}

/**
 * Display Burp Suite integration instructions
 */
function showBurpInstructions() {
    printHeader('🎯 BURP SUITE INTEGRATION SETUP');

    print('\n📖 To use with Burp Suite:', 'bright');
    print('   1. Load the extension: burp-extension/ModernXSSValidator.py', 'cyan');
    print('   2. Go to "XSS Validator" tab in Burp', 'cyan');
    print('   3. Set server host: 127.0.0.1', 'cyan');
    print('   4. Set server port: 8093', 'cyan');
    print('   5. Click "Test Connection"', 'cyan');
    print('   6. Enable "Auto-test responses"', 'cyan');
    print('   7. Start using Intruder with XSS payloads!', 'green');

    print('\n🧪 For manual testing:', 'bright');
    print('   • Use the "Scanner" tab in the extension', 'cyan');
    print('   • Or test via CLI: npm run test:burp', 'cyan');

    print('\n📊 To monitor the server:', 'bright');
    print('   • Check status: npm run status', 'cyan');
    print('   • View logs: npm run logs', 'cyan');
    print('   • Health check: curl http://127.0.0.1:8093/health', 'cyan');
}

/**
 * Display server information
 */
function showServerInfo() {
    printHeader('🚀 SERVER CONFIGURATION');

    print('\n📋 Optimized for Burp Suite:', 'bright');
    print(`   Host: ${BURP_CONFIG.host}`, 'green');
    print(`   Port: ${BURP_CONFIG.port}`, 'green');
    print(`   Max Concurrent Pages: ${BURP_CONFIG.maxPages}`, 'green');
    print(`   Default Browser: ${BURP_CONFIG.browser}`, 'green');
    print(`   Log Level: ${BURP_CONFIG.logLevel}`, 'green');

    print('\n🔗 API Endpoints:', 'bright');
    print(`   POST http://127.0.0.1:8093/     - XSS detection`, 'cyan');
    print(`   GET  http://127.0.0.1:8093/health - Health check`, 'cyan');
    print(`   GET  http://127.0.0.1:8093/stats  - Statistics`, 'cyan');
}

/**
 * Check if server is already running
 */
async function checkServerStatus() {
    printStep(3, 'Checking if server is already running...', 'info');

    try {
        const axios = require('axios');
        const response = await axios.get(`http://${BURP_CONFIG.host}:${BURP_CONFIG.port}/health`, {
            timeout: 3000
        });

        if (response.data.status === 'healthy') {
            printStep(3, 'Server is already running!', 'warning');
            print(`\n📊 Server Status:`, 'bright');
            print(`   Version: ${response.data.version || 'Unknown'}`, 'cyan');
            print(`   Uptime: ${response.data.uptime ? response.data.uptime.toFixed(1) + 's' : 'Unknown'}`, 'cyan');
            print(`   Browsers: ${response.data.availableBrowsers ? response.data.availableBrowsers.join(', ') : 'Unknown'}`, 'cyan');
            print(`   Active Requests: ${response.data.activeRequests || 0}`, 'cyan');

            print('\n💡 To stop the server:', 'yellow');
            print('   Press Ctrl+C in the running terminal', 'bright');
            print('   Or kill the process manually', 'bright');

            return true;
        }
    } catch (error) {
        // Server not running, which is what we want
        printStep(3, 'No existing server found - ready to start', 'success');
        return false;
    }

    return false;
}

/**
 * Start the server with optimal Burp Suite settings
 */
function startServer() {
    printStep(4, 'Starting XSS Validator server for Burp Suite...', 'rocket');

    // Set environment variables for optimal Burp Suite integration
    const env = {
        ...process.env,
        XSS_VALIDATOR_HOST: BURP_CONFIG.host,
        XSS_VALIDATOR_PORT: BURP_CONFIG.port.toString(),
        XSS_VALIDATOR_MAX_PAGES: BURP_CONFIG.maxPages.toString(),
        XSS_VALIDATOR_DEFAULT_BROWSER: BURP_CONFIG.browser,
        XSS_VALIDATOR_DEBUG: BURP_CONFIG.debug.toString(),
        XSS_VALIDATOR_QUIET: BURP_CONFIG.quiet.toString(),
        LOG_LEVEL: BURP_CONFIG.logLevel
    };

    // Start the v2.0 server
    const serverProcess = spawn('node', ['burp-integration-server-v2.js'], {
        env,
        stdio: 'inherit'
    });

    // Handle server process events
    serverProcess.on('error', (error) => {
        print(`\n❌ Failed to start server: ${error.message}`, 'red');
        process.exit(1);
    });

    serverProcess.on('close', (code) => {
        if (code !== 0) {
            print(`\n❌ Server exited with code ${code}`, 'red');
        } else {
            print('\n👋 Server stopped gracefully', 'green');
        }
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        print('\n\n🛑 Stopping server...', 'yellow');
        serverProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
        print('\n\n🛑 Stopping server...', 'yellow');
        serverProcess.kill('SIGTERM');
    });
}

/**
 * Display startup banner
 */
function showBanner() {
    print('\n' + '█'.repeat(70), 'magenta');
    print('█' + ' '.repeat(68) + '█', 'magenta');
    print('█' + '  🎯 XSS VALIDATOR - BURP SUITE INTEGRATION SERVER  '.padEnd(68) + '█', 'magenta');
    print('█' + '  Modern Playwright-based XSS Detection v2.0       '.padEnd(68) + '█', 'magenta');
    print('█' + ' '.repeat(68) + '█', 'magenta');
    print('█'.repeat(70), 'magenta');
}

/**
 * Show quick help
 */
function showQuickHelp() {
    printHeader('🆘 QUICK HELP');

    print('\n🚀 Starting the server:', 'bright');
    print('   node start-burp-suite-server.js', 'cyan');
    print('   npm run burp-server', 'cyan');

    print('\n📊 Monitoring commands:', 'bright');
    print('   npm run status              - Check server status', 'cyan');
    print('   npm run logs               - View server logs', 'cyan');
    print('   npm run test:burp          - Test with sample payload', 'cyan');

    print('\n🔧 Configuration:', 'bright');
    print('   node start-burp-server-v2.js config --show', 'cyan');
    print('   node start-burp-server-v2.js config --edit', 'cyan');

    print('\n🏥 Health check:', 'bright');
    print('   curl http://127.0.0.1:8093/health', 'cyan');

    print('\n❓ For more help:', 'bright');
    print('   node start-burp-server-v2.js --help', 'cyan');
}

/**
 * Main execution function
 */
async function main() {
    // Handle command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showBanner();
        showQuickHelp();
        return;
    }

    if (args.includes('--info')) {
        showBanner();
        showServerInfo();
        showBurpInstructions();
        return;
    }

    // Start server
    showBanner();

    try {
        // Step 1: Check dependencies
        checkDependencies();

        // Step 2: Check browsers
        const browsersReady = await checkBrowsers();
        if (!browsersReady) {
            print('\n⚠️  Browsers not installed, but server will start anyway', 'yellow');
            print('   (it will gracefully handle missing browsers)', 'yellow');
        }

        // Step 3: Check if server is already running
        const alreadyRunning = await checkServerStatus();
        if (alreadyRunning) {
            return;
        }

        // Show configuration and instructions
        showServerInfo();
        showBurpInstructions();

        print('\n🚦 Ready to start server!', 'green');
        print('   Press Ctrl+C to stop the server when done\n', 'yellow');

        // Step 4: Start server
        startServer();

    } catch (error) {
        print(`\n❌ Error: ${error.message}`, 'red');
        print('\n💡 Try running with --help for assistance', 'yellow');
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    print(`\n❌ Uncaught error: ${error.message}`, 'red');
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    print(`\n❌ Unhandled rejection: ${error.message}`, 'red');
    process.exit(1);
});

// Run the main function
main();

module.exports = {BURP_CONFIG, main};
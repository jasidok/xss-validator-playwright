#!/usr/bin/env node

/**
 * CLI tool to start the XSS Validator Burp Integration Server
 *
 * Usage:
 *   node start-burp-server.js [options]
 *
 * Options:
 *   --host <host>         Host to bind to (default: 127.0.0.1)
 *   --port <port>         Port to listen on (default: 8093)
 *   --max-pages <num>     Maximum concurrent pages (default: 5)
 *   --browser <browser>   Default browser (default: chromium)
 *   --debug               Enable debug mode
 *   --help                Show help
 */

const {program} = require('commander');
const path = require('path');

// Set up CLI options
program
    .version('2.0.0')
    .description('XSS Validator Burp Integration Server')
    .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
    .option('-p, --port <port>', 'Port to listen on', '8093')
    .option('-m, --max-pages <num>', 'Maximum concurrent pages', '5')
    .option('-b, --browser <browser>', 'Default browser (chromium, firefox, webkit)', 'chromium')
    .option('-d, --debug', 'Enable debug mode', false)
    .option('-q, --quiet', 'Quiet mode (minimal output)', false)
    .parse();

const options = program.opts();

// Validate options
if (!['chromium', 'firefox', 'webkit'].includes(options.browser)) {
    console.error('❌ Invalid browser. Must be one of: chromium, firefox, webkit');
    process.exit(1);
}

const port = parseInt(options.port);
if (isNaN(port) || port < 1 || port > 65535) {
    console.error('❌ Invalid port. Must be between 1 and 65535');
    process.exit(1);
}

const maxPages = parseInt(options.maxPages);
if (isNaN(maxPages) || maxPages < 1 || maxPages > 100) {
    console.error('❌ Invalid max-pages. Must be between 1 and 100');
    process.exit(1);
}

// Configure the server
process.env.XSS_VALIDATOR_HOST = options.host;
process.env.XSS_VALIDATOR_PORT = options.port;
process.env.XSS_VALIDATOR_MAX_PAGES = options.maxPages;
process.env.XSS_VALIDATOR_DEFAULT_BROWSER = options.browser;
process.env.XSS_VALIDATOR_DEBUG = options.debug;
process.env.XSS_VALIDATOR_QUIET = options.quiet;

if (!options.quiet) {
    console.log('🚀 Starting XSS Validator Burp Integration Server...');
    console.log(`📋 Configuration:`);
    console.log(`   Host: ${options.host}`);
    console.log(`   Port: ${options.port}`);
    console.log(`   Max Concurrent Pages: ${options.maxPages}`);
    console.log(`   Default Browser: ${options.browser}`);
    console.log(`   Debug Mode: ${options.debug ? 'ON' : 'OFF'}`);
    console.log('');
}

// Start the server
try {
    require('./burp-integration-server.js');
} catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('');
    console.error('Make sure you have installed the required dependencies:');
    console.error('  npm install');
    console.error('');
    console.error('And that Playwright browsers are installed:');
    console.error('  npx playwright install');
    process.exit(1);
}
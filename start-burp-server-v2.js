#!/usr/bin/env node

/**
 * Modern CLI for XSS Validator Burp Integration Server v2.0
 *
 * Enhanced features:
 * - Latest Commander.js syntax
 * - Environment variable support
 * - Configuration file support
 * - Health checks and monitoring
 * - Better error handling
 * - TypeScript-ready structure
 */

const {program} = require('commander');
const fs = require('fs').promises;
const path = require('path');

// Version and package info
const packageJson = require('./package.json');

/**
 * Configuration file schema and defaults
 */
const DEFAULT_CONFIG = {
    host: '127.0.0.1',
    port: 8093,
    maxPages: 5,
    browser: 'chromium',
    debug: false,
    quiet: false,
    logLevel: 'info',
    rateLimit: {
        max: 100,
        window: 60
    },
    timeouts: {
        request: 30000,
        page: 15000,
        execution: 3000
    }
};

/**
 * Load configuration from file if it exists
 */
async function loadConfigFile(configPath) {
    try {
        const configFile = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configFile);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // File doesn't exist, return empty config
        }
        throw new Error(`Failed to load config file: ${error.message}`);
    }
}

/**
 * Save configuration to file
 */
async function saveConfigFile(config, configPath) {
    try {
        const configDir = path.dirname(configPath);
        await fs.mkdir(configDir, {recursive: true});
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(`✅ Configuration saved to ${configPath}`);
    } catch (error) {
        throw new Error(`Failed to save config file: ${error.message}`);
    }
}

/**
 * Validate configuration values
 */
function validateConfig(config) {
    const errors = [];

    // Validate host
    if (typeof config.host !== 'string' || !config.host.trim()) {
        errors.push('Host must be a non-empty string');
    }

    // Validate port
    const port = parseInt(config.port);
    if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('Port must be between 1 and 65535');
    }

    // Validate browser
    if (!['chromium', 'firefox', 'webkit'].includes(config.browser)) {
        errors.push('Browser must be one of: chromium, firefox, webkit');
    }

    // Validate max pages
    const maxPages = parseInt(config.maxPages);
    if (isNaN(maxPages) || maxPages < 1 || maxPages > 100) {
        errors.push('Max pages must be between 1 and 100');
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }

    return {
        ...config,
        port,
        maxPages
    };
}

/**
 * Merge configurations with priority: CLI args > config file > env vars > defaults
 */
function mergeConfigurations(cliArgs, fileConfig, envConfig) {
    return {
        ...DEFAULT_CONFIG,
        ...envConfig,
        ...fileConfig,
        ...cliArgs
    };
}

/**
 * Get configuration from environment variables
 */
function getEnvConfig() {
    return {
        host: process.env.XSS_VALIDATOR_HOST,
        port: process.env.XSS_VALIDATOR_PORT,
        maxPages: process.env.XSS_VALIDATOR_MAX_PAGES,
        browser: process.env.XSS_VALIDATOR_DEFAULT_BROWSER,
        debug: process.env.XSS_VALIDATOR_DEBUG === 'true',
        quiet: process.env.XSS_VALIDATOR_QUIET === 'true',
        logLevel: process.env.LOG_LEVEL
    };
}

/**
 * Check if server is running
 */
async function checkServerHealth(host, port) {
    try {
        const axios = require('axios');
        const response = await axios.get(`http://${host}:${port}/health`, {timeout: 5000});
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return null; // Server not running
        }
        throw error;
    }
}

/**
 * Display configuration in a nice format
 */
function displayConfig(config) {
    console.log('📋 Server Configuration:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Max Concurrent Pages: ${config.maxPages}`);
    console.log(`   Default Browser: ${config.browser}`);
    console.log(`   Debug Mode: ${config.debug ? 'ON' : 'OFF'}`);
    console.log(`   Quiet Mode: ${config.quiet ? 'ON' : 'OFF'}`);
    console.log(`   Log Level: ${config.logLevel}`);
    console.log(`   Rate Limit: ${config.rateLimit.max} requests per ${config.rateLimit.window}s`);
    console.log('');
}

/**
 * Set up the CLI program
 */
program
    .name('xss-validator-server')
    .description('Modern XSS Validator Burp Integration Server')
    .version(packageJson.version)
    .option('-H, --host <host>', 'Host to bind to')
    .option('-p, --port <port>', 'Port to listen on')
    .option('-m, --max-pages <num>', 'Maximum concurrent pages')
    .option('-b, --browser <browser>', 'Default browser (chromium, firefox, webkit)')
    .option('-d, --debug', 'Enable debug mode')
    .option('-q, --quiet', 'Quiet mode (minimal output)')
    .option('-l, --log-level <level>', 'Log level (error, warn, info, debug)')
    .option('-c, --config <file>', 'Configuration file path', './config/server.json')
    .option('--save-config', 'Save current configuration to file')
    .hook('preAction', async (thisCommand) => {
        // This runs before any command
        const options = thisCommand.opts();

        // Load configurations
        const envConfig = getEnvConfig();
        const fileConfig = await loadConfigFile(options.config).catch(() => ({}));

        // Filter out undefined CLI args
        const cliArgs = Object.fromEntries(
            Object.entries(options).filter(([_, value]) => value !== undefined)
        );

        // Merge all configurations
        const config = mergeConfigurations(cliArgs, fileConfig, envConfig);

        // Store merged config for commands to use
        thisCommand.config = config;
    });

/**
 * Start command - starts the server
 */
program
    .command('start', {isDefault: true})
    .description('Start the XSS Validator server')
    .action(async () => {
        try {
            const config = program.config;
            const validatedConfig = validateConfig(config);

            // Check if server is already running
            const health = await checkServerHealth(validatedConfig.host, validatedConfig.port);
            if (health) {
                console.log(`❌ Server already running on ${validatedConfig.host}:${validatedConfig.port}`);
                console.log(`   Status: ${health.status}`);
                console.log(`   Uptime: ${health.uptime.toFixed(1)}s`);
                console.log(`   Available browsers: ${health.availableBrowsers.join(', ')}`);
                process.exit(1);
            }

            if (!validatedConfig.quiet) {
                console.log('🚀 Starting XSS Validator Server v2.0...');
                displayConfig(validatedConfig);
            }

            // Save config if requested
            if (program.opts().saveConfig) {
                await saveConfigFile(validatedConfig, program.opts().config);
            }

            // Set environment variables for the server
            Object.entries({
                XSS_VALIDATOR_HOST: validatedConfig.host,
                XSS_VALIDATOR_PORT: validatedConfig.port,
                XSS_VALIDATOR_MAX_PAGES: validatedConfig.maxPages,
                XSS_VALIDATOR_DEFAULT_BROWSER: validatedConfig.browser,
                XSS_VALIDATOR_DEBUG: validatedConfig.debug,
                XSS_VALIDATOR_QUIET: validatedConfig.quiet,
                LOG_LEVEL: validatedConfig.logLevel,
                RATE_LIMIT_MAX: validatedConfig.rateLimit.max,
                RATE_LIMIT_WINDOW: validatedConfig.rateLimit.window,
                REQUEST_TIMEOUT: validatedConfig.timeouts.request,
                PAGE_TIMEOUT: validatedConfig.timeouts.page,
                EXECUTION_TIMEOUT: validatedConfig.timeouts.execution
            }).forEach(([key, value]) => {
                process.env[key] = String(value);
            });

            // Start the server
            require('./burp-integration-server-v2.js');

        } catch (error) {
            console.error('❌ Failed to start server:', error.message);
            process.exit(1);
        }
    });

/**
 * Status command - check server status
 */
program
    .command('status')
    .description('Check server status')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
        try {
            const config = program.config;
            const health = await checkServerHealth(config.host, config.port);

            if (!health) {
                if (options.json) {
                    console.log(JSON.stringify({status: 'stopped'}));
                } else {
                    console.log(`❌ Server not running on ${config.host}:${config.port}`);
                }
                process.exit(1);
            }

            if (options.json) {
                console.log(JSON.stringify(health, null, 2));
            } else {
                console.log(`✅ Server running on ${config.host}:${config.port}`);
                console.log(`   Status: ${health.status}`);
                console.log(`   Version: ${health.version}`);
                console.log(`   Uptime: ${health.uptime.toFixed(1)}s`);
                console.log(`   Available browsers: ${health.availableBrowsers.join(', ')}`);
                console.log(`   Active requests: ${health.activeRequests}/${health.maxConcurrentPages}`);
                console.log(`   Success rate: ${health.metrics.successRate}`);
                console.log(`   Memory usage: ${(health.memory.heapUsed / 1024 / 1024).toFixed(1)}MB`);
            }

        } catch (error) {
            console.error('❌ Failed to check status:', error.message);
            process.exit(1);
        }
    });

/**
 * Test command - test server with a sample payload
 */
program
    .command('test')
    .description('Test server with a sample XSS payload')
    .option('-u, --url <url>', 'Test URL', 'http://example.com/test')
    .option('-p, --payload <payload>', 'XSS payload to test', '<script>alert("test")</script>')
    .option('-b, --browser <browser>', 'Browser to use for testing')
    .action(async (options) => {
        try {
            const config = program.config;
            const testBrowser = options.browser || config.browser;

            // Check if server is running
            const health = await checkServerHealth(config.host, config.port);
            if (!health) {
                console.log(`❌ Server not running on ${config.host}:${config.port}`);
                console.log('Start the server first with: npm run burp-server start');
                process.exit(1);
            }

            console.log(`🧪 Testing XSS detection with ${testBrowser}...`);
            console.log(`   URL: ${options.url}`);
            console.log(`   Payload: ${options.payload}`);
            console.log('');

            // Use the example script
            const {testPayload} = require('./examples/burp-integration-example.js');

            const vulnerableHtml = `
                <html>
                <head><title>Test Page</title></head>
                <body>
                    <h1>XSS Test</h1>
                    <div>User input: ${options.payload}</div>
                    <script>
                        var userInput = "${options.payload}";
                        document.body.innerHTML += userInput;
                    </script>
                </body>
                </html>
            `;

            const result = await testPayload(options.url, vulnerableHtml, options.payload, testBrowser);

            console.log('📊 Test Results:');
            console.log(`   Detected: ${result.value > 0 ? '✅ YES' : '❌ NO'}`);
            console.log(`   Message: ${result.msg}`);

            if (result.enhanced) {
                console.log(`   Severity: ${result.enhanced.severity}`);
                console.log(`   Confidence: ${(result.enhanced.confidence * 100).toFixed(1)}%`);
                console.log(`   Detection Methods: ${result.enhanced.detectionMethods.join(', ')}`);
                console.log(`   Analysis Time: ${result.enhanced.timing?.analysisTime || 'N/A'}ms`);
            }

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Config command - manage configuration
 */
program
    .command('config')
    .description('Manage server configuration')
    .option('-s, --show', 'Show current configuration')
    .option('-e, --edit', 'Edit configuration file')
    .option('-r, --reset', 'Reset to default configuration')
    .action(async (options) => {
        try {
            const configPath = program.opts().config;

            if (options.show) {
                const config = program.config;
                console.log('📋 Current Configuration:');
                console.log(JSON.stringify(config, null, 2));
                return;
            }

            if (options.edit) {
                const {spawn} = require('child_process');
                const editor = process.env.EDITOR || 'nano';

                // Create config file if it doesn't exist
                try {
                    await fs.access(configPath);
                } catch {
                    await saveConfigFile(DEFAULT_CONFIG, configPath);
                }

                const child = spawn(editor, [configPath], {stdio: 'inherit'});
                child.on('exit', (code) => {
                    if (code === 0) {
                        console.log('✅ Configuration updated');
                    } else {
                        console.log('❌ Editor exited with error');
                    }
                });
                return;
            }

            if (options.reset) {
                await saveConfigFile(DEFAULT_CONFIG, configPath);
                console.log('✅ Configuration reset to defaults');
                return;
            }

            // Default: show help
            program.help();

        } catch (error) {
            console.error('❌ Config operation failed:', error.message);
            process.exit(1);
        }
    });

/**
 * Logs command - show server logs
 */
program
    .command('logs')
    .description('Show server logs')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <num>', 'Number of lines to show', '50')
    .option('-l, --level <level>', 'Log level filter (error, warn, info, debug)')
    .action(async (options) => {
        try {
            const logFile = 'logs/combined.log';

            if (options.follow) {
                const {spawn} = require('child_process');
                const tail = spawn('tail', ['-f', '-n', options.lines, logFile]);

                tail.stdout.on('data', (data) => {
                    process.stdout.write(data);
                });

                tail.stderr.on('data', (data) => {
                    process.stderr.write(data);
                });

                process.on('SIGINT', () => {
                    tail.kill();
                    process.exit(0);
                });

            } else {
                try {
                    const logs = await fs.readFile(logFile, 'utf8');
                    const lines = logs.split('\n').slice(-options.lines);

                    lines.forEach(line => {
                        if (line.trim()) {
                            try {
                                const logEntry = JSON.parse(line);
                                if (!options.level || logEntry.level === options.level) {
                                    console.log(`${logEntry.timestamp} [${logEntry.level.toUpperCase()}] ${logEntry.message}`);
                                }
                            } catch {
                                console.log(line); // Non-JSON log line
                            }
                        }
                    });
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        console.log('📝 No log file found. Start the server to generate logs.');
                    } else {
                        throw error;
                    }
                }
            }

        } catch (error) {
            console.error('❌ Failed to show logs:', error.message);
            process.exit(1);
        }
    });

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Parse command line arguments
program.parse();

module.exports = {
    DEFAULT_CONFIG,
    loadConfigFile,
    saveConfigFile,
    validateConfig,
    mergeConfigurations
};
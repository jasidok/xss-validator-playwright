#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { detectXSS } = require('./xssValidator');
const { loadConfig, updateConfig, resetConfig, getConfigPath } = require('./config');
const { createCategorizedPayloadFile, generatePayloads, CONTEXT_TYPES, ATTRIBUTE_TYPES } = require('./payloads/generator');
const { getMostEffectivePayloads } = require('./payloads/effectiveness');
const { crawlWebsite, testDiscoveredInputs } = require('./crawler');

// Setup command for browser installation and management
program
    .command('setup')
    .description('Setup and manage Playwright browsers')
    .option('-c, --check', 'Check browser installation status')
    .option('-i, --install [browsers]', 'Install browsers (all, chromium, firefox, webkit)')
    .option('-f, --force', 'Force reinstallation of browsers')
    .action(async (options) => {
        try {
            const {checkBrowsersAvailable} = require('./utils/browser');
            const {installBrowsers} = require('./scripts/install-browsers');
            const {spawn} = require('child_process');

            if (options.check) {
                console.log('🔍 Checking browser installation status...');
                const browserStatus = await checkBrowsersAvailable();

                if (browserStatus.isInstalled) {
                    console.log(`✅ Browsers installed: ${browserStatus.available.join(', ')}`);

                    if (browserStatus.errors.length > 0) {
                        console.log('\n⚠️  Some browsers have issues:');
                        browserStatus.errors.forEach(error => console.log(`  - ${error}`));
                    }
                } else {
                    console.log('❌ No browsers are installed');
                    if (browserStatus.errors.length > 0) {
                        console.log('\nErrors found:');
                        browserStatus.errors.forEach(error => console.log(`  - ${error}`));
                    }
                    console.log('\n🔧 Run "xss-validator setup --install" to install browsers');
                }
            } else if (options.install !== undefined) {
                const browsersToInstall = options.install || 'chromium';
                console.log(`🚀 Installing browsers: ${browsersToInstall}`);

                // Set environment variable for the installation script
                process.env.BROWSERS = browsersToInstall;

                if (options.force) {
                    console.log('🔄 Force reinstallation enabled');
                    process.env.FORCE_INSTALL = 'true';
                }

                try {
                    await installBrowsers();
                    console.log('✅ Browser installation completed!');

                    // Check status after installation
                    const browserStatus = await checkBrowsersAvailable();
                    console.log(`📊 Installed browsers: ${browserStatus.available.join(', ')}`);
                } catch (error) {
                    console.error('❌ Installation failed:', error.message);
                    console.log('\n🔧 Manual installation commands:');
                    console.log(`npm run setup:${browsersToInstall}`);
                    console.log('or');
                    console.log(`npx playwright install --with-deps ${browsersToInstall}`);
                    process.exit(1);
                }
            } else {
                // Default behavior - show status and install if needed
                console.log('🔍 Checking browser installation...');
                const browserStatus = await checkBrowsersAvailable();

                if (browserStatus.isInstalled) {
                    console.log(`✅ Browsers ready: ${browserStatus.available.join(', ')}`);
                } else {
                    console.log('❌ No browsers installed. Installing Chromium...');
                    process.env.BROWSERS = 'chromium';

                    try {
                        await installBrowsers();
                        console.log('✅ Chromium installation completed!');
                    } catch (error) {
                        console.error('❌ Installation failed:', error.message);
                        console.log('\n🔧 Manual installation:');
                        console.log('npm run setup:chromium');
                        process.exit(1);
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

// Get version from package.json
const packageJson = require('./package.json');
const version = packageJson.version || '1.0.0';

program
  .name('xss-validator')
  .description('A tool for detecting XSS vulnerabilities using Playwright')
  .version(version);

// Detect command
program
  .command('detect <url> <selector>')
  .description('Detect XSS vulnerabilities in a web page')
  .option('-b, --browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
  .option('-s, --submit <selector>', 'CSS selector for the submit button')
  .option('-t, --timeout <ms>', 'Global timeout in milliseconds', parseInt)
  .option('--navigation-timeout <ms>', 'Timeout for page navigation in milliseconds', parseInt)
  .option('--action-timeout <ms>', 'Timeout for actions like clicking and filling forms in milliseconds', parseInt)
  .option('--wait-timeout <ms>', 'Timeout for waitForSelector and similar operations in milliseconds', parseInt)
  .option('--execution-timeout <ms>', 'Timeout for JavaScript execution verification in milliseconds', parseInt)
  .option('-n, --no-verify', 'Disable JavaScript execution verification')
  .option('-p, --payloads <file>', 'Path to a JSON file containing payloads')
  .option('-e, --effective', 'Use the most effective payloads')
  .option('-l, --limit <number>', 'Limit the number of payloads to use', parseInt)
  .option('-r, --report <format>', 'Report format (json, html, both)')
  .option('-o, --output <dir>', 'Directory to save the report')
  .option('-f, --filename <name>', 'Base filename for the report')
  .option('-a, --auth <file>', 'Path to a JSON file containing authentication configuration')
  .option('-c, --config <file>', 'Path to a configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-p, --progress [interval]', 'Show progress indicators (optionally specify update interval)', parseInt)
  .option('--no-progress', 'Disable progress indicators')
  .option('--retry [attempts]', 'Enable retry mechanism for flaky operations (optionally specify max attempts)', parseInt)
  .option('--no-retry', 'Disable retry mechanism')
  .option('--retry-delay <ms>', 'Delay between retry attempts in milliseconds', parseInt)
  .option('--no-exponential-backoff', 'Disable exponential backoff for retry delays')
  .option('--retry-operations <operations>', 'Comma-separated list of operations to retry (navigation, submission, input)')
  .action(async (url, selector, options) => {
    try {
      // Load configuration
      let config = {};

      if (options.config) {
        config = loadConfig(options.config);
      } else {
        config = loadConfig();
      }

      // Build options object from command line arguments
      const detectOptions = {};

      if (options.browser) detectOptions.browser = options.browser;
      if (options.submit) detectOptions.submitSelector = options.submit;
      if (options.verify === false) detectOptions.verifyExecution = false;

      // Configure timeouts
      if (options.timeout || options.navigationTimeout || options.actionTimeout || 
          options.waitTimeout || options.executionTimeout) {

        detectOptions.timeouts = { ...config.timeouts };

        if (options.timeout) {
          detectOptions.timeouts.global = options.timeout;
          if (options.verbose) {
            console.log(`Global timeout set to ${options.timeout}ms`);
          }
        }

        if (options.navigationTimeout) {
          detectOptions.timeouts.navigation = options.navigationTimeout;
          if (options.verbose) {
            console.log(`Navigation timeout set to ${options.navigationTimeout}ms`);
          }
        }

        if (options.actionTimeout) {
          detectOptions.timeouts.action = options.actionTimeout;
          if (options.verbose) {
            console.log(`Action timeout set to ${options.actionTimeout}ms`);
          }
        }

        if (options.waitTimeout) {
          detectOptions.timeouts.waitFor = options.waitTimeout;
          if (options.verbose) {
            console.log(`Wait timeout set to ${options.waitTimeout}ms`);
          }
        }

        if (options.executionTimeout) {
          detectOptions.timeouts.execution = options.executionTimeout;
          if (options.verbose) {
            console.log(`Execution timeout set to ${options.executionTimeout}ms`);
          }
        }
      }

      if (options.report) {
        detectOptions.report = {
          format: options.report,
          outputDir: options.output || './reports',
          filename: options.filename || `xss-report-${new Date().toISOString().replace(/:/g, '-')}`
        };
      }

      if (options.effective || options.limit) {
        detectOptions.effectiveness = {
          useEffectivePayloads: options.effective || false,
          limit: options.limit || 10
        };
      }

      // Load custom payloads if specified
      let customPayloads = null;
      if (options.payloads) {
        try {
          const payloadsPath = path.resolve(options.payloads);
          customPayloads = JSON.parse(fs.readFileSync(payloadsPath, 'utf8'));
          console.log(`Loaded payloads from ${payloadsPath}`);
        } catch (error) {
          console.error(`Error loading payloads: ${error.message}`);
          process.exit(1);
        }
      }

      // Load authentication configuration if specified
      if (options.auth) {
        try {
          const authPath = path.resolve(options.auth);
          const authConfig = JSON.parse(fs.readFileSync(authPath, 'utf8'));
          detectOptions.auth = authConfig;
          console.log(`Loaded authentication configuration from ${authPath}`);
        } catch (error) {
          console.error(`Error loading authentication configuration: ${error.message}`);
          process.exit(1);
        }
      }

      // Configure logging options
      detectOptions.logging = {
        ...detectOptions.logging
      };

      // Enable verbose logging if specified
      if (options.verbose) {
        console.log('Verbose logging enabled');
        detectOptions.logging.verbose = true;
      }

      // Configure progress indicators
      if (options.progress === false) {
        // --no-progress flag was used
        detectOptions.logging.showProgress = false;
        if (options.verbose) {
          console.log('Progress indicators disabled');
        }
      } else if (options.progress) {
        // --progress flag was used with a value
        detectOptions.logging.showProgress = true;
        detectOptions.logging.progressUpdateInterval = options.progress;
        if (options.verbose) {
          console.log(`Progress indicators enabled with update interval: ${options.progress}`);
        }
      } else if (options.progress === true) {
        // --progress flag was used without a value
        detectOptions.logging.showProgress = true;
        if (options.verbose) {
          console.log('Progress indicators enabled with default update interval');
        }
      }

      // Configure retry mechanism
      if (options.retry === false) {
        // --no-retry flag was used
        detectOptions.retry = { enabled: false };
        if (options.verbose) {
          console.log('Retry mechanism disabled');
        }
      } else if (options.retry) {
        // --retry flag was used with a value
        detectOptions.retry = { 
          enabled: true,
          maxAttempts: options.retry
        };
        if (options.verbose) {
          console.log(`Retry mechanism enabled with max attempts: ${options.retry}`);
        }
      } else if (options.retry === true) {
        // --retry flag was used without a value
        detectOptions.retry = { enabled: true };
        if (options.verbose) {
          console.log('Retry mechanism enabled with default settings');
        }
      }

      // Configure retry delay if specified
      if (options.retryDelay) {
        if (!detectOptions.retry) {
          detectOptions.retry = { enabled: true };
        }
        detectOptions.retry.delay = options.retryDelay;
        if (options.verbose) {
          console.log(`Retry delay set to ${options.retryDelay}ms`);
        }
      }

      // Configure exponential backoff
      if (options.exponentialBackoff === false) {
        if (!detectOptions.retry) {
          detectOptions.retry = { enabled: true };
        }
        detectOptions.retry.exponentialBackoff = false;
        if (options.verbose) {
          console.log('Exponential backoff for retry delays disabled');
        }
      }

      // Configure retry operations
      if (options.retryOperations) {
        if (!detectOptions.retry) {
          detectOptions.retry = { enabled: true };
        }
        detectOptions.retry.operations = options.retryOperations.split(',');
        if (options.verbose) {
          console.log(`Retry operations set to: ${detectOptions.retry.operations.join(', ')}`);
        }
      }

      if (options.verbose) {
        console.log('Options:', detectOptions);
      }

      // Run the detection
      console.log(`Detecting XSS vulnerabilities in ${url} with selector ${selector}...`);
      const result = await detectXSS(url, selector, customPayloads, detectOptions);

      // Print results
      console.log(`\nDetection completed. Found ${result.results.length} vulnerabilities.`);

      if (result.results.length > 0) {
        console.log('\nVulnerabilities:');
        result.results.forEach((vuln, index) => {
          console.log(`\n${index + 1}. Payload: ${vuln.payload}`);
          console.log(`   Reflected: ${vuln.reflected}`);
          console.log(`   Executed: ${vuln.executed}`);
        });
      }

      if (result.reportPaths && Object.keys(result.reportPaths).length > 0) {
        console.log('\nReports:');
        for (const [format, path] of Object.entries(result.reportPaths)) {
          console.log(`${format.toUpperCase()}: ${path}`);
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .option('-s, --show', 'Show current configuration')
  .option('-r, --reset', 'Reset configuration to defaults')
  .option('-p, --path', 'Show configuration file path')
  .option('-u, --update <file>', 'Update configuration from a JSON file')
  .action((options) => {
    try {
      if (options.path) {
        console.log(`Configuration file path: ${getConfigPath()}`);
      } else if (options.reset) {
        resetConfig();
        console.log('Configuration reset to defaults');
      } else if (options.update) {
        try {
          const updatePath = path.resolve(options.update);
          const updateData = JSON.parse(fs.readFileSync(updatePath, 'utf8'));
          updateConfig(updateData);
          console.log(`Configuration updated from ${updatePath}`);
        } catch (error) {
          console.error(`Error updating configuration: ${error.message}`);
          process.exit(1);
        }
      } else {
        // Default to showing the configuration
        const config = loadConfig();
        console.log('Current configuration:');
        console.log(JSON.stringify(config, null, 2));
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Payloads command
program
  .command('payloads')
  .description('Manage payloads')
  .option('-g, --generate <file>', 'Generate a categorized payload file')
  .option('-c, --context <context>', 'Generate payloads for a specific context (html, attribute, javascript, url, css)')
  .option('-a, --attribute <type>', 'Attribute type for attribute context (unquoted, single-quoted, double-quoted, event-handler)')
  .option('-e, --effective [limit]', 'Show most effective payloads', parseInt)
  .option('-b, --browser <browser>', 'Browser to filter effective payloads by')
  .action((options) => {
    try {
      if (options.generate) {
        const filePath = createCategorizedPayloadFile(options.generate);
        console.log(`Generated categorized payload file: ${filePath}`);
      } else if (options.context) {
        let context = options.context;
        let attributeType = options.attribute || ATTRIBUTE_TYPES.UNQUOTED;

        // Map context string to constant
        switch (context.toLowerCase()) {
          case 'html':
            context = CONTEXT_TYPES.HTML;
            break;
          case 'attribute':
            context = CONTEXT_TYPES.ATTRIBUTE;
            break;
          case 'javascript':
          case 'js':
            context = CONTEXT_TYPES.JS;
            break;
          case 'url':
            context = CONTEXT_TYPES.URL;
            break;
          case 'css':
            context = CONTEXT_TYPES.CSS;
            break;
        }

        // Map attribute type string to constant
        if (options.attribute) {
          switch (options.attribute.toLowerCase()) {
            case 'unquoted':
              attributeType = ATTRIBUTE_TYPES.UNQUOTED;
              break;
            case 'single-quoted':
            case 'single':
              attributeType = ATTRIBUTE_TYPES.SINGLE_QUOTED;
              break;
            case 'double-quoted':
            case 'double':
              attributeType = ATTRIBUTE_TYPES.DOUBLE_QUOTED;
              break;
            case 'event-handler':
            case 'event':
              attributeType = ATTRIBUTE_TYPES.EVENT_HANDLER;
              break;
          }
        }

        const payloads = generatePayloads(context, { attributeType });
        console.log(`Generated ${payloads.length} payloads for ${context} context:`);
        payloads.forEach(p => console.log(`- ${p}`));
      } else if (options.effective) {
        const limit = typeof options.effective === 'number' ? options.effective : 10;
        const browser = options.browser || null;

        const effectivePayloads = getMostEffectivePayloads(limit, browser);

        if (effectivePayloads.length === 0) {
          console.log('No effectiveness data found. Run some tests first to collect data.');
        } else {
          console.log(`Top ${effectivePayloads.length} most effective payloads:`);
          effectivePayloads.forEach((p, i) => {
            console.log(`${i + 1}. ${p.payload}`);
            console.log(`   Execution Score: ${(p.executionScore * 100).toFixed(1)}%`);
            console.log(`   Reflection Score: ${(p.reflectionScore * 100).toFixed(1)}%`);
            console.log(`   Tests: ${p.totalTests}`);
          });
        }
      } else {
        console.log('No action specified. Use --help to see available options.');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Crawl command
program
  .command('crawl <url>')
  .description('Crawl a website to discover testable input fields')
  .option('-b, --browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
  .option('-d, --depth <depth>', 'Maximum crawl depth', parseInt, 3)
  .option('-p, --pages <pages>', 'Maximum number of pages to crawl', parseInt, 50)
  .option('-e, --exclude <patterns>', 'Comma-separated URL patterns to exclude')
  .option('-s, --stay-on-domain', 'Stay on the same domain', true)
  .option('-f, --follow-external', 'Follow external links', false)
  .option('-a, --auth <file>', 'Path to a JSON file containing authentication configuration')
  .option('-t, --test', 'Test discovered inputs for XSS vulnerabilities')
  .option('-o, --output <file>', 'Save discovered inputs to a JSON file')
  .action(async (url, options) => {
    try {
      // Parse exclude patterns
      const excludePatterns = options.exclude ? options.exclude.split(',') : [];

      // Build crawl options
      const crawlOptions = {
        browser: options.browser,
        maxDepth: options.depth,
        maxPages: options.pages,
        excludePatterns,
        stayOnDomain: options.stayOnDomain,
        followExternalLinks: options.followExternal
      };

      // Load authentication configuration if specified
      if (options.auth) {
        try {
          const authPath = path.resolve(options.auth);
          const authConfig = JSON.parse(fs.readFileSync(authPath, 'utf8'));
          crawlOptions.auth = authConfig;
          console.log(`Loaded authentication configuration from ${authPath}`);
        } catch (error) {
          console.error(`Error loading authentication configuration: ${error.message}`);
          process.exit(1);
        }
      }

      console.log(`Crawling ${url} with max depth ${options.depth} and max pages ${options.pages}...`);
      const inputFields = await crawlWebsite(url, crawlOptions);

      console.log(`\nDiscovered ${inputFields.length} input fields:`);
      inputFields.forEach((input, index) => {
        console.log(`\n${index + 1}. URL: ${input.url}`);
        console.log(`   Selector: ${input.selector}`);
        console.log(`   Type: ${input.type}`);
        if (input.submitSelector) {
          console.log(`   Submit Selector: ${input.submitSelector}`);
        }
      });

      // Save discovered inputs to a file if specified
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(inputFields, null, 2));
        console.log(`\nSaved discovered inputs to ${outputPath}`);
      }

      // Test discovered inputs if specified
      if (options.test) {
        console.log('\nTesting discovered inputs for XSS vulnerabilities...');

        // Load configuration
        const config = loadConfig();

        // Test each input field
        const testResults = await testDiscoveredInputs(inputFields, detectXSS, config);

        // Count vulnerabilities
        const vulnerableInputs = testResults.filter(result => 
          result.result && result.result.results && result.result.results.length > 0
        );

        console.log(`\nTesting completed. Found vulnerabilities in ${vulnerableInputs.length} out of ${inputFields.length} inputs.`);

        // Display vulnerable inputs
        if (vulnerableInputs.length > 0) {
          console.log('\nVulnerable inputs:');
          vulnerableInputs.forEach((result, index) => {
            console.log(`\n${index + 1}. URL: ${result.input.url}`);
            console.log(`   Selector: ${result.input.selector}`);
            console.log(`   Vulnerabilities: ${result.result.results.length}`);

            // Show the first few payloads that worked
            const maxPayloads = 3;
            const payloads = result.result.results.slice(0, maxPayloads);
            payloads.forEach((vuln, i) => {
              console.log(`   Payload ${i + 1}: ${vuln.payload}`);
              console.log(`     Reflected: ${vuln.reflected}, Executed: ${vuln.executed}`);
            });

            if (result.result.results.length > maxPayloads) {
              console.log(`   ... and ${result.result.results.length - maxPayloads} more payloads`);
            }

            // Show report paths if available
            if (result.result.reportPaths && Object.keys(result.result.reportPaths).length > 0) {
              console.log('   Reports:');
              for (const [format, path] of Object.entries(result.result.reportPaths)) {
                console.log(`     ${format.toUpperCase()}: ${path}`);
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}

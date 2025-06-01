# XSS Validator Playwright

A comprehensive XSS (Cross-Site Scripting) vulnerability testing tool built with Playwright that provides automated
detection of XSS vulnerabilities across web applications.

## Features

### Core Functionality

- 🔍 **JavaScript Execution Verification** - Detects actual XSS vulnerabilities by verifying payload execution
- 🌐 **Multi-Browser Support** - Works with Chromium, Firefox, and WebKit via Playwright
- 🔐 **Authentication Support** - Test protected pages with session handling
- 📱 **Form Handling** - Robust form submission mechanism for different form types
- 🎯 **DOM-based XSS Detection** - Identifies client-side XSS vulnerabilities
- 📊 **Detailed Reporting** - Generates comprehensive HTML and JSON reports

### Payload Management

- 📦 **Comprehensive Payload Library** - Pre-configured XSS payloads in JSON format
- 🏷️ **Payload Categorization** - Organized by attack type and browser target
- 📈 **Effectiveness Scoring** - Tracks payload success rates
- ⚡ **Custom Payload Generator** - Create context-specific payloads

### Configuration & Usability

- ⚙️ **Configuration Files** - Persistent settings management
- 💻 **Command Line Interface** - Full CLI with multiple testing scenarios
- 🌐 **Web UI** - Simple web interface for configuration and results
- 🕷️ **Website Crawling** - Automatic discovery of testable inputs
- 📝 **Progress Indicators** - Real-time testing progress and verbose logging

### Advanced Features

- 🚀 **Parallel Testing** - Multi-threaded testing across pages and inputs
- 💾 **Smart Caching** - Avoids redundant tests
- 🔄 **Retry Mechanisms** - Handles flaky network conditions
- 🎯 **Smart Payload Selection** - Optimized testing strategies
- 🔌 **Burp Suite Integration** - Professional security testing workflow

## Installation

### Prerequisites

- Node.js 14+
- npm or yarn

### Install Dependencies

```bash
npm install
```

This will install all required dependencies including Playwright browsers.

## Quick Start

### Basic XSS Testing

```bash
# Test a single URL
node cli.js test --url https://example.com/login --payloads basic

# Test with authentication
node cli.js test --url https://example.com/dashboard --auth-url https://example.com/login --username user --password pass

# Crawl and test entire site
node cli.js crawl --url https://example.com --max-depth 3
```

### Web UI

```bash
# Start the web interface
node cli.js ui --port 3000
```

Then open http://localhost:3000 in your browser.

### Demo Application

Test the tool with the included vulnerable demo app:

```bash
# Start demo app
cd demo-app && npm install && node server.js

# Test demo app (in another terminal)
node cli.js test --url http://localhost:8080
```

## Configuration

### Configuration File

Create a `xss-validator.config.json` file:

```json
{
  "browser": "chromium",
  "headless": true,
  "timeout": 30000,
  "maxConcurrency": 5,
  "payloadSets": ["basic", "advanced"],
  "reporting": {
    "format": "html",
    "outputDir": "./reports"
  }
}
```

### Environment Variables

```bash
export XSS_VALIDATOR_CONFIG=/path/to/config.json
export XSS_VALIDATOR_HEADLESS=false
export XSS_VALIDATOR_BROWSER=firefox
```

## Documentation

- [API Documentation](docs/api.md)
- [Web UI Guide](docs/web-ui-guide.md)
- [Burp Suite Integration](docs/burp-integration.md)
- [CI/CD Integration](docs/ci-cd-integration.md)
- [Troubleshooting](docs/troubleshooting.md)

## Project Structure

```
xss-validator-playwright/
├── cli.js                 # Command line interface
├── xssValidator.js        # Core validation engine
├── crawler.js             # Web crawling functionality
├── config/                # Configuration management
├── docs/                  # Documentation
├── demo-app/              # Vulnerable test application
├── burp-extension/        # Burp Suite integration
├── webui/                 # Web interface
├── payloads/              # XSS payload library
├── tests/                 # Test suite
└── utils/                 # Utility functions
```

## Testing

Run the test suite:

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Security

This tool is designed for authorized security testing only. Users are responsible for ensuring they have proper
authorization before testing any web applications.

## Roadmap

See [docs/tasks.md](docs/tasks.md) for completed features and future enhancements.
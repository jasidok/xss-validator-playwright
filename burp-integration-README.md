# Modern XSS Validator - Burp Suite Integration

This is a modern, Playwright-based replacement for the legacy PhantomJS XSS Validator that integrates seamlessly with
Burp Suite for enhanced XSS detection.

## Overview

The modern XSS Validator provides:

- **Multi-browser support**: Test XSS payloads across Chromium, Firefox, and WebKit
- **Enhanced detection**: Advanced JavaScript execution verification and DOM-based XSS detection
- **Performance optimization**: Browser pooling and concurrent request handling
- **Detailed analysis**: Confidence scoring, severity ratings, and comprehensive reporting
- **Easy integration**: Drop-in replacement for the original PhantomJS script

## Architecture

```
┌─────────────────┐    HTTP POST    ┌──────────────────────┐    ┌─────────────────┐
│   Burp Suite    │ ────────────►   │  Integration Server  │ ───► │  Playwright     │
│                 │                 │  (Node.js/Express)   │      │  Browser Pool   │
│ ┌─────────────┐ │                 │                      │      │                 │
│ │  Extension  │ │ ◄────────────   │  ┌─────────────────┐ │ ◄──── │ ┌─────────────┐ │
│ └─────────────┘ │    JSON         │  │ XSS Detection   │ │      │ │ Chromium    │ │
│                 │   Response      │  │ Engine          │ │      │ │ Firefox     │ │
│ ┌─────────────┐ │                 │  └─────────────────┘ │      │ │ WebKit      │ │
│ │  Intruder   │ │                 │                      │      │ └─────────────┘ │
│ └─────────────┘ │                 └──────────────────────┘      └─────────────────┘
└─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### 2. Start the Integration Server

```bash
# Using the CLI tool (recommended)
node start-burp-server.js

# Or with custom options
node start-burp-server.js --port 8093 --browser chromium --debug

# Or directly
node burp-integration-server.js
```

### 3. Configure Burp Suite

1. **Install the extension**: Load `burp-extension/ModernXSSValidator.py` in Burp Suite
2. **Configure server**: Set server host/port in the extension configuration tab
3. **Test connection**: Use the "Test Connection" button to verify connectivity
4. **Enable auto-testing**: Check "Auto-test responses" for automatic testing

## Server Configuration

### Command Line Options

```bash
node start-burp-server.js [options]

Options:
  -h, --host <host>         Host to bind to (default: 127.0.0.1)
  -p, --port <port>         Port to listen on (default: 8093)
  -m, --max-pages <num>     Maximum concurrent pages (default: 5)
  -b, --browser <browser>   Default browser (chromium, firefox, webkit)
  -d, --debug               Enable debug mode
  -q, --quiet               Quiet mode (minimal output)
  --help                    Show help
```

### Environment Variables

You can also configure the server using environment variables:

```bash
export XSS_VALIDATOR_HOST=127.0.0.1
export XSS_VALIDATOR_PORT=8093
export XSS_VALIDATOR_MAX_PAGES=5
export XSS_VALIDATOR_DEFAULT_BROWSER=chromium
export XSS_VALIDATOR_DEBUG=true
export XSS_VALIDATOR_QUIET=false
```

## API Endpoints

### `POST /`

Main XSS detection endpoint compatible with the original PhantomJS script.

**Request Format:**

```json
{
  "http-response": "base64_encoded_html",
  "http-url": "base64_encoded_url", 
  "http-headers": "base64_encoded_headers",
  "payload": "xss_payload_string",
  "browser": "chromium|firefox|webkit"
}
```

**Response Format:**

```json
{
  "value": 1,
  "msg": "XSS found: alert(1)",
  "enhanced": {
    "severity": "high",
    "confidence": 0.95,
    "detectionMethods": ["javascript_execution", "dom_manipulation"],
    "context": {
      "triggeredEvents": 45,
      "domAnalysis": {
        "scriptTags": 3,
        "payloadInAttributes": 1
      }
    },
    "timing": {
      "totalTime": 2341,
      "analysisTime": 1876
    }
  }
}
```

### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "activeRequests": 2,
  "maxConcurrentPages": 5,
  "availableBrowsers": ["chromium", "firefox", "webkit"],
  "uptime": 3600.5
}
```

### `GET /stats`

Server statistics endpoint.

### `POST /browser/:action`

Browser management endpoint for restarting browsers.

## Enhanced Detection Features

### 1. JavaScript Execution Verification

The server injects comprehensive monitoring scripts that detect:

- `alert()`, `confirm()`, `prompt()` calls
- `console.log()` and `console.error()` output
- `document.write()` executions
- `setTimeout()` and `setInterval()` with string callbacks
- DOM mutations and script injections
- JavaScript errors that may indicate execution attempts

### 2. Event Handler Testing

Automatically triggers events on page elements to activate event-based XSS:

- Mouse events: `mouseover`, `mouseout`, `mousemove`, `click`, etc.
- Keyboard events: `keydown`, `keyup`, `keypress`
- Focus events: `focus`, `blur`
- Load events: `load`, `error`

### 3. DOM Analysis

Performs comprehensive DOM analysis to detect:

- Script tag injections
- Event handler attribute injections
- Suspicious `javascript:` URLs
- iframe injections
- Attribute modifications

### 4. Encoding Detection

Tests for various encoding scenarios:

- URL encoding
- HTML entity encoding
- Mixed encoding cases
- Decoded payload reflections

## Burp Extension Features

### Configuration Tab

- Server connection settings
- Browser selection and management
- Detection thresholds and timeouts
- Auto-testing configuration

### Results Tab

- Real-time vulnerability detection results
- Severity-based color coding
- Filtering and export capabilities
- Detailed analysis information

### Scanner Tab

- Manual payload testing
- Custom URL and payload input
- Browser selection for testing
- Immediate response analysis

### Integration Features

- Automatic testing of HTTP responses
- Context menu integration
- Intruder attack result processing
- Parameter-based payload injection

## Performance Optimizations

### Browser Pool Management

- Pre-initialized browser instances
- Context reuse for improved performance
- Automatic cleanup and resource management
- Configurable concurrency limits

### Request Handling

- Asynchronous processing
- Rate limiting to prevent overload
- Request queuing and prioritization
- Graceful error handling and recovery

### Memory Management

- Automatic page cleanup
- Context isolation
- Resource monitoring
- Garbage collection optimization

## Comparison with Original

| Feature | Original PhantomJS | Modern Playwright |
|---------|-------------------|-------------------|
| Browser Support | WebKit only | Chromium, Firefox, WebKit |
| Detection Methods | Basic alert() hooks | Comprehensive JS monitoring |
| Event Testing | Simple mouse events | Full event simulation |
| DOM Analysis | Limited | Advanced mutation detection |
| Performance | Single-threaded | Multi-browser, concurrent |
| Encoding Support | Basic | Advanced encoding detection |
| Error Handling | Minimal | Comprehensive error recovery |
| Reporting | Simple text | Detailed JSON with confidence |
| Maintenance | Deprecated PhantomJS | Modern, actively maintained |

## Troubleshooting

### Common Issues

1. **Connection Failed**
   ```bash
   # Check if server is running
   curl http://127.0.0.1:8093/health
   
   # Check for port conflicts
   netstat -tulpn | grep 8093
   ```

2. **Browser Installation Issues**
   ```bash
   # Reinstall Playwright browsers
   npx playwright install --force
   
   # Check browser installation
   npx playwright --version
   ```

3. **Performance Issues**
   ```bash
   # Reduce concurrent pages
   node start-burp-server.js --max-pages 2
   
   # Use single browser type
   node start-burp-server.js --browser chromium
   ```

4. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=4096 start-burp-server.js
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
node start-burp-server.js --debug
```

This provides:

- Request processing details
- Browser initialization status
- Payload analysis information
- Performance timing data
- Error stack traces

### Log Analysis

Monitor the server logs for:

- Request processing times
- Browser pool status
- Detection accuracy metrics
- Error patterns
- Resource usage

## Security Considerations

### Network Security

- Server binds to localhost by default
- No external network exposure required
- All communication over HTTP (local only)

### Browser Security

- Browsers run in headless mode
- Security features intentionally disabled for testing
- Isolated contexts prevent cross-contamination
- Automatic cleanup prevents resource leaks

### Data Handling

- No persistent storage of test data
- In-memory processing only
- Automatic data cleanup after processing
- No logging of sensitive payloads (in non-debug mode)

## Integration Examples

### Basic Intruder Testing

1. Set up Intruder attack with XSS payloads
2. Configure positions on input parameters
3. Enable auto-testing in the extension
4. Start the attack - results appear automatically

### Manual Testing

1. Open the extension Scanner tab
2. Enter target URL and custom payload
3. Select browser engine
4. Click "Test for XSS"
5. Review detailed results

### Batch Testing

```bash
# Process multiple URLs with custom payloads
curl -X POST http://127.0.0.1:8093/ \
  -H "Content-Type: application/json" \
  -d '{
    "http-response": "base64_encoded_html",
    "http-url": "base64_encoded_url",
    "payload": "<script>alert(1)</script>",
    "browser": "chromium"
  }'
```

## Contributing

To improve the Burp integration:

1. **Server Enhancements**: Modify `burp-integration-server.js`
2. **Extension Features**: Update `burp-extension/ModernXSSValidator.py`
3. **Detection Logic**: Enhance the JavaScript injection and analysis
4. **Performance**: Optimize browser pool management
5. **Documentation**: Update this README and code comments

## License

This project maintains the same license as the original XSS Validator while incorporating modern enhancements and
Playwright integration.
# XSS Validator Burp Extension Installation Guide

This guide explains how to install and use the XSS Validator Burp Suite extension.

## Installation

### Step 1: Prerequisites

1. **Burp Suite Pro** (required for extensions)
2. **Node.js** installed on your system
3. **XSS Validator** tool (this project)

### Step 2: Install the Extension

1. Open Burp Suite Pro
2. Go to **Extender** → **Extensions**
3. Click **Add**
4. Select **Extension type**: Python
5. Select **Extension file**: Browse to `burp-extension/XSSValidatorExtension.py`
6. Click **Next**

### Step 3: Configure the Extension

1. Go to the **XSS Validator** tab in Burp
2. Configure the following settings:
    - **XSS Validator Path**: Full path to your XSS validator directory (e.g.,
      `/home/dok/tools/xss-validator-playwright`)
    - **Node.js Path**: Path to your Node.js executable (usually just `node`)
    - **Browser**: Choose between `chromium`, `firefox`, or `webkit`
    - **Input Selectors**: CSS selectors for input fields to test
    - **Options**:
        - ✅ **Verify JavaScript Execution**: Confirms XSS actually executes
        - ✅ **Auto-scan detected forms**: Automatically tests forms found during browsing
        - ✅ **Include reflected-only XSS**: Reports XSS even if not executed

## Usage

### Manual Testing

1. Navigate to the **XSS Validator** tab
2. Enter a target URL in the **Manual Test** section
3. Click **Run XSS Test**
4. Results will appear in the **Results** section
5. Vulnerabilities will automatically be added to Burp's **Issues** list

### Automatic Testing

1. Enable **Auto-scan detected forms** in the configuration
2. Browse the target application normally
3. The extension will automatically test forms it detects
4. Check the **XSS Validator** tab for results
5. Check **Target** → **Issues** for discovered vulnerabilities

## Features

### 🔍 **Real Browser Verification**

- Uses Playwright to test XSS in real browsers
- Confirms JavaScript actually executes (not just reflected)
- Supports Chromium, Firefox, and WebKit

### 🎯 **Smart Detection**

- Automatically detects forms and input fields
- Customizable CSS selectors for different input types
- Concurrent scanning with rate limiting

### 📊 **Integrated Reporting**

- Results appear directly in Burp's Issues list
- Detailed vulnerability information
- Severity based on execution confirmation

### ⚡ **Performance Optimized**

- Headless browser execution
- Concurrent scan limiting
- Background processing

## Troubleshooting

### Extension Not Loading

**Issue**: Extension fails to load in Burp
**Solution**:

- Ensure you're using Burp Suite Pro (not Community)
- Check that Python is available in Burp's Jython environment
- Verify the extension file path is correct

### Command Not Found

**Issue**: "node: command not found" or similar
**Solution**:

- Provide full path to Node.js (e.g., `/usr/bin/node`)
- Ensure Node.js is installed and in PATH
- Test Node.js from command line first

### Path Issues

**Issue**: Cannot find XSS validator files
**Solution**:

- Use absolute paths (e.g., `/home/username/tools/xss-validator-playwright`)
- Ensure all XSS validator files are present
- Check file permissions

### Browser Launch Failures

**Issue**: Browser won't launch or crashes
**Solution**:

- Install required browser dependencies
- For Linux: `sudo apt install chromium-browser` or similar
- Use `--no-sandbox` flag (already included in extension)
- Check available memory and system resources

### No Results

**Issue**: Extension runs but finds no vulnerabilities
**Solution**:

- Verify target URL is accessible
- Check CSS selectors match actual input fields
- Enable verbose logging in XSS validator config
- Test manually with XSS validator CLI first

## Configuration Examples

### Basic Configuration

```
XSS Validator Path: /home/user/xss-validator-playwright
Node.js Path: node
Browser: chromium
Input Selectors: input[type="text"], input[type="search"], textarea
```

### Advanced Configuration

```
XSS Validator Path: /opt/security-tools/xss-validator-playwright
Node.js Path: /usr/local/bin/node
Browser: firefox
Input Selectors: input[type="text"], input[type="search"], textarea, input[name*="search"], input[name*="query"], input[name*="comment"]
```

## Integration with Burp Workflow

### 1. Discovery Phase

- Run Burp Spider to discover forms
- Enable auto-scan to test discovered forms automatically

### 2. Manual Testing Phase

- Use manual test feature for specific targets
- Test individual forms during manual assessment

### 3. Verification Phase

- Review results in Burp Issues
- JavaScript execution confirmation provides high confidence
- Export results for reporting

## Best Practices

### 🔒 **Security**

- Use headless browsers to avoid GUI overhead
- Limit concurrent scans to avoid overwhelming targets
- Respect rate limits and target stability

### 📈 **Performance**

- Start with auto-scan disabled for initial setup
- Enable auto-scan only for trusted/internal applications
- Monitor system resources during heavy scanning

### 🎯 **Accuracy**

- Use specific CSS selectors for better targeting
- Enable JavaScript execution verification for fewer false positives
- Cross-reference with manual testing

## Support

If you encounter issues:

1. Check the Burp Extender error log
2. Test XSS validator CLI independently
3. Verify all paths and configurations
4. Check system resources and permissions

The extension logs detailed information to help with debugging.
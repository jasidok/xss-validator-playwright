# 🎯 XSS Validator - Burp Suite Quick Start Guide

This guide gets you up and running with the XSS Validator for Burp Suite integration in under 5 minutes.

## 🚀 **1-Click Server Start**

Choose your platform and run the server:

### **Option A: Cross-Platform (Recommended)**

```bash
npm run burp
```

### **Option B: Platform-Specific Scripts**

**Windows:**

```cmd
start-burp-server.bat
```

**Mac/Linux:**

```bash
./start-burp-server.sh
```

**Manual:**

```bash
node start-burp-suite-server.js
```

## ⚡ **Quick Setup Steps**

### Step 1: Start the Server

Run any of the commands above. You'll see:

```
█████████████████████████████████████████████████████████████████████
█                                                                   █
█  🎯 XSS VALIDATOR - BURP SUITE INTEGRATION SERVER               █
█  Modern Playwright-based XSS Detection v2.0                    █
█                                                                   █
█████████████████████████████████████████████████████████████████████

📋 Step 1: Checking dependencies...
✅ Step 1: All dependencies found

📋 Step 2: Checking Playwright browsers...
✅ Step 2: Playwright is installed

📋 Step 3: Checking if server is already running...
✅ Step 3: No existing server found - ready to start

🚀 Step 4: Starting XSS Validator server for Burp Suite...
```

### Step 2: Load Burp Extension

1. Open Burp Suite
2. Go to **Extensions** → **Installed** → **Add**
3. Select **Python** and load: `burp-extension/ModernXSSValidator.py`

### Step 3: Configure Extension

1. Go to the **"XSS Validator"** tab in Burp
2. Set **Host**: `127.0.0.1`
3. Set **Port**: `8093`
4. Click **"Test Connection"**
5. You should see: ✅ **Connection successful!**

### Step 4: Enable Auto-Testing

1. Check **"Auto-test responses"**
2. Select browsers: **Chromium**, **Firefox** (recommended)
3. Set **Confidence Threshold**: `0.5`

### Step 5: Start Testing!

1. Use Burp **Intruder** with XSS payloads
2. Watch the **"Results"** tab for real-time detection
3. Enjoy enhanced XSS detection! 🎉

## 🧪 **Testing XSS Payloads**

### Recommended Payloads for Intruder:

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
"><script>alert(1)</script>
'><script>alert(1)</script>
javascript:alert(1)
<iframe src="javascript:alert(1)">
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<audio src=x onerror=alert(1)>
```

### Manual Testing:

```bash
# Test a specific payload
npm run test:burp

# Check server status
npm run status

# View real-time logs
npm run logs --follow
```

## 📊 **Reading Results**

The extension shows enhanced results with:

### **Severity Levels:**

- 🔴 **High**: JavaScript executed (alert/confirm/prompt)
- 🟡 **Medium**: DOM manipulation detected
- 🟢 **Low**: Payload reflected but not executed
- ⚪ **None**: No XSS detected

### **Detection Methods:**

- `javascript_execution` - Alert/confirm/prompt called
- `dom_manipulation` - DOM changes detected
- `reflection` - Payload found in page content
- `code_execution` - Console/setTimeout/eval detected
- `network_request` - Fetch/XHR attempts

### **Example Result:**

```json
{
  "detected": true,
  "executed": true,
  "severity": "high",
  "confidence": 0.95,
  "messages": ["alert('XSS')"],
  "detectionMethods": ["javascript_execution", "dom_manipulation"],
  "browser": "chromium",
  "timing": {
    "analysisTime": 1234
  }
}
```

## 🔧 **Troubleshooting**

### **Server Won't Start**

```bash
# Check dependencies
npm install

# Install browsers
npx playwright install

# Try different port
node start-burp-suite-server.js --port 9000
```

### **Burp Extension Connection Failed**

1. Verify server is running: `npm run status`
2. Check host/port settings in extension
3. Test connection manually: `curl http://127.0.0.1:8093/health`

### **No XSS Detected**

1. Check if payload is reflected in page source
2. Try different browsers (some XSS is browser-specific)
3. Increase timeout in extension settings
4. Check logs: `npm run logs`

### **Performance Issues**

```bash
# Reduce concurrent pages
node start-burp-suite-server.js --max-pages 2

# Use single browser
node start-burp-suite-server.js --browser chromium

# Check system resources
npm run status
```

## 📈 **Advanced Features**

### **Multi-Browser Testing**

Enable all browsers in the extension to test XSS across:

- **Chromium** - Most common vulnerabilities
- **Firefox** - Different JavaScript engine
- **WebKit** - Safari-specific issues

### **Custom Payloads**

Use the **Scanner** tab in the extension for:

- Custom payload testing
- Specific URL targeting
- Browser-specific testing

### **Monitoring & Logging**

```bash
# Real-time server monitoring
npm run status

# Follow logs with filtering
npm run logs --follow --level error

# Health check endpoint
curl http://127.0.0.1:8093/health
```

### **Configuration Files**

```bash
# Edit server configuration
node start-burp-server-v2.js config --edit

# View current settings
node start-burp-server-v2.js config --show
```

## 🎯 **Pro Tips**

### **For Better Detection:**

1. **Use multiple browsers** - Some XSS only works in specific engines
2. **Test different contexts** - Forms, URL parameters, headers
3. **Check confidence scores** - Higher confidence = more reliable detection
4. **Monitor timing** - Slow responses might indicate successful execution

### **For Performance:**

1. **Limit concurrent pages** for resource-constrained systems
2. **Use specific browsers** instead of testing all three
3. **Filter results** by confidence threshold
4. **Monitor server resources** with status command

### **For Debugging:**

1. **Enable debug mode**: `node start-burp-suite-server.js --debug`
2. **Check individual requests** in the logs
3. **Test manually** with scanner tab
4. **Verify browser installation**: `npx playwright --version`

## 🆘 **Quick Help**

```bash
# Show all available commands
node start-burp-suite-server.js --help

# Show server information
node start-burp-suite-server.js --info

# Test with custom payload
node start-burp-server-v2.js test --payload '<svg onload=alert(1)>'

# Get detailed status
node start-burp-server-v2.js status --json
```

## 🎉 **You're Ready!**

With the server running and extension configured, you now have:

✅ **Modern XSS detection** with JavaScript execution verification  
✅ **Multi-browser testing** across Chromium, Firefox, and WebKit  
✅ **Enhanced accuracy** with confidence scoring and severity levels  
✅ **Real-time monitoring** and comprehensive logging  
✅ **Production-grade performance** optimized for Burp Suite

Happy bug hunting! 🐛🔍
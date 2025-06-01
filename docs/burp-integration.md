# Burp Suite Pro Integration Guide

This guide explains how to integrate the XSS Validator with Burp Suite Pro for enhanced web application security
testing.

## Integration Methods

### 1. Using Burp Extensions API (Recommended)

Create a custom Burp extension that leverages the XSS validator:

```python
from burp import IBurpExtender, IHttpListener, IScannerCheck
import subprocess
import json
import tempfile
import os

class BurpExtender(IBurpExtender, IHttpListener, IScannerCheck):
    
    def registerExtenderCallbacks(self, callbacks):
        self._callbacks = callbacks
        self._helpers = callbacks.getHelpers()
        callbacks.setExtensionName("XSS Validator Integration")
        callbacks.registerHttpListener(self)
        callbacks.registerScannerCheck(self)
        
    def doPassiveScan(self, baseRequestResponse):
        # Extract forms and input fields from the response
        response = baseRequestResponse.getResponse()
        if response is None:
            return None
            
        responseString = self._helpers.bytesToString(response)
        
        # Look for input fields
        if '<input' in responseString.lower() or '<form' in responseString.lower():
            url = self._helpers.analyzeRequest(baseRequestResponse).getUrl().toString()
            return self.runXSSValidator(url, baseRequestResponse)
            
        return None
    
    def runXSSValidator(self, url, baseRequestResponse):
        try:
            # Create a temporary config file
            config = {
                "browser": "chromium",
                "verifyExecution": True,
                "logging": {"verbose": False, "showProgress": False},
                "report": {"format": "json", "outputDir": "/tmp", "filename": "burp-xss-scan"}
            }
            
            # Run the XSS validator
            cmd = [
                "node", "/path/to/xss-validator/cli.js",
                "--url", url,
                "--selector", "input[type='text'], input[type='search'], textarea",
                "--config", json.dumps(config)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                # Parse results and create Burp issues
                return self.parseResults(result.stdout, baseRequestResponse)
                
        except Exception as e:
            print("XSS Validator error: " + str(e))
            
        return None
    
    def parseResults(self, output, baseRequestResponse):
        issues = []
        try:
            data = json.loads(output)
            for vuln in data.get('results', []):
                issue = CustomScanIssue(
                    baseRequestResponse.getHttpService(),
                    self._helpers.analyzeRequest(baseRequestResponse).getUrl(),
                    [baseRequestResponse],
                    "XSS Vulnerability (Playwright Verified)",
                    f"XSS payload '{vuln['payload']}' was successfully executed. "
                    f"Reflected: {vuln['reflected']}, Executed: {vuln['executed']}",
                    "High" if vuln['executed'] else "Medium"
                )
                issues.append(issue)
        except:
            pass
            
        return issues

class CustomScanIssue:
    def __init__(self, httpService, url, httpMessages, issueName, issueDetail, severity):
        self._httpService = httpService
        self._url = url
        self._httpMessages = httpMessages
        self._issueName = issueName
        self._issueDetail = issueDetail
        self._severity = severity
    
    def getUrl(self):
        return self._url
    
    def getIssueName(self):
        return self._issueName
    
    def getIssueType(self):
        return 0
    
    def getSeverity(self):
        return self._severity
    
    def getConfidence(self):
        return "Certain"
    
    def getIssueBackground(self):
        return "Cross-site scripting (XSS) vulnerabilities verified using Playwright browser automation."
    
    def getRemediationBackground(self):
        return "Implement proper input validation and output encoding."
    
    def getIssueDetail(self):
        return self._issueDetail
    
    def getRemediationDetail(self):
        return "Sanitize user input and encode output appropriately for the context."
    
    def getHttpMessages(self):
        return self._httpMessages
    
    def getHttpService(self):
        return self._httpService
```

### 2. CLI Integration with Burp Proxy

Use Burp's proxy logs to identify targets and run the validator:

```bash
#!/bin/bash
# burp-xss-scan.sh

# Extract URLs from Burp proxy history
BURP_HISTORY="/path/to/burp/proxy/history.xml"
TEMP_URLS="/tmp/burp_urls.txt"

# Parse Burp history for URLs with forms
grep -o 'http[s]*://[^"]*' "$BURP_HISTORY" | grep -E '\.(php|asp|jsp|do)' > "$TEMP_URLS"

# Run XSS validator on each URL
while IFS= read -r url; do
    echo "Testing: $url"
    node /path/to/xss-validator/cli.js \
        --url "$url" \
        --selector "input[type='text'], input[type='search'], textarea" \
        --browser chromium \
        --verify-execution \
        --report-format both \
        --output-dir "./burp-xss-results"
done < "$TEMP_URLS"
```

### 3. JSON Export/Import Integration

Export Burp findings and import into XSS validator:

```javascript
// burp-integration.js
const { detectXSSParallel } = require('./xssValidator');
const fs = require('fs');

async function processBurpExport(burpJsonFile) {
    const burpData = JSON.parse(fs.readFileSync(burpJsonFile, 'utf8'));
    
    // Extract potential XSS targets from Burp findings
    const xssTargets = [];
    
    for (const issue of burpData.issues || []) {
        if (issue.type_index === 45 || issue.name.includes('XSS')) { // XSS issues
            xssTargets.push({
                url: issue.origin,
                inputFieldSelector: 'input, textarea', // Generic selector
                options: {
                    browser: 'chromium',
                    verifyExecution: true,
                    report: {
                        format: 'both',
                        outputDir: './enhanced-xss-results',
                        filename: `enhanced-${issue.origin.replace(/[^a-zA-Z0-9]/g, '_')}`
                    }
                }
            });
        }
    }
    
    // Run enhanced XSS validation
    if (xssTargets.length > 0) {
        console.log(`Running enhanced XSS validation on ${xssTargets.length} targets`);
        const results = await detectXSSParallel(xssTargets, {
            concurrency: 3,
            shareSession: true
        });
        
        return results;
    }
    
    return [];
}

module.exports = { processBurpExport };
```

### 4. REST API Integration

Create a REST API wrapper for real-time integration:

```javascript
// api-server.js
const express = require('express');
const { detectXSS } = require('./xssValidator');

const app = express();
app.use(express.json());

app.post('/api/xss-scan', async (req, res) => {
    try {
        const { url, selector, payloads, options } = req.body;
        
        const result = await detectXSS(url, selector, payloads, {
            browser: 'chromium',
            verifyExecution: true,
            ...options
        });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('XSS Validator API running on port 3000');
});
```

Then call from Burp extension:

```python
import urllib2
import json

def callXSSValidator(url, selector):
    data = {
        'url': url,
        'selector': selector,
        'options': {
            'browser': 'chromium',
            'verifyExecution': True
        }
    }
    
    req = urllib2.Request('http://localhost:3000/api/xss-scan')
    req.add_header('Content-Type', 'application/json')
    response = urllib2.urlopen(req, json.dumps(data))
    return json.loads(response.read())
```

## Configuration for Burp Integration

Create a Burp-specific configuration:

```json
{
  "browser": "chromium",
  "browserOptions": {
    "headless": true,
    "args": [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage"
    ]
  },
  "verifyExecution": true,
  "timeouts": {
    "navigation": 10000,
    "action": 5000,
    "execution": 2000
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 2,
    "operations": ["input", "submission"]
  },
  "logging": {
    "verbose": false,
    "showProgress": false
  },
  "report": {
    "format": "json",
    "outputDir": "./burp-integration-results"
  },
  "cache": {
    "enabled": true,
    "maxAge": 3600000
  }
}
```

## Best Practices

1. **Rate Limiting**: Implement delays between requests to avoid overwhelming target applications
2. **Session Management**: Use shared sessions for authenticated areas
3. **Proxy Configuration**: Configure the validator to use Burp as a proxy for request routing
4. **Result Correlation**: Map validator results back to Burp findings for comprehensive reporting
5. **Custom Payloads**: Use Burp's payload lists with the validator for consistency

## Example Workflow

1. Run Burp Spider/Scanner to discover forms
2. Export potential XSS targets
3. Run XSS Validator with JavaScript execution verification
4. Import enhanced results back into Burp
5. Generate comprehensive reports combining both tools' findings
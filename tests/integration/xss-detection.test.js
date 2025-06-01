const { detectXSS } = require('../../xssValidator');
const { crawlWebsite, testDiscoveredInputs } = require('../../crawler');
const { generatePayloads, CONTEXT_TYPES } = require('../../payloads/generator');
const { loadConfig } = require('../../config');
const fs = require('fs');
const path = require('path');

// Mock Playwright
jest.mock('playwright', () => {
  // Create mock page with methods that simulate a vulnerable page
  const mockPage = {
    goto: jest.fn().mockResolvedValue(null),
    fill: jest.fn().mockResolvedValue(null),
    click: jest.fn().mockResolvedValue(null),
    waitForNavigation: jest.fn().mockResolvedValue(null),
    waitForTimeout: jest.fn().mockResolvedValue(null),
    waitForSelector: jest.fn().mockResolvedValue(null),
    press: jest.fn().mockResolvedValue(null),
    addInitScript: jest.fn().mockResolvedValue(null),
    evaluate: jest.fn().mockImplementation((fn) => {
      // Simulate XSS detection by returning true for __xssDetected
      if (fn.toString().includes('__xssDetected')) {
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    }),
    $$eval: jest.fn().mockImplementation((selector, callback) => {
      if (selector === 'a[href]') {
        return Promise.resolve([
          'https://example.com/page1',
          'https://example.com/page2'
        ]);
      } else if (selector.includes('input')) {
        return Promise.resolve([
          {
            selector: '#search',
            type: 'text',
            formSelector: '#search-form',
            submitSelector: '#search-button',
            isVisible: true,
            attributes: {
              id: 'search',
              name: 'q',
              placeholder: 'Search...'
            }
          }
        ]);
      }
      return Promise.resolve([]);
    }),
    $: jest.fn().mockResolvedValue({
      click: jest.fn().mockResolvedValue(null)
    }),
    content: jest.fn().mockImplementation(() => {
      // Simulate page content that reflects the payload
      return Promise.resolve('<html><body><div id="result"><script>alert(1)</script></div></body></html>');
    }),
    screenshot: jest.fn().mockResolvedValue(null)
  };

  // Create mock context
  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(null)
  };

  // Create mock browser
  const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn().mockResolvedValue(null)
  };

  // Create mock browser types
  const mockBrowserType = {
    launch: jest.fn().mockResolvedValue(mockBrowser)
  };

  return {
    chromium: mockBrowserType,
    firefox: mockBrowserType,
    webkit: mockBrowserType
  };
});

// Mock fs for report generation
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true)
  };
});

describe('XSS Detection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-end XSS detection', () => {
    test('should detect XSS vulnerabilities in a page', async () => {
      const url = 'https://example.com/vulnerable';
      const selector = '#search';
      
      // Use a small set of payloads for testing
      const payloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>'
      ];
      
      const options = {
        browser: 'chromium',
        timeout: 1000,
        verifyExecution: true,
        submitSelector: '#search-button'
      };
      
      const result = await detectXSS(url, selector, payloads, options);
      
      // Should have detected vulnerabilities
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      
      // Results should have the expected properties
      result.results.forEach(vuln => {
        expect(vuln).toHaveProperty('payload');
        expect(vuln).toHaveProperty('reflected');
        expect(vuln).toHaveProperty('executed');
        expect(vuln).toHaveProperty('url');
        expect(vuln).toHaveProperty('timestamp');
      });
    });
    
    test('should generate reports when requested', async () => {
      const url = 'https://example.com/vulnerable';
      const selector = '#search';
      const payloads = ['<script>alert(1)</script>'];
      
      const options = {
        browser: 'chromium',
        timeout: 1000,
        verifyExecution: true,
        submitSelector: '#search-button',
        report: {
          format: 'both',
          outputDir: './reports',
          filename: 'test-report'
        }
      };
      
      const result = await detectXSS(url, selector, payloads, options);
      
      // Should have report paths
      expect(result.reportPaths).toHaveProperty('json');
      expect(result.reportPaths).toHaveProperty('html');
      
      // fs.writeFileSync should have been called for each report
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Crawler integration with XSS detection', () => {
    test('should discover and test input fields', async () => {
      const url = 'https://example.com';
      
      // First crawl the website
      const inputFields = await crawlWebsite(url, {
        maxDepth: 1,
        maxPages: 5
      });
      
      // Then test the discovered inputs
      const testResults = await testDiscoveredInputs(inputFields, detectXSS, {
        browser: 'chromium',
        timeout: 1000,
        verifyExecution: true
      });
      
      // Should have test results for each input field
      expect(testResults).toBeInstanceOf(Array);
      expect(testResults.length).toBe(inputFields.length);
      
      // At least one input should be vulnerable
      const vulnerableInputs = testResults.filter(result => 
        result.result && result.result.results && result.result.results.length > 0
      );
      
      expect(vulnerableInputs.length).toBeGreaterThan(0);
    });
  });

  describe('Payload generation integration', () => {
    test('should use generated payloads for detection', async () => {
      const url = 'https://example.com/vulnerable';
      const selector = '#search';
      
      // Generate payloads for HTML context
      const payloads = generatePayloads(CONTEXT_TYPES.HTML);
      
      const result = await detectXSS(url, selector, payloads, {
        browser: 'chromium',
        timeout: 1000,
        verifyExecution: true
      });
      
      // Should have detected vulnerabilities
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      
      // At least one of the generated payloads should have worked
      const successfulPayloads = result.results.map(r => r.payload);
      expect(payloads.some(p => successfulPayloads.includes(p))).toBe(true);
    });
  });

  describe('Configuration integration', () => {
    test('should use configuration for detection', async () => {
      const url = 'https://example.com/vulnerable';
      const selector = '#search';
      
      // Load configuration
      const config = loadConfig();
      
      // Override some options for testing
      const options = {
        ...config,
        browser: 'firefox',
        timeout: 500,
        verifyExecution: false
      };
      
      const result = await detectXSS(url, selector, null, options);
      
      // Should have detected vulnerabilities
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThan(0);
      
      // The firefox browser should have been used
      const { firefox } = require('playwright');
      expect(firefox.launch).toHaveBeenCalled();
    });
  });
});
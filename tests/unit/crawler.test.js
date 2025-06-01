const { crawlWebsite, discoverInputFields, testDiscoveredInputs } = require('../../crawler');

// Mock Playwright
jest.mock('playwright', () => {
  // Create mock page
  const mockPage = {
    goto: jest.fn().mockResolvedValue(null),
    fill: jest.fn().mockResolvedValue(null),
    click: jest.fn().mockResolvedValue(null),
    waitForNavigation: jest.fn().mockResolvedValue(null),
    $$eval: jest.fn().mockImplementation((selector, callback) => {
      if (selector === 'a[href]') {
        return Promise.resolve([
          'https://example.com/page1',
          'https://example.com/page2',
          'https://example.com/page3',
          'https://otherdomain.com/page1'
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
          },
          {
            selector: '#email',
            type: 'email',
            formSelector: '#contact-form',
            submitSelector: '#submit-button',
            isVisible: true,
            attributes: {
              id: 'email',
              name: 'email',
              placeholder: 'Email'
            }
          }
        ]);
      }
      return Promise.resolve([]);
    }),
    content: jest.fn().mockResolvedValue('<html><body><form id="search-form"><input id="search" name="q" placeholder="Search..."><button id="search-button">Search</button></form></body></html>')
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

describe('Crawler Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crawlWebsite', () => {
    test('should crawl a website and discover input fields', async () => {
      const url = 'https://example.com';
      const options = {
        maxDepth: 2,
        maxPages: 10,
        stayOnDomain: true
      };

      const inputFields = await crawlWebsite(url, options);

      // Should have discovered input fields
      expect(inputFields).toBeInstanceOf(Array);
      expect(inputFields.length).toBeGreaterThan(0);

      // Each input field should have the expected properties
      inputFields.forEach(input => {
        expect(input).toHaveProperty('url');
        expect(input).toHaveProperty('selector');
        expect(input).toHaveProperty('type');
        expect(input).toHaveProperty('formSelector');
        expect(input).toHaveProperty('submitSelector');
        expect(input).toHaveProperty('isVisible');
        expect(input).toHaveProperty('attributes');
      });
    });

    test('should respect maxDepth option', async () => {
      const url = 'https://example.com';
      
      // Test with maxDepth = 0 (only crawl the starting URL)
      const options = {
        maxDepth: 0,
        maxPages: 10,
        stayOnDomain: true
      };

      const inputFields = await crawlWebsite(url, options);

      // Should still discover input fields from the starting URL
      expect(inputFields).toBeInstanceOf(Array);
      expect(inputFields.length).toBeGreaterThan(0);

      // All input fields should have the same URL (the starting URL)
      inputFields.forEach(input => {
        expect(input.url).toBe(url);
      });
    });

    test('should respect stayOnDomain option', async () => {
      const url = 'https://example.com';
      
      // Test with stayOnDomain = true
      const options = {
        maxDepth: 2,
        maxPages: 10,
        stayOnDomain: true,
        followExternalLinks: false
      };

      const inputFields = await crawlWebsite(url, options);

      // All input fields should have URLs from the same domain
      inputFields.forEach(input => {
        const inputUrl = new URL(input.url);
        expect(inputUrl.hostname).toBe(new URL(url).hostname);
      });
    });

    test('should handle authentication if provided', async () => {
      const url = 'https://example.com';
      const authConfig = {
        url: 'https://example.com/login',
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#login-button',
        username: 'testuser',
        password: 'testpass'
      };

      const options = {
        maxDepth: 1,
        maxPages: 5,
        auth: authConfig
      };

      await crawlWebsite(url, options);

      // Verify that authentication was attempted
      const { chromium } = require('playwright');
      const mockPage = await chromium.launch().then(browser => browser.newContext().then(context => context.newPage()));
      
      expect(mockPage.goto).toHaveBeenCalledWith(authConfig.url);
      expect(mockPage.fill).toHaveBeenCalledWith(authConfig.usernameSelector, authConfig.username);
      expect(mockPage.fill).toHaveBeenCalledWith(authConfig.passwordSelector, authConfig.password);
      expect(mockPage.click).toHaveBeenCalledWith(authConfig.submitSelector);
      expect(mockPage.waitForNavigation).toHaveBeenCalled();
    });
  });

  describe('discoverInputFields', () => {
    test('should discover input fields on a page', async () => {
      const { chromium } = require('playwright');
      const mockPage = await chromium.launch().then(browser => browser.newContext().then(context => context.newPage()));
      
      const inputFields = await discoverInputFields(mockPage);
      
      expect(inputFields).toBeInstanceOf(Array);
      expect(inputFields.length).toBeGreaterThan(0);
      
      // Each input field should have the expected properties
      inputFields.forEach(input => {
        expect(input).toHaveProperty('selector');
        expect(input).toHaveProperty('type');
        expect(input).toHaveProperty('formSelector');
        expect(input).toHaveProperty('submitSelector');
        expect(input).toHaveProperty('isVisible');
        expect(input).toHaveProperty('attributes');
      });
    });
  });

  describe('testDiscoveredInputs', () => {
    test('should test discovered input fields', async () => {
      const inputFields = [
        {
          url: 'https://example.com',
          selector: '#search',
          type: 'text',
          submitSelector: '#search-button'
        },
        {
          url: 'https://example.com/page1',
          selector: '#email',
          type: 'email',
          submitSelector: '#submit-button'
        }
      ];
      
      // Mock test function
      const mockTestFunction = jest.fn().mockImplementation((url, selector, payloads, options) => {
        return Promise.resolve({
          results: [
            {
              payload: '<script>alert(1)</script>',
              reflected: true,
              executed: url === 'https://example.com' // Only the first URL is vulnerable
            }
          ],
          reportPaths: {}
        });
      });
      
      const options = {
        browser: 'chromium',
        timeout: 2000
      };
      
      const results = await testDiscoveredInputs(inputFields, mockTestFunction, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(inputFields.length);
      
      // Test function should be called for each input field
      expect(mockTestFunction).toHaveBeenCalledTimes(inputFields.length);
      
      // First input should be vulnerable
      expect(results[0].result.results.length).toBeGreaterThan(0);
      
      // Check that submitSelector was passed to the test function
      expect(mockTestFunction).toHaveBeenCalledWith(
        inputFields[0].url,
        inputFields[0].selector,
        null,
        expect.objectContaining({
          submitSelector: inputFields[0].submitSelector
        })
      );
    });
    
    test('should handle errors during testing', async () => {
      const inputFields = [
        {
          url: 'https://example.com',
          selector: '#search',
          type: 'text',
          submitSelector: '#search-button'
        }
      ];
      
      // Mock test function that throws an error
      const mockTestFunction = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const results = await testDiscoveredInputs(inputFields, mockTestFunction, {});
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(inputFields.length);
      
      // Result should contain the error
      expect(results[0]).toHaveProperty('error');
      expect(results[0].error).toBe('Test error');
    });
  });
});
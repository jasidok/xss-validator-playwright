const mockFs = require('mock-fs');
const fs = require('fs');
const path = require('path');
const { 
  generateJSONReport, 
  generateHTMLReport 
} = require('../../reports');

describe('Reports Module', () => {
  // Sample results for testing
  const sampleResults = [
    {
      payload: '<script>alert(1)</script>',
      reflected: true,
      executed: true,
      url: 'https://example.com/test',
      timestamp: '2023-01-01T00:00:00.000Z'
    },
    {
      payload: '<img src=x onerror=alert(1)>',
      reflected: true,
      executed: false,
      url: 'https://example.com/test',
      timestamp: '2023-01-01T00:00:00.000Z'
    }
  ];
  
  // Sample options for testing
  const sampleOptions = {
    browser: 'chromium',
    timeout: 2000,
    verifyExecution: true
  };
  
  // Clean up after each test
  afterEach(() => {
    mockFs.restore();
  });
  
  describe('generateJSONReport', () => {
    test('should generate a JSON report with the correct structure', async () => {
      // Setup mock filesystem
      mockFs({
        'reports': {}
      });
      
      const outputPath = path.join(__dirname, '../../reports/test-report.json');
      
      await generateJSONReport(sampleResults, outputPath, sampleOptions);
      
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      
      // Check report structure
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('options');
      
      // Check summary
      expect(report.summary).toHaveProperty('total');
      expect(report.summary).toHaveProperty('reflected');
      expect(report.summary).toHaveProperty('executed');
      expect(report.summary.total).toBe(sampleResults.length);
      expect(report.summary.reflected).toBe(sampleResults.filter(r => r.reflected).length);
      expect(report.summary.executed).toBe(sampleResults.filter(r => r.executed).length);
      
      // Check results
      expect(report.results).toEqual(sampleResults);
      
      // Check options
      expect(report.options).toEqual(sampleOptions);
    });
    
    test('should create directory if it does not exist', async () => {
      // Setup mock filesystem
      mockFs({});
      
      const dirPath = path.join(__dirname, '../../reports/nested');
      const outputPath = path.join(dirPath, 'test-report.json');
      
      await generateJSONReport(sampleResults, outputPath, sampleOptions);
      
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });
  
  describe('generateHTMLReport', () => {
    test('should generate an HTML report with the correct structure', async () => {
      // Setup mock filesystem
      mockFs({
        'reports': {}
      });
      
      const outputPath = path.join(__dirname, '../../reports/test-report.html');
      
      await generateHTMLReport(sampleResults, outputPath, sampleOptions);
      
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const html = fs.readFileSync(outputPath, 'utf8');
      
      // Check basic HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      
      // Check that report contains key elements
      expect(html).toContain('XSS Validator Report');
      expect(html).toContain('Summary');
      expect(html).toContain('Vulnerabilities');
      
      // Check that results are included
      sampleResults.forEach(result => {
        expect(html).toContain(escapeHtmlForTest(result.payload));
        expect(html).toContain(result.url);
      });
      
      // Check that summary counts are included
      expect(html).toContain(`Total Vulnerabilities: <strong>${sampleResults.length}</strong>`);
      expect(html).toContain(`Reflected: <strong>${sampleResults.filter(r => r.reflected).length}</strong>`);
      expect(html).toContain(`Executed: <strong>${sampleResults.filter(r => r.executed).length}</strong>`);
    });
    
    test('should create directory if it does not exist', async () => {
      // Setup mock filesystem
      mockFs({});
      
      const dirPath = path.join(__dirname, '../../reports/nested');
      const outputPath = path.join(dirPath, 'test-report.html');
      
      await generateHTMLReport(sampleResults, outputPath, sampleOptions);
      
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
    
    test('should escape HTML in payloads', async () => {
      // Setup mock filesystem
      mockFs({
        'reports': {}
      });
      
      const outputPath = path.join(__dirname, '../../reports/test-report.html');
      
      // Results with HTML that needs to be escaped
      const resultsWithHTML = [
        {
          payload: '<script>alert("XSS")</script>',
          reflected: true,
          executed: true,
          url: 'https://example.com/test',
          timestamp: '2023-01-01T00:00:00.000Z'
        }
      ];
      
      await generateHTMLReport(resultsWithHTML, outputPath, sampleOptions);
      
      const html = fs.readFileSync(outputPath, 'utf8');
      
      // Check that HTML is escaped
      expect(html).not.toContain('<script>alert("XSS")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
  });
});

// Helper function to escape HTML for testing
function escapeHtmlForTest(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
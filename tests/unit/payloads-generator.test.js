const mockFs = require('mock-fs');
const fs = require('fs');
const path = require('path');
const { 
  CONTEXT_TYPES, 
  ATTRIBUTE_TYPES, 
  generatePayloads, 
  savePayloads, 
  generateMultiContextPayloads, 
  createCategorizedPayloadFile 
} = require('../../payloads/generator');

describe('Payloads Generator Module', () => {
  // Clean up after each test
  afterEach(() => {
    mockFs.restore();
  });
  
  describe('generatePayloads', () => {
    test('should generate HTML context payloads', () => {
      const payloads = generatePayloads(CONTEXT_TYPES.HTML);
      
      expect(payloads).toBeInstanceOf(Array);
      expect(payloads.length).toBeGreaterThan(0);
      expect(payloads.some(p => p.includes('<script>'))).toBe(true);
    });
    
    test('should generate attribute context payloads based on attribute type', () => {
      const unquotedPayloads = generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.UNQUOTED });
      const singleQuotedPayloads = generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.SINGLE_QUOTED });
      const doubleQuotedPayloads = generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.DOUBLE_QUOTED });
      const eventHandlerPayloads = generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.EVENT_HANDLER });
      
      expect(unquotedPayloads.length).toBeGreaterThan(0);
      expect(singleQuotedPayloads.length).toBeGreaterThan(0);
      expect(doubleQuotedPayloads.length).toBeGreaterThan(0);
      expect(eventHandlerPayloads.length).toBeGreaterThan(0);
      
      // Check that the payloads are different for different attribute types
      expect(unquotedPayloads).not.toEqual(singleQuotedPayloads);
      expect(unquotedPayloads).not.toEqual(doubleQuotedPayloads);
      expect(unquotedPayloads).not.toEqual(eventHandlerPayloads);
    });
    
    test('should generate JavaScript context payloads', () => {
      const payloads = generatePayloads(CONTEXT_TYPES.JS);
      
      expect(payloads).toBeInstanceOf(Array);
      expect(payloads.length).toBeGreaterThan(0);
      expect(payloads.some(p => p.includes('alert(1)'))).toBe(true);
    });
    
    test('should generate URL context payloads', () => {
      const payloads = generatePayloads(CONTEXT_TYPES.URL);
      
      expect(payloads).toBeInstanceOf(Array);
      expect(payloads.length).toBeGreaterThan(0);
      expect(payloads.some(p => p.includes('javascript:'))).toBe(true);
    });
    
    test('should generate CSS context payloads', () => {
      const payloads = generatePayloads(CONTEXT_TYPES.CSS);
      
      expect(payloads).toBeInstanceOf(Array);
      expect(payloads.length).toBeGreaterThan(0);
      expect(payloads.some(p => p.includes('</style>'))).toBe(true);
    });
    
    test('should add prefix and suffix to payloads', () => {
      const prefix = 'PREFIX_';
      const suffix = '_SUFFIX';
      const payloads = generatePayloads(CONTEXT_TYPES.HTML, { prefix, suffix });
      
      expect(payloads.every(p => p.startsWith(prefix))).toBe(true);
      expect(payloads.every(p => p.endsWith(suffix))).toBe(true);
    });
    
    test('should replace alert value in payloads', () => {
      const alertValue = 'XSS_TEST';
      const payloads = generatePayloads(CONTEXT_TYPES.HTML, { alertValue });
      
      expect(payloads.some(p => p.includes(`alert(${alertValue})`))).toBe(true);
      expect(payloads.every(p => !p.includes('alert(1)'))).toBe(true);
    });
    
    test('should URL-encode payloads when requested', () => {
      const payloads = generatePayloads(CONTEXT_TYPES.HTML, { encode: true });
      
      // Check that special characters are encoded
      expect(payloads.some(p => p.includes('%3C') || p.includes('%3E'))).toBe(true);
    });
  });
  
  describe('savePayloads', () => {
    test('should save payloads to a JSON file', () => {
      // Setup mock filesystem
      mockFs({
        'payloads': {}
      });
      
      const payloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>'];
      const filename = 'test-payloads';
      const expectedPath = path.join(__dirname, '../../payloads', `${filename}.json`);
      
      const filePath = savePayloads(payloads, filename);
      
      expect(filePath).toBe(expectedPath);
      expect(fs.existsSync(expectedPath)).toBe(true);
      
      const savedPayloads = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
      expect(savedPayloads).toEqual(payloads);
    });
  });
  
  describe('generateMultiContextPayloads', () => {
    test('should generate payloads for multiple contexts', () => {
      const contexts = [
        { type: CONTEXT_TYPES.HTML },
        { type: CONTEXT_TYPES.JS, options: { prefix: 'JS_' } }
      ];
      
      const payloads = generateMultiContextPayloads(contexts);
      
      expect(payloads).toBeInstanceOf(Array);
      expect(payloads.length).toBeGreaterThan(0);
      
      // Should include payloads from both contexts
      const htmlPayloads = generatePayloads(CONTEXT_TYPES.HTML);
      const jsPayloads = generatePayloads(CONTEXT_TYPES.JS, { prefix: 'JS_' });
      
      htmlPayloads.forEach(p => {
        expect(payloads).toContain(p);
      });
      
      jsPayloads.forEach(p => {
        expect(payloads).toContain(p);
      });
    });
  });
  
  describe('createCategorizedPayloadFile', () => {
    test('should create a categorized payload file', () => {
      // Setup mock filesystem
      mockFs({
        'payloads': {}
      });
      
      const filename = 'test-categorized';
      const expectedPath = path.join(__dirname, '../../payloads', `${filename}.json`);
      
      const filePath = createCategorizedPayloadFile(filename);
      
      expect(filePath).toBe(expectedPath);
      expect(fs.existsSync(expectedPath)).toBe(true);
      
      const categorizedPayloads = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
      
      expect(categorizedPayloads).toBeInstanceOf(Array);
      expect(categorizedPayloads.length).toBeGreaterThan(0);
      
      // Check structure of categorized payloads
      categorizedPayloads.forEach(category => {
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('browser_compatibility');
        expect(category).toHaveProperty('payloads');
        expect(category.payloads).toBeInstanceOf(Array);
        expect(category.payloads.length).toBeGreaterThan(0);
      });
      
      // Check that all context types are included
      const categoryNames = categorizedPayloads.map(c => c.category);
      expect(categoryNames).toContain('HTML_Context');
      expect(categoryNames).toContain('JavaScript_Context');
      expect(categoryNames).toContain('URL_Context');
      expect(categoryNames).toContain('CSS_Context');
      
      // Check that all attribute types are included
      expect(categoryNames).toContain('Unquoted_Attribute');
      expect(categoryNames).toContain('Single_Quoted_Attribute');
      expect(categoryNames).toContain('Double_Quoted_Attribute');
      expect(categoryNames).toContain('Event_Handler');
    });
  });
});
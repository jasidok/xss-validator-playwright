const mockFs = require('mock-fs');
const fs = require('fs');
const path = require('path');
const { 
  updatePayloadEffectiveness, 
  getPayloadEffectiveness, 
  getMostEffectivePayloads 
} = require('../../payloads/effectiveness');

describe('Payloads Effectiveness Module', () => {
  const testEffectivenessPath = path.join(__dirname, '../../payloads/effectiveness.json');
  
  // Sample effectiveness data for testing
  const sampleData = {
    payloads: {
      '<script>alert(1)</script>': {
        totalTests: 10,
        reflectedCount: 8,
        executedCount: 5,
        browsers: {
          chromium: {
            totalTests: 5,
            reflectedCount: 4,
            executedCount: 3
          },
          firefox: {
            totalTests: 3,
            reflectedCount: 2,
            executedCount: 1
          },
          webkit: {
            totalTests: 2,
            reflectedCount: 2,
            executedCount: 1
          }
        },
        lastTested: '2023-01-01T00:00:00.000Z'
      },
      '<img src=x onerror=alert(1)>': {
        totalTests: 8,
        reflectedCount: 7,
        executedCount: 6,
        browsers: {
          chromium: {
            totalTests: 4,
            reflectedCount: 4,
            executedCount: 3
          },
          firefox: {
            totalTests: 2,
            reflectedCount: 2,
            executedCount: 2
          },
          webkit: {
            totalTests: 2,
            reflectedCount: 1,
            executedCount: 1
          }
        },
        lastTested: '2023-01-01T00:00:00.000Z'
      },
      'javascript:alert(1)': {
        totalTests: 6,
        reflectedCount: 6,
        executedCount: 2,
        browsers: {
          chromium: {
            totalTests: 2,
            reflectedCount: 2,
            executedCount: 1
          },
          firefox: {
            totalTests: 2,
            reflectedCount: 2,
            executedCount: 1
          },
          webkit: {
            totalTests: 2,
            reflectedCount: 2,
            executedCount: 0
          }
        },
        lastTested: '2023-01-01T00:00:00.000Z'
      }
    },
    metadata: {
      lastUpdated: '2023-01-01T00:00:00.000Z',
      totalTests: 24
    }
  };
  
  // Clean up after each test
  afterEach(() => {
    mockFs.restore();
  });
  
  describe('updatePayloadEffectiveness', () => {
    test('should create new payload entry if it does not exist', () => {
      // Setup mock filesystem with empty effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify({
            payloads: {},
            metadata: {
              lastUpdated: '2023-01-01T00:00:00.000Z',
              totalTests: 0
            }
          })
        }
      });
      
      const payload = '<script>alert("new")</script>';
      const reflected = true;
      const executed = true;
      const browser = 'chromium';
      
      updatePayloadEffectiveness(payload, reflected, executed, browser);
      
      const data = JSON.parse(fs.readFileSync(testEffectivenessPath, 'utf8'));
      
      expect(data.payloads[payload]).toBeDefined();
      expect(data.payloads[payload].totalTests).toBe(1);
      expect(data.payloads[payload].reflectedCount).toBe(1);
      expect(data.payloads[payload].executedCount).toBe(1);
      expect(data.payloads[payload].browsers[browser]).toBeDefined();
      expect(data.payloads[payload].browsers[browser].totalTests).toBe(1);
      expect(data.payloads[payload].browsers[browser].reflectedCount).toBe(1);
      expect(data.payloads[payload].browsers[browser].executedCount).toBe(1);
      expect(data.metadata.totalTests).toBe(1);
    });
    
    test('should update existing payload entry', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const payload = '<script>alert(1)</script>';
      const reflected = true;
      const executed = false;
      const browser = 'chromium';
      
      // Get initial counts
      const initialData = JSON.parse(fs.readFileSync(testEffectivenessPath, 'utf8'));
      const initialTotalTests = initialData.payloads[payload].totalTests;
      const initialReflectedCount = initialData.payloads[payload].reflectedCount;
      const initialExecutedCount = initialData.payloads[payload].executedCount;
      const initialBrowserTotalTests = initialData.payloads[payload].browsers[browser].totalTests;
      const initialBrowserReflectedCount = initialData.payloads[payload].browsers[browser].reflectedCount;
      const initialBrowserExecutedCount = initialData.payloads[payload].browsers[browser].executedCount;
      const initialMetadataTotalTests = initialData.metadata.totalTests;
      
      updatePayloadEffectiveness(payload, reflected, executed, browser);
      
      const updatedData = JSON.parse(fs.readFileSync(testEffectivenessPath, 'utf8'));
      
      expect(updatedData.payloads[payload].totalTests).toBe(initialTotalTests + 1);
      expect(updatedData.payloads[payload].reflectedCount).toBe(initialReflectedCount + 1);
      expect(updatedData.payloads[payload].executedCount).toBe(initialExecutedCount); // No change because executed is false
      expect(updatedData.payloads[payload].browsers[browser].totalTests).toBe(initialBrowserTotalTests + 1);
      expect(updatedData.payloads[payload].browsers[browser].reflectedCount).toBe(initialBrowserReflectedCount + 1);
      expect(updatedData.payloads[payload].browsers[browser].executedCount).toBe(initialBrowserExecutedCount); // No change because executed is false
      expect(updatedData.metadata.totalTests).toBe(initialMetadataTotalTests + 1);
    });
    
    test('should create browser entry if it does not exist', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const payload = '<script>alert(1)</script>';
      const reflected = true;
      const executed = true;
      const browser = 'new-browser';
      
      updatePayloadEffectiveness(payload, reflected, executed, browser);
      
      const data = JSON.parse(fs.readFileSync(testEffectivenessPath, 'utf8'));
      
      expect(data.payloads[payload].browsers[browser]).toBeDefined();
      expect(data.payloads[payload].browsers[browser].totalTests).toBe(1);
      expect(data.payloads[payload].browsers[browser].reflectedCount).toBe(1);
      expect(data.payloads[payload].browsers[browser].executedCount).toBe(1);
    });
  });
  
  describe('getPayloadEffectiveness', () => {
    test('should return effectiveness scores for a payload', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const payload = '<script>alert(1)</script>';
      const effectiveness = getPayloadEffectiveness(payload);
      
      expect(effectiveness).toHaveProperty('reflectionScore');
      expect(effectiveness).toHaveProperty('executionScore');
      expect(effectiveness).toHaveProperty('totalTests');
      
      // Calculate expected scores
      const payloadData = sampleData.payloads[payload];
      const expectedReflectionScore = payloadData.reflectedCount / payloadData.totalTests;
      const expectedExecutionScore = payloadData.executedCount / payloadData.totalTests;
      
      expect(effectiveness.reflectionScore).toBe(expectedReflectionScore);
      expect(effectiveness.executionScore).toBe(expectedExecutionScore);
      expect(effectiveness.totalTests).toBe(payloadData.totalTests);
    });
    
    test('should return browser-specific effectiveness scores when browser is specified', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const payload = '<script>alert(1)</script>';
      const browser = 'firefox';
      const effectiveness = getPayloadEffectiveness(payload, browser);
      
      // Calculate expected scores
      const browserData = sampleData.payloads[payload].browsers[browser];
      const expectedReflectionScore = browserData.reflectedCount / browserData.totalTests;
      const expectedExecutionScore = browserData.executedCount / browserData.totalTests;
      
      expect(effectiveness.reflectionScore).toBe(expectedReflectionScore);
      expect(effectiveness.executionScore).toBe(expectedExecutionScore);
      expect(effectiveness.totalTests).toBe(browserData.totalTests);
    });
    
    test('should return zero scores for unknown payload', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const payload = 'unknown-payload';
      const effectiveness = getPayloadEffectiveness(payload);
      
      expect(effectiveness.reflectionScore).toBe(0);
      expect(effectiveness.executionScore).toBe(0);
      expect(effectiveness.totalTests).toBe(0);
    });
  });
  
  describe('getMostEffectivePayloads', () => {
    test('should return the most effective payloads sorted by execution score', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const limit = 2;
      const effectivePayloads = getMostEffectivePayloads(limit);
      
      expect(effectivePayloads).toBeInstanceOf(Array);
      expect(effectivePayloads.length).toBe(limit);
      
      // Payloads should be sorted by execution score (highest first)
      expect(effectivePayloads[0].executionScore).toBeGreaterThanOrEqual(effectivePayloads[1].executionScore);
      
      // Check structure of returned objects
      effectivePayloads.forEach(p => {
        expect(p).toHaveProperty('payload');
        expect(p).toHaveProperty('reflectionScore');
        expect(p).toHaveProperty('executionScore');
        expect(p).toHaveProperty('totalTests');
      });
    });
    
    test('should return browser-specific effective payloads when browser is specified', () => {
      // Setup mock filesystem with sample effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify(sampleData)
        }
      });
      
      const limit = 2;
      const browser = 'firefox';
      const effectivePayloads = getMostEffectivePayloads(limit, browser);
      
      expect(effectivePayloads).toBeInstanceOf(Array);
      expect(effectivePayloads.length).toBe(limit);
      
      // Check that scores are browser-specific
      effectivePayloads.forEach(p => {
        const payloadData = sampleData.payloads[p.payload];
        if (payloadData && payloadData.browsers[browser]) {
          const browserData = payloadData.browsers[browser];
          const expectedReflectionScore = browserData.reflectedCount / browserData.totalTests;
          const expectedExecutionScore = browserData.executedCount / browserData.totalTests;
          
          expect(p.reflectionScore).toBe(expectedReflectionScore);
          expect(p.executionScore).toBe(expectedExecutionScore);
        }
      });
    });
    
    test('should return empty array when no effectiveness data exists', () => {
      // Setup mock filesystem with empty effectiveness data
      mockFs({
        [path.dirname(testEffectivenessPath)]: {
          'effectiveness.json': JSON.stringify({
            payloads: {},
            metadata: {
              lastUpdated: '2023-01-01T00:00:00.000Z',
              totalTests: 0
            }
          })
        }
      });
      
      const effectivePayloads = getMostEffectivePayloads(10);
      
      expect(effectivePayloads).toBeInstanceOf(Array);
      expect(effectivePayloads.length).toBe(0);
    });
  });
});
const mockFs = require('mock-fs');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { 
  loadConfig, 
  saveConfig, 
  updateConfig, 
  resetConfig, 
  getConfigPath,
  DEFAULT_CONFIG
} = require('../../config');

describe('Config Module', () => {
  const testConfigPath = path.join(os.tmpdir(), 'xss-validator-test-config.json');
  
  // Clean up after each test
  afterEach(() => {
    mockFs.restore();
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });
  
  describe('loadConfig', () => {
    test('should return default config when file does not exist', () => {
      // Setup mock filesystem
      mockFs({});
      
      const config = loadConfig(testConfigPath);
      expect(config).toEqual(DEFAULT_CONFIG);
    });
    
    test('should load config from file when it exists', () => {
      // Create a test config file
      const testConfig = { ...DEFAULT_CONFIG, browser: 'firefox' };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));
      
      const config = loadConfig(testConfigPath);
      expect(config).toEqual(testConfig);
    });
    
    test('should return default config when file is invalid', () => {
      // Create an invalid config file
      fs.writeFileSync(testConfigPath, 'invalid json');
      
      const config = loadConfig(testConfigPath);
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });
  
  describe('saveConfig', () => {
    test('should save config to file', () => {
      // Setup mock filesystem
      mockFs({});
      
      const testConfig = { ...DEFAULT_CONFIG, browser: 'webkit' };
      const result = saveConfig(testConfig, testConfigPath);
      
      expect(result).toBe(true);
      expect(fs.existsSync(testConfigPath)).toBe(true);
      
      const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
      expect(savedConfig).toEqual(testConfig);
    });
    
    test('should create directory if it does not exist', () => {
      // Setup mock filesystem
      mockFs({});
      
      const dirPath = path.join(os.tmpdir(), 'xss-validator-test-dir');
      const filePath = path.join(dirPath, 'config.json');
      
      const result = saveConfig(DEFAULT_CONFIG, filePath);
      
      expect(result).toBe(true);
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
  
  describe('updateConfig', () => {
    test('should update existing config with new values', () => {
      // Create a test config file
      const initialConfig = { ...DEFAULT_CONFIG };
      fs.writeFileSync(testConfigPath, JSON.stringify(initialConfig));
      
      const newValues = { browser: 'firefox', timeout: 5000 };
      const updatedConfig = updateConfig(newValues, testConfigPath);
      
      expect(updatedConfig.browser).toBe('firefox');
      expect(updatedConfig.timeout).toBe(5000);
      
      // Other values should remain unchanged
      expect(updatedConfig.verifyExecution).toBe(DEFAULT_CONFIG.verifyExecution);
    });
    
    test('should handle nested objects correctly', () => {
      // Create a test config file
      const initialConfig = { ...DEFAULT_CONFIG };
      fs.writeFileSync(testConfigPath, JSON.stringify(initialConfig));
      
      const newValues = { 
        logging: { 
          verbose: true,
          showProgress: false
        } 
      };
      const updatedConfig = updateConfig(newValues, testConfigPath);
      
      expect(updatedConfig.logging.verbose).toBe(true);
      expect(updatedConfig.logging.showProgress).toBe(false);
      
      // Other nested values should remain unchanged
      expect(updatedConfig.logging.progressUpdateInterval).toBe(DEFAULT_CONFIG.logging.progressUpdateInterval);
    });
  });
  
  describe('resetConfig', () => {
    test('should reset config to default values', () => {
      // Create a test config file with custom values
      const customConfig = { 
        ...DEFAULT_CONFIG, 
        browser: 'firefox',
        timeout: 5000,
        logging: { 
          verbose: true,
          showProgress: false
        }
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(customConfig));
      
      const resetResult = resetConfig(testConfigPath);
      
      expect(resetResult).toEqual(DEFAULT_CONFIG);
      
      // Check that the file was actually updated
      const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
      expect(savedConfig).toEqual(DEFAULT_CONFIG);
    });
  });
  
  describe('getConfigPath', () => {
    test('should return the default config path', () => {
      const configPath = getConfigPath();
      const expectedPath = path.join(os.homedir(), '.xss-validator', 'config.json');
      
      expect(configPath).toBe(expectedPath);
    });
  });
});
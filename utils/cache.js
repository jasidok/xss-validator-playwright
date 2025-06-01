/**
 * Cache management utilities for XSS Validator
 * This module provides functions for caching test results to avoid redundant tests
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Directory for storing cache data
const CACHE_DIR = path.join(__dirname, '..', 'cache');

// Ensure the cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generates a cache key for a test configuration
 * @param {string} url - The URL of the page to test
 * @param {string} inputFieldSelector - CSS selector for the input field
 * @param {string} payload - The XSS payload being tested
 * @param {Object} options - Additional options that affect the test result
 * @returns {string} - A unique cache key
 */
function generateCacheKey(url, inputFieldSelector, payload, options = {}) {
  // Extract only the options that affect the test result
  const relevantOptions = {
    browser: options.browser || 'chromium',
    verifyExecution: options.verifyExecution || false,
    submitSelector: options.submitSelector || null
  };
  
  // Create a string representation of the test configuration
  const configString = JSON.stringify({
    url,
    inputFieldSelector,
    payload,
    options: relevantOptions
  });
  
  // Generate a hash of the configuration string
  return crypto.createHash('md5').update(configString).digest('hex');
}

/**
 * Checks if a result exists in the cache
 * @param {string} cacheKey - The cache key to check
 * @param {number} maxAge - Maximum age of the cache entry in milliseconds (0 = no expiration)
 * @returns {boolean} - Whether the result exists in the cache and is not expired
 */
function cacheExists(cacheKey, maxAge = 0) {
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  if (!fs.existsSync(cachePath)) {
    return false;
  }
  
  // Check if the cache entry is expired
  if (maxAge > 0) {
    const stats = fs.statSync(cachePath);
    const ageMs = Date.now() - stats.mtimeMs;
    
    if (ageMs > maxAge) {
      // Cache entry is expired, delete it
      fs.unlinkSync(cachePath);
      return false;
    }
  }
  
  return true;
}

/**
 * Gets a result from the cache
 * @param {string} cacheKey - The cache key to retrieve
 * @returns {Object|null} - The cached result or null if not found
 */
function getCachedResult(cacheKey) {
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading cache file: ${error.message}`);
      return null;
    }
  }
  
  return null;
}

/**
 * Stores a result in the cache
 * @param {string} cacheKey - The cache key to store
 * @param {Object} result - The result to cache
 * @returns {boolean} - Whether the result was successfully cached
 */
function cacheResult(cacheKey, result) {
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing cache file: ${error.message}`);
    return false;
  }
}

/**
 * Clears the entire cache or specific cache entries
 * @param {string|Array<string>} [cacheKeys] - Specific cache keys to clear (if omitted, clears all)
 * @returns {number} - Number of cache entries cleared
 */
function clearCache(cacheKeys = null) {
  if (cacheKeys) {
    // Clear specific cache entries
    const keys = Array.isArray(cacheKeys) ? cacheKeys : [cacheKeys];
    let clearedCount = 0;
    
    for (const key of keys) {
      const cachePath = path.join(CACHE_DIR, `${key}.json`);
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
        clearedCount++;
      }
    }
    
    return clearedCount;
  } else {
    // Clear all cache entries
    const files = fs.readdirSync(CACHE_DIR);
    let clearedCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
        clearedCount++;
      }
    }
    
    return clearedCount;
  }
}

/**
 * Gets statistics about the cache
 * @returns {Object} - Cache statistics
 */
function getCacheStats() {
  const files = fs.readdirSync(CACHE_DIR);
  const cacheFiles = files.filter(file => file.endsWith('.json'));
  
  let totalSize = 0;
  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;
  
  for (const file of cacheFiles) {
    const filePath = path.join(CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    
    totalSize += stats.size;
    oldestTimestamp = Math.min(oldestTimestamp, stats.mtimeMs);
    newestTimestamp = Math.max(newestTimestamp, stats.mtimeMs);
  }
  
  return {
    entryCount: cacheFiles.length,
    totalSize,
    oldestEntry: new Date(oldestTimestamp).toISOString(),
    newestEntry: new Date(newestTimestamp).toISOString(),
    averageSize: cacheFiles.length > 0 ? Math.round(totalSize / cacheFiles.length) : 0
  };
}

module.exports = {
  generateCacheKey,
  cacheExists,
  getCachedResult,
  cacheResult,
  clearCache,
  getCacheStats
};
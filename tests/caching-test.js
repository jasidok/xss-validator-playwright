const { detectXSS } = require('../xssValidator');
const { getCacheStats, clearCache } = require('../utils/cache');

/**
 * This example demonstrates how to use the XSS validator with caching
 * to improve performance by avoiding redundant tests.
 */
async function runCachingTest() {
  try {
    console.log('Starting caching test');
    
    // Clear any existing cache to start fresh
    clearCache();
    console.log('Cache cleared for a fresh start');
    
    // Target URL and selector to test
    const targetUrl = 'https://xss-game.appspot.com/level1/frame';
    const inputSelector = '#query';
    
    // Define a small set of payloads for demonstration
    const testPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)'
    ];
    
    // First run: Cache miss (no cached results)
    console.log('\n=== First Run: Cache Miss ===');
    console.log('Running test with caching enabled (should be cache misses)');
    
    const firstRunOptions = {
      browser: 'chromium',
      verifyExecution: true,
      // Enable caching
      cache: {
        enabled: true,
        maxAge: 3600000, // 1 hour in milliseconds
        verbose: true    // Log cache hits and misses
      },
      logging: {
        verbose: true,
        showProgress: true
      }
    };
    
    console.log('Running first test (no cached results yet)...');
    const startTime1 = Date.now();
    
    const firstResults = await detectXSS(
      targetUrl,
      inputSelector,
      testPayloads,
      firstRunOptions
    );
    
    const duration1 = Date.now() - startTime1;
    console.log(`First run completed in ${duration1}ms`);
    console.log(`Found ${firstResults.results.length} vulnerabilities`);
    
    // Display cache statistics after first run
    const statsAfterFirstRun = getCacheStats();
    console.log('\nCache statistics after first run:');
    console.log(`  Total entries: ${statsAfterFirstRun.totalEntries}`);
    console.log(`  Hits: ${statsAfterFirstRun.hits}`);
    console.log(`  Misses: ${statsAfterFirstRun.misses}`);
    console.log(`  Hit ratio: ${statsAfterFirstRun.hitRatio.toFixed(2)}%`);
    
    // Second run: Cache hit (should use cached results)
    console.log('\n=== Second Run: Cache Hit ===');
    console.log('Running the same test again (should be cache hits)');
    
    const secondRunOptions = {
      browser: 'chromium',
      verifyExecution: true,
      // Enable caching with the same settings
      cache: {
        enabled: true,
        maxAge: 3600000,
        verbose: true
      },
      logging: {
        verbose: true,
        showProgress: true
      }
    };
    
    console.log('Running second test (should use cached results)...');
    const startTime2 = Date.now();
    
    const secondResults = await detectXSS(
      targetUrl,
      inputSelector,
      testPayloads,
      secondRunOptions
    );
    
    const duration2 = Date.now() - startTime2;
    console.log(`Second run completed in ${duration2}ms`);
    console.log(`Found ${secondResults.results.length} vulnerabilities`);
    
    // Display cache statistics after second run
    const statsAfterSecondRun = getCacheStats();
    console.log('\nCache statistics after second run:');
    console.log(`  Total entries: ${statsAfterSecondRun.totalEntries}`);
    console.log(`  Hits: ${statsAfterSecondRun.hits}`);
    console.log(`  Misses: ${statsAfterSecondRun.misses}`);
    console.log(`  Hit ratio: ${statsAfterSecondRun.hitRatio.toFixed(2)}%`);
    
    // Third run: Different browser (should be cache miss)
    console.log('\n=== Third Run: Different Browser ===');
    console.log('Running test with a different browser (should be cache misses)');
    
    const thirdRunOptions = {
      browser: 'firefox', // Different browser
      verifyExecution: true,
      cache: {
        enabled: true,
        maxAge: 3600000,
        verbose: true
      },
      logging: {
        verbose: true,
        showProgress: true
      }
    };
    
    console.log('Running third test with Firefox...');
    const startTime3 = Date.now();
    
    const thirdResults = await detectXSS(
      targetUrl,
      inputSelector,
      testPayloads,
      thirdRunOptions
    );
    
    const duration3 = Date.now() - startTime3;
    console.log(`Third run completed in ${duration3}ms`);
    console.log(`Found ${thirdResults.results.length} vulnerabilities`);
    
    // Display cache statistics after third run
    const statsAfterThirdRun = getCacheStats();
    console.log('\nCache statistics after third run:');
    console.log(`  Total entries: ${statsAfterThirdRun.totalEntries}`);
    console.log(`  Hits: ${statsAfterThirdRun.hits}`);
    console.log(`  Misses: ${statsAfterThirdRun.misses}`);
    console.log(`  Hit ratio: ${statsAfterThirdRun.hitRatio.toFixed(2)}%`);
    
    // Performance comparison
    console.log('\n=== Performance Comparison ===');
    console.log(`First run (cache miss): ${duration1}ms`);
    console.log(`Second run (cache hit): ${duration2}ms`);
    console.log(`Third run (different browser): ${duration3}ms`);
    
    if (duration1 > 0 && duration2 > 0) {
      const speedup = ((duration1 - duration2) / duration1 * 100).toFixed(2);
      console.log(`Cache speedup: ${speedup}% faster on second run`);
    }
    
    console.log('\nCaching test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runCachingTest();
const { detectXSS } = require('../xssValidator');

// This is a simple test to demonstrate how to use the XSS validator
async function runTest() {
  try {
    // Test against a demo site that allows input reflection
    // Note: This is just an example, replace with an actual test site
    await detectXSS('https://xss-game.appspot.com/level1/frame', '#query');
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
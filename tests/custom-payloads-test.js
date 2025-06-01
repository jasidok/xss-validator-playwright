const { detectXSS } = require('../xssValidator');
const fs = require('fs');

// This test demonstrates how to use custom payloads with the XSS validator
async function runCustomPayloadsTest() {
  try {
    // Load custom payloads from JSON file
    const customPayloads = JSON.parse(fs.readFileSync('payloads/common.json', 'utf8'));

    console.log(`Loaded ${customPayloads.length} custom payloads`);

    // The detectXSS function has been modified to accept custom payloads
    // This demonstrates how to use your own payloads instead of the default ones

    // Now we can use the custom payloads with the detectXSS function
    await detectXSS('https://xss-game.appspot.com/level1/frame', '#query', customPayloads);

    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runCustomPayloadsTest();

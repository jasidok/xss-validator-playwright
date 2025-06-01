const fs = require('fs');
const path = require('path');

// Path to the effectiveness data file
const EFFECTIVENESS_FILE = path.join(__dirname, 'effectiveness.json');

/**
 * Loads the effectiveness data from the JSON file
 * @returns {Object} The effectiveness data
 */
function loadEffectivenessData() {
    try {
        if (fs.existsSync(EFFECTIVENESS_FILE)) {
            const data = fs.readFileSync(EFFECTIVENESS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading effectiveness data:', error);
    }
    
    // Return default data if file doesn't exist or there's an error
    return {
        payloads: {},
        metadata: {
            lastUpdated: new Date().toISOString(),
            totalTests: 0
        }
    };
}

/**
 * Saves the effectiveness data to the JSON file
 * @param {Object} data The effectiveness data to save
 */
function saveEffectivenessData(data) {
    try {
        fs.writeFileSync(EFFECTIVENESS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving effectiveness data:', error);
    }
}

/**
 * Updates the effectiveness data for a payload based on test results
 * @param {string} payload The payload that was tested
 * @param {boolean} reflected Whether the payload was reflected in the page
 * @param {boolean} executed Whether the payload was executed
 * @param {string} browser The browser that was used for testing
 */
function updatePayloadEffectiveness(payload, reflected, executed, browser) {
    const data = loadEffectivenessData();
    
    // Initialize payload data if it doesn't exist
    if (!data.payloads[payload]) {
        data.payloads[payload] = {
            totalTests: 0,
            reflectedCount: 0,
            executedCount: 0,
            browsers: {},
            lastTested: null
        };
    }
    
    // Update payload data
    const payloadData = data.payloads[payload];
    payloadData.totalTests++;
    if (reflected) payloadData.reflectedCount++;
    if (executed) payloadData.executedCount++;
    payloadData.lastTested = new Date().toISOString();
    
    // Update browser-specific data
    if (!payloadData.browsers[browser]) {
        payloadData.browsers[browser] = {
            totalTests: 0,
            reflectedCount: 0,
            executedCount: 0
        };
    }
    
    const browserData = payloadData.browsers[browser];
    browserData.totalTests++;
    if (reflected) browserData.reflectedCount++;
    if (executed) browserData.executedCount++;
    
    // Update metadata
    data.metadata.lastUpdated = new Date().toISOString();
    data.metadata.totalTests++;
    
    // Save updated data
    saveEffectivenessData(data);
}

/**
 * Gets the effectiveness score for a payload
 * @param {string} payload The payload to get the score for
 * @param {string} browser The browser to get the score for (optional)
 * @returns {Object} The effectiveness score
 */
function getPayloadEffectiveness(payload, browser = null) {
    const data = loadEffectivenessData();
    
    if (!data.payloads[payload]) {
        return {
            reflectionScore: 0,
            executionScore: 0,
            totalTests: 0
        };
    }
    
    const payloadData = data.payloads[payload];
    
    if (browser && payloadData.browsers[browser]) {
        const browserData = payloadData.browsers[browser];
        return {
            reflectionScore: browserData.totalTests > 0 ? browserData.reflectedCount / browserData.totalTests : 0,
            executionScore: browserData.totalTests > 0 ? browserData.executedCount / browserData.totalTests : 0,
            totalTests: browserData.totalTests
        };
    }
    
    return {
        reflectionScore: payloadData.totalTests > 0 ? payloadData.reflectedCount / payloadData.totalTests : 0,
        executionScore: payloadData.totalTests > 0 ? payloadData.executedCount / payloadData.totalTests : 0,
        totalTests: payloadData.totalTests
    };
}

/**
 * Gets the most effective payloads based on execution score
 * @param {number} limit The maximum number of payloads to return
 * @param {string} browser The browser to get scores for (optional)
 * @returns {Array} The most effective payloads with their scores
 */
function getMostEffectivePayloads(limit = 10, browser = null) {
    const data = loadEffectivenessData();
    const payloads = Object.keys(data.payloads);
    
    // Get effectiveness scores for all payloads
    const payloadsWithScores = payloads.map(payload => {
        const effectiveness = getPayloadEffectiveness(payload, browser);
        return {
            payload,
            ...effectiveness
        };
    });
    
    // Sort by execution score (primary) and reflection score (secondary)
    payloadsWithScores.sort((a, b) => {
        if (b.executionScore !== a.executionScore) {
            return b.executionScore - a.executionScore;
        }
        return b.reflectionScore - a.reflectionScore;
    });
    
    // Return the top N payloads
    return payloadsWithScores.slice(0, limit);
}

module.exports = {
    updatePayloadEffectiveness,
    getPayloadEffectiveness,
    getMostEffectivePayloads
};
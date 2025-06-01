const fs = require('fs');
const path = require('path');
const os = require('os');

// Default configuration file path
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.xss-validator', 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
    browser: 'chromium',
    submitSelector: 'button[type="submit"]',
    timeouts: {
        navigation: 30000,    // Timeout for page navigation
        action: 10000,        // Timeout for actions like clicking, filling forms
        waitFor: 5000,        // Timeout for waitForSelector and similar operations
        execution: 2000,      // Timeout for JavaScript execution verification
        global: 60000         // Global timeout for the entire test
    },
    verifyExecution: true,
    retry: {
        enabled: true,
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
        operations: ['navigation', 'submission', 'input']
    },
    logging: {
        verbose: false,
        showProgress: true,
        progressUpdateInterval: 1 // Update progress after every payload
    },
    report: {
        format: null,
        outputDir: './reports',
        filename: 'xss-report'
    },
    effectiveness: {
        track: true,
        useEffectivePayloads: false,
        limit: 10
    },
    payloads: {
        defaultFile: 'common.json'
    }
};

/**
 * Loads configuration from a file
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} - The loaded configuration
 */
function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
    try {
        // Create directory if it doesn't exist
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Create default config file if it doesn't exist
        if (!fs.existsSync(configPath)) {
            saveConfig(DEFAULT_CONFIG, configPath);
            return DEFAULT_CONFIG;
        }

        // Load and parse the config file
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error(`Error loading configuration from ${configPath}:`, error);
        return DEFAULT_CONFIG;
    }
}

/**
 * Saves configuration to a file
 * @param {Object} config - The configuration to save
 * @param {string} configPath - Path to the configuration file
 * @returns {boolean} - Whether the save was successful
 */
function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
    try {
        // Create directory if it doesn't exist
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Write the config file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving configuration to ${configPath}:`, error);
        return false;
    }
}

/**
 * Updates configuration with new values
 * @param {Object} newConfig - New configuration values
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} - The updated configuration
 */
function updateConfig(newConfig, configPath = DEFAULT_CONFIG_PATH) {
    const currentConfig = loadConfig(configPath);
    const updatedConfig = mergeConfigs(currentConfig, newConfig);
    saveConfig(updatedConfig, configPath);
    return updatedConfig;
}

/**
 * Merges two configuration objects
 * @param {Object} target - Target configuration
 * @param {Object} source - Source configuration
 * @returns {Object} - Merged configuration
 */
function mergeConfigs(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            // If the key is an object and exists in the target, merge them
            if (target[key] !== null && typeof target[key] === 'object') {
                result[key] = mergeConfigs(target[key], source[key]);
            } else {
                // Otherwise just assign
                result[key] = { ...source[key] };
            }
        } else {
            // For non-objects, just assign
            result[key] = source[key];
        }
    }

    return result;
}

/**
 * Resets configuration to default values
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} - The default configuration
 */
function resetConfig(configPath = DEFAULT_CONFIG_PATH) {
    saveConfig(DEFAULT_CONFIG, configPath);
    return DEFAULT_CONFIG;
}

/**
 * Gets the path to the configuration file
 * @returns {string} - Path to the configuration file
 */
function getConfigPath() {
    return DEFAULT_CONFIG_PATH;
}

module.exports = {
    loadConfig,
    saveConfig,
    updateConfig,
    resetConfig,
    getConfigPath,
    DEFAULT_CONFIG
};

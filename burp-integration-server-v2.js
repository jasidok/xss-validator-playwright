#!/usr/bin/env node

/**
 * Modern XSS Validator Server v2.0 - Enhanced with Latest Packages
 *
 * Key Improvements:
 * - Latest package versions with security enhancements
 * - Winston logging for better observability
 * - Helmet for security headers
 * - Rate limiting with rate-limiter-flexible
 * - Input validation with Joi
 * - Compression middleware
 * - Better error handling and monitoring
 * - TypeScript-ready structure
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const winston = require('winston');
const Joi = require('joi');
const {RateLimiterMemory} = require('rate-limiter-flexible');
const {chromium, firefox, webkit} = require('playwright');

// Enhanced logging with Winston
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({stack: true}),
        winston.format.json()
    ),
    defaultMeta: {service: 'xss-validator-server'},
    transports: [
        new winston.transports.File({filename: 'logs/error.log', level: 'error'}),
        new winston.transports.File({filename: 'logs/combined.log'}),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Modern configuration with environment variables and validation
const configSchema = Joi.object({
    HOST: Joi.string().default('127.0.0.1'),
    PORT: Joi.number().port().default(8093),
    MAX_CONCURRENT_PAGES: Joi.number().min(1).max(50).default(5),
    DEFAULT_BROWSER: Joi.string().valid('chromium', 'firefox', 'webkit').default('chromium'),
    DEBUG: Joi.boolean().default(false),
    QUIET: Joi.boolean().default(false),
    REQUEST_TIMEOUT: Joi.number().default(30000),
    PAGE_TIMEOUT: Joi.number().default(15000),
    EXECUTION_TIMEOUT: Joi.number().default(3000),
    RATE_LIMIT_MAX: Joi.number().default(100),
    RATE_LIMIT_WINDOW: Joi.number().default(60) // seconds
});

const {error, value: CONFIG} = configSchema.validate({
    HOST: process.env.XSS_VALIDATOR_HOST,
    PORT: process.env.XSS_VALIDATOR_PORT,
    MAX_CONCURRENT_PAGES: process.env.XSS_VALIDATOR_MAX_PAGES,
    DEFAULT_BROWSER: process.env.XSS_VALIDATOR_DEFAULT_BROWSER,
    DEBUG: process.env.XSS_VALIDATOR_DEBUG === 'true',
    QUIET: process.env.XSS_VALIDATOR_QUIET === 'true',
    REQUEST_TIMEOUT: process.env.REQUEST_TIMEOUT,
    PAGE_TIMEOUT: process.env.PAGE_TIMEOUT,
    EXECUTION_TIMEOUT: process.env.EXECUTION_TIMEOUT,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW
});

if (error) {
    logger.error('Configuration validation failed:', error.details);
    process.exit(1);
}

// Rate limiter setup
const rateLimiter = new RateLimiterMemory({
    keyGenerator: (req) => req.ip,
    points: CONFIG.RATE_LIMIT_MAX,
    duration: CONFIG.RATE_LIMIT_WINDOW,
    blockDuration: 60,
});

// Express app setup with modern middleware
const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for XSS testing
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors({
    origin: ['http://localhost', 'http://127.0.0.1'],
    credentials: true
}));

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({extended: true, limit: '50mb'}));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });

    next();
});

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
    try {
        await rateLimiter.consume(req.ip);
        next();
    } catch (rejRes) {
        const remainingTime = Math.round(rejRes.msBeforeNext / 1000) || 1;

        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            remainingTime: remainingTime
        });

        res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${remainingTime} seconds.`,
            retryAfter: remainingTime
        });
    }
};

app.use(rateLimitMiddleware);

// Global state management with enhanced monitoring
const browserPool = new Map();
const activeRequests = new Set();
const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: null
};

/**
 * Enhanced XSS Result class with modern validation
 */
class XSSResult {
    constructor() {
        this.detected = false;
        this.executed = false;
        this.severity = 'none';
        this.confidence = 0;
        this.messages = [];
        this.detectionMethods = [];
        this.context = {};
        this.timing = {};
        this.metadata = {
            version: '2.0',
            timestamp: new Date().toISOString()
        };
    }

    addDetection(method, message, confidence = 1.0) {
        if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
            throw new Error('Confidence must be a number between 0 and 1');
        }

        this.detected = true;
        this.detectionMethods.push(method);
        this.messages.push(message);
        this.confidence = Math.max(this.confidence, confidence);

        // Enhanced severity calculation
        if (method.includes('execution') || method.includes('alert') || method.includes('console')) {
            this.executed = true;
            this.severity = 'high';
        } else if (method.includes('dom') || method.includes('mutation')) {
            this.severity = this.severity === 'none' ? 'medium' : this.severity;
        } else if (method.includes('reflection')) {
            this.severity = this.severity === 'none' ? 'low' : this.severity;
        }

        logger.debug('Detection added', {method, confidence, severity: this.severity});
    }

    toJSON() {
        return {
            detected: this.detected,
            executed: this.executed,
            severity: this.severity,
            confidence: this.confidence,
            messages: this.messages,
            detectionMethods: this.detectionMethods,
            context: this.context,
            timing: this.timing,
            metadata: this.metadata
        };
    }
}

/**
 * Request validation schemas
 */
const xssTestSchema = Joi.object({
    'http-response': Joi.string().base64().required(),
    'http-url': Joi.string().base64().required(),
    'http-headers': Joi.string().base64().allow(''),
    'payload': Joi.string().required(),
    'browser': Joi.string().valid('chromium', 'firefox', 'webkit').default(CONFIG.DEFAULT_BROWSER),
    'options': Joi.object().default({})
});

/**
 * Enhanced browser pool initialization with better error handling
 */
async function initializeBrowserPool() {
    const browsers = ['chromium', 'firefox', 'webkit'];
    const initPromises = [];

    for (const browserType of browsers) {
        initPromises.push(initializeBrowser(browserType));
    }

    const results = await Promise.allSettled(initPromises);

    results.forEach((result, index) => {
        const browserType = browsers[index];
        if (result.status === 'fulfilled') {
            logger.info(`✓ Initialized ${browserType} browser`);
        } else {
            logger.warn(`⚠️ Failed to initialize ${browserType}:`, result.reason.message);
        }
    });

    if (browserPool.size === 0) {
        throw new Error('No browsers could be initialized. Please check Playwright installation.');
    }

    logger.info(`Initialized ${browserPool.size}/3 browsers: ${Array.from(browserPool.keys()).join(', ')}`);
}

async function initializeBrowser(browserType) {
    try {
        let browser;
        const commonArgs = ['--disable-dev-shm-usage', '--no-sandbox'];

        switch (browserType) {
            case 'firefox':
                browser = await firefox.launch({
                    headless: true,
                    args: commonArgs
                });
                break;
            case 'webkit':
                browser = await webkit.launch({
                    headless: true,
                    args: commonArgs
                });
                break;
            case 'chromium':
            default:
                browser = await chromium.launch({
                    headless: true,
                    args: [
                        ...commonArgs,
                        '--disable-gpu',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-extensions',
                        '--disable-background-networking',
                        '--disable-default-apps',
                        '--disable-sync',
                        '--disable-translate',
                        '--hide-scrollbars',
                        '--metrics-recording-only',
                        '--mute-audio',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                });
                break;
        }

        browserPool.set(browserType, {
            browser,
            contexts: [],
            lastUsed: Date.now(),
            totalContexts: 0,
            activeContexts: 0
        });

        return browser;
    } catch (error) {
        logger.error(`Failed to initialize ${browserType}:`, error);
        throw error;
    }
}

/**
 * Enhanced context management with connection pooling
 */
async function getBrowserContext(browserType = CONFIG.DEFAULT_BROWSER) {
    const poolEntry = browserPool.get(browserType);
    if (!poolEntry) {
        throw new Error(`Browser ${browserType} not available`);
    }

    const context = await poolEntry.browser.newContext({
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        javaScriptEnabled: true,
        extraHTTPHeaders: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    poolEntry.activeContexts++;
    poolEntry.totalContexts++;
    poolEntry.lastUsed = Date.now();

    return {context, poolEntry};
}

/**
 * Enhanced XSS detection script with modern JavaScript
 */
const ENHANCED_DETECTION_SCRIPT = `
(() => {
    'use strict';
    
    // Modern XSS detection state with comprehensive tracking
    window.__xssDetectionState = {
        alerts: [],
        executions: [],
        domChanges: [],
        errors: [],
        networkRequests: [],
        startTime: performance.now(),
        version: '2.0'
    };

    // Store original functions with modern method
    const originals = {
        alert: window.alert,
        confirm: window.confirm,
        prompt: window.prompt,
        consoleLog: console.log,
        consoleError: console.error,
        setTimeout: window.setTimeout,
        setInterval: window.setInterval,
        documentWrite: document.write,
        fetch: window.fetch,
        XMLHttpRequest: window.XMLHttpRequest
    };

    // Enhanced alert detection with stack trace
    window.alert = function(message) {
        const alertInfo = {
            type: 'alert',
            message: String(message),
            timestamp: performance.now(),
            stack: new Error().stack,
            location: window.location.href
        };
        
        window.__xssDetectionState.alerts.push(alertInfo);
        console.log('XSS Alert detected:', alertInfo);
        
        return originals.alert.call(this, message);
    };

    window.confirm = function(message) {
        const confirmInfo = {
            type: 'confirm',
            message: String(message),
            timestamp: performance.now(),
            stack: new Error().stack,
            location: window.location.href
        };
        
        window.__xssDetectionState.alerts.push(confirmInfo);
        return true; // Auto-confirm for testing
    };

    window.prompt = function(message, defaultText) {
        const promptInfo = {
            type: 'prompt',
            message: String(message),
            defaultText: String(defaultText || ''),
            timestamp: performance.now(),
            stack: new Error().stack,
            location: window.location.href
        };
        
        window.__xssDetectionState.alerts.push(promptInfo);
        return defaultText || 'xss-test-response';
    };

    // Enhanced console monitoring
    console.log = function(...args) {
        const message = args.join(' ');
        if (args.some(arg => 
            typeof arg === 'string' && 
            (arg.includes('xss') || arg.includes('alert') || arg.includes('script'))
        )) {
            window.__xssDetectionState.executions.push({
                type: 'console.log',
                message: message,
                timestamp: performance.now(),
                args: args.length
            });
        }
        return originals.consoleLog.apply(this, args);
    };

    // Modern fetch and XHR monitoring for data exfiltration
    window.fetch = function(...args) {
        window.__xssDetectionState.networkRequests.push({
            type: 'fetch',
            url: args[0],
            timestamp: performance.now(),
            method: args[1]?.method || 'GET'
        });
        return originals.fetch.apply(this, args);
    };

    // Enhanced DOM mutation observer with modern features
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const tagName = node.tagName?.toLowerCase();
                        
                        if (tagName === 'script') {
                            window.__xssDetectionState.domChanges.push({
                                type: 'script_injection',
                                content: node.textContent || node.src || '',
                                timestamp: performance.now(),
                                attributes: Array.from(node.attributes || []).map(attr => ({
                                    name: attr.name,
                                    value: attr.value
                                }))
                            });
                        }
                        
                        // Check for dangerous attributes
                        const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
                        dangerousAttrs.forEach(attr => {
                            if (node.hasAttribute?.(attr)) {
                                window.__xssDetectionState.domChanges.push({
                                    type: 'event_handler_injection',
                                    element: tagName,
                                    attribute: attr,
                                    value: node.getAttribute(attr),
                                    timestamp: performance.now()
                                });
                            }
                        });
                    }
                });
            }
        });
    });

    observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'src', 'href']
    });

    // Enhanced error handling
    window.addEventListener('error', (event) => {
        window.__xssDetectionState.errors.push({
            type: 'javascript_error',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            timestamp: performance.now(),
            stack: event.error?.stack
        });
    });

    // CSP violation detection
    document.addEventListener('securitypolicyviolation', (event) => {
        window.__xssDetectionState.errors.push({
            type: 'csp_violation',
            violatedDirective: event.violatedDirective,
            blockedURI: event.blockedURI,
            timestamp: performance.now()
        });
    });

    console.log('Enhanced XSS detection monitoring initialized v2.0');
})();
`;

/**
 * Main XSS detection endpoint with enhanced validation and error handling
 */
app.post('/', async (req, res) => {
    const requestId = ++metrics.totalRequests;
    const startTime = Date.now();

    try {
        // Validate request data
        const {error: validationError, value: validatedData} = xssTestSchema.validate(req.body);

        if (validationError) {
            logger.warn('Request validation failed', {
                requestId,
                error: validationError.details,
                ip: req.ip
            });

            return res.status(400).json({
                error: 'Validation Error',
                details: validationError.details.map(d => d.message)
            });
        }

        // Check rate limits and capacity
        if (activeRequests.size >= CONFIG.MAX_CONCURRENT_PAGES) {
            logger.warn('Server capacity exceeded', {
                requestId,
                activeRequests: activeRequests.size,
                maxCapacity: CONFIG.MAX_CONCURRENT_PAGES
            });

            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'Server at capacity. Please try again later.',
                activeRequests: activeRequests.size,
                maxCapacity: CONFIG.MAX_CONCURRENT_PAGES
            });
        }

        activeRequests.add(requestId);

        // Process the XSS test
        const result = await processXSSTest(validatedData, requestId);

        // Update metrics
        metrics.successfulRequests++;
        metrics.averageResponseTime = (metrics.averageResponseTime + (Date.now() - startTime)) / 2;
        metrics.lastRequestTime = new Date().toISOString();

        // Return enhanced response
        if (result.detected || result.executed) {
            res.status(200).json({
                value: result.executed ? 1 : (result.detected ? 1 : 0),
                msg: result.messages.join('; '),
                enhanced: result.toJSON()
            });
        } else {
            res.status(201).json({
                value: 0,
                msg: 'No XSS found in response',
                enhanced: result.toJSON()
            });
        }

    } catch (error) {
        metrics.failedRequests++;
        logger.error('Request processing failed', {
            requestId,
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'An error occurred while processing your request',
            requestId
        });
    } finally {
        activeRequests.delete(requestId);
    }
});

/**
 * Enhanced health check with detailed metrics
 */
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeRequests: activeRequests.size,
        maxConcurrentPages: CONFIG.MAX_CONCURRENT_PAGES,
        availableBrowsers: Array.from(browserPool.keys()),
        metrics: {
            ...metrics,
            successRate: metrics.totalRequests > 0 ?
                (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) + '%' : '100%'
        },
        browserPool: Object.fromEntries(
            Array.from(browserPool.entries()).map(([browser, pool]) => [
                browser,
                {
                    totalContexts: pool.totalContexts,
                    activeContexts: pool.activeContexts,
                    lastUsed: new Date(pool.lastUsed).toISOString()
                }
            ])
        )
    };

    res.json(health);
});

/**
 * Enhanced metrics endpoint
 */
app.get('/metrics', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        requests: metrics,
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            activeRequests: activeRequests.size
        },
        browsers: Object.fromEntries(
            Array.from(browserPool.entries()).map(([browser, pool]) => [
                browser,
                {
                    available: true,
                    contexts: pool.totalContexts,
                    active: pool.activeContexts,
                    lastUsed: pool.lastUsed
                }
            ])
        )
    });
});

/**
 * Process XSS test with enhanced analysis
 */
async function processXSSTest(data, requestId) {
    const result = new XSSResult();
    let context = null;
    let page = null;
    let poolEntry = null;

    try {
        // Decode request data
        const decodedResponse = Buffer.from(data['http-response'], 'base64').toString('utf-8');
        const decodedUrl = Buffer.from(data['http-url'], 'base64').toString('utf-8');
        const decodedHeaders = data['http-headers'] ?
            Buffer.from(data['http-headers'], 'base64').toString('utf-8') : '';

        logger.debug('Processing XSS test', {
            requestId,
            url: decodedUrl,
            payload: data.payload,
            browser: data.browser
        });

        // Get browser context
        const contextResult = await getBrowserContext(data.browser);
        context = contextResult.context;
        poolEntry = contextResult.poolEntry;

        page = await context.newPage();

        // Add enhanced detection script
        await page.addInitScript(ENHANCED_DETECTION_SCRIPT);

        // Set page content with timeout
        await page.setContent(decodedResponse, {
            url: decodedUrl,
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.PAGE_TIMEOUT
        });

        // Enhanced analysis
        await analyzePageForXSS(page, data.payload, result);

        // Add context information
        result.context = {
            ...result.context,
            requestId,
            browser: data.browser,
            url: decodedUrl,
            timestamp: new Date().toISOString()
        };

        return result;

    } catch (error) {
        logger.error('XSS test processing failed', {
            requestId,
            error: error.message,
            stack: error.stack
        });

        result.addDetection('processing_error', `Error: ${error.message}`, 0.1);
        return result;

    } finally {
        // Cleanup with better error handling
        try {
            if (page) await page.close();
            if (context) await context.close();
            if (poolEntry) poolEntry.activeContexts--;
        } catch (cleanupError) {
            logger.warn('Cleanup error', {
                requestId,
                error: cleanupError.message
            });
        }
    }
}

/**
 * Enhanced page analysis with modern detection techniques
 */
async function analyzePageForXSS(page, payload, result) {
    const startTime = Date.now();

    try {
        // Basic reflection check
        const content = await page.content();
        if (content.includes(payload)) {
            result.addDetection('reflection', 'Payload reflected in page content', 0.6);
        }

        // Wait for execution and DOM mutations
        await page.waitForTimeout(CONFIG.EXECUTION_TIMEOUT);

        // Get detection state
        const detectionState = await page.evaluate(() => {
            return window.__xssDetectionState;
        });

        if (detectionState) {
            // Process different types of detections
            detectionState.alerts.forEach(alert => {
                result.addDetection('javascript_execution',
                    `${alert.type}('${alert.message}')`, 1.0);
            });

            detectionState.executions.forEach(execution => {
                result.addDetection('code_execution',
                    `${execution.type}: ${execution.message}`, 0.9);
            });

            detectionState.domChanges.forEach(change => {
                result.addDetection('dom_manipulation',
                    `${change.type}: ${change.content || change.value || ''}`, 0.8);
            });

            detectionState.networkRequests.forEach(request => {
                if (request.url && request.url !== 'about:blank') {
                    result.addDetection('network_request',
                        `${request.type} to ${request.url}`, 0.7);
                }
            });

            result.context.detectionDetails = detectionState;
        }

        result.timing.analysisTime = Date.now() - startTime;

    } catch (error) {
        logger.error('Page analysis failed', {error: error.message});
        result.addDetection('analysis_error', `Analysis error: ${error.message}`, 0.3);
    }
}

/**
 * Graceful shutdown with proper cleanup
 */
async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new requests
    server.close(() => {
        logger.info('HTTP server closed');
    });

    // Close all browsers
    const closePromises = Array.from(browserPool.values()).map(async (poolEntry) => {
        try {
            await poolEntry.browser.close();
            logger.info(`Browser closed: ${poolEntry.browser.browserType()?.name() || 'unknown'}`);
        } catch (error) {
            logger.error('Error closing browser:', error);
        }
    });

    await Promise.allSettled(closePromises);

    logger.info('All browsers closed. Exiting...');
    process.exit(0);
}

// Enhanced startup process
async function startServer() {
    try {
        logger.info('🚀 Starting XSS Validator Server v2.0...');
        logger.info('Configuration:', {
            host: CONFIG.HOST,
            port: CONFIG.PORT,
            maxPages: CONFIG.MAX_CONCURRENT_PAGES,
            defaultBrowser: CONFIG.DEFAULT_BROWSER,
            debug: CONFIG.DEBUG
        });

        // Initialize browsers
        await initializeBrowserPool();

        // Start server
        const server = app.listen(CONFIG.PORT, CONFIG.HOST, () => {
            logger.info(`✅ Server listening on ${CONFIG.HOST}:${CONFIG.PORT}`);
            logger.info(`🌐 Available browsers: ${Array.from(browserPool.keys()).join(', ')}`);
            logger.info('📡 Ready to receive requests from Burp Suite');
        });

        // Setup graceful shutdown
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

        return server;

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = {app, CONFIG, logger};
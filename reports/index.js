const fs = require('fs');
const path = require('path');

/**
 * Generates a JSON report of XSS vulnerabilities
 * @param {Array} results - Array of detected vulnerabilities
 * @param {string} outputPath - Path to save the report
 * @param {Object} options - Additional options for the report
 * @returns {Promise<string>} - Path to the generated report
 */
async function generateJSONReport(results, outputPath, options = {}) {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: results.length,
            reflected: results.filter(r => r.reflected).length,
            executed: results.filter(r => r.executed).length
        },
        results: results,
        options: options
    };
    
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the report to file
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    
    return outputPath;
}

/**
 * Generates an HTML report of XSS vulnerabilities
 * @param {Array} results - Array of detected vulnerabilities
 * @param {string} outputPath - Path to save the report
 * @param {Object} options - Additional options for the report
 * @returns {Promise<string>} - Path to the generated report
 */
async function generateHTMLReport(results, outputPath, options = {}) {
    const summary = {
        total: results.length,
        reflected: results.filter(r => r.reflected).length,
        executed: results.filter(r => r.executed).length
    };
    
    // Create HTML content
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>XSS Validator Report</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            h1, h2, h3 {
                color: #2c3e50;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            .summary {
                background-color: #f8f9fa;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .summary-item {
                display: inline-block;
                margin-right: 20px;
                font-size: 18px;
            }
            .vulnerability {
                background-color: #fff;
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 15px;
                margin-bottom: 15px;
            }
            .vulnerability-header {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
                margin-bottom: 10px;
            }
            .vulnerability-title {
                font-weight: bold;
                font-size: 18px;
            }
            .vulnerability-status {
                font-size: 14px;
            }
            .status-executed {
                color: #e74c3c;
                font-weight: bold;
            }
            .status-reflected {
                color: #f39c12;
            }
            .payload {
                background-color: #f8f9fa;
                padding: 10px;
                border-radius: 3px;
                font-family: monospace;
                overflow-x: auto;
            }
            .timestamp {
                color: #7f8c8d;
                font-size: 14px;
            }
            .severity-high {
                color: #e74c3c;
            }
            .severity-medium {
                color: #f39c12;
            }
            .severity-low {
                color: #3498db;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>XSS Validator Report</h1>
            <div class="summary">
                <h2>Summary</h2>
                <div class="summary-item">Total Vulnerabilities: <strong>${summary.total}</strong></div>
                <div class="summary-item">Reflected: <strong>${summary.reflected}</strong></div>
                <div class="summary-item">Executed: <strong>${summary.executed}</strong></div>
            </div>
            
            <h2>Vulnerabilities</h2>
    `;
    
    // Add each vulnerability to the report
    results.forEach((result, index) => {
        // Determine severity
        let severity = 'Low';
        let severityClass = 'severity-low';
        
        if (result.executed) {
            severity = 'High';
            severityClass = 'severity-high';
        } else if (result.reflected) {
            severity = 'Medium';
            severityClass = 'severity-medium';
        }
        
        html += `
            <div class="vulnerability">
                <div class="vulnerability-header">
                    <div class="vulnerability-title">Vulnerability #${index + 1} - <span class="${severityClass}">${severity}</span></div>
                    <div class="vulnerability-status">
                        ${result.executed ? '<span class="status-executed">Executed</span>' : ''}
                        ${result.reflected ? '<span class="status-reflected">Reflected</span>' : ''}
                    </div>
                </div>
                <div>
                    <strong>URL:</strong> ${result.url}
                </div>
                <div>
                    <strong>Payload:</strong>
                    <pre class="payload">${escapeHtml(result.payload)}</pre>
                </div>
                <div class="timestamp">
                    Detected at: ${result.timestamp}
                </div>
            </div>
        `;
    });
    
    // Close HTML tags
    html += `
        </div>
    </body>
    </html>
    `;
    
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the report to file
    fs.writeFileSync(outputPath, html);
    
    return outputPath;
}

/**
 * Escape HTML special characters to prevent XSS in the report itself
 * @param {string} unsafe - Unsafe string that might contain HTML
 * @returns {string} - Escaped string
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

module.exports = {
    generateJSONReport,
    generateHTMLReport
};
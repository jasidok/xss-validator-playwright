// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');
const detectionForm = document.getElementById('detection-form');
const configForm = document.getElementById('config-form');
const progressCard = document.getElementById('progress-card');
const resultsCard = document.getElementById('results-card');
const progressBar = document.querySelector('.progress');
const progressText = document.querySelector('.progress-text');
const statusElement = document.querySelector('.status');
const logsElement = document.querySelector('.logs');
const clearLogsButton = document.getElementById('clear-logs');
const totalVulns = document.getElementById('total-vulns');
const reflectedVulns = document.getElementById('reflected-vulns');
const executedVulns = document.getElementById('executed-vulns');
const vulnerabilitiesContainer = document.querySelector('.vulnerabilities-container');
const reportsList = document.querySelector('.reports-list');
const reportIframe = document.getElementById('report-iframe');

// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and panes
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        // Add active class to clicked button and corresponding pane
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        // Load data for the tab if needed
        if (tabId === 'reports') {
            loadReports();
        } else if (tabId === 'configuration') {
            loadConfiguration();
        }
    });
});

// Load configuration from server
async function loadConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // Populate configuration form
        document.getElementById('default-browser').value = config.browser || 'chromium';
        document.getElementById('default-submit-selector').value = config.submitSelector || '';
        document.getElementById('default-timeout').value = config.timeout || 2000;
        document.getElementById('default-verify-execution').checked = config.verifyExecution !== false;
        
        if (config.report) {
            document.getElementById('default-report-format').value = config.report.format || '';
            document.getElementById('report-output-dir').value = config.report.outputDir || './reports';
        }
        
        if (config.effectiveness) {
            document.getElementById('track-effectiveness').checked = config.effectiveness.track !== false;
            document.getElementById('use-effective-payloads').checked = config.effectiveness.useEffectivePayloads === true;
            document.getElementById('effective-payloads-limit').value = config.effectiveness.limit || 10;
        }
        
        // Also populate the detection form with defaults
        document.getElementById('browser').value = config.browser || 'chromium';
        document.getElementById('submit-selector').value = config.submitSelector || '';
        document.getElementById('timeout').value = config.timeout || 2000;
        document.getElementById('verify-execution').checked = config.verifyExecution !== false;
        
        // Load available payloads
        loadPayloads();
    } catch (error) {
        console.error('Error loading configuration:', error);
        showNotification('Error loading configuration', 'error');
    }
}

// Save configuration to server
async function saveConfiguration(event) {
    event.preventDefault();
    
    const formData = new FormData(configForm);
    const config = {};
    
    // Process form data into nested configuration object
    for (const [key, value] of formData.entries()) {
        if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (!config[parent]) config[parent] = {};
            config[parent][child] = value;
        } else if (key === 'verifyExecution') {
            config[key] = true; // Checkbox is only included when checked
        } else {
            config[key] = value;
        }
    }
    
    // Handle checkboxes that might not be in the form data if unchecked
    if (!formData.has('verifyExecution')) config.verifyExecution = false;
    if (!formData.has('effectiveness.track')) {
        if (!config.effectiveness) config.effectiveness = {};
        config.effectiveness.track = false;
    }
    if (!formData.has('effectiveness.useEffectivePayloads')) {
        if (!config.effectiveness) config.effectiveness = {};
        config.effectiveness.useEffectivePayloads = false;
    }
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        if (result.success) {
            showNotification('Configuration saved successfully', 'success');
        } else {
            showNotification('Error saving configuration: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        showNotification('Error saving configuration', 'error');
    }
}

// Load available payloads
async function loadPayloads() {
    try {
        const response = await fetch('/api/payloads');
        const payloads = await response.json();
        
        const payloadsSelect = document.getElementById('payloads');
        
        // Keep the default options
        const defaultOptions = Array.from(payloadsSelect.options).slice(0, 2);
        payloadsSelect.innerHTML = '';
        
        // Add default options back
        defaultOptions.forEach(option => {
            payloadsSelect.appendChild(option);
        });
        
        // Add payload files
        payloads.forEach(payload => {
            const option = document.createElement('option');
            option.value = payload.path;
            option.textContent = payload.name;
            payloadsSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading payloads:', error);
    }
}

// Load reports
async function loadReports() {
    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();
        
        reportsList.innerHTML = '';
        
        if (reports.length === 0) {
            reportsList.innerHTML = '<div class="no-reports">No reports found</div>';
            return;
        }
        
        reports.forEach(report => {
            const reportItem = document.createElement('div');
            reportItem.className = 'report-item';
            reportItem.dataset.path = report.path;
            reportItem.dataset.type = report.type;
            
            const date = new Date(report.date);
            
            reportItem.innerHTML = `
                <div>${report.name}</div>
                <div class="timestamp">${date.toLocaleString()}</div>
            `;
            
            reportItem.addEventListener('click', () => {
                // Remove active class from all report items
                document.querySelectorAll('.report-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to clicked item
                reportItem.classList.add('active');
                
                // Show report in iframe
                document.querySelector('.no-preview').style.display = 'none';
                reportIframe.style.display = 'block';
                reportIframe.src = report.path;
            });
            
            reportsList.appendChild(reportItem);
        });
    } catch (error) {
        console.error('Error loading reports:', error);
        reportsList.innerHTML = '<div class="no-reports">Error loading reports</div>';
    }
}

// Handle detection form submission
function startDetection(event) {
    event.preventDefault();
    
    // Show progress card and hide results card
    progressCard.style.display = 'block';
    resultsCard.style.display = 'none';
    
    // Reset progress and logs
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    statusElement.textContent = 'Starting...';
    logsElement.innerHTML = '';
    
    // Get form data
    const formData = new FormData(detectionForm);
    const url = formData.get('url');
    const selector = formData.get('selector');
    
    // Build options object
    const options = {
        browser: formData.get('browser'),
        submitSelector: formData.get('submitSelector'),
        timeout: parseInt(formData.get('timeout')),
        verifyExecution: formData.has('verifyExecution'),
        logging: {
            verbose: formData.has('verbose'),
            showProgress: true
        }
    };
    
    // Add report options if selected
    const reportFormat = formData.get('reportFormat');
    if (reportFormat) {
        options.report = {
            format: reportFormat,
            outputDir: './reports',
            filename: `xss-report-${new Date().toISOString().replace(/:/g, '-')}`
        };
    }
    
    // Get payloads
    let payloads = null;
    const payloadsValue = formData.get('payloads');
    if (payloadsValue === 'effective') {
        options.effectiveness = {
            useEffectivePayloads: true,
            limit: 10
        };
    } else if (payloadsValue !== 'default') {
        // Custom payloads file selected, we'll let the server handle loading it
        options.payloads = {
            file: payloadsValue
        };
    }
    
    // Send detection request to server
    socket.emit('detect-xss', {
        url,
        selector,
        payloads,
        options
    });
}

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('progress', (data) => {
    const percent = data.percent || 0;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
});

socket.on('log', (message) => {
    const logLine = document.createElement('div');
    logLine.textContent = message;
    logsElement.appendChild(logLine);
    logsElement.scrollTop = logsElement.scrollHeight;
});

socket.on('status', (data) => {
    statusElement.textContent = data.message;
    
    if (data.status === 'error') {
        statusElement.style.color = 'var(--danger-color)';
    } else if (data.status === 'complete') {
        statusElement.style.color = 'var(--success-color)';
    } else {
        statusElement.style.color = '';
    }
});

socket.on('detection-complete', (result) => {
    // Show results card
    resultsCard.style.display = 'block';
    
    // Update summary
    const results = result.results || [];
    totalVulns.textContent = results.length;
    reflectedVulns.textContent = results.filter(r => r.reflected).length;
    executedVulns.textContent = results.filter(r => r.executed).length;
    
    // Clear previous vulnerabilities
    vulnerabilitiesContainer.innerHTML = '';
    
    // Add vulnerabilities
    results.forEach((vuln, index) => {
        // Determine severity
        let severity = 'Low';
        let severityClass = 'severity-low';
        
        if (vuln.executed) {
            severity = 'High';
            severityClass = 'severity-high';
        } else if (vuln.reflected) {
            severity = 'Medium';
            severityClass = 'severity-medium';
        }
        
        const vulnElement = document.createElement('div');
        vulnElement.className = 'vulnerability';
        vulnElement.innerHTML = `
            <div class="vulnerability-header">
                <div class="vulnerability-title">Vulnerability #${index + 1} - <span class="${severityClass}">${severity}</span></div>
                <div class="vulnerability-status">
                    ${vuln.executed ? '<span class="status-executed">Executed</span>' : ''}
                    ${vuln.reflected ? '<span class="status-reflected">Reflected</span>' : ''}
                </div>
            </div>
            <div>
                <strong>URL:</strong> ${vuln.url}
            </div>
            <div>
                <strong>Payload:</strong>
                <pre class="payload">${escapeHtml(vuln.payload)}</pre>
            </div>
            <div class="timestamp">
                Detected at: ${vuln.timestamp}
            </div>
        `;
        
        vulnerabilitiesContainer.appendChild(vulnElement);
    });
    
    // If no vulnerabilities found
    if (results.length === 0) {
        vulnerabilitiesContainer.innerHTML = '<div class="no-vulnerabilities">No vulnerabilities found</div>';
    }
    
    // If reports were generated, update the reports tab
    if (result.reportPaths && Object.keys(result.reportPaths).length > 0) {
        // Add a notification about reports
        const reportsMessage = document.createElement('div');
        reportsMessage.className = 'reports-message';
        reportsMessage.innerHTML = `
            <p>Reports generated:</p>
            <ul>
                ${Object.entries(result.reportPaths).map(([format, path]) => 
                    `<li><a href="${path}" target="_blank">${format.toUpperCase()}</a></li>`
                ).join('')}
            </ul>
            <p>View them in the Reports tab.</p>
        `;
        vulnerabilitiesContainer.appendChild(reportsMessage);
        
        // Reload reports in the background
        loadReports();
    }
});

socket.on('error', (error) => {
    console.error('Error from server:', error);
    showNotification(error.message, 'error');
});

// Clear logs button
clearLogsButton.addEventListener('click', () => {
    logsElement.innerHTML = '';
});

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.querySelector('.notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set notification content and type
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Event listeners
detectionForm.addEventListener('submit', startDetection);
configForm.addEventListener('submit', saveConfiguration);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadConfiguration();
});
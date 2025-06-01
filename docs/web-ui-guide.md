# XSS Validator Web UI Guide

This document provides instructions for using the XSS Validator Web UI, a graphical interface for configuring and running XSS detection tests, viewing progress and logs in real-time, and analyzing the results.

## Getting Started

### Prerequisites
- Node.js version 18 or higher
- npm (Node Package Manager)
- XSS Validator dependencies installed (`npm install`)

### Starting the Web UI
To start the Web UI, run the following command from the project root:

```bash
npm run webui
```

This will start the server on port 3000 (by default). You can then access the Web UI by opening a web browser and navigating to:

```
http://localhost:3000
```

## Using the Web UI

The Web UI is organized into three main tabs:

### 1. Detection Tab

This tab allows you to configure and run XSS detection tests.

#### Configuration Options
- **URL to Test**: The URL of the page to test for XSS vulnerabilities
- **Input Field Selector**: CSS selector for the input field to test
- **Browser**: Browser to use for testing (Chromium, Firefox, or WebKit)
- **Submit Button Selector**: CSS selector for the submit button
- **Timeout**: Timeout in milliseconds for waiting after submission
- **Verify JavaScript Execution**: Whether to verify if JavaScript is executed
- **Verbose Logging**: Enable detailed logging during detection
- **Payloads**: Select which payloads to use for testing
- **Report Format**: Format for generating reports (JSON, HTML, or both)

#### Running a Test
1. Fill in the required fields (URL and Input Field Selector)
2. Configure other options as needed
3. Click the "Start Detection" button

#### Viewing Progress and Logs
During the test, you'll see:
- A progress bar showing the completion percentage
- Status messages indicating the current state
- Detailed logs if verbose logging is enabled

#### Viewing Results
After the test completes, you'll see:
- A summary of detected vulnerabilities
- Detailed information about each vulnerability
- Links to generated reports (if any)

### 2. Configuration Tab

This tab allows you to configure default settings for the XSS Validator.

#### Available Settings
- **Default Browser**: Default browser to use for testing
- **Default Submit Selector**: Default CSS selector for submit buttons
- **Default Timeout**: Default timeout in milliseconds
- **Verify JavaScript Execution**: Whether to verify JavaScript execution by default
- **Default Report Format**: Default format for generating reports
- **Report Output Directory**: Directory to save generated reports
- **Track Payload Effectiveness**: Whether to track which payloads are most effective
- **Use Most Effective Payloads**: Whether to use the most effective payloads by default
- **Effective Payloads Limit**: Maximum number of effective payloads to use

#### Saving Configuration
1. Adjust the settings as needed
2. Click the "Save Configuration" button

### 3. Reports Tab

This tab allows you to view and manage generated reports.

#### Viewing Reports
1. Select a report from the list on the left
2. The report will be displayed in the preview pane on the right

## Command Line Options

In addition to the Web UI, you can also use the command line interface with the new progress and logging options:

### Progress Indicators
```bash
xss-validator detect https://example.com "#search" -p 5
```
This will show progress updates after every 5 payloads.

To disable progress indicators:
```bash
xss-validator detect https://example.com "#search" --no-progress
```

### Verbose Logging
```bash
xss-validator detect https://example.com "#search" -v
```
This will enable verbose logging, showing detailed information about each step of the detection process.

## Troubleshooting

### Web UI Not Starting
- Make sure you have installed all dependencies with `npm install`
- Check if port 3000 is already in use by another application
- Verify that you have Node.js version 18 or higher installed

### Detection Not Working
- Verify that the URL is accessible from your machine
- Check that the input field selector correctly identifies the input element
- Try increasing the timeout value for complex pages
- Enable verbose logging for more detailed information

### Reports Not Generating
- Make sure the reports directory exists and is writable
- Check the console for any error messages
- Verify that you have selected a report format (JSON, HTML, or both)
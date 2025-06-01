const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'xss-validator-demo-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// No view engine needed as we're sending HTML directly

// In-memory storage for comments and messages
const comments = [];
const messages = {};

// Routes

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Reflected XSS - Search page
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Search Results</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Search Results</h1>
      <form action="/search" method="GET">
        <input type="text" name="q" value="${query}" placeholder="Search...">
        <button type="submit">Search</button>
      </form>
      <div class="results">
        <h2>Results for: ${query}</h2>
        <p>No results found for your search.</p>
      </div>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

// Reflected XSS - Echo page with different contexts
app.get('/echo', (req, res) => {
  const input = req.query.input || '';
  const context = req.query.context || 'html';

  let output = '';

  switch(context) {
    case 'attribute':
      output = `<div id="output" data-value="${input}">Attribute Context</div>`;
      break;
    case 'javascript':
      output = `<script>var userInput = "${input}";</script><div id="output">JavaScript Context</div>`;
      break;
    case 'url':
      output = `<a href="${input}" id="output">URL Context</a>`;
      break;
    case 'css':
      output = `<div id="output" style="color: ${input}">CSS Context</div>`;
      break;
    case 'html':
    default:
      output = `<div id="output">${input}</div>`;
      break;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Echo Page</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Echo Page</h1>
      <form action="/echo" method="GET">
        <input type="text" name="input" value="${input}" placeholder="Enter text...">
        <select name="context">
          <option value="html" ${context === 'html' ? 'selected' : ''}>HTML Context</option>
          <option value="attribute" ${context === 'attribute' ? 'selected' : ''}>Attribute Context</option>
          <option value="javascript" ${context === 'javascript' ? 'selected' : ''}>JavaScript Context</option>
          <option value="url" ${context === 'url' ? 'selected' : ''}>URL Context</option>
          <option value="css" ${context === 'css' ? 'selected' : ''}>CSS Context</option>
        </select>
        <button type="submit">Echo</button>
      </form>
      <div class="output-container">
        <h2>Output:</h2>
        ${output}
      </div>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

// Stored XSS - Comments page
app.get('/comments', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comments</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Comments</h1>
      <form action="/comments" method="POST">
        <input type="text" name="name" placeholder="Your Name" required>
        <textarea name="comment" placeholder="Your Comment" required></textarea>
        <button type="submit">Post Comment</button>
      </form>
      <div class="comments">
        <h2>Previous Comments</h2>
        ${comments.map(c => `
          <div class="comment">
            <h3>${c.name}</h3>
            <p>${c.comment}</p>
            <small>${c.date}</small>
          </div>
        `).join('')}
      </div>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.post('/comments', (req, res) => {
  const { name, comment } = req.body;
  if (name && comment) {
    comments.unshift({
      name,
      comment,
      date: new Date().toLocaleString()
    });
  }
  res.redirect('/comments');
});

// DOM-based XSS - Hash fragment
app.get('/dom', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DOM-based XSS</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>DOM-based XSS</h1>
      <p>Try adding a hash fragment to the URL (e.g., #&lt;script&gt;alert(1)&lt;/script&gt;)</p>
      <div id="output"></div>
      <script>
        // Vulnerable code that uses hash fragment without sanitization
        document.getElementById('output').innerHTML = 'Hash fragment: ' + location.hash.substring(1);

        // Update when hash changes
        window.addEventListener('hashchange', function() {
          document.getElementById('output').innerHTML = 'Hash fragment: ' + location.hash.substring(1);
        });
      </script>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

// Session-based XSS - Messages
app.get('/messages', (req, res) => {
  const userId = req.session.userId || 'guest-' + Math.random().toString(36).substring(2, 10);
  req.session.userId = userId;

  const userMessages = messages[userId] || [];

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Messages</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Your Messages</h1>
      <p>User ID: ${userId}</p>
      <form action="/messages" method="POST">
        <textarea name="message" placeholder="Write a message..." required></textarea>
        <button type="submit">Save Message</button>
      </form>
      <div class="messages">
        <h2>Your Saved Messages</h2>
        ${userMessages.map(m => `
          <div class="message">
            <p>${m.text}</p>
            <small>${m.date}</small>
          </div>
        `).join('')}
      </div>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.post('/messages', (req, res) => {
  const { message } = req.body;
  const userId = req.session.userId || 'guest-' + Math.random().toString(36).substring(2, 10);
  req.session.userId = userId;

  if (message) {
    if (!messages[userId]) {
      messages[userId] = [];
    }

    messages[userId].unshift({
      text: message,
      date: new Date().toLocaleString()
    });
  }

  res.redirect('/messages');
});

// Login page (for testing authentication)
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Login</h1>
      <form action="/login" method="POST">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Simple authentication (for demo purposes only)
  if (username === 'admin' && password === 'password') {
    req.session.authenticated = true;
    req.session.username = username;
    res.redirect('/admin');
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Failed</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <h1>Login Failed</h1>
        <p>Invalid username or password.</p>
        <a href="/login">Try Again</a>
        <a href="/">Back to Home</a>
      </body>
      </html>
    `);
  }
});

// Admin page (protected)
app.get('/admin', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Panel</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Admin Panel</h1>
      <p>Welcome, ${req.session.username}!</p>
      <div class="admin-panel">
        <h2>User Input</h2>
        <form action="/admin/echo" method="POST">
          <textarea name="input" placeholder="Enter text to echo..." required></textarea>
          <button type="submit">Echo</button>
        </form>
      </div>
      <a href="/logout">Logout</a>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.post('/admin/echo', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login');
  }

  const { input } = req.body;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Echo</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Admin Echo</h1>
      <p>Welcome, ${req.session.username}!</p>
      <div class="output-container">
        <h2>Your Input:</h2>
        <div class="admin-output">${input}</div>
      </div>
      <a href="/admin">Back to Admin Panel</a>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start the server
app.listen(PORT, () => {
  console.log(`XSS Validator Demo App running on http://localhost:${PORT}`);
});

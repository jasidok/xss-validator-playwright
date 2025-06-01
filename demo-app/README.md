# XSS Validator Demo Application

This is a deliberately vulnerable web application designed for testing the XSS Validator tool. It contains various types of XSS vulnerabilities in different contexts to help demonstrate and test the capabilities of the XSS Validator.

**WARNING**: This application is intentionally vulnerable to XSS attacks. Do not deploy it in a production environment or on a publicly accessible server.

## Features

The demo application includes the following types of XSS vulnerabilities:

1. **Reflected XSS**
   - Search page with query reflection
   - Echo page with different contexts (HTML, attribute, JavaScript, URL, CSS)

2. **Stored XSS**
   - Comments page that stores and displays user input

3. **DOM-based XSS**
   - Page that uses hash fragments without sanitization

4. **Session-based XSS**
   - Messages page that stores user input in session

5. **Authentication-required XSS**
   - Admin page with echo functionality that requires login

## Setup

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)

### Installation

1. Install the required dependencies:

```bash
cd demo-app
npm install express body-parser express-session
```

2. Start the server:

```bash
node server.js
```

The application will be available at http://localhost:3000.

## Usage with XSS Validator

### Basic Testing

Test the search page for reflected XSS:

```bash
xss-validator detect http://localhost:3000/search "#q"
```

Test the echo page with HTML context:

```bash
xss-validator detect http://localhost:3000/echo "input[name='input']"
```

Test the comments page for stored XSS:

```bash
xss-validator detect http://localhost:3000/comments "textarea[name='comment']" --submit "button[type='submit']"
```

### Testing with Authentication

Create an authentication configuration file (`auth-config.json`):

```json
{
  "url": "http://localhost:3000/login",
  "usernameSelector": "input[name='username']",
  "passwordSelector": "input[name='password']",
  "submitSelector": "button[type='submit']",
  "username": "admin",
  "password": "password"
}
```

Test the admin page with authentication:

```bash
xss-validator detect http://localhost:3000/admin/echo "textarea[name='input']" --auth auth-config.json
```

### Crawling and Testing All Inputs

Crawl the entire site and test all discovered inputs:

```bash
xss-validator crawl http://localhost:3000 --test
```

## Vulnerability Details

### Reflected XSS

- **Search Page** (`/search`): Reflects the query parameter directly in the HTML without sanitization.
- **Echo Page** (`/echo`): Reflects user input in different contexts (HTML, attribute, JavaScript, URL, CSS) without sanitization.

### Stored XSS

- **Comments Page** (`/comments`): Stores user-submitted comments and displays them without sanitization.

### DOM-based XSS

- **DOM Page** (`/dom`): Uses the hash fragment from the URL to update the DOM without sanitization.

### Session-based XSS

- **Messages Page** (`/messages`): Stores user messages in the session and displays them without sanitization.

### Authentication-required XSS

- **Admin Page** (`/admin/echo`): Requires authentication and then reflects user input without sanitization.

## Login Credentials

For testing the authentication-required pages:

- Username: `admin`
- Password: `password`

## XSS Payloads to Try

Here are some example XSS payloads to test with:

- `<script>alert(1)</script>`
- `<img src=x onerror=alert(1)>`
- `<svg onload=alert(1)>`
- `javascript:alert(1)`
- `" onmouseover="alert(1)`
- `'-alert(1)-'`

## Customization

You can modify the server.js file to add more vulnerabilities or change the behavior of existing ones. The application is designed to be simple and easy to understand, making it a good starting point for learning about XSS vulnerabilities and how to test for them.
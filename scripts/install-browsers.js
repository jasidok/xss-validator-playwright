#!/usr/bin/env node

const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Browser installation script for XSS Validator
 * This script automatically installs Playwright browsers during npm install
 */

// Check if we're in a CI environment where we might want to skip browser installation
const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'production';
const skipInstall = process.env.SKIP_BROWSER_INSTALL === 'true';

// Default browsers to install
const browsersToInstall = process.env.BROWSERS || 'chromium';

async function checkBrowserInstallation() {
    console.log('🔍 Checking Playwright browser installation...');

    try {
        // Try to import playwright to check if it's available
        const playwright = require('playwright');

        // Check if browsers are installed by trying to get browser executable paths
        const browsers = ['chromium', 'firefox', 'webkit'];
        const installedBrowsers = [];

        for (const browserName of browsers) {
            try {
                const browser = playwright[browserName];
                if (browser && browser.executablePath && browser.executablePath()) {
                    installedBrowsers.push(browserName);
                }
            } catch (error) {
                // Browser not installed
            }
        }

        if (installedBrowsers.length > 0) {
            console.log(`✅ Found installed browsers: ${installedBrowsers.join(', ')}`);
            return true;
        }

        return false;
    } catch (error) {
        console.log('❌ Playwright not found or not properly installed');
        return false;
    }
}

async function installBrowsers() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Installing Playwright browsers...');
        console.log(`Installing: ${browsersToInstall}`);

        // Determine which browsers to install
        const installArgs = ['playwright', 'install'];

        if (browsersToInstall === 'all') {
            installArgs.push('--with-deps');
        } else {
            installArgs.push('--with-deps', ...browsersToInstall.split(',').map(b => b.trim()));
        }

        const installProcess = spawn('npx', installArgs, {
            stdio: 'inherit',
            shell: true,
            env: {...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 'false'}
        });

        installProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Browser installation completed successfully!');
                resolve();
            } else {
                console.error(`❌ Browser installation failed with exit code ${code}`);
                reject(new Error(`Installation failed with exit code ${code}`));
            }
        });

        installProcess.on('error', (error) => {
            console.error('❌ Error during browser installation:', error.message);
            reject(error);
        });

        // Handle timeout
        const timeout = setTimeout(() => {
            installProcess.kill();
            reject(new Error('Installation timeout after 5 minutes'));
        }, 5 * 60 * 1000); // 5 minutes timeout

        installProcess.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

async function createBrowserCheckScript() {
    const checkScriptPath = path.join(__dirname, 'check-browsers.js');
    const checkScript = `#!/usr/bin/env node

const { chromium, firefox, webkit } = require('playwright');

async function checkBrowsers() {
  const browsers = [
    { name: 'chromium', instance: chromium },
    { name: 'firefox', instance: firefox },
    { name: 'webkit', instance: webkit }
  ];
  
  console.log('🔍 Checking browser installations...');
  
  const results = [];
  
  for (const { name, instance } of browsers) {
    try {
      const executablePath = instance.executablePath();
      if (executablePath && require('fs').existsSync(executablePath)) {
        console.log(\`✅ \${name}: \${executablePath}\`);
        results.push({ name, status: 'installed', path: executablePath });
      } else {
        console.log(\`❌ \${name}: Not found\`);
        results.push({ name, status: 'missing' });
      }
    } catch (error) {
      console.log(\`❌ \${name}: Error - \${error.message}\`);
      results.push({ name, status: 'error', error: error.message });
    }
  }
  
  const installed = results.filter(r => r.status === 'installed');
  const missing = results.filter(r => r.status !== 'installed');
  
  console.log(\`\\n📊 Summary: \${installed.length}/3 browsers installed\`);
  
  if (missing.length > 0) {
    console.log('\\n🔧 To install missing browsers, run:');
    console.log('npm run setup');
    console.log('\\nOr install specific browsers:');
    console.log('npm run setup:chromium');
    console.log('npm run setup:firefox');
    console.log('npm run setup:webkit');
    process.exit(1);
  }
  
  console.log('\\n🎉 All browsers are ready!');
}

checkBrowsers().catch(console.error);
`;

    fs.writeFileSync(checkScriptPath, checkScript);
    console.log(`📝 Created browser check script: ${checkScriptPath}`);
}

async function main() {
    try {
        if (skipInstall) {
            console.log('⏭️  Skipping browser installation (SKIP_BROWSER_INSTALL=true)');
            return;
        }

        if (isCI) {
            console.log('🤖 CI environment detected');
            console.log('💡 To install browsers in CI, add this to your pipeline:');
            console.log('   npm run setup');
            console.log('   or');
            console.log('   npx playwright install --with-deps chromium');
            return;
        }

        // Check if browsers are already installed
        const browsersInstalled = await checkBrowserInstallation();

        if (browsersInstalled) {
            console.log('✅ Browsers already installed, skipping installation');
            await createBrowserCheckScript();
            return;
        }

        console.log('📦 Installing Playwright browsers for XSS Validator...');
        console.log('This may take a few minutes on the first installation.');

        await installBrowsers();
        await createBrowserCheckScript();

        console.log('🎉 Setup complete! You can now use the XSS Validator.');
        console.log('💡 Run "xss-validator --help" to get started.');

    } catch (error) {
        console.error('❌ Installation failed:', error.message);
        console.log('');
        console.log('🔧 Manual installation options:');
        console.log('1. Run: npm run setup');
        console.log('2. Run: npx playwright install --with-deps');
        console.log('3. Run: npx playwright install --with-deps chromium (for Chromium only)');
        console.log('');
        console.log('📖 For more help, see: docs/troubleshooting.md');

        // Don't fail the npm install process if browser installation fails
        // Users can install manually
        process.exit(0);
    }
}

// Only run if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = {checkBrowserInstallation, installBrowsers};
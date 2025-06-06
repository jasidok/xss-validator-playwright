/**
 * Initialize browser pool for performance optimization
 */
async function initializeBrowserPool() {
    const browsers = ['chromium', 'firefox', 'webkit'];

    for (const browserType of browsers) {
        try {
            let browser;
            switch (browserType) {
                case 'firefox':
                    browser = await firefox.launch({
                        headless: true,
                        args: ['--disable-dev-shm-usage', '--no-sandbox']
                    });
                    break;
                case 'webkit':
                    browser = await webkit.launch({
                        headless: true,
                        args: ['--disable-dev-shm-usage', '--no-sandbox']
                    });
                    break;
                case 'chromium':
                default:
                    browser = await chromium.launch({
                        headless: true,
                        args: [
                            '--disable-gpu',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--no-first-run',
                            '--no-zygote',
                            '--disable-extensions',
                            '--disable-background-networking',
                            '--disable-default-apps',
                            '--disable-sync',
                            '--disable-translate',
                            '--hide-scrollbars',
                            '--metrics-recording-only',
                            '--mute-audio',
                            '--no-sandbox',
                            '--disable-web-security',
                            '--disable-features=VizDisplayCompositor'
                        ]
                    });
                    break;
            }

            browserPool.set(browserType, {
                browser,
                contexts: [],
                lastUsed: Date.now()
            });

            if (CONFIG.debug && !CONFIG.quiet) {
                console.log(`✓ Initialized ${browserType} browser`);
            }
        } catch (error) {
            console.warn(`⚠️  Failed to initialize ${browserType}: ${error.message}`);
            if (CONFIG.debug && !CONFIG.quiet) {
                console.warn(`   Skipping ${browserType} - will use other available browsers`);
            }
        }
    }

    // Check if at least one browser initialized
    if (browserPool.size === 0) {
        throw new Error('No browsers could be initialized. Please check Playwright installation.');
    }

    if (!CONFIG.quiet) {
        console.log(`✅ Initialized ${browserPool.size}/3 browsers: ${Array.from(browserPool.keys()).join(', ')}`);
    }
}

#!/usr/bin/env node

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
        console.log(`✅ ${name}: ${executablePath}`);
        results.push({ name, status: 'installed', path: executablePath });
      } else {
        console.log(`❌ ${name}: Not found`);
        results.push({ name, status: 'missing' });
      }
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error.message}`);
      results.push({ name, status: 'error', error: error.message });
    }
  }
  
  const installed = results.filter(r => r.status === 'installed');
  const missing = results.filter(r => r.status !== 'installed');
  
  console.log(`\n📊 Summary: ${installed.length}/3 browsers installed`);
  
  if (missing.length > 0) {
    console.log('\n🔧 To install missing browsers, run:');
    console.log('npm run setup');
    console.log('\nOr install specific browsers:');
    console.log('npm run setup:chromium');
    console.log('npm run setup:firefox');
    console.log('npm run setup:webkit');
    process.exit(1);
  }
  
  console.log('\n🎉 All browsers are ready!');
}

checkBrowsers().catch(console.error);

const { chromium } = require('playwright');
const { spawn } = require('child_process');

(async () => {
    // Start vite
    const vite = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), shell: true });
    vite.stdout.on('data', data => console.log('VITE:', data.toString()));
    
    // Give vite a moment to start
    await new Promise(r => setTimeout(r, 3000));
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    console.log('Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173');
    
    // Wait a bit to let the app load
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
    vite.kill();
    process.exit(0);
})();

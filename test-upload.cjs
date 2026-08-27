const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:5173');
    } catch {
        await page.goto('http://localhost:5174');
    }
    
    const fileInput = await page.$('input[type="file"]');
    await fileInput.setInputFiles('test.gif');
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot.png' });
    
    await browser.close();
})();

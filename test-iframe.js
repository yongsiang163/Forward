const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    console.log('Navigating to http://localhost:8000/?v=rewind100');
    await page.goto('http://localhost:8000/?v=rewind100', { waitUntil: 'networkidle' });

    // Click the center Rewind button to activate the iframe
    console.log('Clicking the Rewind toggle button...');
    await page.click('#nav-rewind');
    await page.waitForTimeout(1000);

    // Dump the iframe's src and bottom-nav HTML
    const frame = page.frame({ name: 'rewind-iframe' }) || page.frames().find(f => f.url().includes('rewind/index.html'));
    if (frame) {
        console.log('Iframe URL:', frame.url());
        const search = await frame.evaluate(() => window.location.search);
        console.log('Iframe location.search:', search);

        // Dump the nav innerHTML
        const navHtml = await frame.evaluate(() => {
            const nav = document.getElementById('bottom-nav');
            return nav ? nav.outerHTML : 'no #bottom-nav found';
        });
        console.log('Iframe nav HTML:\\n', navHtml);
    } else {
        console.log('Could not find rewind iframe.');
    }

    await browser.close();
})();

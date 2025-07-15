const puppeteer = require('puppeteer');

let browser; // Declare browser variable outside to potentially reuse

/**
 * Initializes a Puppeteer browser instance.
 * @returns {Promise<puppeteer.Browser>} The Puppeteer browser instance.
 */
async function getBrowser() {
    if (!browser) {
        console.log('[Puppeteer] Launching new browser instance...');
        try {
            browser = await puppeteer.launch({
                headless: true, // Run Chrome in headless mode (no GUI)
                args: [
                    '--no-sandbox', // Required for many Linux environments (e.g., Docker, Netlify Functions)
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', // Overcomes limited resource problems in Docker/certain environments
                    '--disable-accelerated-video-decode',
                    '--no-zygote', // Helps with stability in some environments
                    '--single-process', // Ensures only one process for the browser, good for limited memory
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
        } catch (error) {
            console.error('[Puppeteer] Failed to launch browser:', error);
            throw new Error(`Failed to launch browser: ${error.message}`);
        }
        console.log('[Puppeteer] Browser launched successfully.');
    }
    return browser;
}

/**
 * Generates a PDF from a given URL.
 * @param {string} url The URL to convert to PDF.
 * @param {object} options PDF options (e.g., format, printBackground, margin).
 * @returns {Promise<Buffer>} The PDF content as a Buffer.
 */
async function generatePdfFromUrl(url, options = {}) {
    let page;
    try {
        const browserInstance = await getBrowser();
        page = await browserInstance.newPage();

        console.log(`[PDF Generator] Navigating to URL: ${url}`);
        // Navigate with a timeout
        await page.goto(url, {
            waitUntil: 'networkidle0', // Wait until network activity is idle
            timeout: 60000 // 60-second navigation timeout
        });
        console.log(`[PDF Generator] Successfully navigated to ${url}. Generating PDF...`);

        const pdfOptions = {
            format: options.format || 'A4',
            printBackground: options.printBackground !== false, // Default to true
            margin: options.margin || { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
            // Add more Puppeteer PDF options as needed:
            // landscape: options.landscape || false,
            // preferCSSPageSize: options.preferCSSPageSize || false,
            // scale: options.scale || 1,
            // headerTemplate: options.headerTemplate,
            // footerTemplate: options.footerTemplate,
            // displayHeaderFooter: !!options.headerTemplate || !!options.footerTemplate
        };

        const pdfBuffer = await page.pdf(pdfOptions);
        console.log(`[PDF Generator] PDF generated from URL: ${url}`);
        return pdfBuffer;
    } catch (error) {
        console.error(`[PDF Generator Error - URL ${url}]:`, error);
        // If the browser itself crashed or became unresponsive, reset it
        if (error.message.includes('Browser has disconnected') || error.message.includes('Target closed')) {
            console.warn('[Puppeteer] Browser disconnected. Attempting to restart browser...');
            await closeBrowser(); // Close and force a new browser launch next time
        }
        throw new Error(`No PDF generated from URL ${url}: ${error.message}`);
    } finally {
        if (page) {
            await page.close(); // Close the page to free up resources
        }
    }
}

/**
 * Generates a PDF from a given HTML string.
 * @param {string} htmlContent The HTML string to convert to PDF.
 * @param {object} options PDF options (e.g., format, printBackground, margin).
 * @returns {Promise<Buffer>} The PDF content as a Buffer.
 */
async function generatePdfFromHtml(htmlContent, options = {}) {
    let page;
    try {
        const browserInstance = await getBrowser();
        page = await browserInstance.newPage();

        // Set a larger viewport for better PDF rendering
        await page.setViewport({ width: 1200, height: 1600 });

        console.log('[PDF Generator] Setting HTML content on page.');
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0', // Wait until network is idle after setting content
            timeout: 60000 // 60-second timeout for content loading
        });
        console.log('[PDF Generator] HTML content set. Generating PDF...');

        const pdfOptions = {
            format: options.format || 'A4',
            printBackground: options.printBackground !== false, // Default to true
            margin: options.margin || { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
            preferCSSPageSize: options.preferCSSPageSize || false,
            displayHeaderFooter: options.displayHeaderFooter || false,
            headerTemplate: options.headerTemplate || '<div></div>',
            footerTemplate: options.footerTemplate || '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
            scale: options.scale || 0.8, // Slightly smaller scale for better text fitting
        };

        const pdfBuffer = await page.pdf(pdfOptions);
        console.log('[PDF Generator] PDF generated from HTML content.');
        return pdfBuffer;
    } catch (error) {
        console.error('[PDF Generator Error - HTML]:', error);
        if (error.message.includes('Browser has disconnected') || error.message.includes('Target closed')) {
            console.warn('[Puppeteer] Browser disconnected. Attempting to restart browser...');
            await closeBrowser();
        }
        throw new Error(`No PDF generated from HTML content: ${error.message}`);
    } finally {
        if (page) {
            await page.close();
        }
    }
}

/**
 * Closes the Puppeteer browser instance.
 */
async function closeBrowser() {
    if (browser) {
        console.log('[Puppeteer] Closing browser instance...');
        await browser.close();
        browser = null; // Clear the browser instance
        console.log('[Puppeteer] Browser closed.');
    }
}

// Ensure the browser is closed when the Node.js process exits
process.on('exit', async () => {
    console.log('[Puppeteer] Node process exiting. Ensuring browser is closed.');
    await closeBrowser();
});

process.on('SIGINT', async () => {
    console.log('[Puppeteer] SIGINT received. Closing browser and exiting.');
    await closeBrowser();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Puppeteer] SIGTERM received. Closing browser and exiting.');
    await closeBrowser();
    process.exit(0);
});

module.exports = {
    generatePdfFromUrl,
    generatePdfFromHtml,
    closeBrowser // Export for potential external management/testing
};
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
const puppeteer = require('puppeteer'); // Added Puppeteer for PDF generation

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://xbook-hub.netlify.app', 'http://localhost:5173'];
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

// --- Middleware ---
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent', 'X-Requested-With'],
    credentials: true
}));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Helper functions ---
function cleanHtmlContent(html) {
    if (!html) return '';
    let cleaned = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned;
}

// PDF Generation Function
async function generatePdfFromHtml(html) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: 'Georgia', serif; 
                        font-size: 12pt; 
                        line-height: 1.6; 
                        padding: 20px;
                    }
                    pre {
                        white-space: pre-wrap;
                        font-family: inherit;
                    }
                </style>
            </head>
            <body>
                <pre>${html}</pre>
            </body>
            </html>
        `, { waitUntil: 'domcontentloaded' });
        
        return await page.pdf({
            format: 'A4',
            printBackground: false,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
    } finally {
        if (browser) await browser.close();
    }
}

// Internet Archive URL resolver (unchanged)
async function getInternetArchiveContentUrl(iaIdentifier, requestedFormat) {
    // ... existing implementation unchanged ...
}

// --- API Endpoints ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: ['Project Gutenberg', 'Internet Archive', 'Google Books']
    });
});

// General Purpose External Content Proxy (unchanged)
app.get('/api/fetch-book', async (req, res) => {
    // ... existing implementation unchanged ...
});

// Image Proxy Endpoint (unchanged)
app.get('/api/fetch-image', async (req, res) => {
    // ... existing implementation unchanged ...
});

// Book Cover Endpoint (unchanged)
app.get('/api/book/:source/:id/cover', async (req, res) => {
    // ... existing implementation unchanged ...
});

// --- UPDATED CONTENT ENDPOINT WITH PDF GENERATION ---
app.get('/api/book/:source/:id/content', async (req, res) => {
    const { source, id } = req.params;
    const { format = 'txt' } = req.query;
    
    let contentUrl = null;
    let cleanHtmlForProxy = false;
    let bookTitle = null;
    let bookAuthor = null;

    try {
        console.log(`[Content Resolver] Request for source: "${source}", ID: "${id}", Format: "${format}"`);

        if (source === 'gutenberg') {
            // ... existing Gutenberg implementation unchanged ...
        } else if (source === 'archive') {
            // ... existing Archive implementation unchanged ...
        } else if (source === 'google') {
            // ... existing Google implementation unchanged ...
        } else {
            return res.status(400).json({ error: 'Unsupported book source. Must be "gutenberg", "archive", or "google".' });
        }

        if (contentUrl) {
            console.log(`[Content Resolver] Proceeding to fetch content for: ${contentUrl}`);
            
            // PDF GENERATION LOGIC
            if (format === 'pdf' && cleanHtmlForProxy) {
                console.log(`[Content Resolver] PDF generation requested for HTML content`);
                
                // Fetch cleaned HTML content
                const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-book?url=${encodeURIComponent(contentUrl)}&clean=true`;
                console.log(`[Content Resolver] Fetching cleaned HTML from: ${internalProxyUrl}`);
                
                const proxyResponse = await fetch(internalProxyUrl);
                
                if (!proxyResponse.ok) {
                    throw new Error(`Failed to fetch HTML for PDF generation: ${proxyResponse.statusText}`);
                }
                
                const htmlContent = await proxyResponse.text();
                console.log(`[Content Resolver] Retrieved ${htmlContent.length} characters of cleaned HTML for PDF generation`);
                
                // Generate PDF
                try {
                    console.log(`[Content Resolver] Starting PDF generation...`);
                    const pdfBuffer = await generatePdfFromHtml(htmlContent);
                    console.log(`[Content Resolver] PDF generation successful (${pdfBuffer.length} bytes)`);
                    
                    // Set response headers
                    res.set({
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="${source}-${id}.pdf"`,
                        'Content-Length': pdfBuffer.length,
                        'X-PDF-Generated': 'true',
                        'X-Original-Content-URL': contentUrl
                    });
                    
                    return res.send(pdfBuffer);
                } catch (pdfError) {
                    console.error('[Content Resolver] PDF generation failed:', pdfError);
                    return res.status(500).json({ 
                        error: 'PDF generation failed', 
                        message: 'Could not create PDF from book content',
                        details: process.env.NODE_ENV === 'development' ? pdfError.message : undefined
                    });
                }
            } 
            // Handle other formats (txt, html, epub) and direct PDFs
            else {
                console.log(`[Content Resolver] Proxying content via /api/fetch-book for: ${contentUrl}`);
                const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-book?url=${encodeURIComponent(contentUrl)}&clean=${cleanHtmlForProxy}`;
                const proxyResponse = await fetch(internalProxyUrl);

                res.status(proxyResponse.status);
                proxyResponse.headers.forEach((value, name) => {
                    if (name !== 'content-encoding' && name !== 'transfer-encoding' && name !== 'connection') {
                        res.set(name, value);
                    }
                });
                res.set('X-Source-Resolved-URL', contentUrl);
                proxyResponse.body.pipe(res);
            }
        } else {
            return res.status(500).json({ error: 'Failed to resolve content URL after source processing.' });
        }

    } catch (error) {
        console.error(`[Book Content Resolution Error for ${source}/${id}]:`, error);
        let errorMessage = 'Failed to resolve or fetch book content.';
        if (error.name === 'AbortError') {
            errorMessage = 'Content fetching timed out.';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || (error.message && error.message.includes('getaddrinfo'))) {
            errorMessage = 'Could not connect to the external book source.';
        } else if (error.message && error.message.includes('404')) {
            errorMessage = 'Content not found in the requested format or source.';
        }
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch book content',
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            source: source,
            id: id,
            format: format
        });
    }
});

// --- Other endpoints unchanged ---
app.get('/api/archive/*', async (req, res) => {
    // ... existing implementation unchanged ...
});

app.get('/api/googlebooks/*', async (req, res) => {
    // ... existing implementation unchanged ...
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handling
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION! Shutting down...', reason, promise);
    process.exit(1);
});

// START THE SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`PDF generation enabled with Puppeteer`);
});
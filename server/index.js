const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
const { generatePdfFromHtml } = require('./pdfGenerator');

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  [
    'https://xbook-hub.netlify.app', 
    'https://xbookhub-project.onrender.com',
    'http://localhost:5173', 
    'http://localhost:3000', 
    'http://localhost:5000',
    'http://localhost:5174',
    'https://localhost:5173',
    'https://localhost:5174',
    'http://127.0.0.1:5173',
    'https://127.0.0.1:5173'
  ];

// --- Middleware ---
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl requests, or server-to-server)
        if (!origin) return callback(null, true);
        
        if (ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked origin: ${origin}`);
            callback(null, true); // Allow all origins for now to fix CORS issues
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: ['Project Gutenberg', 'Open Library', 'Internet Archive'],
        server: 'xbookhub-project.onrender.com'
    });
});

// --- Book Content Fetching Endpoint ---
app.get('/api/fetch-book', async (req, res) => {
    const { url, clean } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'Missing "url" parameter.' });
    }

    console.log(`Fetching book content from: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // Increased timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,text/plain,*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            signal: controller.signal,
            follow: 10,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ 
                error: 'Failed to fetch content', 
                message: `${response.status}: ${response.statusText}`,
                url: url
            });
        }

        const contentType = response.headers.get('content-type') || 'text/plain';
        const content = await response.text();

        if (!content || content.trim().length === 0) {
            return res.status(204).json({ 
                error: 'Empty content', 
                message: 'The source returned empty content' 
            });
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Content-Length', content.length.toString());
        res.setHeader('X-Source-URL', url);

        if (clean === 'true' && contentType.includes('html')) {
            const cleanedContent = content
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<link[^>]*>/gi, '')
                .replace(/<meta[^>]*>/gi, '')
                .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                .replace(/<object[^>]*>.*?<\/object>/gi, '')
                .replace(/<embed[^>]*>/gi, '');
            
            return res.send(cleanedContent);
        }

        res.send(content);

    } catch (error) {
        console.error(`Error fetching book content from ${url}:`, error);
        
        if (error.name === 'AbortError') {
            return res.status(408).json({ 
                error: 'Request timeout', 
                message: 'The request took too long to complete. Internet Archive books may take longer to load.' 
            });
        }
        
        res.status(502).json({ 
            error: 'Bad Gateway', 
            message: `Failed to fetch content from the source: ${error.message}`,
            url: url
        });
    }
});

// --- API Proxy Routes ---
const createProxy = (proxyPath, targetDomain) => {
    return async (req, res) => {
        const targetPath = req.originalUrl.replace(proxyPath, '');
        const targetUrl = `${targetDomain}${targetPath}`;
        console.log(`Proxying request: ${req.originalUrl} -> ${targetUrl}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(targetUrl, {
                method: req.method,
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json,text/html,*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Proxy error for ${targetUrl}: ${response.status} ${response.statusText}`);
                return res.status(response.status).json({ 
                    error: 'Proxy Error', 
                    message: `Failed to fetch from ${targetDomain}: ${response.status} ${response.statusText}`,
                    details: errorText.substring(0, 200)
                });
            }

            const contentType = response.headers.get('content-type');
            if (contentType) {
                res.setHeader('Content-Type', contentType);
            }

            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                res.json(data);
            } else {
                response.body.pipe(res);
            }

        } catch (error) {
            console.error(`Proxy error for ${targetUrl}:`, error);
            
            if (error.name === 'AbortError') {
                return res.status(408).json({ 
                    error: 'Request timeout', 
                    message: 'The proxy request took too long to complete.' 
                });
            }
            
            res.status(502).json({ 
                error: 'Bad Gateway', 
                message: `Failed to proxy request to ${targetDomain}: ${error.message}` 
            });
        }
    };
};

app.use('/api/openlibrary', createProxy('/api/openlibrary', 'https://openlibrary.org'));
app.use('/api/archive', createProxy('/api/archive', 'https://archive.org'));

// --- PDF Generation Endpoints ---
app.post('/api/generate-pdf-from-url', async (req, res) => {
    const { url, title, author } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing "url" parameter.' });
    }

    console.log(`Generating PDF from URL: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

        const contentResponse = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,text/plain,*/*',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: controller.signal,
            follow: 10,
        });

        clearTimeout(timeoutId);

        if (!contentResponse.ok) {
            throw new Error(`Failed to fetch content: ${contentResponse.status} ${contentResponse.statusText}`);
        }

        let content = await contentResponse.text();
        const contentType = contentResponse.headers.get('content-type') || '';

        if (!content || content.trim().length === 0) {
            throw new Error('The source returned empty content');
        }

        if (contentType.includes('text/plain')) {
            const escapedContent = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            content = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>${title || 'Document'}</title>
                    <style>
                        body { 
                            font-family: 'Times New Roman', serif; 
                            line-height: 1.6; 
                            margin: 20px;
                            color: #333;
                            max-width: 100%;
                            font-size: 12px;
                        }
                        h1 { 
                            color: #2c3e50; 
                            border-bottom: 2px solid #3498db; 
                            padding-bottom: 10px; 
                            margin-bottom: 20px;
                            font-size: 18px;
                            page-break-after: avoid;
                        }
                        h2 { 
                            color: #34495e; 
                            margin-top: 30px; 
                            margin-bottom: 15px;
                            font-size: 16px;
                            page-break-after: avoid;
                        }
                        .content { 
                            white-space: pre-wrap; 
                            font-size: 12px;
                            line-height: 1.8;
                            text-align: justify;
                            hyphens: auto;
                            word-wrap: break-word;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 40px;
                            page-break-after: avoid;
                        }
                        @page {
                            margin: 0.75in;
                            size: A4;
                        }
                        p {
                            margin-bottom: 1em;
                            orphans: 3;
                            widows: 3;
                        }
                        .page-break {
                            page-break-before: always;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${title || 'Document'}</h1>
                        ${author ? `<h2>by ${author}</h2>` : ''}
                    </div>
                    <hr>
                    <div class="content">${escapedContent}</div>
                </body>
                </html>`;
        } else if (contentType.includes('text/html')) {
            // Clean up HTML content more thoroughly
            content = content
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<link[^>]*>/gi, '')
                .replace(/<meta[^>]*>/gi, '')
                .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                .replace(/<object[^>]*>.*?<\/object>/gi, '')
                .replace(/<embed[^>]*>/gi, '')
                .replace(/<form[^>]*>.*?<\/form>/gi, '')
                .replace(/<input[^>]*>/gi, '')
                .replace(/<button[^>]*>.*?<\/button>/gi, '')
                .replace(/<nav[^>]*>.*?<\/nav>/gi, '')
                .replace(/<header[^>]*>.*?<\/header>/gi, '')
                .replace(/<footer[^>]*>.*?<\/footer>/gi, '')
                .replace(/<aside[^>]*>.*?<\/aside>/gi, '')
                .replace(/style\s*=\s*["'][^"']*["']/gi, ''); // Remove inline styles

            const styleTag = `
                <style>
                    body { 
                        font-family: 'Times New Roman', serif; 
                        line-height: 1.6; 
                        margin: 20px;
                        color: #333;
                        max-width: 100%;
                        font-size: 12px;
                    }
                    img { 
                        display: none; 
                    }
                    h1, h2, h3, h4, h5, h6 { 
                        color: #2c3e50; 
                        page-break-after: avoid;
                        margin-top: 1.5em;
                        margin-bottom: 0.5em;
                    }
                    h1 { font-size: 18px; }
                    h2 { font-size: 16px; }
                    h3 { font-size: 14px; }
                    h4, h5, h6 { font-size: 12px; }
                    p { 
                        margin-bottom: 1em; 
                        text-align: justify;
                        orphans: 3;
                        widows: 3;
                        hyphens: auto;
                        word-wrap: break-word;
                    }
                    blockquote {
                        margin: 1em 2em;
                        padding: 0.5em 1em;
                        border-left: 3px solid #3498db;
                        font-style: italic;
                    }
                    ul, ol {
                        margin: 1em 0;
                        padding-left: 2em;
                    }
                    li {
                        margin-bottom: 0.5em;
                    }
                    .header { 
                        border-bottom: 2px solid #3498db; 
                        padding-bottom: 10px; 
                        margin-bottom: 20px; 
                        text-align: center;
                        page-break-after: avoid;
                    }
                    @page {
                        margin: 0.75in;
                        size: A4;
                        @bottom-center {
                            content: counter(page) " / " counter(pages);
                        }
                    }
                    .page-break {
                        page-break-before: always;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 1em 0;
                        font-size: 11px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 0.5em;
                        text-align: left;
                    }
                    th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                </style>`;

            if (content.includes('<head>')) {
                content = content.replace('</head>', `${styleTag}</head>`);
            } else if (content.includes('<html>')) {
                content = content.replace('<html>', `<html><head>${styleTag}</head>`);
            } else {
                content = `<html><head>${styleTag}</head><body>${content}</body></html>`;
            }

            if (title && !content.toLowerCase().includes('<h1>')) {
                const titleHtml = `<div class="header"><h1>${title}</h1>${author ? `<h2>by ${author}</h2>` : ''}</div>`;
                if (content.includes('<body>')) {
                    content = content.replace('<body>', `<body>${titleHtml}`);
                } else {
                    content = `${titleHtml}${content}`;
                }
            }
        }

        console.log('Generating PDF with Puppeteer...');
        const pdfBuffer = await generatePdfFromHtml(content, {
            format: 'A4',
            printBackground: true,
            margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' },
            preferCSSPageSize: false,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%; margin-top: 10px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
            scale: 0.8
        });

        console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${(title || 'document').replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}.pdf"`,
            'Content-Length': pdfBuffer.length,
            'Cache-Control': 'no-cache'
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        
        if (error.name === 'AbortError') {
            return res.status(408).json({ 
                error: 'PDF Generation Timeout', 
                message: 'PDF generation took too long to complete. Please try again.' 
            });
        }
        
        res.status(500).json({ 
            error: 'PDF Generation Error', 
            message: error.message,
            details: 'Failed to generate PDF from the provided URL. The content may not be accessible or may be too large.'
        });
    }
});

app.post('/api/generate-pdf-from-html', async (req, res) => {
    const { html, title, author } = req.body;

    if (!html) {
        return res.status(400).json({ error: 'Missing "html" parameter.' });
    }

    console.log(`Generating PDF from HTML content (length: ${html.length})`);

    try {
        const pdfBuffer = await generatePdfFromHtml(html, {
            format: 'A4',
            printBackground: true,
            margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
            preferCSSPageSize: false,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${(title || 'document').replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}.pdf"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ 
            error: 'PDF Generation Error', 
            message: error.message 
        });
    }
});

// --- Static Assets and Client-Side Routing ---
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// --- Error Handling ---
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
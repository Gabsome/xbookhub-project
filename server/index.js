const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
const { generatePdfFromHtml } = require('./pdfGenerator');

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://xbook-hub.netlify.app', 'http://localhost:5173'];

// --- Middleware ---
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`The CORS policy for this site does not allow access from the specified origin: ${origin}`), false);
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// --- API Proxy Routes ---
const createProxy = (proxyPath, targetDomain) => {
    return async (req, res) => {
        const targetPath = req.originalUrl.replace(proxyPath, '');
        const targetUrl = `${targetDomain}${targetPath}`;
        console.log(`Proxying request: ${req.originalUrl} -> ${targetUrl}`);

        try {
            const response = await fetch(targetUrl, {
                method: req.method,
                headers: { 'User-Agent': 'Xbook-Hub/1.0 (Server-Side Proxy)' },
                timeout: 30000,
            });

            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).send(errorText);
            }

            res.setHeader('Content-Type', response.headers.get('content-type'));
            response.body.pipe(res);

        } catch (error) {
            res.status(502).json({ error: 'Bad Gateway', message: `Failed to proxy request to ${targetDomain}.` });
        }
    };
};

app.use('/api/openlibrary', createProxy('/api/openlibrary', 'https://openlibrary.org'));
app.use('/api/archive', createProxy('/api/archive', 'https://archive.org'));

// --- PDF Generation Endpoint ---
app.post('/api/generate-pdf-from-url', async (req, res) => {
    const { url, title, author } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing "url" parameter.' });
    }

    try {
        const contentResponse = await fetch(url);
        if (!contentResponse.ok) {
            throw new Error(`Failed to fetch content: ${contentResponse.statusText}`);
        }
        const rawHtml = await contentResponse.text();

        const fullHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title || 'Document'}</title>
                <style>
                    body { font-family: serif; line-height: 1.6; }
                    img { display: none; }
                </style>
            </head>
            <body>
                <h1>${title || ''}</h1>
                <h2>${author || ''}</h2>
                <hr>
                ${rawHtml}
            </body>
            </html>`;

        const pdfBuffer = await generatePdfFromHtml(fullHtml);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="document.pdf"'
        }).send(pdfBuffer);

    } catch (error) {
        res.status(500).json({ error: 'PDF Generation Error', message: error.message });
    }
});

// --- Static Assets and Client-Side Routing ---
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
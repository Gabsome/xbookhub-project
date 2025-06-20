const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();
const path = require('path');

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = ['https://xbook-hub.netlify.app', 'http://localhost:5173'];

// Optional: Google Books API Key
// You should store this securely, e.g., in an environment variable.
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || ''; // Replace with your actual key if needed

// --- Middleware ---
app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent', 'X-Requested-With'],
    credentials: true
}));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper function to clean HTML content ---
function cleanHtmlContent(html) {
    if (!html) return '';
    let cleaned = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
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

// --- HELPER FUNCTION FOR INTERNET ARCHIVE CONTENT RESOLUTION (for *book content*, not covers) ---
async function getInternetArchiveContentUrl(iaIdentifier, requestedFormat) {
    const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
    console.log(`[IA Content Resolver] Fetching metadata for ${iaIdentifier} from: ${metadataUrl}`);

    try {
        const response = await fetch(metadataUrl, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
                'Accept': 'application/json',
            },
            timeout: 10000
        });

        if (!response.ok) {
            console.warn(`[IA Content Resolver] Failed to fetch metadata for ${iaIdentifier}: ${response.status} ${response.statusText}`);
            return null;
        }

        const metadata = await response.json();
        const files = metadata.files || [];

        let bestMatchUrl = null;
        let cleanHtml = false;

        const downloadBaseUrl = `https://archive.org/download/${iaIdentifier}/`;

        const formatMap = {
            'txt': ['DjVu text', 'Text', 'Plain Text'],
            'html': ['HTML', 'Animated GIF', 'JPEG', 'Image Container'], // Keep HTML if available, allow cleaning
            'pdf': ['PDF'],
            'epub': ['EPUB'],
        };

        const potentialFormats = formatMap[requestedFormat] || [];
        for (const iaFormat of potentialFormats) {
            const foundFile = files.find(file => file.format === iaFormat);
            if (foundFile && foundFile.name) {
                bestMatchUrl = `${downloadBaseUrl}${encodeURIComponent(foundFile.name)}`;
                cleanHtml = (iaFormat === 'HTML');
                console.log(`[IA Content Resolver] Found direct match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                return { url: bestMatchUrl, cleanHtml };
            }
        }

        const fallbackOrder = ['txt', 'epub', 'pdf', 'html'];
        for (const formatKey of fallbackOrder) {
            if (formatKey === requestedFormat) continue; // Already tried the requested format
            const fallbackIAFormats = formatMap[formatKey] || [];
            for (const iaFormat of fallbackIAFormats) {
                const foundFile = files.find(file => file.format === iaFormat);
                if (foundFile && foundFile.name) {
                    bestMatchUrl = `${downloadBaseUrl}${encodeURIComponent(foundFile.name)}`;
                    cleanHtml = (iaFormat === 'HTML');
                    console.log(`[IA Content Resolver] Found fallback match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                    return { url: bestMatchUrl, cleanHtml };
                }
            }
        }

        if (!bestMatchUrl) {
            // Fallback to the item's details page as a last resort if no direct file is found
            bestMatchUrl = `https://archive.org/details/${iaIdentifier}`;
            cleanHtml = true; // Assume it might be HTML content that needs cleaning
            console.log(`[IA Content Resolver] No direct file found, falling back to item details page: ${bestMatchUrl}`);
            return { url: bestMatchUrl, cleanHtml };
        }

        return null;
    } catch (error) {
        console.error(`[IA Content Resolver Error] Could not resolve IA content for ${iaIdentifier}:`, error);
        return null;
    }
}

// --- API Endpoints ---

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: ['Project Gutenberg', 'Internet Archive', 'Google Books']
    });
});

app.get('/api/fetch-book', async (req, res) => {
    const { url, clean } = req.query;

    if (!url) {
        console.log(`[Proxy-Fetch] ERROR: Missing URL parameter.`);
        return res.status(400).json({
            error: 'Missing URL parameter',
            message: 'Please provide a URL to fetch content from'
        });
    }

    try {
        new URL(url);
    } catch (error) {
        console.log(`[Proxy-Fetch] ERROR: Invalid URL format for ${url}.`);
        return res.status(400).json({
            error: 'Invalid URL format',
            message: 'The provided URL is not valid'
        });
    }

    console.log(`[Proxy-Fetch] Attempting to fetch: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log(`[Proxy-Fetch] Timeout initiated for ${url}`);
            controller.abort();
        }, 30000);

        const headers = {
            'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
            'Accept': 'text/html,text/plain,application/pdf,application/epub+zip,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };

        if (url.includes('archive.org')) {
            headers['Referer'] = 'https://archive.org/';
            headers['Accept'] = 'text/html,text/plain,application/pdf,application/epub+zip,*/*';
        } else if (url.includes('books.google.com')) {
            headers['Referer'] = 'https://books.google.com/';
        }


        const response = await fetch(url, {
            signal: controller.signal,
            headers,
            redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[Proxy-Fetch] HTTP Error: ${response.status} ${response.statusText} for ${url}`);
            let errorMessage = response.statusText;
            try {
                const errorBody = await response.text();
                if (errorBody && errorBody.length < 500) {
                    errorMessage = `${errorMessage} - ${errorBody.substring(0, 200)}...`;
                }
            } catch (readErr) {
                console.warn('[Proxy-Fetch] Could not read error response body:', readErr.message);
            }
            return res.status(response.status).json({
                error: `HTTP ${response.status}`,
                message: `Failed to fetch content: ${errorMessage}`,
                url: url
            });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        console.log(`[Proxy-Fetch] Content-Type received: ${contentType} for ${url}`);

        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'X-Source-URL': url
        });

        if (contentType.includes('application/pdf') || contentType.includes('application/epub+zip')) {
            console.log(`[Proxy-Fetch] Piping binary content (${contentType}) for ${url}`);
            response.body.pipe(res);
            return;
        }

        if (!contentType.startsWith('text/') &&
            !contentType.includes('application/xml') &&
            !contentType.includes('application/xhtml') &&
            !contentType.includes('application/json')) {
            console.warn(`[Proxy-Fetch] Unsupported content type for book content: ${contentType} for URL: ${url}`);
            return res.status(400).json({
                error: 'Unsupported content type',
                message: `Content type ${contentType} is not supported for book content. Only text, PDF, and EPUB are allowed.`,
                contentType: contentType
            });
        }

        let content = await response.text();

        if (!content || content.trim().length === 0) {
            console.warn(`[Proxy-Fetch] Fetched content is empty for ${url}.`);
            return res.status(204).json({
                error: 'Empty content',
                message: 'The fetched content is empty'
            });
        }

        console.log(`[Proxy-Fetch] Successfully fetched ${content.length} characters from ${url}.`);

        if (clean === 'true' && contentType.includes('text/html')) {
            const cleanedContent = cleanHtmlContent(content);
            console.log(`[Proxy-Fetch] Cleaned HTML content. Original length: ${content.length}, Cleaned length: ${cleanedContent.length}`);
            res.set('X-Cleaned-Content-Length', cleanedContent.length.toString());
            return res.send(cleanedContent);
        } else {
            console.log(`[Proxy-Fetch] Sending raw content (or non-HTML) for ${url}.`);
            return res.send(content);
        }

    } catch (error) {
        console.error('[Proxy-Fetch Error]:', error);

        if (error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'The request took too long to complete. Please try again.',
                url: url
            });
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.message.includes('getaddrinfo')) {
            return res.status(503).json({
                error: 'Network error',
                message: 'Unable to connect to the content server. Please check the URL or your internet connection.',
                url: url
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while fetching the content',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            url: url
        });
    }
});

// --- General Purpose Image Proxy Endpoint (Enhanced for robustness) ---
app.get('/api/fetch-image', async (req, res) => {
    const { url } = req.query;
    const defaultCoverUrl = 'https://via.placeholder.com/128x190?text=No+Cover';
    const defaultCoverContentType = 'image/png';

    const sendDefaultCover = async (status = 200, errorMessage = 'No image available', originalUrl = 'N/A') => {
        console.log(`[Image Proxy] Serving default cover. Status: ${status}, Message: ${errorMessage}, Original URL: ${originalUrl}`);
        try {
            const defaultImageResponse = await fetch(defaultCoverUrl);
            const contentType = defaultImageResponse.headers.get('content-type') || defaultCoverContentType;
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            res.set('X-Fallback-Image', 'true');
            if (errorMessage) {
                res.set('X-Error-Message', errorMessage);
            }
            res.set('X-Original-Request-URL', originalUrl);
            res.status(status);
            defaultImageResponse.body.pipe(res);
        } catch (err) {
            console.error('Failed to fetch hardcoded default cover:', err);
            res.status(500).set('Content-Type', 'image/png').send(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
        }
    };

    if (!url) {
        console.warn('[Image Proxy] No URL provided to /api/fetch-image. Serving default cover.');
        return sendDefaultCover(400, 'Image URL missing.', 'No URL provided');
    }

    try {
        new URL(url);
    } catch (error) {
        console.warn(`[Image Proxy] Invalid URL format: "${url}". Serving default cover.`);
        return sendDefaultCover(400, 'Invalid image URL format.', url);
    }

    console.log(`[Image Proxy] Attempting to fetch image: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log(`[Image Proxy] Timeout initiated for ${url}`);
            controller.abort();
        }, 15000);

        const headers = {
            'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
            'Referer': req.headers.referer || 'https://xbook-hub.netlify.app',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        };

        const response = await fetch(url, {
            signal: controller.signal,
            headers,
            redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
            console.error(`[Image Proxy] ${errorMessage} for ${url}. Serving default cover.`);
            return sendDefaultCover(response.status, `Failed to fetch image: ${errorMessage}`, url);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        if (!contentType.startsWith('image/')) {
            console.warn(`[Image Proxy] Fetched content is not an image (${contentType}) for URL: ${url}. Serving default cover.`);
            return sendDefaultCover(415, `Content type ${contentType} is not an image.`, url);
        }

        console.log(`[Image Proxy] Successfully fetched image, Content-Type: ${contentType} from ${url}`);

        res.set({
            'Content-Type': contentType,
            'Content-Length': response.headers.get('content-length'),
            'Cache-Control': 'public, max-age=86400',
            'X-Source-URL': url
        });

        response.body.pipe(res);

    } catch (error) {
        let errorMessage = `Failed to fetch image: ${error.message}`;
        console.error(`[Image Proxy Error] ${errorMessage} for ${url}. Serving default cover.`);

        if (error.name === 'AbortError') {
            errorMessage = 'Image request timed out.';
            return sendDefaultCover(408, errorMessage, url);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = 'Could not connect to the external image source.';
            return sendDefaultCover(503, errorMessage, url);
        } else {
            return sendDefaultCover(500, errorMessage, url);
        }
    }
});

// --- UPDATED ENDPOINT TO RESOLVE AND SERVE BOOK COVERS ---
app.get('/api/book/:source/:id/cover', async (req, res) => {
    const { source, id } = req.params;
    let coverExternalUrl = null;
    let bookTitle = null; // To store title for Google Books fallback
    let bookAuthor = null; // To store author for Google Books fallback

    console.log(`[Cover Resolver] --- NEW COVER REQUEST --- Source: "${source}", ID: "${id}"`);

    try {
        if (source === 'gutenberg') {
            const gutendexUrl = `https://gutendex.com/books/${id}/`;
            console.log(`[Cover Resolver] Gutenberg: Fetching Gutendex metadata from: ${gutendexUrl}`);
            try {
                const response = await fetch(gutendexUrl, { timeout: 10000 });
                if (response.ok) {
                    const book = await response.json();
                    bookTitle = book.title;
                    if (book.authors && book.authors.length > 0) {
                        bookAuthor = book.authors[0].name;
                    }
                    console.log(`[Cover Resolver] Gutenberg: Metadata found. Title: "${bookTitle}", Author: "${bookAuthor}"`);

                    coverExternalUrl = book.formats['image/jpeg'] || book.formats['image/png'] || book.formats['image/webp'];
                    console.log(`[Cover Resolver] Gutenberg: Gutendex direct cover found: ${coverExternalUrl || 'Not found'}`);
                    if (!coverExternalUrl) {
                        coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                        console.log(`[Cover Resolver] Gutenberg: Gutendex cover not found, falling back to pattern: ${coverExternalUrl}`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Gutenberg: Failed to fetch Gutendex metadata for ID ${id}: ${response.status} ${response.statusText}.`);
                    // Even if metadata fetch fails, attempt the common cover pattern for Gutenberg
                    coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                    console.log(`[Cover Resolver] Gutenberg: Falling back to Gutenberg pattern due to Gutendex error: ${coverExternalUrl}`);
                }
            } catch (gutendexError) {
                console.error(`[Cover Resolver] Gutenberg: Error fetching from Gutendex for ID ${id}: ${gutendexError.message}. Falling back to pattern.`);
                coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
            }
            console.log(`[Cover Resolver] Gutenberg: Final resolved coverExternalUrl (before Google fallback): ${coverExternalUrl}`);

        } else if (source === 'archive') {
            const iaIdentifier = id;

            console.log(`[Cover Resolver] Internet Archive: Attempting to resolve cover for ID: ${iaIdentifier}`);

            // Fetch IA metadata early to get title/author for potential Google fallback
            try {
                const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
                const metadataResponse = await fetch(metadataUrl, {
                    headers: { 'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)' },
                    timeout: 7000
                });

                if (metadataResponse.ok) {
                    const metadata = await metadataResponse.json();
                    bookTitle = metadata.metadata?.title;
                    bookAuthor = metadata.metadata?.creator; // IA often uses 'creator' for author
                    console.log(`[Cover Resolver] Internet Archive: Metadata fetched. Title: "${bookTitle}", Author: "${bookAuthor}"`);

                    const files = metadata.files || [];
                    const coverFile = files.find(file =>
                        file.name && (
                            file.name.toLowerCase().includes('cover.jpg') ||
                            file.name.toLowerCase().includes('cover.png') ||
                            file.name.toLowerCase().includes('thumb.jpg') ||
                            file.name.toLowerCase().includes('thumbnail.jpg') ||
                            (file.format === 'JPEG' && files.length < 20) || // Heuristic: if many files, don't just pick any JPEG/PNG
                            (file.format === 'PNG' && files.length < 20)
                        ) && (file.format === 'JPEG' || file.format === 'PNG' || file.format === 'Image')
                    );

                    if (coverFile) {
                        coverExternalUrl = `https://archive.org/download/${iaIdentifier}/${encodeURIComponent(coverFile.name)}`;
                        console.log(`[Cover Resolver] Internet Archive: Found specific IA file cover: ${coverExternalUrl}`);
                    } else {
                        console.log(`[Cover Resolver] Internet Archive: No specific IA cover file found in metadata.`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Internet Archive: Failed to fetch IA metadata for ${iaIdentifier}: ${metadataResponse.status} ${metadataResponse.statusText}.`);
                }
            } catch (metaError) {
                console.error(`[Cover Resolver] Internet Archive: Error fetching IA metadata for ${iaIdentifier}:`, metaError.message);
            }
            console.log(`[Cover Resolver] Internet Archive: Final resolved coverExternalUrl (before Google fallback): ${coverExternalUrl}`);
        } else if (source === 'google') {
            // Directly resolve Google Books cover by Volume ID
            console.log(`[Cover Resolver] Google Books: Attempting to resolve cover for Volume ID: ${id}`);
            const googleBooksApiUrl = `https://www.googleapis.com/books/v1/volumes/${id}?fields=volumeInfo/imageLinks,volumeInfo/title,volumeInfo/authors&key=${GOOGLE_BOOKS_API_KEY}`;
            console.log(`[Cover Resolver] Google Books: Fetching details from: ${googleBooksApiUrl}`);

            try {
                const googleResponse = await fetch(googleBooksApiUrl, { timeout: 7000 });
                if (googleResponse.ok) {
                    const googleData = await googleResponse.json();
                    const volumeInfo = googleData.volumeInfo;
                    bookTitle = volumeInfo.title;
                    if (volumeInfo.authors && volumeInfo.authors.length > 0) {
                        bookAuthor = volumeInfo.authors[0];
                    }

                    if (volumeInfo.imageLinks) {
                        coverExternalUrl = volumeInfo.imageLinks.medium || volumeInfo.imageLinks.large || volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail;
                        console.log(`[Cover Resolver] Google Books: Found direct cover for Volume ID ${id}: ${coverExternalUrl}`);
                    } else {
                        console.warn(`[Cover Resolver] Google Books: No imageLinks found for Volume ID ${id}.`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Google Books: API error for Volume ID ${id}: ${googleResponse.status} ${googleResponse.statusText}`);
                }
            } catch (googleError) {
                console.error(`[Cover Resolver] Google Books: Error fetching details for Volume ID ${id}: ${googleError.message}`);
            }
            console.log(`[Cover Resolver] Google Books: Final resolved coverExternalUrl: ${coverExternalUrl}`);

        } else {
            console.warn(`[Cover Resolver] ERROR: Unsupported source: ${source}`);
            return res.status(400).json({ error: 'Unsupported book source for cover. Must be "gutenberg", "archive", or "google".' });
        }

        // --- Google Books API Fallback (only if no cover found and we have title/author) ---
        // This block now also accounts for cases where the specific Google ID lookup failed to yield a cover.
        if (!coverExternalUrl && bookTitle) {
            console.log(`[Cover Resolver] No cover found from primary sources (or direct Google ID failed). Attempting Google Books API search fallback for "${bookTitle}" by "${bookAuthor || 'Unknown Author'}"`);
            let googleSearchQuery = `intitle:"${encodeURIComponent(bookTitle)}"`;
            if (bookAuthor) {
                googleSearchQuery += `+inauthor:"${encodeURIComponent(bookAuthor)}"`;
            }

            const googleBooksSearchApiUrl = `https://www.googleapis.com/books/v1/volumes?q=${googleSearchQuery}&maxResults=1&printType=books&fields=items(volumeInfo/imageLinks,volumeInfo/industryIdentifiers)&key=${GOOGLE_BOOKS_API_KEY}`;
            console.log(`[Cover Resolver] Google Books Fallback: Searching API: ${googleBooksSearchApiUrl}`);

            try {
                const googleResponse = await fetch(googleBooksSearchApiUrl, { timeout: 7000 });
                if (googleResponse.ok) {
                    const googleData = await googleResponse.json();
                    if (googleData.items && googleData.items.length > 0) {
                        const volumeInfo = googleData.items[0].volumeInfo;
                        const imageLinks = volumeInfo.imageLinks;

                        if (imageLinks) {
                            coverExternalUrl = imageLinks.medium || imageLinks.large || imageLinks.thumbnail || imageLinks.smallThumbnail;
                            console.log(`[Cover Resolver] Google Books Fallback: Found cover: ${coverExternalUrl}`);
                        } else {
                            console.warn(`[Cover Resolver] Google Books Fallback: No imageLinks found for search "${bookTitle}".`);
                        }
                    } else {
                        console.warn(`[Cover Resolver] Google Books Fallback: No results found for search "${bookTitle}"`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Google Books Fallback: API error: ${googleResponse.status} ${googleResponse.statusText}`);
                }
            } catch (googleError) {
                console.error(`[Cover Resolver] Google Books Fallback: Error during API call: ${googleError.message}`);
            }
        }
        // --- End Google Books API Fallback ---

        // --- Proxy the resolved cover URL through /api/fetch-image endpoint ---
        const internalProxyUrl = coverExternalUrl
            ? `${req.protocol}://${req.get('host')}/api/fetch-image?url=${encodeURIComponent(coverExternalUrl)}`
            : `${req.protocol}://${req.get('host')}/api/fetch-image`; // If no URL was resolved, /fetch-image will serve default

        console.log(`[Cover Resolver] Final decision: Proxying resolved cover URL (or default) via internal image endpoint: ${internalProxyUrl}`);

        const proxyResponse = await fetch(internalProxyUrl);
        console.log(`[Cover Resolver] Internal proxy response status: ${proxyResponse.status}`);

        res.status(proxyResponse.status);
        proxyResponse.headers.forEach((value, name) => {
            if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                res.set(name, value);
            }
        });
        if (coverExternalUrl) {
            res.set('X-Source-Resolved-Cover-URL', coverExternalUrl);
        }
        res.set('X-Cover-Source-Attempted', coverExternalUrl ? 'Primary/Google' : 'FallbackDefault'); // Indicate if a real source found it
        proxyResponse.body.pipe(res);

    } catch (error) {
        console.error(`[Cover Resolution Master Error for ${source}/${id}]:`, error);
        let errorMessage = 'Failed to fetch book cover due to an unexpected error.';
        if (error.name === 'AbortError') {
            errorMessage = 'Cover image request timed out.';
        } else if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
            errorMessage = 'Cover not found for this book or source.';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = 'Could not connect to the external cover source.';
        }

        console.log(`[Cover Resolution Master Error] Attempting to send default cover due to error.`);
        try {
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-image`;
            const proxyResponse = await fetch(internalProxyUrl);
            res.status(proxyResponse.status);
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                    res.set(name, value);
                }
            });
            res.set('X-Error-Message', errorMessage);
            proxyResponse.body.pipe(res);
        } catch (fallbackError) {
            console.error(`[Cover Resolution Fallback Error for ${source}/${id}]: Failed to retrieve default cover image:`, fallbackError.message);
            res.status(500).json({
                error: 'Failed to retrieve cover image and fallback.',
                message: errorMessage,
                details: process.env.NODE_ENV === 'development' ? (error.message + ' Fallback error: ' + fallbackError.message) : undefined,
                source: source,
                id: id
            });
        }
    }
});


// Main endpoint to resolve book ID to content URL and then fetch it
app.get('/api/book/:source/:id/content', async (req, res) => {
    const { source, id } = req.params;
    const { format = 'txt' } = req.query;

    let contentUrl = null;
    let cleanHtml = false;

    try {
        console.log(`[Content Resolver] Request for source: "${source}", ID: "${id}", Format: "${format}"`);

        if (source === 'gutenberg') {
            const gutendexUrl = `https://gutendex.com/books/${id}/`;
            console.log(`[Content Resolver] Fetching Gutenberg metadata from: ${gutendexUrl}`);
            const response = await fetch(gutendexUrl, { timeout: 10000 });
            if (!response.ok) {
                if (response.status === 404) {
                    return res.status(404).json({ error: `Gutenberg book with ID ${id} not found.` });
                }
                throw new Error(`Failed to fetch Gutenberg metadata: ${response.statusText}`);
            }
            const book = await response.json();
            const formats = book.formats || {};

            if (format === 'txt') {
                contentUrl = formats['text/plain; charset=utf-8'] || formats['text/plain'];
            } else if (format === 'html') {
                contentUrl = formats['text/html'] || formats['text/html; charset=utf-8'] || formats['text/html; charset=iso-8859-1'];
                cleanHtml = true;
            } else if (format === 'pdf') {
                contentUrl = formats['application/pdf'];
            } else if (format === 'epub') {
                contentUrl = formats['application/epub+zip'];
            }

            if (!contentUrl) {
                contentUrl = formats['text/plain; charset=utf-8'] || formats['text/plain'] || formats['text/html'];
                if (contentUrl && contentUrl.includes('html')) cleanHtml = true;
            }

            if (!contentUrl) {
                console.warn(`[Content Resolver] No suitable content URL found for Gutenberg ID ${id} in format ${format}. Available formats:`, Object.keys(formats).join(', '));
                return res.status(404).json({ error: `Content in ${format} format not available for Gutenberg book ID ${id}.` });
            }
            console.log(`[Content Resolver] Gutenberg URL resolved to: ${contentUrl}`);

        } else if (source === 'archive') {
            const iaIdentifier = id;
            console.log(`[Content Resolver] Directly fetching from Internet Archive ID: ${iaIdentifier}`);

            const iaContent = await getInternetArchiveContentUrl(iaIdentifier, format);
            if (iaContent) {
                contentUrl = iaContent.url;
                cleanHtml = iaContent.cleanHtml;
            } else {
                console.warn(`[Content Resolver] getInternetArchiveContentUrl failed for IA ID ${iaIdentifier} in format ${format}.`);
                return res.status(404).json({ error: `Content in ${format} format not available for Internet Archive item ID ${id}.` });
            }
            console.log(`[Content Resolver] Internet Archive URL resolved to: ${contentUrl}`);

        } else if (source === 'google') {
            console.log(`[Content Resolver] Google Books: Attempting to fetch content for Volume ID: ${id}, Format: ${format}`);
            const googleBooksApiUrl = `https://www.googleapis.com/books/v1/volumes/${id}?fields=accessInfo(epub,pdf,webReaderLink)&key=${GOOGLE_BOOKS_API_KEY}`;

            try {
                const response = await fetch(googleBooksApiUrl, { timeout: 10000 });
                if (!response.ok) {
                    if (response.status === 404) {
                        return res.status(404).json({ error: `Google Book with Volume ID ${id} not found.` });
                    }
                    throw new Error(`Failed to fetch Google Books metadata: ${response.statusText}`);
                }
                const book = await response.json();
                const accessInfo = book.accessInfo;

                if (accessInfo) {
                    if (format === 'epub' && accessInfo.epub && accessInfo.epub.isAvailable && accessInfo.epub.downloadLink) {
                        contentUrl = accessInfo.epub.downloadLink;
                        console.log(`[Content Resolver] Google Books: Found EPUB download link: ${contentUrl}`);
                    } else if (format === 'pdf' && accessInfo.pdf && accessInfo.pdf.isAvailable && accessInfo.pdf.downloadLink) {
                        contentUrl = accessInfo.pdf.downloadLink;
                        console.log(`[Content Resolver] Google Books: Found PDF download link: ${contentUrl}`);
                    } else if (format === 'html' && accessInfo.webReaderLink) {
                        contentUrl = accessInfo.webReaderLink;
                        cleanHtml = true; // Web reader link content is typically HTML that can benefit from cleaning
                        console.log(`[Content Resolver] Google Books: Found webReaderLink (HTML): ${contentUrl}`);
                    } else {
                        // Fallback: Prioritize EPUB, then PDF, then webReaderLink
                        if (accessInfo.epub && accessInfo.epub.isAvailable && accessInfo.epub.downloadLink) {
                            contentUrl = accessInfo.epub.downloadLink;
                            console.log(`[Content Resolver] Google Books: Falling back to EPUB: ${contentUrl}`);
                        } else if (accessInfo.pdf && accessInfo.pdf.isAvailable && accessInfo.pdf.downloadLink) {
                            contentUrl = accessInfo.pdf.downloadLink;
                            console.log(`[Content Resolver] Google Books: Falling back to PDF: ${contentUrl}`);
                        } else if (accessInfo.webReaderLink) {
                            contentUrl = accessInfo.webReaderLink;
                            cleanHtml = true;
                            console.log(`[Content Resolver] Google Books: Falling back to webReaderLink (HTML): ${contentUrl}`);
                        }
                    }
                }

                if (!contentUrl) {
                    console.warn(`[Content Resolver] Google Books: No suitable content URL found for Volume ID ${id} in format ${format}. Available accessInfo:`, accessInfo);
                    return res.status(404).json({ error: `Content in ${format} format not available for Google Book ID ${id}. Try a different format or it might only have a preview.` });
                }
            } catch (googleError) {
                console.error(`[Content Resolver] Google Books: Error fetching content for ID ${id}: ${googleError.message}`);
                return res.status(500).json({ error: 'Failed to fetch content from Google Books.', message: googleError.message });
            }

        } else {
            return res.status(400).json({ error: 'Unsupported book source. Must be "gutenberg", "archive", or "google".' });
        }

        if (contentUrl) {
            console.log(`[Content Resolver] Proceeding to fetch content via /api/fetch-book for: ${contentUrl}`);
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-book?url=${encodeURIComponent(contentUrl)}&clean=${cleanHtml}`;

            const proxyResponse = await fetch(internalProxyUrl);

            res.status(proxyResponse.status);
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                    res.set(name, value);
                }
            });
            res.set('X-Source-Resolved-URL', contentUrl);
            proxyResponse.body.pipe(res);
        } else {
            return res.status(500).json({ error: 'Failed to resolve content URL after source processing.' });
        }

    } catch (error) {
        console.error(`[Book Content Resolution Error for ${source}/${id}]:`, error);
        let errorMessage = 'Failed to resolve or fetch book content.';
        if (error.name === 'AbortError') {
            errorMessage = 'Content fetching timed out.';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.message.includes('getaddrinfo')) {
            errorMessage = 'Could not connect to the external book source.';
        } else if (error.message.includes('404')) {
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

// Proxy endpoint for Internet Archive API metadata (NO CHANGES)
app.get('/api/archive/*', async (req, res) => {
    try {
        const path = req.params[0];
        const queryString = req.url.split('?')[1] || '';
        const url = `https://archive.org/${path}${queryString ? '?' + queryString : ''}`;

        console.log(`[IA Metadata Proxy] Proxying Internet Archive request: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
                'Accept': 'application/json, text/xml, */*',
            },
            timeout: 15000
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Internet Archive API Error: ${response.status}`,
                message: response.statusText
            });
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.json(data);
        } else {
            const data = await response.text();
            res.set('Content-Type', contentType || 'text/plain');
            res.send(data);
        }

    } catch (error) {
        console.error('[IA Metadata Proxy Error]:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: 'Failed to fetch from Internet Archive API',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
});

// NEW: Proxy endpoint for Google Books API metadata
app.get('/api/googlebooks/*', async (req, res) => {
    try {
        const path = req.params[0]; // e.g., 'volumes' or 'volumes/ID'
        const queryString = req.url.split('?')[1] || '';
        let googleUrl = `https://www.googleapis.com/books/v1/${path}${queryString ? '?' + queryString : ''}`;

        // Append API key if it's not already in the query string
        if (GOOGLE_BOOKS_API_KEY && !googleUrl.includes('key=')) {
            googleUrl += `${queryString ? '&' : '?'}key=${GOOGLE_BOOKS_API_KEY}`;
        }

        console.log(`[Google Books Proxy] Proxying Google Books request: ${googleUrl}`);

        const response = await fetch(googleUrl, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
                'Accept': 'application/json',
            },
            timeout: 15000
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Google Books API Error: ${response.status}`,
                message: response.statusText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Google Books Proxy Error]:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: 'Failed to fetch from Google Books API',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
});

// START THE SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
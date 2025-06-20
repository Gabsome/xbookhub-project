const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Ensure node-fetch is correctly imported
const app = express();

// --- Middleware ---
app.use(cors({
    origin: ['https://xbook-hub.netlify.app', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent'],
    credentials: true
}));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

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

// --- HELPER FUNCTION FOR INTERNET ARCHIVE CONTENT RESOLUTION ---
/**
 * Resolves the direct content URL for an Internet Archive item based on desired format.
 * Queries IA metadata to find available files.
 * @param {string} iaIdentifier - The Internet Archive item identifier (e.g., 'gutenberg_book_1342').
 * @param {string} requestedFormat - The desired content format ('txt', 'html', 'pdf', 'epub').
 * @returns {Promise<{url: string, cleanHtml: boolean}|null>} - The content URL and whether to clean HTML, or null if not found.
 */
async function getInternetArchiveContentUrl(iaIdentifier, requestedFormat) {
    const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
    console.log(`[IA Resolver] Fetching metadata for ${iaIdentifier} from: ${metadataUrl}`);

    try {
        const response = await fetch(metadataUrl, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
                'Accept': 'application/json',
            },
            timeout: 10000 // Add a timeout for external fetches
        });

        if (!response.ok) {
            console.warn(`[IA Resolver] Failed to fetch metadata for ${iaIdentifier}: ${response.status} ${response.statusText}`);
            return null;
        }

        const metadata = await response.json();
        const files = metadata.files || [];

        let bestMatchUrl = null;
        let cleanHtml = false;

        const downloadBaseUrl = `https://archive.org/download/${iaIdentifier}/`;

        const formatMap = {
            'txt': ['DjVu text', 'Text', 'Plain Text'],
            'html': ['HTML', 'Animated GIF', 'JPEG', 'Image Container'],
            'pdf': ['PDF'],
            'epub': ['EPUB'],
        };

        const potentialFormats = formatMap[requestedFormat] || [];
        for (const iaFormat of potentialFormats) {
            const foundFile = files.find(file => file.format === iaFormat);
            if (foundFile && foundFile.name) {
                bestMatchUrl = `${downloadBaseUrl}${encodeURIComponent(foundFile.name)}`;
                cleanHtml = (iaFormat === 'HTML');
                console.log(`[IA Resolver] Found direct match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                return { url: bestMatchUrl, cleanHtml };
            }
        }

        // Fallback to other available formats if the exact requested format isn't found
        const fallbackOrder = ['txt', 'epub', 'pdf', 'html'];
        for (const formatKey of fallbackOrder) {
            if (formatKey === requestedFormat) continue; // Skip if it's the one we already looked for
            const fallbackIAFormats = formatMap[formatKey] || [];
            for (const iaFormat of fallbackIAFormats) {
                const foundFile = files.find(file => file.format === iaFormat);
                if (foundFile && foundFile.name) {
                    bestMatchUrl = `${downloadBaseUrl}${encodeURIComponent(foundFile.name)}`;
                    cleanHtml = (iaFormat === 'HTML');
                    console.log(`[IA Resolver] Found fallback match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                    return { url: bestMatchUrl, cleanHtml };
                }
            }
        }

        if (!bestMatchUrl) {
            // As a very last resort for content, link to the item details page, but this won't be direct content
            bestMatchUrl = `https://archive.org/details/${iaIdentifier}`;
            cleanHtml = true; // Still attempt to clean in case it's an HTML page
            console.log(`[IA Resolver] No direct file found, falling back to item details page: ${bestMatchUrl}`);
            return { url: bestMatchUrl, cleanHtml };
        }

        return null; // Should not be reached if fallback logic is thorough
    } catch (error) {
        console.error(`[IA Resolver Error] Could not resolve IA content for ${iaIdentifier}:`, error);
        return null;
    }
}


// --- API Endpoints ---

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: ['Project Gutenberg', 'Open Library', 'Internet Archive']
    });
});

// General purpose content fetching endpoint (your existing proxy) - NO CHANGES TO BOOK FETCHING LOGIC
app.get('/api/fetch-book', async (req, res) => {
    const { url, clean } = req.query;

    if (!url) {
        return res.status(400).json({
            error: 'Missing URL parameter',
            message: 'Please provide a URL to fetch content from'
        });
    }

    try {
        new URL(url); // Validate URL format
    } catch (error) {
        return res.status(400).json({
            error: 'Invalid URL format',
            message: 'The provided URL is not valid'
        });
    }

    console.log(`[Proxy-Fetch] Attempting to fetch: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const headers = {
            'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
            'Accept': 'text/html,text/plain,application/pdf,application/epub+zip,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate', // Allow compressed responses
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };

        if (url.includes('archive.org')) {
            headers['Referer'] = 'https://archive.org/';
            headers['Accept'] = 'text/html,text/plain,application/pdf,application/epub+zip,*/*';
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
                if (errorBody && errorBody.length < 500) { // Limit error body length
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
            'Cache-Control': 'public, max-age=3600', // Cache content for 1 hour
            'X-Source-URL': url
        });

        // Handle binary files (PDF, EPUB) by piping the stream
        if (contentType.includes('application/pdf') || contentType.includes('application/epub+zip')) {
            response.body.pipe(res);
            return; // Important to return here to prevent further processing
        }

        if (!contentType.includes('text/') &&
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
            return res.status(204).json({
                error: 'Empty content',
                message: 'The fetched content is empty'
            });
        }

        console.log(`[Proxy-Fetch] Successfully fetched ${content.length} characters from ${url}.`);

        if (clean === 'true' && contentType.includes('text/html')) {
            const cleanedContent = cleanHtmlContent(content);
            res.set('X-Cleaned-Content-Length', cleanedContent.length.toString());
            return res.send(cleanedContent);
        } else {
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
    // Using a more reliable, simple placeholder that works without external services for immediate fallback
    const defaultCoverUrl = 'https://via.placeholder.com/128x190?text=No+Cover';
    const defaultCoverContentType = 'image/png'; // Default content type for the placeholder

    // Helper function to send the default image
    const sendDefaultCover = async (status = 200, errorMessage = 'No image available') => {
        try {
            const defaultImageResponse = await fetch(defaultCoverUrl);
            const contentType = defaultImageResponse.headers.get('content-type') || defaultCoverContentType;
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400'); // Cache default for 24 hours
            res.set('X-Fallback-Image', 'true'); // Indicate that this is a fallback
            if (errorMessage) {
                res.set('X-Error-Message', errorMessage); // Provide error message in header
            }
            res.status(status);
            defaultImageResponse.body.pipe(res);
        } catch (err) {
            console.error('Failed to fetch hardcoded default cover:', err);
            // If even the hardcoded default fails, send a tiny transparent GIF or PNG to avoid browser errors
            // 1x1 transparent PNG base64
            res.status(500).set('Content-Type', 'image/png').send(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
        }
    };

    if (!url) {
        console.warn('[Image Proxy] No URL provided, serving default cover.');
        return sendDefaultCover(400, 'Image URL missing.'); // Bad request for missing URL, but provide an image
    }

    try {
        new URL(url); // Validate URL format
    } catch (error) {
        console.warn(`[Image Proxy] Invalid URL format: ${url}. Serving default cover.`);
        return sendDefaultCover(400, 'Invalid image URL format.');
    }

    console.log(`[Image Proxy] Attempting to fetch image: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for images

        const headers = {
            'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
            'Referer': req.headers.referer || 'https://xbook-hub.netlify.app', // Send Referer header
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        };

        const response = await fetch(url, {
            signal: controller.signal,
            headers,
            redirect: 'follow', // Follow redirects
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
            console.error(`[Image Proxy] ${errorMessage} for ${url}. Serving default cover.`);
            return sendDefaultCover(response.status, `Failed to fetch image: ${errorMessage}`);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        if (!contentType.startsWith('image/')) {
            console.warn(`[Image Proxy] Fetched content is not an image (${contentType}) for URL: ${url}. Serving default cover.`);
            return sendDefaultCover(415, `Content type ${contentType} is not an image.`); // Unsupported Media Type, but provide an image
        }

        console.log(`[Image Proxy] Successfully fetched image, Content-Type: ${contentType}`);

        // Set appropriate headers for the client
        res.set({
            'Content-Type': contentType,
            'Content-Length': response.headers.get('content-length'), // Preserve original content length if available
            'Cache-Control': 'public, max-age=86400', // Cache images for longer (24 hours)
            'X-Source-URL': url // Custom header for debugging
        });

        // Pipe the image stream directly to the response
        response.body.pipe(res);

    } catch (error) {
        let errorMessage = `Failed to fetch image: ${error.message}`;
        console.error(`[Image Proxy Error] ${errorMessage} for ${url}. Serving default cover.`);

        if (error.name === 'AbortError') {
            errorMessage = 'Image request timed out.';
            return sendDefaultCover(408, errorMessage); // Request Timeout
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = 'Could not connect to the external image source.';
            return sendDefaultCover(503, errorMessage); // Service Unavailable
        } else {
            return sendDefaultCover(500, errorMessage); // Internal Server Error
        }
    }
});


// --- UPDATED ENDPOINT TO RESOLVE AND SERVE BOOK COVERS ---
app.get('/api/book/:source/:id/cover', async (req, res) => {
    const { source, id } = req.params;
    let coverExternalUrl = null;

    try {
        console.log(`[Cover Resolver] Request for cover, source: "${source}", ID: "${id}"`);

        if (source === 'gutenberg') {
            const gutendexUrl = `https://gutendex.com/books/${id}/`;
            try {
                const response = await fetch(gutendexUrl, { timeout: 10000 });
                if (response.ok) {
                    const book = await response.json();
                    coverExternalUrl = book.formats['image/jpeg'] || book.formats['image/png'] || book.formats['image/webp'];
                    console.log(`[Cover Resolver] Gutenberg direct cover from Gutendex: ${coverExternalUrl || 'Not found'}`);
                    if (!coverExternalUrl) {
                        // Fallback to the general Gutenberg cover URL pattern if Gutendex doesn't explicitly list it
                        coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                        console.log(`[Cover Resolver] Gutenberg fallback cover pattern: ${coverExternalUrl}`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Failed to fetch Gutendex metadata for ID ${id}: ${response.status} ${response.statusText}`);
                    coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                    console.log(`[Cover Resolver] Gutenberg fallback cover pattern due to Gutendex error: ${coverExternalUrl}`);
                }
            } catch (gutendexError) {
                console.error(`[Cover Resolver] Error fetching from Gutendex for ID ${id}: ${gutendexError.message}. Falling back to default pattern.`);
                coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
            }

        } else if (source === 'openlibrary') {
            // Open Library covers can be retrieved using /b/id/ (numeric cover_id) or /b/olid/ (OLID)
            if (!isNaN(Number(id))) { // Check if the ID is purely numeric (likely a cover_id)
                coverExternalUrl = `https://covers.openlibrary.org/b/id/${id}-L.jpg`; // L for Large, M for Medium, S for Small
                console.log(`[Cover Resolver] Open Library cover from numeric ID: ${coverExternalUrl}`);
            } else if (id.startsWith('OL')) { // Could be an OLID (e.g., OL12345M) or a Work ID (e.g., OL12345W)
                coverExternalUrl = `https://covers.openlibrary.org/b/olid/${id}-L.jpg`; // Tries by OLID
                console.log(`[Cover Resolver] Open Library cover from OLID/Work ID: ${coverExternalUrl}`);
            } else {
                console.warn(`[Cover Resolver] Open Library ID "${id}" is not a direct numeric cover ID or OLID. Cannot construct direct cover URL.`);
                // If ID format doesn't match direct cover pattern, coverExternalUrl remains null, triggering default fallback.
            }
        } else if (source === 'archive') {
            const iaIdentifier = id;
            console.log(`[Cover Resolver] Attempting to resolve Internet Archive cover for ID: ${iaIdentifier}`);

            // Strategy 1: Try the standard Internet Archive /services/img/ identifier URL (often auto-generated)
            let potentialCoverUrl = `https://archive.org/services/img/${iaIdentifier}/full/!300,400/0/default.jpg`;
            console.log(`[Cover Resolver] Trying IA standard service URL: ${potentialCoverUrl}`);

            // Strategy 2: Fallback to querying IA metadata for specific cover image files (more robust)
            try {
                const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
                console.log(`[Cover Resolver] Fetching IA metadata as fallback for specific file: ${metadataUrl}`);
                const metadataResponse = await fetch(metadataUrl, {
                    headers: { 'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)' },
                    timeout: 5000 // Shorter timeout for metadata
                });

                if (metadataResponse.ok) {
                    const metadata = await metadataResponse.json();
                    const files = metadata.files || [];

                    // Prioritize common cover image filenames and formats
                    const coverFile = files.find(file =>
                        file.name &&
                        (file.name.toLowerCase().includes('cover.jpg') ||
                         file.name.toLowerCase().includes('thumb.jpg') ||
                         file.name.toLowerCase().includes('thumbnail.jpg') ||
                         file.name.toLowerCase().includes('cover.png') ||
                         file.name.toLowerCase().endsWith('.jpg') || // General .jpg as a last resort in files
                         file.name.toLowerCase().endsWith('.png')) && // General .png as a last resort in files
                        (file.format === 'JPEG' || file.format === 'PNG' || file.format === 'Image') // Check common image formats
                    );

                    if (coverFile) {
                        // If a specific cover file is found, use its direct download URL
                        coverExternalUrl = `https://archive.org/download/${iaIdentifier}/${encodeURIComponent(coverFile.name)}`;
                        console.log(`[Cover Resolver] Found specific IA file cover: ${coverExternalUrl}`);
                    } else {
                        // If no specific file, revert to the service URL as the primary candidate
                        coverExternalUrl = potentialCoverUrl;
                        console.log(`[Cover Resolver] No specific IA cover file found, using IA service URL: ${coverExternalUrl}`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Failed to fetch IA metadata for ${iaIdentifier}: ${metadataResponse.status} ${metadataResponse.statusText}. Using IA service URL as fallback.`);
                    coverExternalUrl = potentialCoverUrl; // Fallback to service URL if metadata fetch fails
                }
            } catch (metaError) {
                console.error(`[Cover Resolver] Error fetching IA metadata for ${iaIdentifier}:`, metaError.message, 'Using IA service URL as fallback.');
                coverExternalUrl = potentialCoverUrl; // Fallback to service URL on metadata error
            }

        } else {
            console.warn(`[Cover Resolver] Unsupported source: ${source}`);
            // If source is unsupported, the `coverExternalUrl` will remain null, triggering the default fallback.
            // Explicitly set a 400 status if no valid source is matched, before attempting to serve an image.
            return res.status(400).json({ error: 'Unsupported book source for cover. Must be "gutenberg", "openlibrary", or "archive".' });
        }

        // --- Proxy the resolved cover URL through /api/fetch-image ---
        // This ensures consistent caching, error handling (with default image fallback), and referer management.
        const internalProxyUrl = coverExternalUrl
            ? `${req.protocol}://${req.get('host')}/api/fetch-image?url=${encodeURIComponent(coverExternalUrl)}`
            : `${req.protocol}://${req.get('host')}/api/fetch-image`; // If no URL, /fetch-image will serve default

        console.log(`[Cover Resolver] Proxying to internal image endpoint: ${internalProxyUrl}`);

        const proxyResponse = await fetch(internalProxyUrl);

        // Pass through the status and headers from the internal image proxy
        res.status(proxyResponse.status);
        proxyResponse.headers.forEach((value, name) => {
            // IMPORTANT: Do NOT forward content-encoding or transfer-encoding headers,
            // as node-fetch might have already decompressed the content, or Express might handle it.
            if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                res.set(name, value);
            }
        });
        if (coverExternalUrl) {
            res.set('X-Source-Resolved-Cover-URL', coverExternalUrl); // Custom header for debugging
        }
        proxyResponse.body.pipe(res); // Pipe the image stream

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

        // Always attempt to send the default cover via your proxy, even on upstream errors
        // This ensures the client always gets an image response, even if it's a placeholder.
        try {
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-image`; // Call with no URL to get default
            const proxyResponse = await fetch(internalProxyUrl);
            res.status(proxyResponse.status); // This should be 200 from the default image logic
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                    res.set(name, value);
                }
            });
            res.set('X-Error-Message', errorMessage); // Add a custom error header for client-side debugging
            proxyResponse.body.pipe(res);
        } catch (fallbackError) {
            console.error(`[Cover Resolution Fallback Error for ${source}/${id}]:`, fallbackError.message);
            // If even the fallback fails, send a generic JSON error as a last resort
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


// Main endpoint to resolve book ID to content URL and then fetch it (NO CHANGES TO THIS LOGIC)
app.get('/api/book/:source/:id/content', async (req, res) => {
    const { source, id } = req.params;
    const { format = 'txt' } = req.query; // Default to 'txt'

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

            // Fallback for Gutenberg content: prioritize plain text, then HTML if requested format not found
            if (!contentUrl) {
                contentUrl = formats['text/plain; charset=utf-8'] || formats['text/plain'] || formats['text/html'];
                if (contentUrl && contentUrl.includes('html')) cleanHtml = true;
            }

            if (!contentUrl) {
                console.warn(`[Content Resolver] No suitable content URL found for Gutenberg ID ${id} in format ${format}. Available formats:`, Object.keys(formats).join(', '));
                return res.status(404).json({ error: `Content in ${format} format not available for Gutenberg book ID ${id}.` });
            }
            console.log(`[Content Resolver] Gutenberg URL resolved to: ${contentUrl}`);

        } else if (source === 'openlibrary') {
            const openLibraryWorkUrl = `https://openlibrary.org/works/${id}.json`;
            console.log(`[Content Resolver] Fetching Open Library work details from: ${openLibraryWorkUrl}`);
            const workResponse = await fetch(openLibraryWorkUrl, { timeout: 10000 });

            if (!workResponse.ok) {
                if (workResponse.status === 404) {
                    return res.status(404).json({ error: `Open Library work with ID ${id} not found.` });
                }
                throw new Error(`Failed to fetch Open Library work metadata: ${workResponse.statusText}`);
            }
            const workData = await workResponse.json();

            let iaIdentifier = workData.ia_collection_id || workData.ia_loaded_id || workData.ia_id || workData.ocaid;

            if (!iaIdentifier && workData.first_editions && workData.first_editions[0] && workData.first_editions[0].ia_id) {
                iaIdentifier = workData.first_editions[0].ia_id;
            }

            if (iaIdentifier) {
                console.log(`[Content Resolver] Found Internet Archive ID: ${iaIdentifier} for Open Library work ${id}.`);
                const iaContent = await getInternetArchiveContentUrl(iaIdentifier, format);
                if (iaContent) {
                    contentUrl = iaContent.url;
                    cleanHtml = iaContent.cleanHtml;
                } else {
                    console.warn(`[Content Resolver] getInternetArchiveContentUrl failed for IA ID ${iaIdentifier} in format ${format}.`);
                }
            }

            if (!contentUrl) {
                const message = iaIdentifier
                    ? `An Internet Archive ID (${iaIdentifier}) was found, but no direct ${format} link could be constructed from it by the IA resolver.`
                    : 'No associated Internet Archive ID found for this Open Library work.';
                console.warn(`[Content Resolver] No content URL for Open Library ID ${id}. ${message}`);
                return res.status(404).json({
                    error: `Content not directly available in ${format} format for Open Library work ID ${id}.`,
                    message: message + ' Open Library primarily provides metadata. Try searching directly on Internet Archive or looking for "Read Online" links on Open Library.',
                    iaIdentifierFound: !!iaIdentifier
                });
            }
            console.log(`[Content Resolver] Open Library/IA URL resolved to: ${contentUrl}`);

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

        } else {
            return res.status(400).json({ error: 'Unsupported book source. Must be "gutenberg", "openlibrary", or "archive".' });
        }

        if (contentUrl) {
            console.log(`[Content Resolver] Proceeding to fetch content via /api/fetch-book for: ${contentUrl}`);
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-book?url=${encodeURIComponent(contentUrl)}&clean=${cleanHtml}`;

            const proxyResponse = await fetch(internalProxyUrl);

            res.status(proxyResponse.status);
            proxyResponse.headers.forEach((value, name) => {
                // Ensure content-encoding isn't re-applied if node-fetch already decoded it
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


// Proxy endpoint for Open Library API metadata (NO CHANGES)
app.get('/api/openlibrary/*', async (req, res) => {
    try {
        const path = req.params[0];
        const queryString = req.url.split('?')[1] || '';
        const olUrl = `https://openlibrary.org/${path}${queryString ? '?' + queryString : ''}`;

        console.log(`[OL Metadata Proxy] Proxying Open Library request: ${olUrl}`);

        const response = await fetch(olUrl, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
                'Accept': 'application/json',
            },
            timeout: 15000 // Add timeout
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Open Library API Error: ${response.status}`,
                message: response.statusText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[OL Metadata Proxy Error]:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: 'Failed to fetch from Open Library API',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
            timeout: 15000 // Add timeout
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Internet Archive API Error: ${response.status}`,
                message: response.statusText
            });
        }

        // Check content-type to ensure JSON parsing is appropriate
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.json(data);
        } else {
            // If not JSON, just send the raw text/data
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

// START THE SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for origins: ${['https://xbook-hub.netlify.app', 'http://localhost:5173'].join(', ')}`);
});
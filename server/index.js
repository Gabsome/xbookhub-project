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

// --- NEW HELPER FUNCTION FOR INTERNET ARCHIVE CONTENT RESOLUTION (EXISTING) ---
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
            'html': ['HTML', 'Animated GIF', 'JPEG', 'Image Container'], // IA metadata can sometimes list images as 'HTML' format, be cautious.
            'pdf': ['PDF'],
            'epub': ['EPUB'],
        };

        const potentialFormats = formatMap[requestedFormat] || [];
        for (const iaFormat of potentialFormats) {
            const foundFile = files.find(file => file.format === iaFormat);
            if (foundFile && foundFile.name) {
                bestMatchUrl = `${downloadBaseUrl}${encodeURIComponent(foundFile.name)}`;
                cleanHtml = (iaFormat === 'HTML'); // Assuming HTML needs cleaning
                console.log(`[IA Resolver] Found direct match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                return { url: bestMatchUrl, cleanHtml };
            }
        }

        const fallbackOrder = ['txt', 'epub', 'pdf', 'html'];
        for (const formatKey of fallbackOrder) {
            if (formatKey === requestedFormat) continue; // Don't re-check the already requested format
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
            // As a last resort, link to the item's details page which will have content links
            bestMatchUrl = `https://archive.org/details/${iaIdentifier}`;
            cleanHtml = true; // Attempt to clean if we fetch this page
            console.log(`[IA Resolver] No direct file found, falling back to item details page: ${bestMatchUrl}`);
            return { url: bestMatchUrl, cleanHtml };
        }

        return null; // Should not reach here if fallbacks are handled
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

// General purpose content fetching endpoint (your existing proxy)
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

        // Handle binary files (PDF, EPUB) by piping the stream
        if (contentType.includes('application/pdf') || contentType.includes('application/epub+zip')) {
            response.body.pipe(res);
            return; // Important to return here to prevent further processing
        }

        // IMPORTANT: This block prevents fetching images! (This is for content proxy, not images)
        if (!contentType.includes('text/') &&
            !contentType.includes('application/xml') &&
            !contentType.includes('application/xhtml') &&
            !contentType.includes('application/json')) {
            console.warn(`[Proxy-Fetch] Unsupported content type: ${contentType} for URL: ${url}`);
            return res.status(400).json({
                error: 'Unsupported content type',
                message: `Content type ${contentType} is not supported. Only text, PDF, and EPUB are allowed.`,
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


// --- NEW GENERAL PURPOSE IMAGE PROXY ENDPOINT (EXISTING, now used by cover resolver) ---
app.get('/api/fetch-image', async (req, res) => {
    const { url } = req.query;
    const defaultCoverUrl = 'https://via.placeholder.com/128x190?text=No+Cover'; // Placeholder image

    if (!url) {
        // If no URL is provided, send the default cover
        try {
            const defaultImageResponse = await fetch(defaultCoverUrl);
            const contentType = defaultImageResponse.headers.get('content-type') || 'image/png';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            defaultImageResponse.body.pipe(res);
            return;
        } catch (err) {
            console.error('Failed to fetch default cover:', err);
            return res.status(500).json({ error: 'Missing URL and failed to load default image.' });
        }
    }

    try {
        new URL(url); // Validate URL format
    } catch (error) {
        return res.status(400).json({
            error: 'Invalid URL format',
            message: 'The provided URL is not valid'
        });
    }

    console.log(`[Image Proxy] Attempting to fetch image: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for images

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
            console.error(`[Image Proxy] HTTP Error: ${response.status} ${response.statusText} for ${url}`);
            // On error, send the default cover instead of an error JSON
            const defaultImageResponse = await fetch(defaultCoverUrl);
            const contentType = defaultImageResponse.headers.get('content-type') || 'image/png';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            res.status(200); // Send 200 even on error if providing a fallback image
            defaultImageResponse.body.pipe(res);
            return;
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        if (!contentType.startsWith('image/')) {
            console.warn(`[Image Proxy] Unsupported content type for image: ${contentType} for URL: ${url}`);
            // If not an image, send the default cover
            const defaultImageResponse = await fetch(defaultCoverUrl);
            const defaultContentType = defaultImageResponse.headers.get('content-type') || 'image/png';
            res.set('Content-Type', defaultContentType);
            res.set('Cache-Control', 'public, max-age=86400');
            res.status(200); // Send 200
            defaultImageResponse.body.pipe(res);
            return;
        }

        console.log(`[Image Proxy] Successfully fetched image, Content-Type: ${contentType}`);

        res.set({
            'Content-Type': contentType,
            'Content-Length': response.headers.get('content-length'),
            'Cache-Control': 'public, max-age=86400', // Cache images for longer (24 hours)
            'X-Source-URL': url
        });

        response.body.pipe(res);

    } catch (error) {
        console.error('[Image Proxy Error]:', error);

        // On any error, send the default cover instead of an error JSON
        try {
            const defaultImageResponse = await fetch(defaultCoverUrl);
            const contentType = defaultImageResponse.headers.get('content-type') || 'image/png';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            res.status(200); // Ensure 200 OK for the fallback image
            defaultImageResponse.body.pipe(res);
        } catch (defaultError) {
            console.error('Failed to retrieve default cover image:', defaultError.message);
            res.status(500).json({
                error: 'Internal server error',
                message: 'An unexpected error occurred while fetching the image and fallback.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                url: url
            });
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
            // Attempt to get cover from Gutendex metadata
            const gutendexUrl = `https://gutendex.com/books/${id}/`;
            const response = await fetch(gutendexUrl, { timeout: 10000 });
            if (response.ok) {
                const book = await response.json();
                // Gutendex provides direct image links, prioritize JPEG
                coverExternalUrl = book.formats['image/jpeg'] || book.formats['image/png'] || book.formats['image/webp'];
                console.log(`[Cover Resolver] Gutenberg direct cover from Gutendex: ${coverExternalUrl || 'Not found'}`);
                if (!coverExternalUrl) {
                    // Fallback to the general Gutenberg cover URL pattern if Gutendex doesn't explicitly list it
                    coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                    console.log(`[Cover Resolver] Gutenberg fallback cover pattern: ${coverExternalUrl}`);
                }
            } else {
                console.warn(`[Cover Resolver] Failed to fetch Gutendex metadata for ID ${id}: ${response.status} ${response.statusText}`);
                // Fallback to the general Gutenberg cover URL pattern if Gutendex call fails
                coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                console.log(`[Cover Resolver] Gutenberg fallback cover pattern due to Gutendex error: ${coverExternalUrl}`);
            }
        } else if (source === 'openlibrary') {
            // Open Library covers require either an OLID, ISBN, or a numeric cover_id.
            // Based on frontend discussion, `id` should be the `openlibrary_cover_id` if available,
            // which is the numeric cover ID.
            if (!isNaN(Number(id))) { // Check if the ID is purely numeric (likely a cover_id)
                coverExternalUrl = `https://covers.openlibrary.org/b/id/${id}-L.jpg`; // L for Large, M for Medium, S for Small
                console.log(`[Cover Resolver] Open Library cover from numeric ID: ${coverExternalUrl}`);
            } else if (id.startsWith('OL')) { // Could be an OLID (e.g., OL12345M) or a Work ID (e.g., OL12345W)
                coverExternalUrl = `https://covers.openlibrary.org/b/olid/${id}-L.jpg`; // Tries by OLID
                console.log(`[Cover Resolver] Open Library cover from OLID/Work ID: ${coverExternalUrl}`);
                // If this fails, a more robust solution would be to fetch openlibrary.org/works/{id}.json
                // and then try to find `covers` array or `ia_id`.
            } else {
                console.warn(`[Cover Resolver] Open Library ID "${id}" is not a direct numeric cover ID or OLID. Cannot construct direct cover URL.`);
                // No direct URL from ID, will fall back to default via /api/fetch-image
            }

        } else if (source === 'archive') {
            const iaIdentifier = id;
            console.log(`[Cover Resolver] Attempting to resolve Internet Archive cover for ID: ${iaIdentifier}`);

            // 1. Try the standard Internet Archive /services/img/ identifier URL
            coverExternalUrl = `https://archive.org/services/img/${iaIdentifier}/full/!300,400/0/default.jpg`;
            console.log(`[Cover Resolver] Trying IA standard service URL: ${coverExternalUrl}`);

            // Optional: Verify if this URL actually returns an image before proceeding
            // This would involve another fetch call with a small timeout, checking content-type.
            // For now, we'll let /api/fetch-image handle its own fallback if this URL is bad.

            // 2. Fallback: Query IA metadata for specific cover image files
            // This is more robust as it checks for actual file names.
            let foundSpecificCover = false;
            try {
                const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
                console.log(`[Cover Resolver] Fetching IA metadata as fallback: ${metadataUrl}`);
                const metadataResponse = await fetch(metadataUrl, {
                    headers: { 'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)' },
                    timeout: 5000 // Shorter timeout for metadata
                });

                if (metadataResponse.ok) {
                    const metadata = await metadataResponse.json();
                    const files = metadata.files || [];

                    // Prioritize specific cover image filenames
                    const coverFile = files.find(file =>
                        file.name &&
                        (file.name.includes('cover.jpg') ||
                         file.name.includes('thumb.jpg') ||
                         file.name.includes('cover.png') ||
                         file.name.includes('thumbnail.jpg')) &&
                        (file.format === 'JPEG' || file.format === 'PNG')
                    );

                    if (coverFile) {
                        coverExternalUrl = `https://archive.org/download/${iaIdentifier}/${encodeURIComponent(coverFile.name)}`;
                        foundSpecificCover = true;
                        console.log(`[Cover Resolver] Found specific IA file cover: ${coverExternalUrl}`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Failed to fetch IA metadata for ${iaIdentifier}: ${metadataResponse.status} ${metadataResponse.statusText}`);
                }
            } catch (metaError) {
                console.error(`[Cover Resolver] Error fetching IA metadata for ${iaIdentifier}:`, metaError.message);
            }
            // If a specific cover was found, it overrides the /services/img/ one.
            // If not, coverExternalUrl remains the /services/img/ one from step 1.

        } else {
            console.warn(`[Cover Resolver] Unsupported source: ${source}`);
            return res.status(400).json({ error: 'Unsupported book source for cover. Must be "gutenberg", "openlibrary", or "archive".' });
        }

        // If a coverExternalUrl was determined, proxy it through your /api/fetch-image endpoint
        if (coverExternalUrl) {
            console.log(`[Cover Resolver] Proxying resolved cover URL: ${coverExternalUrl} via /api/fetch-image`);
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-image?url=${encodeURIComponent(coverExternalUrl)}`;

            // Make an internal request to your general image proxy endpoint
            const proxyResponse = await fetch(internalProxyUrl);

            // Re-set headers and pipe the response body from the internal proxy
            res.status(proxyResponse.status); // Pass through the status (e.g., 200, 404, etc.)
            proxyResponse.headers.forEach((value, name) => {
                // Avoid re-setting headers that `express` or `node-fetch` might handle internally
                // or headers that could cause issues if passed through (like content-encoding if it's already decompressed)
                if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                    res.set(name, value);
                }
            });
            res.set('X-Source-Resolved-Cover-URL', coverExternalUrl); // Custom header for debugging
            proxyResponse.body.pipe(res); // Pipe the image stream

        } else {
            // If no specific cover URL could be resolved, fall back to the default cover
            console.warn(`[Cover Resolver] No specific cover URL resolved for ${source}/${id}. Sending default.`);
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-image`; // Call with no URL to get default
            const proxyResponse = await fetch(internalProxyUrl);
            res.status(proxyResponse.status);
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                    res.set(name, value);
                }
            });
            proxyResponse.body.pipe(res);
        }

    } catch (error) {
        console.error(`[Cover Resolution Error for ${source}/${id}]:`, error);
        let errorMessage = 'Failed to fetch book cover due to an unexpected error.';
        if (error.name === 'AbortError') {
            errorMessage = 'Cover image request timed out.';
        } else if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
            errorMessage = 'Cover not found for this book or source.';
        }
        // Even on error, attempt to send the default cover via your proxy
        try {
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-image`; // Call with no URL to get default
            const proxyResponse = await fetch(internalProxyUrl);
            res.status(proxyResponse.status); // Should be 200 from default
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding' && name !== 'transfer-encoding') {
                    res.set(name, value);
                }
            });
            res.set('X-Error-Message', errorMessage); // Add custom error header
            proxyResponse.body.pipe(res);
        } catch (fallbackError) {
            console.error(`[Cover Resolution Fallback Error for ${source}/${id}]:`, fallbackError.message);
            // If even the fallback fails, send a generic JSON error
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


// Main endpoint to resolve book ID to content URL and then fetch it (no changes here for covers)
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
                if (name !== 'content-encoding') { // Don't forward content-encoding as node-fetch might have decompressed
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


// Proxy endpoint for Open Library API metadata
app.get('/api/openlibrary/*', async (req, res) => {
    // Reconstruct the original Open Library API path
    const olPath = req.params[0];
    const queryParams = new URLSearchParams(req.query).toString();
    const olUrl = `https://openlibrary.org/${olPath}${queryParams ? `?${queryParams}` : ''}`;

    console.log(`[OL Proxy] Fetching: ${olUrl}`);

    try {
        const response = await fetch(olUrl, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
                'Accept': 'application/json',
            },
            timeout: 15000 // 15-second timeout for Open Library metadata
        });

        if (!response.ok) {
            console.error(`[OL Proxy] HTTP Error: ${response.status} ${response.statusText} for ${olUrl}`);
            return res.status(response.status).json({
                error: `Open Library API Error: ${response.status}`,
                message: response.statusText
            });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('[OL Proxy Error]:', error);
        if (error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request Timeout',
                message: 'Open Library API request timed out.'
            });
        }
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch data from Open Library API.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// START THE SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173, https://xbook-hub.netlify.app'}`);
});
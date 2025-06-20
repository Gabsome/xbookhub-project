const express = require('express');
const cors = require('cors');
// Ensure node-fetch is correctly imported for ESM and CJS compatibility
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();
const path = require('path'); // Require path module

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = ['https://xbook-hub.netlify.app', 'http://localhost:5173'];

// --- Middleware ---
app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent', 'X-Requested-With'], // Added X-Requested-With
    credentials: true
}));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve static files from the 'public' directory
// This is crucial if you later decide to use a local 'no_cover.jpg'
// For now, your /api/fetch-image uses an external placeholder.
// If you want a local 'no_cover.jpg', ensure it exists in 'public'
// and update the defaultCoverUrl in /api/fetch-image.
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
/**
 * Resolves the direct content URL for an Internet Archive item based on desired format.
 * Queries IA metadata to find available files.
 * @param {string} iaIdentifier - The Internet Archive item identifier (e.g., 'gutenberg_book_1342').
 * @param {string} requestedFormat - The desired content format ('txt', 'html', 'pdf', 'epub').
 * @returns {Promise<{url: string, cleanHtml: boolean}|null>} - The content URL and whether to clean HTML, or null if not found.
 */
async function getInternetArchiveContentUrl(iaIdentifier, requestedFormat) {
    const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
    console.log(`[IA Content Resolver] Fetching metadata for ${iaIdentifier} from: ${metadataUrl}`);

    try {
        const response = await fetch(metadataUrl, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
                'Accept': 'application/json',
            },
            timeout: 10000 // Add a timeout for external fetches
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
            'html': ['HTML', 'Animated GIF', 'JPEG', 'Image Container'], // IA's HTML might be primary content
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
                    console.log(`[IA Content Resolver] Found fallback match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                    return { url: bestMatchUrl, cleanHtml };
                }
            }
        }

        if (!bestMatchUrl) {
            // As a very last resort for content, link to the item details page, but this won't be direct content
            bestMatchUrl = `https://archive.org/details/${iaIdentifier}`;
            cleanHtml = true; // Still attempt to clean in case it's an HTML page
            console.log(`[IA Content Resolver] No direct file found, falling back to item details page: ${bestMatchUrl}`);
            return { url: bestMatchUrl, cleanHtml };
        }

        return null; // Should not be reached if fallback logic is thorough
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
    // Using a simple, reliable placeholder that works without external services for immediate fallback
    const defaultCoverUrl = 'https://via.placeholder.com/128x190?text=No+Cover';
    const defaultCoverContentType = 'image/png';

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
            // If even the hardcoded default fails, send a tiny transparent PNG to avoid browser errors
            // 1x1 transparent PNG base64 encoded
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
        console.warn(`[Image Proxy] Invalid URL format: "${url}". Serving default cover.`);
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
                    // Gutendex provides direct image links, prioritize JPEG
                    coverExternalUrl = book.formats['image/jpeg'] || book.formats['image/png'] || book.formats['image/webp'];
                    console.log(`[Cover Resolver] Gutenberg direct cover from Gutendex: ${coverExternalUrl || 'Not found'}`);
                    if (!coverExternalUrl) {
                        // Fallback to the general Gutenberg cover URL pattern if Gutendex doesn't explicitly list it
                        // This is a common pattern for Gutenberg books but might not exist for all.
                        coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                        console.log(`[Cover Resolver] Gutenberg fallback cover pattern: ${coverExternalUrl}`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Failed to fetch Gutendex metadata for ID ${id}: ${response.status} ${response.statusText}`);
                    // Fallback to the general Gutenberg cover URL pattern if Gutendex call fails
                    coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
                    console.log(`[Cover Resolver] Gutenberg fallback cover pattern due to Gutendex error: ${coverExternalUrl}`);
                }
            } catch (gutendexError) {
                console.error(`[Cover Resolver] Error fetching from Gutendex for ID ${id}: ${gutendexError.message}. Falling back to Gutenberg pattern.`);
                // If Gutendex fetch itself throws an error (e.g., network issue), use the direct Gutenberg URL pattern
                coverExternalUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
            }

        } else if (source === 'openlibrary') {
            // Open Library covers require either an OLID, ISBN, or a numeric cover_id.
            // Based on frontend discussion, `id` should be the `openlibrary_cover_id` if available,
            // which is the numeric cover ID.
            if (!isNaN(Number(id))) { // Check if the ID is purely numeric (likely a cover_i)
                coverExternalUrl = `https://covers.openlibrary.org/b/id/${id}-L.jpg`; // L for Large, M for Medium, S for Small
                console.log(`[Cover Resolver] Open Library cover from numeric ID: ${coverExternalUrl}`);
            } else if (id.startsWith('OL')) { // Could be an OLID (e.g., OL12345M) or a Work ID (e.g., OL12345W)
                coverExternalUrl = `https://covers.openlibrary.org/b/olid/${id}-L.jpg`; // Tries by OLID
                console.log(`[Cover Resolver] Open Library cover from OLID/Work ID: ${coverExternalUrl}`);
                // If this fails, a more robust solution would be to fetch openlibrary.org/works/{id}.json
                // and then try to find `covers` array or `ia_id`.
            } else {
                console.warn(`[Cover Resolver] Open Library ID "${id}" is not a direct numeric cover ID or OLID. Cannot construct direct cover URL.`);
                // No direct URL from ID, will fall back to default via /api/fetch-image as coverExternalUrl remains null
            }
        } else if (source === 'archive') {
            const iaIdentifier = id;
            let bookMetadata = null; // To store metadata for Open Library fallback

            console.log(`[Cover Resolver] Attempting to resolve Internet Archive cover for ID: ${iaIdentifier}`);

            // Strategy 1: Attempt Internet Archive's /services/img/ endpoint
            const iaServiceUrl = `https://archive.org/services/img/${iaIdentifier}/full/!300,400/0/default.jpg`;
            try {
                // Use HEAD request to quickly check existence and content type without downloading
                const iaServiceResponse = await fetch(iaServiceUrl, { method: 'HEAD', timeout: 5000 });
                const iaServiceContentType = iaServiceResponse.headers.get('content-type');

                if (iaServiceResponse.ok && iaServiceContentType && iaServiceContentType.startsWith('image/')) {
                    coverExternalUrl = iaServiceUrl;
                    console.log(`[Cover Resolver] Found IA cover via standard service: ${coverExternalUrl}`);
                } else {
                    console.warn(`[Cover Resolver] IA standard service URL not found or not image for ${iaIdentifier}. Status: ${iaServiceResponse.status}, Type: ${iaServiceContentType}.`);
                }
            } catch (error) {
                console.error(`[Cover Resolver] Error checking IA standard service for ${iaIdentifier}: ${error.message}`);
            }

            // Strategy 2: If no cover yet, query IA metadata for specific image files (e.g., 'cover.jpg')
            if (!coverExternalUrl) {
                try {
                    const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
                    console.log(`[Cover Resolver] Fetching IA metadata for specific file search from: ${metadataUrl}`);
                    const metadataResponse = await fetch(metadataUrl, {
                        headers: { 'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)' },
                        timeout: 7000 // A bit more time for full metadata
                    });

                    if (metadataResponse.ok) {
                        const metadata = await metadataResponse.json();
                        const files = metadata.files || [];

                        // Store metadata for potential Open Library fallback
                        bookMetadata = {
                            title: metadata.metadata?.title,
                            creator: metadata.metadata?.creator // Often the author
                        };

                        // Prioritize common cover image filenames and formats
                        const coverFile = files.find(file =>
                            file.name && (
                                file.name.toLowerCase().includes('cover.jpg') ||
                                file.name.toLowerCase().includes('cover.png') ||
                                file.name.toLowerCase().includes('thumb.jpg') ||
                                file.name.toLowerCase().includes('thumbnail.jpg') ||
                                (file.format === 'JPEG' && files.length < 20) || // If few files, any JPEG might be cover
                                (file.format === 'PNG' && files.length < 20)
                            ) && (file.format === 'JPEG' || file.format === 'PNG' || file.format === 'Image')
                        );

                        if (coverFile) {
                            // If a specific cover file is found, use its direct download URL
                            coverExternalUrl = `https://archive.org/download/${iaIdentifier}/${encodeURIComponent(coverFile.name)}`;
                            console.log(`[Cover Resolver] Found specific IA file cover: ${coverExternalUrl}`);
                        } else {
                            console.log(`[Cover Resolver] No specific IA cover file found in metadata for ${iaIdentifier}.`);
                        }
                    } else {
                        console.warn(`[Cover Resolver] Failed to fetch IA metadata for ${iaIdentifier}: ${metadataResponse.status} ${metadataResponse.statusText}.`);
                    }
                } catch (metaError) {
                    console.error(`[Cover Resolver] Error fetching IA metadata for ${iaIdentifier}:`, metaError.message);
                }
            }

            // Fallback 1: If no cover from Internet Archive's methods, try Open Library
            // Only proceed if we have basic book metadata from IA to search OL
            if (!coverExternalUrl && bookMetadata && bookMetadata.title) {
                console.log(`[Cover Resolver] IA cover not found for ${iaIdentifier}. Attempting Open Library fallback...`);
                let olSearchQuery = `title=${encodeURIComponent(bookMetadata.title)}`;
                if (bookMetadata.creator) {
                    olSearchQuery += `&author=${encodeURIComponent(bookMetadata.creator)}`;
                }

                const olSearchUrl = `https://openlibrary.org/search.json?${olSearchQuery}&limit=1`;
                console.log(`[Cover Resolver] Searching Open Library for: ${olSearchUrl}`);
                try {
                    const olSearchResponse = await fetch(olSearchUrl, { timeout: 7000 });
                    if (olSearchResponse.ok) {
                        const olSearchData = await olSearchResponse.json();
                        if (olSearchData.docs && olSearchData.docs.length > 0) {
                            const firstMatch = olSearchData.docs[0];
                            if (firstMatch.cover_i) { // cover_i is the cover ID for covers.openlibrary.org
                                coverExternalUrl = `https://covers.openlibrary.org/b/id/${firstMatch.cover_i}-L.jpg`;
                                console.log(`[Cover Resolver] Found Open Library cover via search for IA book ${iaIdentifier}: ${coverExternalUrl}`);
                            } else if (firstMatch.key) { // Fallback to work key if cover_i not direct
                                const olWorkId = firstMatch.key.split('/').pop();
                                coverExternalUrl = `https://covers.openlibrary.org/b/olid/${olWorkId}-L.jpg`;
                                console.log(`[Cover Resolver] Found Open Library cover (via work ID) for IA book ${iaIdentifier}: ${coverExternalUrl}`);
                            } else {
                                console.warn(`[Cover Resolver] Open Library search found match but no cover_i or key for ${iaIdentifier}.`);
                            }
                        } else {
                            console.warn(`[Cover Resolver] No matching book found on Open Library for IA ID ${iaIdentifier}.`);
                        }
                    } else {
                        console.warn(`[Cover Resolver] Failed to search Open Library for IA ID ${iaIdentifier}: ${olSearchResponse.status}`);
                    }
                } catch (error) {
                    console.error(`[Cover Resolver] Error during Open Library fallback for ${iaIdentifier}: ${error.message}`);
                }
            }

        } else {
            console.warn(`[Cover Resolver] Unsupported source: ${source}`);
            // Explicitly return a 400 for unsupported source instead of relying on the proxy.
            return res.status(400).json({ error: 'Unsupported book source for cover. Must be "gutenberg", "openlibrary", or "archive".' });
        }

        // --- Proxy the resolved cover URL through /api/fetch-image endpoint ---
        // This ensures consistent caching, error handling (with default image fallback), and referer management.
        const internalProxyUrl = coverExternalUrl
            ? `${req.protocol}://${req.get('host')}/api/fetch-image?url=${encodeURIComponent(coverExternalUrl)}`
            : `${req.protocol}://${req.get('host')}/api/fetch-image`; // If no URL was resolved, /fetch-image will serve default

        console.log(`[Cover Resolver] Proxying resolved cover URL (or default) via internal image endpoint: ${internalProxyUrl}`);

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
            res.set('X-Source-Resolved-Cover-URL', coverExternalUrl); // Custom header for debugging the resolved URL
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
            console.error(`[Cover Resolution Fallback Error for ${source}/${id}]: Failed to retrieve default cover image:`, fallbackError.message);
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
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
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

// --- NEW HELPER FUNCTION FOR INTERNET ARCHIVE CONTENT RESOLUTION ---
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
            }
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

        // Map requested format to common Internet Archive file formats
        const formatMap = {
            'txt': ['DjVu text', 'Text', 'Plain Text'],
            'html': ['HTML', 'Animated GIF', 'JPEG', 'Image Container'], // HTML pages, or sometimes images that render as html
            'pdf': ['PDF'],
            'epub': ['EPUB'],
        };

        // Prioritize requested format
        const potentialFormats = formatMap[requestedFormat] || [];
        for (const iaFormat of potentialFormats) {
            const foundFile = files.find(file => file.format === iaFormat);
            if (foundFile && foundFile.name) {
                bestMatchUrl = `${downloadBaseUrl}${encodeURIComponent(foundFile.name)}`;
                cleanHtml = (iaFormat === 'HTML'); // Clean if it's an HTML page
                console.log(`[IA Resolver] Found direct match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                return { url: bestMatchUrl, cleanHtml };
            }
        }

        // Fallback: If specific format not found, try common text/html first, then pdf/epub
        const fallbackOrder = ['txt', 'epub', 'pdf', 'html']; // Ordered by general preference
        for (const formatKey of fallbackOrder) {
            if (formatKey === requestedFormat) continue; // Already tried exact match
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

        // Final fallback: If no specific file is found, link to the item's details page as HTML
        if (!bestMatchUrl) {
            bestMatchUrl = `https://archive.org/details/${iaIdentifier}`;
            cleanHtml = true; // Always clean if it's the main details page
            console.log(`[IA Resolver] No direct file found, falling back to item details page: ${bestMatchUrl}`);
            return { url: bestMatchUrl, cleanHtml };
        }

        return null; // Should ideally not reach here if fallbacks work
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
// This endpoint is used internally by /api/book/:source/:id/content
// It can also be called directly with a known URL.
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
            'Accept-Encoding': 'gzip, deflate',
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

        if (contentType.includes('application/pdf') || contentType.includes('application/epub+zip')) {
            const buffer = await response.arrayBuffer();
            res.set('Content-Length', buffer.byteLength.toString());
            return res.send(Buffer.from(buffer));
        }

        // IMPORTANT: This block prevents fetching images!
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


// --- NEW GENERAL PURPOSE IMAGE PROXY ENDPOINT ---
app.get('/api/fetch-image', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            error: 'Missing URL parameter',
            message: 'Please provide an image URL to fetch'
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

    console.log(`[Image Proxy] Attempting to fetch image: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for images

        const headers = {
            'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
            'Referer': req.headers.referer || 'https://xbook-hub.netlify.app', // Send referer if present or default
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
            return res.status(response.status).json({
                error: `HTTP ${response.status}`,
                message: `Failed to fetch image: ${response.statusText}`,
                url: url
            });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        // Only allow image content types
        if (!contentType.startsWith('image/')) {
            console.warn(`[Image Proxy] Unsupported content type for image: ${contentType} for URL: ${url}`);
            return res.status(400).json({
                error: 'Unsupported content type',
                message: `Content type ${contentType} is not an image.`,
                contentType: contentType
            });
        }

        console.log(`[Image Proxy] Successfully fetched image, Content-Type: ${contentType}`);

        res.set({
            'Content-Type': contentType,
            'Content-Length': response.headers.get('content-length'), // Pass through content length for efficiency
            'Cache-Control': 'public, max-age=86400', // Cache images for longer (24 hours)
            'X-Source-URL': url
        });

        // Pipe the image stream directly to the client
        response.body.pipe(res);

    } catch (error) {
        console.error('[Image Proxy Error]:', error);

        if (error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'The image request took too long to complete. Please try again.',
                url: url
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while fetching the image',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            url: url
        });
    }
});


// --- NEW ENDPOINT TO RESOLVE AND SERVE BOOK COVERS ---
app.get('/api/book/:source/:id/cover', async (req, res) => {
    const { source, id } = req.params;

    let coverUrl = null;

    try {
        console.log(`[Cover Resolver] Request for cover, source: "${source}", ID: "${id}"`);

        if (source === 'gutenberg') {
            const gutendexUrl = `https://gutendex.com/books/${id}/`;
            const response = await fetch(gutendexUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    return res.status(404).json({ error: `Gutenberg book with ID ${id} not found.` });
                }
                throw new Error(`Failed to fetch Gutenberg metadata: ${response.statusText}`);
            }
            const book = await response.json();
            // Gutendex often provides direct image links in formats
            // Look for common cover image types
            coverUrl = book.formats['image/jpeg'] || book.formats['image/png'] || book.formats['image/webp'];
            if (!coverUrl) {
                // Fallback to text/html with image, sometimes covers are linked within HTML
                const htmlUrl = book.formats['text/html'] || book.formats['text/html; charset=utf-8'];
                if (htmlUrl) {
                    console.warn(`[Cover Resolver] No direct image URL for Gutenberg ${id}, checking linked HTML: ${htmlUrl}`);
                    // You could fetch the HTML and try to parse it for an img tag.
                    // For simplicity, we'll note this is a limitation without complex parsing here.
                    // A more advanced solution would involve a library like 'cheerio' to extract <img> src.
                    // For now, if no direct image/jpeg, we assume no cover found.
                    // If you need to parse HTML for images, uncomment/implement the following:
                    // const htmlResponse = await fetch(htmlUrl);
                    // const htmlContent = await htmlResponse.text();
                    // const cheerio = require('cheerio');
                    // const $ = cheerio.load(htmlContent);
                    // coverUrl = $('img[alt="Cover image"]').attr('src') || $('img').first().attr('src');
                    // if (coverUrl && !coverUrl.startsWith('http')) {
                    //     coverUrl = new URL(coverUrl, htmlUrl).href; // Resolve relative URLs
                    // }
                }
            }
            console.log(`[Cover Resolver] Gutenberg cover URL: ${coverUrl}`);

        } else if (source === 'openlibrary') {
            // Open Library uses a separate covers API
            // It needs the OLID (Open Library ID for the book edition, not the work ID) or an ISBN.
            // For now, we will use the Work ID, but often covers are tied to Editions.
            // If the work itself doesn't yield a cover, you might need to find an edition.
            coverUrl = `https://covers.openlibrary.org/b/olid/${id}-M.jpg`; // -M for Medium, -L for Large, -S for Small
            console.log(`[Cover Resolver] Open Library cover URL (based on work ID): ${coverUrl}`);
            // To be more precise, you would need to fetch work.json -> editions -> then for each edition, get its OLID/ISBN.
            // e.g. https://openlibrary.org/works/OL158488W.json -> "first_publish_date": "1940" -> find an edition ID (OLID)
            // or fetch https://openlibrary.org/works/OL158488W/editions.json and pick one with a cover.
            // For simplicity, we're assuming the work ID *might* work for some covers, or this might be a placeholder.
            // A more robust solution might involve:
            // const workResponse = await fetch(`https://openlibrary.org/works/${id}.json`);
            // if (workResponse.ok) {
            //     const workData = await workResponse.json();
            //     const iaIdentifier = workData.ia_collection_id || workData.ia_loaded_id || workData.ia_id || workData.ocaid;
            //     if (iaIdentifier) { // Try Internet Archive cover if OL doesn't have it directly
            //        const iaCover = await getInternetArchiveCoverUrl(iaIdentifier); // A new helper similar to getInternetArchiveContentUrl
            //        if (iaCover) coverUrl = iaCover;
            //     }
            // }


        } else if (source === 'archive') {
            const iaIdentifier = id;
            const metadataUrl = `https://archive.org/metadata/${iaIdentifier}`;
            const response = await fetch(metadataUrl, {
                headers: { 'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)' }
            });
            if (response.ok) {
                const metadata = await response.json();
                const files = metadata.files || [];
                // Look for common thumbnail or cover image files
                const coverFile = files.find(file =>
                    file.name &&
                    (file.name.includes('thumb.jpg') ||
                     file.name.includes('cover.jpg') ||
                     file.name.includes('first_page.jpg')) &&
                    file.format === 'JPEG'
                );
                if (coverFile) {
                    coverUrl = `https://archive.org/download/${iaIdentifier}/${encodeURIComponent(coverFile.name)}`;
                } else {
                    // Fallback to a common pattern for IA thumbnails if no specific file found
                    coverUrl = `https://archive.org/services/img/thumb/${iaIdentifier}`;
                }
            }
            console.log(`[Cover Resolver] Internet Archive cover URL: ${coverUrl}`);

        } else {
            return res.status(400).json({ error: 'Unsupported book source for cover. Must be "gutenberg", "openlibrary", or "archive".' });
        }

        // If a coverUrl was successfully resolved, use the /api/fetch-image proxy
        if (coverUrl) {
            console.log(`[Cover Resolver] Proceeding to fetch cover via /api/fetch-image for: ${coverUrl}`);
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-image?url=${encodeURIComponent(coverUrl)}`;

            // Make an internal request to your new image proxy endpoint
            const proxyResponse = await fetch(internalProxyUrl);

            // Pipe the response directly back to the client
            res.status(proxyResponse.status);
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding' && name !== 'transfer-encoding') { // Avoid issues if content is gzipped by external server
                    res.set(name, value);
                }
            });
            res.set('X-Source-Resolved-Cover-URL', coverUrl);
            proxyResponse.body.pipe(res);
        } else {
            return res.status(404).json({ error: 'No cover found for this book.', source, id });
        }

    } catch (error) {
        console.error(`[Cover Resolution Error for ${source}/${id}]:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch book cover',
            message: 'An unexpected error occurred while resolving or fetching the cover',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            source: source,
            id: id
        });
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
            const response = await fetch(gutendexUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    return res.status(404).json({ error: `Gutenberg book with ID ${id} not found.` });
                }
                throw new Error(`Failed to fetch Gutenberg metadata: ${response.statusText}`);
            }
            const book = await response.json();
            const formats = book.formats || {};

            // Prioritize requested format
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

            // Fallback to a common text format if specific not found
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
            // Fetch Open Library Work details to find associated Internet Archive ID
            const openLibraryWorkUrl = `https://openlibrary.org/works/${id}.json`;
            console.log(`[Content Resolver] Fetching Open Library work details from: ${openLibraryWorkUrl}`);
            const workResponse = await fetch(openLibraryWorkUrl);

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
                // --- Use the new helper for IA content resolution ---
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
            // Assume 'id' is directly the Internet Archive Item ID
            const iaIdentifier = id;
            console.log(`[Content Resolver] Directly fetching from Internet Archive ID: ${iaIdentifier}`);

            // --- Use the new helper for IA content resolution ---
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

        // If a contentUrl was successfully resolved, use the /api/fetch-book proxy
        if (contentUrl) {
            console.log(`[Content Resolver] Proceeding to fetch content via /api/fetch-book for: ${contentUrl}`);
            const internalProxyUrl = `${req.protocol}://${req.get('host')}/api/fetch-book?url=${encodeURIComponent(contentUrl)}&clean=${cleanHtml}`;

            // Make an internal request to your own proxy endpoint
            const proxyResponse = await fetch(internalProxyUrl);

            // Pipe the response from the internal proxy call directly back to the client
            res.status(proxyResponse.status);
            proxyResponse.headers.forEach((value, name) => {
                if (name !== 'content-encoding') { // Avoid issues if content is gzipped by external server
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
    try {
        const path = req.params[0];
        const queryString = req.url.split('?')[1] || '';
        const url = `https://openlibrary.org/${path}${queryString ? '?' + queryString : ''}`;

        console.log(`[OL Metadata Proxy] Proxying Open Library request: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
                'Accept': 'application/json',
            }
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
            message: 'Failed to fetch from Open Library API'
        });
    }
});

// Proxy endpoint for Internet Archive API metadata
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
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Internet Archive API Error: ${response.status}`,
                message: response.statusText
            });
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            res.json(data);
        } else {
            const data = await response.text();
            res.set('Content-Type', contentType);
            res.send(data);
        }

    } catch (error) {
        console.error('[IA Metadata Proxy Error]:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: 'Failed to fetch from Internet Archive API'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.url} not found`
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Xbook-Hub Server running on http://localhost:${PORT}`);
    console.log(`📚 Content resolution endpoint: /api/book/:source/:id/content`);
    console.log(`🖼️  Cover image resolution endpoint: /api/book/:source/:id/cover`);
    console.log(`🔗 General URL proxy: /api/fetch-book?url=...`);
    console.log(`🖼️  General image proxy: /api/fetch-image?url=...`);
    console.log(`🔍 Metadata proxies: /api/openlibrary/* and /api/archive/*`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
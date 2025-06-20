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
                console.log(`[IA Content Resolver] Found direct match for ${requestedFormat} (${iaFormat}): ${bestMatchUrl}`);
                return { url: bestMatchUrl, cleanHtml };
            }
        }

        const fallbackOrder = ['txt', 'epub', 'pdf', 'html'];
        for (const formatKey of fallbackOrder) {
            if (formatKey === requestedFormat) continue;
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
            bestMatchUrl = `https://archive.org/details/${iaIdentifier}`;
            cleanHtml = true;
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
        services: ['Project Gutenberg', 'Open Library', 'Internet Archive', 'Google Books (fallback)']
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

        } else if (source === 'openlibrary') {
            console.log(`[Cover Resolver] Open Library: Processing ID "${id}"`);
            const openLibraryWorkUrl = `https://openlibrary.org/works/${id}.json`; // Fetch work metadata to get title/author
            try {
                const workResponse = await fetch(openLibraryWorkUrl, { timeout: 10000 });
                if (workResponse.ok) {
                    const workData = await workResponse.json();
                    bookTitle = workData.title;
                    if (workData.authors && workData.authors.length > 0 && workData.authors[0].author) {
                        // For Open Library, authors often come as { key: '/authors/OL...' }
                        // You might need an extra fetch to resolve the author's name if not directly available.
                        // For simplicity, we'll try to get it directly if possible or skip.
                        try {
                             const authorKey = workData.authors[0].author.key;
                             const authorResponse = await fetch(`https://openlibrary.org${authorKey}.json`, { timeout: 5000 });
                             if (authorResponse.ok) {
                                 const authorData = await authorResponse.json();
                                 bookAuthor = authorData.name;
                             }
                        } catch (authorError) {
                            console.warn(`[Cover Resolver] OL: Could not fetch author name for ${id}:`, authorError.message);
                        }
                    }
                    console.log(`[Cover Resolver] Open Library: Metadata found. Title: "${bookTitle}", Author: "${bookAuthor}"`);
                } else {
                    console.warn(`[Cover Resolver] OL: Failed to fetch work metadata for ID ${id}: ${workResponse.status}`);
                }
            } catch (error) {
                console.error(`[Cover Resolver] OL: Error fetching work metadata for ID ${id}:`, error.message);
            }

            if (!isNaN(Number(id))) {
                coverExternalUrl = `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
                console.log(`[Cover Resolver] Open Library: Resolved cover from numeric ID: ${coverExternalUrl}`);
            } else if (id.startsWith('OL')) {
                coverExternalUrl = `https://covers.openlibrary.org/b/olid/${id}-L.jpg`;
                console.log(`[Cover Resolver] Open Library: Resolved cover from OLID/Work ID: ${coverExternalUrl}`);
            } else {
                console.warn(`[Cover Resolver] Open Library: ID "${id}" is not a direct numeric cover ID or OLID. Cannot construct direct cover URL.`);
            }
            console.log(`[Cover Resolver] Open Library: Final resolved coverExternalUrl (before Google fallback): ${coverExternalUrl}`);

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
                            (file.format === 'JPEG' && files.length < 20) ||
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

            // Fallback 1 (Open Library search for IA books):
            if (!coverExternalUrl && bookTitle) { // Only try OL fallback if we have a title from IA
                console.log(`[Cover Resolver] Internet Archive: IA cover not found for ${iaIdentifier}. Attempting Open Library fallback...`);
                let olSearchQuery = `title=${encodeURIComponent(bookTitle)}`;
                if (bookAuthor) {
                    olSearchQuery += `&author=${encodeURIComponent(bookAuthor)}`;
                }

                const olSearchUrl = `https://openlibrary.org/search.json?${olSearchQuery}&limit=1`;
                console.log(`[Cover Resolver] Internet Archive: Searching Open Library for: ${olSearchUrl}`);
                try {
                    const olSearchResponse = await fetch(olSearchUrl, { timeout: 7000 });
                    if (olSearchResponse.ok) {
                        const olSearchData = await olSearchResponse.json();
                        if (olSearchData.docs && olSearchData.docs.length > 0) {
                            const firstMatch = olSearchData.docs[0];
                            if (firstMatch.cover_i) {
                                coverExternalUrl = `https://covers.openlibrary.org/b/id/${firstMatch.cover_i}-L.jpg`;
                                console.log(`[Cover Resolver] Internet Archive: Found Open Library cover via search for IA book ${iaIdentifier}: ${coverExternalUrl}`);
                            } else if (firstMatch.key) {
                                const olWorkId = firstMatch.key.split('/').pop();
                                coverExternalUrl = `https://covers.openlibrary.org/b/olid/${olWorkId}-L.jpg`;
                                console.log(`[Cover Resolver] Internet Archive: Found Open Library cover (via work ID) for IA book ${iaIdentifier}: ${coverExternalUrl}`);
                            } else {
                                console.warn(`[Cover Resolver] Internet Archive: Open Library search found match but no cover_i or key.`);
                            }
                        } else {
                            console.warn(`[Cover Resolver] Internet Archive: No matching book found on Open Library.`);
                        }
                    } else {
                        console.warn(`[Cover Resolver] Internet Archive: Failed to search Open Library: ${olSearchResponse.status}`);
                    }
                } catch (error) {
                    console.error(`[Cover Resolver] Internet Archive: Error during Open Library fallback: ${error.message}`);
                }
            }
            console.log(`[Cover Resolver] Internet Archive: Final resolved coverExternalUrl (before Google fallback): ${coverExternalUrl}`);

        } else {
            console.warn(`[Cover Resolver] ERROR: Unsupported source: ${source}`);
            return res.status(400).json({ error: 'Unsupported book source for cover. Must be "gutenberg", "openlibrary", or "archive".' });
        }

        // --- Google Books API Fallback ---
        if (!coverExternalUrl && bookTitle) {
            console.log(`[Cover Resolver] No cover found from primary sources. Attempting Google Books API fallback for "${bookTitle}" by "${bookAuthor || 'Unknown Author'}"`);
            let googleSearchQuery = `intitle:"${encodeURIComponent(bookTitle)}"`;
            if (bookAuthor) {
                googleSearchQuery += `+inauthor:"${encodeURIComponent(bookAuthor)}"`;
            }

            const googleBooksApiUrl = `https://www.googleapis.com/books/v1/volumes?q=${googleSearchQuery}&maxResults=1&printType=books&fields=items(volumeInfo/imageLinks,volumeInfo/industryIdentifiers)`;
            console.log(`[Cover Resolver] Google Books: Searching API: ${googleBooksApiUrl}`);

            try {
                const googleResponse = await fetch(googleBooksApiUrl, { timeout: 7000 });
                if (googleResponse.ok) {
                    const googleData = await googleResponse.json();
                    if (googleData.items && googleData.items.length > 0) {
                        const volumeInfo = googleData.items[0].volumeInfo;
                        const imageLinks = volumeInfo.imageLinks;

                        if (imageLinks) {
                            // Prioritize larger sizes
                            coverExternalUrl = imageLinks.medium || imageLinks.large || imageLinks.thumbnail || imageLinks.smallThumbnail;
                            console.log(`[Cover Resolver] Google Books: Found cover: ${coverExternalUrl}`);
                        } else {
                            console.warn(`[Cover Resolver] Google Books: No imageLinks found for "${bookTitle}".`);
                        }
                    } else {
                        console.warn(`[Cover Resolver] Google Books: No results found for "${bookTitle}"`);
                    }
                } else {
                    console.warn(`[Cover Resolver] Google Books: API error: ${googleResponse.status} ${googleResponse.statusText}`);
                }
            } catch (googleError) {
                console.error(`[Cover Resolver] Google Books: Error during API call: ${googleError.message}`);
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


// Main endpoint to resolve book ID to content URL and then fetch it (NO CHANGES TO THIS LOGIC)
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
            timeout: 15000
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

// START THE SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS enabled for origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
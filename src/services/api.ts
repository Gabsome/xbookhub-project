import { BooksApiResponse, Book, OpenLibraryWork, OpenLibraryAuthor, ArchiveSearchResponse, ArchiveItem } from '../types';

// Your backend base URL from environment variable, fallback to localhost for local development
const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL || 'http://localhost:3001';

// External API base URLs (used to construct the URL passed to your content proxy)
const GUTENBERG_EXTERNAL_BASE = 'https://gutendex.com';

/**
 * Enhanced fetch with retry logic and better error handling for all API calls.
 * @param url The URL to fetch.
 * @param options RequestInit options for the fetch call.
 * @param retries Number of retries before giving up.
 * @returns A Promise that resolves with the Response object.
 */
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            // Set a timeout for the fetch request. If it exceeds 20 seconds, abort.
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            // Define default headers, including Content-Type and a User-Agent for better identification.
            const defaultHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
            };

            // Merge default headers with any custom headers provided in options.
            let combinedHeaders: HeadersInit = { ...defaultHeaders };
            if (options.headers) {
                if (Array.isArray(options.headers)) {
                    // If headers are an array of [key, value] pairs
                    combinedHeaders = [...Object.entries(defaultHeaders), ...options.headers];
                } else if (options.headers instanceof Headers) {
                    // If headers are a Headers object
                    combinedHeaders = options.headers;
                    // Add default headers if they don't already exist in the provided Headers object
                    for (const [key, value] of Object.entries(defaultHeaders)) {
                        if (!(combinedHeaders as Headers).has(key)) {
                            (combinedHeaders as Headers).set(key, value);
                        }
                    }
                } else {
                    // If headers are a plain object (Record<string, string>)
                    combinedHeaders = { ...defaultHeaders, ...options.headers as Record<string, string> };
                }
            }

            // Perform the fetch request with combined options.
            const response = await fetch(url, {
                ...options,
                signal: controller.signal, // Abort controller signal
                headers: combinedHeaders, // Use the combined headers
            });

            // Clear the timeout as the request has completed
            clearTimeout(timeoutId);

            // If response is OK (status 200-299), return it
            if (response.ok) {
                return response;
            }

            // If it's a server error (5xx) and not the last retry, wait and then continue to next retry
            if (response.status >= 500 && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1))); // Exponential backoff
                continue;
            }

            // For other non-OK responses or last retry, throw an error
            throw new Error(`HTTP ${response.status}: ${response.statusText} for URL: ${url}`);
        } catch (error) {
            console.error(`Fetch attempt ${i + 1} failed for ${url}:`, error);
            if (i === retries - 1) { // If it's the last attempt, re-throw the error
                throw error;
            }
            // Wait before the next retry (if not the last attempt)
            await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
        }
    }
    // If all retries fail, throw a final error
    throw new Error('Max retries exceeded');
};

/**
 * Helper function to route content requests through the backend's `/api/fetch-book` proxy.
 * This proxy is essential for bypassing CORS issues when fetching content from external sources.
 *
 * @param externalUrl The full external URL of the resource to fetch (e.g., a Gutenberg TXT file URL).
 * @param cleanHtml Optional. If true, adds `clean=true` to the proxy request. This tells the backend
 * to attempt to strip HTML tags and return plain text. Useful for PDF generation
 * or reading modes that don't need rich HTML. Defaults to `false`.
 * @param options Standard RequestInit options to pass to the fetch call.
 * @returns A Promise that resolves with the Response object from the backend proxy.
 */
const fetchContentViaProxy = async (externalUrl: string, cleanHtml: boolean = false, options: RequestInit = {}): Promise<Response> => {
    // Construct the proxy URL, encoding the external URL and adding the 'clean' parameter.
    const proxyRequestUrl = `${API_BASE_URL}/fetch-book?url=${encodeURIComponent(externalUrl)}&clean=${cleanHtml}`;
    return fetchWithRetry(proxyRequestUrl, options);
};

// --- API Functions for various Book Sources ---

/**
 * Fetches a list of books from Project Gutenberg via Gutendex API.
 * @param page The page number to fetch.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const fetchGutenbergBooks = async (page = 1): Promise<BooksApiResponse> => {
    try {
        // Direct fetch to Gutendex as it's typically CORS-friendly for metadata.
        // If your setup requires all external calls to go through your backend proxy,
        // you would use `fetchContentViaProxy` here.
        const response = await fetchWithRetry(`${GUTENBERG_EXTERNAL_BASE}/books?page=${page}`);
        const data = await response.json();
        return {
            ...data,
            source: 'gutenberg',
            results: data.results.map((book: any) => ({
                ...book,
                source: 'gutenberg'
            }))
        };
    } catch (error) {
        console.error('Error fetching Gutenberg books:', error);
        throw new Error('Failed to fetch books from Project Gutenberg.');
    }
};

/**
 * Searches for books on Project Gutenberg via Gutendex API.
 * @param query The search query string.
 * @param page The page number to fetch.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const searchGutenbergBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
    try {
        const response = await fetchWithRetry(`${GUTENBERG_EXTERNAL_BASE}/books?search=${encodeURIComponent(query)}&page=${page}`);
        const data = await response.json();
        return {
            ...data,
            source: 'gutenberg',
            results: data.results.map((book: any) => ({
                ...book,
                source: 'gutenberg'
            }))
        };
    } catch (error) {
        console.error('Error searching Gutenberg books:', error);
        throw new Error('Failed to search books in Project Gutenberg.');
    }
};

/**
 * Fetches a list of books from Open Library via your backend proxy.
 * This proxies the Open Library Search API.
 * @param page The page number to fetch.
 * @param limit The number of results per page.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const fetchOpenLibraryBooks = async (page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        // The 'page' variable IS used here to calculate the 'offset'.
        // The TypeScript warning "'page' is declared but its value is never read." is a false positive from some linters.
        const offset = (page - 1) * limit;
        const response = await fetchWithRetry(
            `${API_BASE_URL}/openlibrary/search.json?q=*&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`
        );
        const data = await response.json();

        // Convert Open Library specific response format to your generic Book interface
        const books = await Promise.all(
            data.docs.slice(0, limit).map(async (doc: any) => await convertOpenLibraryToBook(doc))
        );

        return {
            count: data.numFound || 0,
            next: data.numFound > offset + limit ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: books.filter(book => book !== null), // Filter out any nulls from conversion failures
            source: 'openlibrary'
        };
    } catch (error) {
        console.error('Error fetching Open Library books via proxy:', error);
        throw new Error('Failed to fetch books from Open Library via server.');
    }
};

/**
 * Searches for books on Open Library via your backend proxy.
 * @param query The search query string.
 * @param page The page number to fetch.
 * @param limit The number of results per page.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const searchOpenLibraryBooks = async (query: string, page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        const offset = (page - 1) * limit;
        const response = await fetchWithRetry(
            `${API_BASE_URL}/openlibrary/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`
        );
        const data = await response.json();

        const books = await Promise.all(
            data.docs.slice(0, limit).map(async (doc: any) => await convertOpenLibraryToBook(doc))
        );

        return {
            count: data.numFound || 0,
            next: data.numFound > offset + limit ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: books.filter(book => book !== null),
            source: 'openlibrary'
        };
    } catch (error) {
        console.error('Error searching Open Library books via proxy:', error);
        throw new Error('Failed to search books in Open Library via server.');
    }
};

/**
 * Fetches a list of books from Internet Archive via your backend proxy.
 * This proxies the Internet Archive's Advanced Search API.
 * @param page The page number to fetch.
 * @param limit The number of results per page.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const fetchArchiveBooks = async (page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        const response = await fetchWithRetry(
            `${API_BASE_URL}/archive/advancedsearch.php?q=collection:opensource AND mediatype:texts AND format:pdf&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`
        );
        const data: ArchiveSearchResponse = await response.json();

        const books = await Promise.all(
            data.response.docs.map(async (doc: ArchiveItem) => await convertArchiveToBook(doc))
        );

        return {
            count: data.response.numFound || 0,
            next: data.response.numFound > (page * limit) ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: books.filter(book => book !== null),
            source: 'archive'
        };
    } catch (error) {
        console.error('Error fetching Archive books via proxy:', error);
        throw new Error('Failed to fetch books from Internet Archive via server.');
    }
};

/**
 * Searches for books on Internet Archive via your backend proxy.
 * @param query The search query string.
 * @param page The page number to fetch.
 * @param limit The number of results per page.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const searchArchiveBooks = async (query: string, page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        const response = await fetchWithRetry(
            `${API_BASE_URL}/archive/advancedsearch.php?q=${encodeURIComponent(query)} AND collection:opensource AND mediatype:texts&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`
        );
        const data: ArchiveSearchResponse = await response.json();

        const books = await Promise.all(
            data.response.docs.map(async (doc: ArchiveItem) => await convertArchiveToBook(doc))
        );

        return {
            count: data.response.numFound || 0,
            next: data.response.numFound > (page * limit) ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: books.filter(book => book !== null),
            source: 'archive'
        };
    } catch (error) {
        console.error('Error searching Archive books via proxy:', error);
        throw new Error('Failed to search books in Internet Archive via server.');
    }
};

/**
 * Fetches a combined list of books from all available sources.
 * This aggregates results from Gutenberg, Open Library, and Internet Archive.
 * @param page The page number for pagination across all sources.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
    try {
        // Use Promise.allSettled to handle potential individual source failures gracefully.
        const [gutenbergBooks, openLibraryBooks, archiveBooks] = await Promise.allSettled([
            fetchGutenbergBooks(page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'gutenberg' as const })),
            fetchOpenLibraryBooks(page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'openlibrary' as const })),
            fetchArchiveBooks(page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'archive' as const }))
        ]);

        const allBooks: Book[] = [];
        let totalCount = 0;

        // Collect results from fulfilled promises
        if (gutenbergBooks.status === 'fulfilled') {
            allBooks.push(...gutenbergBooks.value.results);
            totalCount += gutenbergBooks.value.count;
        }

        if (openLibraryBooks.status === 'fulfilled') {
            allBooks.push(...openLibraryBooks.value.results);
            totalCount += openLibraryBooks.value.count;
        }

        if (archiveBooks.status === 'fulfilled') {
            allBooks.push(...archiveBooks.value.results);
            totalCount += archiveBooks.value.count;
        }

        // Shuffle and slice to get a diverse set of results
        const shuffledBooks = allBooks.sort(() => Math.random() - 0.5).slice(0, 20);

        return {
            count: totalCount,
            next: totalCount > page * 20 ? `page=${page + 1}` : null, // Simple pagination logic
            previous: page > 1 ? `page=${page - 1}` : null,
            results: shuffledBooks,
            source: 'gutenberg' // Default source for combined results
        };
    } catch (error) {
        console.error('Error fetching combined books:', error);
        throw new Error('Failed to fetch books from all sources.');
    }
};

/**
 * Searches for books across all available sources.
 * @param query The search query string.
 * @param page The page number for pagination.
 * @returns A Promise resolving to a BooksApiResponse.
 */
export const searchBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
    try {
        const [gutenbergBooks, openLibraryBooks, archiveBooks] = await Promise.allSettled([
            searchGutenbergBooks(query, page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'gutenberg' as const })),
            searchOpenLibraryBooks(query, page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'openlibrary' as const })),
            searchArchiveBooks(query, page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'archive' as const }))
        ]);

        const allBooks: Book[] = [];
        let totalCount = 0;

        if (gutenbergBooks.status === 'fulfilled') {
            allBooks.push(...gutenbergBooks.value.results);
            totalCount += gutenbergBooks.value.count;
        }

        if (openLibraryBooks.status === 'fulfilled') {
            allBooks.push(...openLibraryBooks.value.results);
            totalCount += openLibraryBooks.value.count;
        }

        if (archiveBooks.status === 'fulfilled') {
            allBooks.push(...archiveBooks.value.results);
            totalCount += archiveBooks.value.count;
        }

        // Sort by relevance (e.g., if query is in title) then slice
        const sortedBooks = allBooks.sort((a, b) => {
            const aInTitle = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            const bInTitle = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            return bInTitle - aInTitle; // Books with query in title come first
        });

        return {
            count: totalCount,
            next: totalCount > page * 20 ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: sortedBooks.slice(0, 20), // Return top 20 relevant results
            source: 'gutenberg' // Default source for combined results
        };
    } catch (error) {
        console.error('Error searching combined books:', error);
        throw new Error('Failed to search books from all sources.');
    }
};

/**
 * Fetches detailed information for a single book by its ID from any source.
 * This function attempts to fetch from Gutenberg, Open Library, then Internet Archive.
 * @param id The ID of the book (number for Gutenberg, string for OL/IA identifiers).
 * @returns A Promise resolving to a Book object.
 */
export const fetchBookById = async (id: number | string): Promise<Book> => {
    try {
        // Try Gutenberg first if the ID format suggests it (numeric)
        if (typeof id === 'number' || /^\d+$/.test(id.toString())) {
            try {
                // Gutendex API is usually directly accessible for metadata lookup
                const response = await fetchWithRetry(`${GUTENBERG_EXTERNAL_BASE}/books/${id}`);
                const book = await response.json();
                return { ...book, source: 'gutenberg' };
            } catch (error) {
                console.warn('Book not found in Gutenberg via direct fetch, trying Open Library and Internet Archive...');
            }
        }

        // Then try Open Library if ID format suggests it (e.g., /works/OL123W or OL123W)
        if (id.toString().startsWith('/works/') || id.toString().startsWith('OL')) {
            try {
                // Open Library metadata should be fetched via your backend proxy
                const olKey = id.toString().startsWith('/') ? id : `/works/${id}`;
                const response = await fetchWithRetry(`${API_BASE_URL}/openlibrary${olKey}.json`);
                const work = await response.json();
                return await convertOpenLibraryWorkToBook(work);
            } catch (error) {
                console.warn('Book not found in Open Library via proxy...');
            }
        }

        // Finally, try Internet Archive for other IDs (often strings)
        try {
            // Internet Archive metadata should be fetched via your backend proxy
            const response = await fetchWithRetry(`${API_BASE_URL}/archive/metadata/${id}`);
            const metadata = await response.json();
            return await convertArchiveMetadataToBook(metadata);
        } catch (error) {
            console.warn('Book not found in Internet Archive via proxy...');
        }

        // If none of the above succeed, throw an error
        throw new Error('Book not found in any source');
    } catch (error) {
        console.error('Error fetching book details via proxy:', error);
        throw new Error('Failed to fetch book details via server. Please check your internet connection and try again.');
    }
};

// --- Helper Functions for Data Conversion ---

/**
 * Converts a raw Open Library search result document to a standardized Book object.
 * @param doc The raw document object from Open Library search response.
 * @returns A Promise resolving to a Book object or null if conversion fails.
 */
const convertOpenLibraryToBook = async (doc: any): Promise<Book | null> => {
    try {
        const book: Book = {
            id: doc.key || `ol_${doc.cover_edition_key || Math.random().toString()}`, // Fallback ID
            title: doc.title || 'Unknown Title',
            authors: doc.author_name ? doc.author_name.map((name: string) => ({ name })) : [{ name: 'Unknown Author' }],
            subjects: doc.subject || [],
            formats: {
                // Common IA links for OL books. These might lead to PDF/HTML content.
                'text/html': doc.ia && doc.ia.length > 0 ? `https://archive.org/details/${doc.ia[0]}` : undefined,
                'application/pdf': doc.ia && doc.ia.length > 0 ? `https://archive.org/download/${doc.ia[0]}/${doc.ia[0]}.pdf` : undefined,
            },
            download_count: 0, // Open Library search results don't always provide download counts directly
            source: 'openlibrary',
            isbn: doc.isbn || [],
            publish_date: doc.first_publish_year ? doc.first_publish_year.toString() : undefined,
            publisher: doc.publisher || [],
            description: doc.first_sentence ? doc.first_sentence.join(' ') : undefined,
            cover_id: doc.cover_i, // Cover image ID
            ia_identifier: doc.ia && doc.ia.length > 0 ? doc.ia[0] : undefined, // Internet Archive identifier if linked
            language: doc.language || ['en']
        };

        // Add cover URL if cover_i is available
        if (doc.cover_i) {
            book.formats['image/jpeg'] = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }

        return book;
    } catch (error) {
        console.warn('Error converting Open Library book:', error);
        return null; // Return null on conversion failure
    }
};

/**
 * Converts a raw Open Library Work object (from /works/:key.json) to a standardized Book object.
 * This also fetches author details for richer information.
 * @param work The raw Work object from Open Library.
 * @returns A Promise resolving to a Book object.
 */
const convertOpenLibraryWorkToBook = async (work: OpenLibraryWork): Promise<Book> => {
    const book: Book = {
        id: work.key,
        title: work.title,
        authors: [], // Will be populated below
        subjects: work.subjects || [],
        formats: {}, // Will be populated below
        download_count: 0, // Not available directly from Work API
        source: 'openlibrary',
        description: typeof work.description === 'string' ? work.description : work.description?.value,
        cover_id: work.covers?.[0], // First cover ID
        publish_date: work.first_publish_date,
        language: ['en'] // Default language, refine if more info available
    };

    // Fetch author information for each author reference
    if (work.authors && work.authors.length > 0) {
        try {
            const authorPromises = work.authors.map(async (authorRef) => {
                try {
                    // Fetch individual author details via backend proxy
                    const authorResponse = await fetchWithRetry(`${API_BASE_URL}/openlibrary${authorRef.author.key}.json`);
                    const author: OpenLibraryAuthor = await authorResponse.json();
                    return {
                        name: author.name,
                        birth_year: author.birth_date ? parseInt(author.birth_date) : undefined,
                        death_year: author.death_date ? parseInt(author.death_date) : undefined,
                        key: author.key
                    };
                } catch (error) {
                    console.warn(`Could not fetch author details for ${authorRef.author.key}:`, error);
                    return { name: 'Unknown Author' }; // Fallback author
                }
            });
            book.authors = await Promise.all(authorPromises);
        } catch (error) {
            console.error('Error fetching Open Library authors:', error);
            book.authors = [{ name: 'Unknown Author' }]; // Fallback if author fetching fails
        }
    } else {
        book.authors = [{ name: 'Unknown Author' }];
    }

    // Add cover URL if available
    if (work.covers && work.covers.length > 0) {
        book.formats['image/jpeg'] = `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`;
    }

    return book;
};

/**
 * Converts a raw Internet Archive search result item to a standardized Book object.
 * @param item The raw ArchiveItem object from Internet Archive search response.
 * @returns A Promise resolving to a Book object or null if conversion fails.
 */
const convertArchiveToBook = async (item: ArchiveItem): Promise<Book | null> => {
    // Ensure essential fields exist
    if (!item.identifier || !item.title) {
        return null;
    }

    const book: Book = {
        id: item.identifier,
        title: item.title,
        authors: item.creator ?
            (Array.isArray(item.creator) ? item.creator.map(name => ({ name })) : [{ name: item.creator }]) :
            [{ name: 'Unknown Author' }],
        subjects: item.subject ? (Array.isArray(item.subject) ? item.subject : [item.subject]) : [],
        formats: {
            // Standard IA links for content
            'text/html': `https://archive.org/details/${item.identifier}`,
            'application/pdf': `https://archive.org/download/${item.identifier}/${item.identifier}.pdf`
        },
        download_count: item.downloads || 0,
        source: 'archive',
        ia_identifier: item.identifier,
        publish_date: item.date,
        publisher: item.publisher ? (Array.isArray(item.publisher) ? item.publisher : [item.publisher]) : [],
        description: item.description,
        language: item.language ? (Array.isArray(item.language) ? item.language : [item.language]) : ['en']
    };

    // Add Internet Archive cover image directly
    book.formats['image/jpeg'] = `https://archive.org/services/img/${item.identifier}`;

    return book;
};

/**
 * Converts a raw Internet Archive full metadata response to a standardized Book object.
 * This is used when fetching a book's details directly by its IA identifier.
 * @param metadata The raw metadata object from Internet Archive's /metadata/:id endpoint.
 * @returns A Promise resolving to a Book object.
 */
const convertArchiveMetadataToBook = async (metadata: any): Promise<Book> => {
    // NOTE: The structure of Internet Archive's /metadata/:id endpoint can be complex.
    // This implementation assumes a common structure for 'metadata' field.
    // Adjust paths (e.g., `metadata.metadata?.identifier`) based on your backend's proxy response.
    const book: Book = {
        id: metadata.metadata?.identifier || 'unknown_id',
        title: metadata.metadata?.title || 'Unknown Title',
        authors: metadata.metadata?.creator ?
            (Array.isArray(metadata.metadata.creator) ? metadata.metadata.creator.map((name: string) => ({ name })) : [{ name: metadata.metadata.creator }]) :
            [{ name: 'Unknown Author' }],
        subjects: metadata.metadata?.subject ? (Array.isArray(metadata.metadata.subject) ? metadata.metadata.subject : [metadata.metadata.subject]) : [],
        formats: {
            'text/html': `https://archive.org/details/${metadata.metadata?.identifier}`,
            'application/pdf': `https://archive.org/download/${metadata.metadata?.identifier}/${metadata.metadata?.identifier}.pdf`
        },
        download_count: parseInt(metadata.metadata?.downloads || '0'),
        source: 'archive',
        ia_identifier: metadata.metadata?.identifier,
        publish_date: metadata.metadata?.date,
        publisher: metadata.metadata?.publisher ? (Array.isArray(metadata.metadata.publisher) ? metadata.metadata.publisher : [metadata.metadata.publisher]) : [],
        description: metadata.metadata?.description,
        language: metadata.metadata?.language ? (Array.isArray(metadata.metadata.language) ? metadata.metadata.language : [metadata.metadata.language]) : ['en']
    };

    book.formats['image/jpeg'] = `https://archive.org/services/img/${metadata.metadata?.identifier}`;

    return book;
};

/**
 * Fetches book content for reading display or PDF generation.
 * This function routes the request through your backend proxy which handles fetching
 * from the actual external content source and applying cleaning if requested.
 *
 * @param book The book object containing its source and identifier.
 * @param format The desired content format (e.g., 'txt', 'html'). Note: For binary formats like PDF,
 * this function will throw an error as it expects string content; use `downloadBookAsFile`.
 * @param cleanHtml Optional. If `true`, tells the backend to aggressively strip HTML tags
 * and return plain text content. Useful for text-only PDF generation. Defaults to `false`.
 * @returns A Promise that resolves with the book content as a string.
 */
export const fetchBookContent = async (book: Book, format: 'txt' | 'html' | 'pdf' | 'epub' = 'html', cleanHtml: boolean = false): Promise<string> => {
    try {
        let externalContentUrl = '';

        // Determine the best external URL to fetch for content based on the book's source and available formats.
        // The backend proxy will then handle the actual fetching and potential format conversion/cleaning.
        if (book.source === 'gutenberg') {
            // Gutenberg books often have direct HTML or TXT links in formats.
            if (book.formats['text/html']) {
                externalContentUrl = book.formats['text/html'];
            } else if (book.formats['text/plain']) {
                externalContentUrl = book.formats['text/plain'];
            } else {
                throw new Error('No readable HTML or plain text format found for this Gutenberg book.');
            }
        } else if ((book.source === 'openlibrary' || book.source === 'archive') && book.ia_identifier) {
            // For Open Library books linked to Internet Archive, or direct Internet Archive books,
            // use the IA identifier base URL. The backend proxy can then resolve content from there.
            externalContentUrl = `https://archive.org/details/${book.ia_identifier}`;
        } else {
            // Fallback for other sources or if specific formats aren't linked via ia_identifier directly.
            // Prioritize HTML, then plain text.
            if (book.formats['text/html']) {
                externalContentUrl = book.formats['text/html'];
            } else if (book.formats['text/plain']) {
                externalContentUrl = book.formats['text/plain'];
            } else {
                throw new Error('No readable content format available for this book.');
            }
        }

        console.log(`[API Service] Requesting book content via proxy for: ${externalContentUrl}, format: ${format}, cleanHtml: ${cleanHtml}`);
        // Route through the content proxy with the determined external URL,
        // and pass the `cleanHtml` parameter to the backend.
        const response = await fetchContentViaProxy(externalContentUrl, cleanHtml);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { message: response.statusText || 'Unknown error occurred while fetching content' };
            }
            console.error('Error fetching book content:', errorData);
            throw new Error(errorData.message || `Failed to fetch book content from ${book.source}`);
        }

        const contentType = response.headers.get('Content-Type');

        // Check if the response content type is binary (like PDF/EPUB).
        // This function is for text content; binary files should be handled by `downloadBookAsFile`.
        if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/epub+zip'))) {
            throw new Error(`Binary content type (${contentType}) not parseable as text by fetchBookContent. Please use downloadBookAsFile for direct downloads.`);
        }

        const content = await response.text();

        if (!content || content.trim().length === 0) {
            throw new Error('Book content is empty or unavailable');
        }

        return content;
    } catch (error) {
        console.error('[API Service] Error in fetchBookContent:', error);
        throw error;
    }
};

/**
 * Initiates a direct file download by fetching content from the backend proxy and creating a Blob.
 * This is used for downloading TXT, HTML, PDF, or EPUB files directly to the user's device.
 * It does NOT attempt to clean HTML, ensuring the original file is downloaded.
 *
 * @param book The book object.
 * @param format The desired file format ('txt', 'html', 'pdf', 'epub').
 */
export const downloadBookAsFile = async (book: Book, format: 'txt' | 'html' | 'pdf' | 'epub' = 'txt'): Promise<void> => {
    try {
        let downloadUrl = '';
        let fileExtension = format; // Default file extension

        // Determine the most appropriate URL for the requested format.
        // Prioritize specific formats if available.
        if (format === 'pdf' && book.formats['application/pdf']) {
            downloadUrl = book.formats['application/pdf'];
        } else if (format === 'html' && book.formats['text/html']) {
            downloadUrl = book.formats['text/html'];
        } else if (format === 'txt' && book.formats['text/plain']) {
            downloadUrl = book.formats['text/plain'];
        } else if (format === 'epub' && book.formats['application/epub+zip']) {
            downloadUrl = book.formats['application/epub+zip'];
        } else {
            // Fallback: If the exact format isn't found, try to get a text or HTML version,
            // defaulting to .txt if neither is explicitly available or if it's the 'txt' request.
            downloadUrl = book.formats['text/plain'] || book.formats['text/html'] || '';
            if (downloadUrl.includes('.html')) {
                fileExtension = 'html';
            } else {
                fileExtension = 'txt';
            }
        }

        if (!downloadUrl) {
            throw new Error(`${format.toUpperCase()} format not explicitly available for this book, and no suitable fallback found.`);
        }

        console.log(`[API Service] Requesting file download via proxy for: ${downloadUrl}, format: ${format}`);
        // Route through the content proxy. `cleanHtml` is explicitly `false` here,
        // as we want the raw file for download, not stripped text.
        const response = await fetchContentViaProxy(downloadUrl, false);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { message: response.statusText || 'Unknown error occurred during download' };
            }
            throw new Error(errorData.message || `Failed to initiate download for ${format.toUpperCase()}`);
        }

        const blob = await response.blob(); // Get the content as a Blob

        // Create a temporary URL for the Blob and trigger download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Clean the book title for a friendly filename
        const cleanTitle = book.title.replace(/[^a-zA-Z0-9\s]/gi, '').replace(/\s+/g, '_').toLowerCase();
        link.download = `${cleanTitle}.${fileExtension}`; // Set the download filename

        // Append to body, click, and remove to initiate download without visible element
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revoke the object URL to free up memory
        window.URL.revokeObjectURL(url);

        console.log(`File "${link.download}" downloaded successfully.`);
    } catch (error) {
        console.error(`Error downloading book as ${format}:`, error);
        throw new Error(`Failed to download book as ${format.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// No direct change to downloadBookAsPDF here, as it calls downloadBookAsFile
// and should function correctly if downloadBookAsFile is robust.

// --- Local Storage Management for Saved/Offline Books (Client-side persistence) ---

/**
 * Saves a book to the user's local storage for "saved books".
 * In a real application, this would typically interact with a backend database (e.g., Firestore).
 * @param book The Book object to save.
 * @param userId The ID of the current user.
 * @returns A Promise that resolves when the book is saved.
 */
export const saveBook = async (book: Book, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);

    // Prevent saving duplicates
    const isAlreadySaved = savedBooks.some(savedBook => savedBook.id === book.id);

    if (!isAlreadySaved) {
        const bookToSave = {
            ...book,
            savedAt: new Date().toISOString(), // Record when it was saved
        };
        const updatedBooks = [...savedBooks, bookToSave];
        localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
    }
    console.log(`Book "${book.title}" saved for user ${userId}.`);
};

/**
 * Retrieves a list of books saved by a specific user from local storage.
 * @param userId The ID of the current user.
 * @returns An array of Book objects saved by the user.
 */
export const getSavedBooks = (userId: string): Book[] => {
    const saved = localStorage.getItem(`xbook-saved-${userId}`);
    try {
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Error parsing saved books from localStorage:', e);
        return [];
    }
};

/**
 * Removes a book from the user's saved books in local storage.
 * @param bookId The ID of the book to remove.
 * @param userId The ID of the current user.
 * @returns A Promise that resolves when the book is removed.
 */
export const removeSavedBook = async (bookId: number | string, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    const updatedBooks = savedBooks.filter(book => book.id !== bookId);
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
    console.log(`Book with ID ${bookId} removed from saved for user ${userId}.`);
};

/**
 * Updates a user's note for a specific saved book in local storage.
 * @param bookId The ID of the book to update the note for.
 * @param userId The ID of the current user.
 * @param note The new note string.
 * @returns A Promise that resolves when the note is updated.
 */
export const updateBookNote = async (bookId: number | string, userId: string, note: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    const updatedBooks = savedBooks.map(book =>
        book.id === bookId ? { ...book, notes: note } : book
    );
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
    console.log(`Note for book ID ${bookId} updated for user ${userId}.`);
};

// --- Helper for Book Cover Images ---

/**
 * Constructs the most appropriate URL for a book's cover image.
 * This prioritizes Internet Archive's direct images, then generic JPEG formats,
 * and finally falls back to your backend's cover proxy.
 * @param book The Book object.
 * @returns A string URL for the book's cover image.
 */
export const getBookCoverUrl = (book: Book): string => {
    // For Internet Archive books, use their direct image service
    if (book.source === 'archive' && book.ia_identifier) {
        return `https://archive.org/services/img/${book.ia_identifier}`;
    }

    // For other sources, check if a general JPEG image format URL is available
    if (book.formats['image/jpeg']) {
        return book.formats['image/jpeg'];
    }

    // Fallback to your backend's cover proxy. This allows your backend to resolve
    // covers from various sources (e.g., Open Library cover_id) if not directly available.
    return `${API_BASE_URL}/book/${book.source}/${book.id}/cover`;
};


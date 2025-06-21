import { BooksApiResponse, Book, OpenLibraryWork, OpenLibraryAuthor, ArchiveSearchResponse, ArchiveItem } from '../types'; // Removed OpenLibraryEdition

// Your backend proxy endpoint that handles content fetching
const BACKEND_CONTENT_PROXY_URL = 'https://xbookhub-project.onrender.com/api/fetch-book';
// Your backend base URL for specific endpoints like covers and proxied metadata
const BACKEND_BASE_URL = 'https://xbookhub-project.onrender.com';

// External API base URLs (used to construct the URL passed to your content proxy)
const GUTENBERG_EXTERNAL_BASE = 'https://gutendex.com';

// Enhanced fetch with retry logic and better error handling
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased timeout to 20 seconds for proxy/external calls

            // Fix for Error 7053: Safely merge headers
            const defaultHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
            };

            let combinedHeaders: HeadersInit = { ...defaultHeaders };

            if (options.headers) {
                if (Array.isArray(options.headers)) {
                    combinedHeaders = [...Object.entries(defaultHeaders), ...options.headers];
                } else if (options.headers instanceof Headers) {
                    combinedHeaders = options.headers; // Use the Headers object directly if provided
                    for (const [key, value] of Object.entries(defaultHeaders)) {
                        if (!combinedHeaders.has(key)) {
                            (combinedHeaders as Headers).set(key, value);
                        }
                    }
                } else { // Assume it's a plain object (Record<string, string>)
                    combinedHeaders = { ...defaultHeaders, ...options.headers as Record<string, string> };
                }
            }

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: combinedHeaders, // Use the combinedHeaders
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                return response;
            }

            if (response.status >= 500 && i < retries - 1) {
                // Server error, retry
                await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1))); // Slightly longer retry delay
                continue;
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText} for URL: ${url}`);
        } catch (error) {
            console.error(`Fetch attempt ${i + 1} failed for ${url}:`, error);
            if (i === retries - 1) {
                throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
};

// Helper function to route content requests through the backend content proxy
const fetchContentViaProxy = async (externalUrl: string, options: RequestInit = {}): Promise<Response> => {
    const proxyRequestUrl = `${BACKEND_CONTENT_PROXY_URL}?url=${encodeURIComponent(externalUrl)}`;
    return fetchWithRetry(proxyRequestUrl, options);
};

// Project Gutenberg API functions
export const fetchGutenbergBooks = async (page = 1): Promise<BooksApiResponse> => {
    try {
        const response = await fetchContentViaProxy(`${GUTENBERG_EXTERNAL_BASE}/books?page=${page}`);
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
        console.error('Error fetching Gutenberg books via proxy:', error);
        throw new Error('Failed to fetch books from Project Gutenberg via server.');
    }
};

export const searchGutenbergBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
    try {
        const response = await fetchContentViaProxy(`${GUTENBERG_EXTERNAL_BASE}/books?search=${encodeURIComponent(query)}&page=${page}`);
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
        console.error('Error searching Gutenberg books via proxy:', error);
        throw new Error('Failed to search books in Project Gutenberg via server.');
    }
};

// Open Library API functions
export const fetchOpenLibraryBooks = async (page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        const offset = (page - 1) * limit;
        // Use BACKEND_BASE_URL for Open Library metadata proxy, not fetch-book
        const response = await fetchWithRetry(
            `${BACKEND_BASE_URL}/api/openlibrary/search.json?q=*&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`
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
        console.error('Error fetching Open Library books via proxy:', error);
        throw new Error('Failed to fetch books from Open Library via server.');
    }
};

export const searchOpenLibraryBooks = async (query: string, page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        const offset = (page - 1) * limit;
        // Use BACKEND_BASE_URL for Open Library metadata proxy
        const response = await fetchWithRetry(
            `${BACKEND_BASE_URL}/api/openlibrary/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`
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

// Internet Archive API functions
export const fetchArchiveBooks = async (page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        // Use BACKEND_BASE_URL for Internet Archive metadata proxy
        const response = await fetchWithRetry(
            `${BACKEND_BASE_URL}/api/archive/advancedsearch.php?q=collection:opensource AND mediatype:texts AND format:pdf&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`
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

export const searchArchiveBooks = async (query: string, page = 1, limit = 20): Promise<BooksApiResponse> => {
    try {
        // Use BACKEND_BASE_URL for Internet Archive metadata proxy
        const response = await fetchWithRetry(
            `${BACKEND_BASE_URL}/api/archive/advancedsearch.php?q=${encodeURIComponent(query)} AND collection:opensource AND mediatype:texts&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`
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

// Combined API functions (remain the same, as they call the updated individual source functions)
export const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
    try {
        const [gutenbergBooks, openLibraryBooks, archiveBooks] = await Promise.allSettled([
            fetchGutenbergBooks(page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'gutenberg' as const })),
            fetchOpenLibraryBooks(page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'openlibrary' as const })),
            fetchArchiveBooks(page).catch(() => ({ results: [], count: 0, next: null, previous: null, source: 'archive' as const }))
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

        const shuffledBooks = allBooks.sort(() => Math.random() - 0.5).slice(0, 20);

        return {
            count: totalCount,
            next: totalCount > page * 20 ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: shuffledBooks,
            source: 'gutenberg'
        };
    } catch (error) {
        console.error('Error fetching combined books:', error);
        throw new Error('Failed to fetch books from all sources.');
    }
};

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

        const sortedBooks = allBooks.sort((a, b) => {
            const aInTitle = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            const bInTitle = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
            return bInTitle - aInTitle;
        });

        return {
            count: totalCount,
            next: totalCount > page * 20 ? `page=${page + 1}` : null,
            previous: page > 1 ? `page=${page - 1}` : null,
            results: sortedBooks.slice(0, 20),
            source: 'gutenberg'
        };
    } catch (error) {
        console.error('Error searching combined books:', error);
        throw new Error('Failed to search books from all sources.');
    }
};

// Fetch book by ID from any source via proxy
export const fetchBookById = async (id: number | string): Promise<Book> => {
    try {
        // Determine source based on ID format and try fetching via proxy
        if (typeof id === 'number' || /^\d+$/.test(id.toString())) {
            try {
                const response = await fetchContentViaProxy(`${GUTENBERG_EXTERNAL_BASE}/books/${id}`);
                const book = await response.json();
                return { ...book, source: 'gutenberg' };
            } catch (error) {
                console.warn('Book not found in Gutenberg via proxy, trying other sources...');
            }
        }

        if (id.toString().startsWith('/works/') || id.toString().startsWith('OL')) {
            try {
                // Use BACKEND_BASE_URL for Open Library metadata proxy
                const response = await fetchWithRetry(`${BACKEND_BASE_URL}/api/openlibrary${id.toString().startsWith('/') ? id : `/works/${id}`}.json`);
                const work = await response.json();
                return await convertOpenLibraryWorkToBook(work);
            } catch (error) {
                console.warn('Book not found in Open Library via proxy...');
            }
        }

        try {
            // Use BACKEND_BASE_URL for Internet Archive metadata proxy
            const response = await fetchWithRetry(`${BACKEND_BASE_URL}/api/archive/metadata/${id}`);
            const metadata = await response.json();
            // --- FIX START ---
            // Placeholder function - you NEED to implement the logic for this
            return await convertArchiveMetadataToBook(metadata);
            // --- FIX END ---
        } catch (error) {
            console.warn('Book not found in Internet Archive via proxy...');
        }

        throw new Error('Book not found in any source');
    } catch (error) {
        console.error('Error fetching book details via proxy:', error);
        throw new Error('Failed to fetch book details via server. Please check your internet connection and try again.');
    }
};

// Helper function to convert Open Library search result to Book
const convertOpenLibraryToBook = async (doc: any): Promise<Book | null> => {
    try {
        const book: Book = {
            id: doc.key || `ol_${doc.cover_edition_key || Math.random()}`,
            title: doc.title || 'Unknown Title',
            authors: doc.author_name ? doc.author_name.map((name: string) => ({ name })) : [{ name: 'Unknown Author' }],
            subjects: doc.subject || [],
            formats: {
                'text/html': doc.ia && doc.ia.length > 0 ? `https://archive.org/details/${doc.ia[0]}` : undefined,
                'application/pdf': doc.ia && doc.ia.length > 0 ? `https://archive.org/download/${doc.ia[0]}/${doc.ia[0]}.pdf` : undefined,
            },
            download_count: 0,
            source: 'openlibrary',
            isbn: doc.isbn || [],
            publish_date: doc.first_publish_year ? doc.first_publish_year.toString() : undefined,
            publisher: doc.publisher || [],
            description: doc.first_sentence ? doc.first_sentence.join(' ') : undefined,
            cover_id: doc.cover_i,
            ia_identifier: doc.ia && doc.ia.length > 0 ? doc.ia[0] : undefined,
            language: doc.language || ['en']
        };

        // Add cover URL if available
        if (doc.cover_i) {
            book.formats['image/jpeg'] = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }

        return book;
    } catch (error) {
        console.warn('Error converting Open Library book:', error);
        return null;
    }
};

// Helper function to convert Open Library work to Book
const convertOpenLibraryWorkToBook = async (work: OpenLibraryWork): Promise<Book> => {
    const book: Book = {
        id: work.key,
        title: work.title,
        authors: [],
        subjects: work.subjects || [],
        formats: {},
        download_count: 0,
        source: 'openlibrary',
        description: typeof work.description === 'string' ? work.description : work.description?.value,
        cover_id: work.covers?.[0],
        publish_date: work.first_publish_date,
        language: ['en']
    };

    // Fetch author information
    if (work.authors && work.authors.length > 0) {
        try {
            const authorPromises = work.authors.map(async (authorRef) => {
                try {
                    // Use BACKEND_BASE_URL for Open Library metadata proxy
                    const authorResponse = await fetchWithRetry(`${BACKEND_BASE_URL}/api/openlibrary${authorRef.author.key}.json`);
                    const author: OpenLibraryAuthor = await authorResponse.json();
                    return {
                        name: author.name,
                        birth_year: author.birth_date ? parseInt(author.birth_date) : undefined,
                        death_year: author.death_date ? parseInt(author.death_date) : undefined,
                        key: author.key
                    };
                } catch (error) {
                    return { name: 'Unknown Author' };
                }
            });
            book.authors = await Promise.all(authorPromises);
        } catch (error) {
            book.authors = [{ name: 'Unknown Author' }];
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

// Helper function to convert Internet Archive item (from search results) to Book
const convertArchiveToBook = async (item: ArchiveItem): Promise<Book | null> => {
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
        formats: { // These are content formats, not cover display formats
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


// --- START OF THE MISSING FUNCTION (YOU NEED TO IMPLEMENT THIS LOGIC) ---
// This function is expected to convert the *full metadata* response from Internet Archive's /metadata/:id endpoint
// into your 'Book' type. The structure of this metadata might be different from ArchiveItem (which comes from search results).
const convertArchiveMetadataToBook = async (metadata: any): Promise<Book> => {
    // IMPORTANT: Replace 'any' with a more specific type definition for Internet Archive's full metadata response.
    // You will need to inspect the structure of the JSON returned by your backend proxy for /api/archive/metadata/:id.

    // Placeholder implementation - adjust this based on the actual 'metadata' structure
    const book: Book = {
        id: metadata.metadata?.identifier || 'unknown_id', // Adjust path based on actual metadata structure
        title: metadata.metadata?.title || 'Unknown Title', // Adjust path
        authors: metadata.metadata?.creator ?
            (Array.isArray(metadata.metadata.creator) ? metadata.metadata.creator.map((name: string) => ({ name })) : [{ name: metadata.metadata.creator }]) :
            [{ name: 'Unknown Author' }],
        subjects: metadata.metadata?.subject ? (Array.isArray(metadata.metadata.subject) ? metadata.metadata.subject : [metadata.metadata.subject]) : [],
        formats: {
            // These formats are crucial. You'll need to derive them from the metadata.
            // Internet Archive metadata might have a 'files' array or similar to find direct download links.
            'text/html': `https://archive.org/details/${metadata.metadata?.identifier}`,
            'application/pdf': `https://archive.org/download/${metadata.metadata?.identifier}/${metadata.metadata?.identifier}.pdf` // Common pattern, but verify
        },
        download_count: parseInt(metadata.metadata?.downloads || '0'), // Adjust path and parse
        source: 'archive',
        ia_identifier: metadata.metadata?.identifier,
        publish_date: metadata.metadata?.date,
        publisher: metadata.metadata?.publisher ? (Array.isArray(metadata.metadata.publisher) ? metadata.metadata.publisher : [metadata.metadata.publisher]) : [],
        description: metadata.metadata?.description,
        language: metadata.metadata?.language ? (Array.isArray(metadata.metadata.language) ? metadata.metadata.language : [metadata.metadata.language]) : ['en']
    };

    // Add cover image URL
    book.formats['image/jpeg'] = `https://archive.org/services/img/${metadata.metadata?.identifier}`;

    return book;
};
// --- END OF THE MISSING FUNCTION ---


// Enhanced book content fetching with support for all sources
export const fetchBookContent = async (book: Book): Promise<string> => {
    try {
        let contentUrl = '';

        // Determine the best content URL based on the book's source and available formats
        if (book.formats['text/plain']) {
            contentUrl = book.formats['text/plain'];
        } else if (book.formats['text/html']) {
            contentUrl = book.formats['text/html'];
        } else {
            throw new Error('No readable format available for this book');
        }

        // For Internet Archive, adjust the URL for better text extraction
        if (book.source === 'archive' && book.ia_identifier) {
            contentUrl = `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}_djvu.txt`;
        }

        // Route through the content proxy for external URLs
        const response = await fetchContentViaProxy(contentUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
        }

        const content = await response.text();

        if (!content || content.trim().length === 0) {
            throw new Error('Book content is empty or unavailable');
        }

        return content;
    } catch (error) {
        console.error('Error fetching book content via proxy:', error);
        throw new Error('Failed to load book content. The book may not be available for reading online.');
    }
};

// Enhanced file download with support for different formats
export const downloadBookAsFile = async (book: Book, format: 'txt' | 'html' | 'pdf' = 'txt'): Promise<void> => {
    try {
        let downloadUrl = '';
        let mimeType = 'text/plain';
        let fileExtension = 'txt';

        switch (format) {
            case 'pdf':
                downloadUrl = book.formats['application/pdf'] || '';
                mimeType = 'application/pdf';
                fileExtension = 'pdf';
                break;
            case 'html':
                downloadUrl = book.formats['text/html'] || '';
                mimeType = 'text/html';
                fileExtension = 'html';
                break;
            default:
                downloadUrl = book.formats['text/plain'] || book.formats['text/html'] || '';
                mimeType = 'text/plain';
                fileExtension = 'txt';
        }

        if (!downloadUrl) {
            throw new Error(`${format.toUpperCase()} format not available for this book`);
        }

        // Route through the content proxy for external URLs
        const response = await fetchContentViaProxy(downloadUrl);

        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        }

        let blob: Blob;
        if (format === 'pdf') {
            const arrayBuffer = await response.arrayBuffer();
            blob = new Blob([arrayBuffer], { type: mimeType });
        } else {
            const content = await response.text();
            blob = new Blob([content], { type: mimeType });
        }

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Clean title for filename
        const cleanTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${cleanTitle}.${fileExtension}`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up object URL
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading book via proxy:', error);
        throw new Error(`Failed to download book as ${format.toUpperCase()}. Please try again or choose a different format.`);
    }
};

// Enhanced PDF download with better error handling
export const downloadBookAsPDF = async (book: Book): Promise<void> => {
    await downloadBookAsFile(book, 'pdf');
};

// Save book to "MongoDB" (localStorage in this demo)
export const saveBook = async (book: Book, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);

    // Check if book is already saved
    const isAlreadySaved = savedBooks.some(savedBook => savedBook.id === book.id);

    if (!isAlreadySaved) {
        const bookToSave = {
            ...book,
            savedAt: new Date().toISOString(),
        };
        const updatedBooks = [...savedBooks, bookToSave];
        localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
    }
};

// Get saved books from "MongoDB" (localStorage in this demo)
export const getSavedBooks = (userId: string): any[] => {
    const saved = localStorage.getItem(`xbook-saved-${userId}`);
    return saved ? JSON.parse(saved) : [];
};

// Remove book from saved books
export const removeSavedBook = async (bookId: number | string, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    const updatedBooks = savedBooks.filter(book => book.id !== bookId);
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
};

// Update user note for a book
export const updateBookNote = async (bookId: number | string, userId: string, note: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    const updatedBooks = savedBooks.map(book =>
        book.id === bookId ? { ...book, notes: note } : book
    );
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
};

// --- HELPER FOR CONSTRUCTING COVER URL (for your UI component) ---
export const getBookCoverUrl = (book: Book): string => {
    // For Internet Archive books, use direct image URL
    if (book.source === 'archive' && book.ia_identifier) {
        return `https://archive.org/services/img/${book.ia_identifier}`;
    }

    // For other sources, use the existing format
    if (book.formats['image/jpeg']) {
        return book.formats['image/jpeg'];
    }

    // Fallback to backend URL for cover proxy
    const backendBaseUrl = 'https://xbookhub-project.onrender.com';
    return `${backendBaseUrl}/api/book/${book.source}/${book.id}/cover`;
};
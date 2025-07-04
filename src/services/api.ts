import { BooksApiResponse, Book, OpenLibraryWork, OpenLibraryAuthor, ArchiveSearchResponse, ArchiveItem, SavedBook } from '../types';

// Use the deployed server URL by default
export const API_BASE_URL = import.meta.env.VITE_PROXY_URL?.replace('/api/fetch-book', '') || 
                            import.meta.env.VITE_BACKEND_API_BASE_URL || 
                            'https://xbookhub-project.onrender.com';

const GUTENBERG_EXTERNAL_BASE = 'https://gutendex.com';

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);
            
            const response = await fetch(url, { 
                ...options, 
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) return response;
            
            if (response.status >= 500 && i < retries - 1) {
                console.warn(`Server error ${response.status}, retrying... (${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                continue;
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText} for URL: ${url}`);
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.warn(`Request timeout for ${url}, attempt ${i + 1}/${retries}`);
                } else {
                    console.warn(`Request failed for ${url}, attempt ${i + 1}/${retries}:`, error.message);
                }
            } else {
                console.warn(`Request failed for ${url}, attempt ${i + 1}/${retries}:`, error);
            }
            
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
};

const fetchContentViaProxy = async (externalUrl: string, cleanHtml: boolean = false): Promise<Response> => {
    const proxyRequestUrl = `${API_BASE_URL}/api/fetch-book?url=${encodeURIComponent(externalUrl)}&clean=${cleanHtml}`;
    return fetchWithRetry(proxyRequestUrl);
};

export const fetchGutenbergBooks = async (page = 1): Promise<BooksApiResponse> => {
    const response = await fetchWithRetry(`${GUTENBERG_EXTERNAL_BASE}/books?page=${page}`);
    const data = await response.json();
    return { ...data, source: 'gutenberg', results: data.results.map((book: any) => ({ ...book, source: 'gutenberg' })) };
};

export const searchGutenbergBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
    const response = await fetchWithRetry(`${GUTENBERG_EXTERNAL_BASE}/books?search=${encodeURIComponent(query)}&page=${page}`);
    const data = await response.json();
    return { ...data, source: 'gutenberg', results: data.results.map((book: any) => ({ ...book, source: 'gutenberg' })) };
};

export const fetchOpenLibraryBooks = async (page = 1, limit = 20): Promise<BooksApiResponse> => {
    const offset = (page - 1) * limit;
    const response = await fetchWithRetry(`${API_BASE_URL}/api/openlibrary/search.json?q=*&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`);
    const data = await response.json();
    const books = await Promise.all(data.docs.slice(0, limit).map((doc: any) => convertOpenLibraryToBook(doc)));
    return { count: data.numFound || 0, next: data.numFound > offset + limit ? `page=${page + 1}` : null, previous: page > 1 ? `page=${page - 1}` : null, results: books.filter(b => b !== null), source: 'openlibrary' };
};

export const searchOpenLibraryBooks = async (query: string, page = 1, limit = 20): Promise<BooksApiResponse> => {
    const offset = (page - 1) * limit;
    const response = await fetchWithRetry(`${API_BASE_URL}/api/openlibrary/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`);
    const data = await response.json();
    const books = await Promise.all(data.docs.slice(0, limit).map((doc: any) => convertOpenLibraryToBook(doc)));
    return { count: data.numFound || 0, next: data.numFound > offset + limit ? `page=${page + 1}` : null, previous: page > 1 ? `page=${page - 1}` : null, results: books.filter(b => b !== null), source: 'openlibrary' };
};

export const fetchArchiveBooks = async (page = 1, limit = 20): Promise<BooksApiResponse> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/archive/advancedsearch.php?q=collection:opensource AND mediatype:texts&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`);
    const data: ArchiveSearchResponse = await response.json();
    const books = await Promise.all(data.response.docs.map((doc: ArchiveItem) => convertArchiveToBook(doc)));
    return { count: data.response.numFound || 0, next: data.response.numFound > (page * limit) ? `page=${page + 1}` : null, previous: page > 1 ? `page=${page - 1}` : null, results: books.filter(b => b !== null), source: 'archive' };
};

export const searchArchiveBooks = async (query: string, page = 1, limit = 20): Promise<BooksApiResponse> => {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/archive/advancedsearch.php?q=${encodeURIComponent(query)} AND collection:opensource AND mediatype:texts&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`);
    const data: ArchiveSearchResponse = await response.json();
    const books = await Promise.all(data.response.docs.map((doc: ArchiveItem) => convertArchiveToBook(doc)));
    return { count: data.response.numFound || 0, next: data.response.numFound > (page * limit) ? `page=${page + 1}` : null, previous: page > 1 ? `page=${page - 1}` : null, results: books.filter(b => b !== null), source: 'archive' };
};

export const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
    const [gutenberg, openLibrary, archive] = await Promise.allSettled([
        fetchGutenbergBooks(page),
        fetchOpenLibraryBooks(page),
        fetchArchiveBooks(page)
    ]);
    const allBooks = [
        ...(gutenberg.status === 'fulfilled' ? gutenberg.value.results : []),
        ...(openLibrary.status === 'fulfilled' ? openLibrary.value.results : []),
        ...(archive.status === 'fulfilled' ? archive.value.results : [])
    ];
    const totalCount = (gutenberg.status === 'fulfilled' ? gutenberg.value.count : 0) + (openLibrary.status === 'fulfilled' ? openLibrary.value.count : 0) + (archive.status === 'fulfilled' ? archive.value.count : 0);
    return { count: totalCount, next: totalCount > page * 20 ? `page=${page + 1}` : null, previous: page > 1 ? `page=${page - 1}` : null, results: allBooks.sort(() => Math.random() - 0.5).slice(0, 20), source: 'gutenberg' };
};

export const searchBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
    const [gutenberg, openLibrary, archive] = await Promise.allSettled([
        searchGutenbergBooks(query, page),
        searchOpenLibraryBooks(query, page),
        searchArchiveBooks(query, page)
    ]);
    const allBooks = [
        ...(gutenberg.status === 'fulfilled' ? gutenberg.value.results : []),
        ...(openLibrary.status === 'fulfilled' ? openLibrary.value.results : []),
        ...(archive.status === 'fulfilled' ? archive.value.results : [])
    ];
    const totalCount = (gutenberg.status === 'fulfilled' ? gutenberg.value.count : 0) + (openLibrary.status === 'fulfilled' ? openLibrary.value.count : 0) + (archive.status === 'fulfilled' ? archive.value.count : 0);
    return { count: totalCount, next: totalCount > page * 20 ? `page=${page + 1}` : null, previous: page > 1 ? `page=${page - 1}` : null, results: allBooks.sort((a, b) => (b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0) - (a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0)).slice(0, 20), source: 'gutenberg' };
};

export const fetchBookById = async (id: number | string): Promise<Book> => {
    if (typeof id === 'number' || /^\d+$/.test(id.toString())) {
        try {
            const response = await fetchWithRetry(`${GUTENBERG_EXTERNAL_BASE}/books/${id}`);
            return { ...(await response.json()), source: 'gutenberg' };
        } catch (e) { /* continue */ }
    }
    if (id.toString().startsWith('/works/') || id.toString().startsWith('OL')) {
        try {
            const olKey = id.toString().startsWith('/') ? id : `/works/${id}`;
            const response = await fetchWithRetry(`${API_BASE_URL}/api/openlibrary${olKey}.json`);
            return await convertOpenLibraryWorkToBook(await response.json());
        } catch (e) { /* continue */ }
    }
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}/api/archive/metadata/${id}`);
        return await convertArchiveMetadataToBook(await response.json());
    } catch (e) { /* continue */ }
    throw new Error('Book not found in any source');
};

const convertOpenLibraryToBook = async (doc: any): Promise<Book | null> => {
    if (!doc.key) return null;
    return {
        id: doc.key,
        title: doc.title || 'Unknown Title',
        authors: doc.author_name?.map((name: string) => ({ name })) || [{ name: 'Unknown Author' }],
        subjects: doc.subject || [],
        formats: {
            'text/html': doc.ia?.[0] ? `https://archive.org/details/${doc.ia[0]}` : undefined,
            'text/plain': doc.ia?.[0] ? `https://archive.org/stream/${doc.ia[0]}/${doc.ia[0]}_djvu.txt` : undefined,
            'image/jpeg': doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
        },
        download_count: 0,
        source: 'openlibrary',
        ia_identifier: doc.ia?.[0],
    };
};

const convertOpenLibraryWorkToBook = async (work: OpenLibraryWork): Promise<Book> => {
    const authors = work.authors ? await Promise.all(work.authors.map(async (authorRef) => {
        try {
            const authorResp = await fetchWithRetry(`${API_BASE_URL}/api/openlibrary${authorRef.author.key}.json`);
            const author: OpenLibraryAuthor = await authorResp.json();
            return { name: author.name };
        } catch {
            return { name: 'Unknown Author' };
        }
    })) : [{ name: 'Unknown Author' }];

    return {
        id: work.key,
        title: work.title,
        authors,
        subjects: work.subjects || [],
        formats: { 'image/jpeg': work.covers?.[0] ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg` : undefined },
        download_count: 0,
        source: 'openlibrary',
        description: typeof work.description === 'string' ? work.description : work.description?.value,
    };
};

const convertArchiveToBook = async (item: ArchiveItem): Promise<Book | null> => {
    if (!item.identifier) return null;
    return {
        id: item.identifier,
        title: item.title,
        authors: item.creator ? (Array.isArray(item.creator) ? item.creator.map(name => ({ name })) : [{ name: item.creator }]) : [{ name: 'Unknown Author' }],
        subjects: item.subject ? (Array.isArray(item.subject) ? item.subject : [item.subject]) : [],
        formats: {
            'text/html': `https://archive.org/details/${item.identifier}`,
            'text/plain': `https://archive.org/stream/${item.identifier}/${item.identifier}_djvu.txt`,
            'image/jpeg': `https://archive.org/services/img/${item.identifier}`,
        },
        download_count: item.downloads || 0,
        source: 'archive',
        ia_identifier: item.identifier,
    };
};

const convertArchiveMetadataToBook = async (metadata: any): Promise<Book> => {
    const meta = metadata.metadata || {};
    return {
        id: meta.identifier || 'unknown_id',
        title: meta.title || 'Unknown Title',
        authors: meta.creator ? (Array.isArray(meta.creator) ? meta.creator.map((name: string) => ({ name })) : [{ name: meta.creator }]) : [{ name: 'Unknown Author' }],
        subjects: meta.subject ? (Array.isArray(meta.subject) ? meta.subject : [meta.subject]) : [],
        formats: {
            'text/html': `https://archive.org/details/${meta.identifier}`,
            'text/plain': `https://archive.org/stream/${meta.identifier}/${meta.identifier}_djvu.txt`,
            'image/jpeg': `https://archive.org/services/img/${meta.identifier}`,
        },
        download_count: parseInt(meta.downloads || '0'),
        source: 'archive',
        ia_identifier: meta.identifier,
    };
};

export const fetchBookContent = async (book: Book, format: 'html' | 'txt' = 'html', cleanHtml: boolean = false): Promise<string> => {
    const contentUrls: string[] = [];
    
    if (book.source === 'gutenberg') {
        if (format === 'html' && book.formats['text/html']) {
            contentUrls.push(book.formats['text/html']);
        }
        if (book.formats['text/plain']) {
            contentUrls.push(book.formats['text/plain']);
        }
        if (book.formats['text/html']) {
            contentUrls.push(book.formats['text/html']);
        }
    } else if (book.source === 'archive' || book.source === 'openlibrary') {
        if (book.ia_identifier) {
            contentUrls.push(
                `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}_djvu.txt`,
                `https://archive.org/download/${book.ia_identifier}/${book.ia_identifier}.txt`,
                `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}.txt`,
                `https://archive.org/download/${book.ia_identifier}/${book.ia_identifier}.pdf`,
                `https://archive.org/details/${book.ia_identifier}`
            );
        }
        if (book.formats['text/plain']) {
            contentUrls.push(book.formats['text/plain']);
        }
        if (book.formats['text/html']) {
            contentUrls.push(book.formats['text/html']);
        }
    }

    if (contentUrls.length === 0) {
        throw new Error('No readable content format available for this book.');
    }

    for (const url of contentUrls) {
        try {
            console.log(`Attempting to fetch content from: ${url}`);
            const response = await fetchContentViaProxy(url, cleanHtml);
            
            if (response.ok) {
                const content = await response.text();
                if (content && content.trim().length > 0) {
                    console.log(`Successfully fetched content from: ${url} (${content.length} characters)`);
                    return content;
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to fetch from ${url}:`, errorMessage);
            continue;
        }
    }

    throw new Error('Failed to fetch book content from any available source. The book may not have readable content available.');
};

export const downloadBookAsFile = async (book: Book, format: 'txt' | 'html' = 'txt'): Promise<void> => {
    try {
        const content = await fetchBookContent(book, format, false);
        
        const blob = new Blob([content], { 
            type: format === 'html' ? 'text/html' : 'text/plain' 
        });
        
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${book.title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error downloading book:', errorMessage);
        throw new Error(`Failed to download book in ${format.toUpperCase()} format: ${errorMessage}`);
    }
};

export const saveBook = async (book: Book, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    if (!savedBooks.some(b => b.id === book.id)) {
        const savedBook: SavedBook = { ...book, savedAt: new Date().toISOString() };
        localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify([...savedBooks, savedBook]));
    }
};

export const getSavedBooks = (userId: string): SavedBook[] => {
    const saved = localStorage.getItem(`xbook-saved-${userId}`);
    return saved ? JSON.parse(saved) : [];
};

export const removeSavedBook = async (bookId: number | string, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(savedBooks.filter(b => b.id !== bookId)));
};

export const updateBookNote = async (bookId: number | string, userId: string, notes: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    const updatedBooks = savedBooks.map(book => 
        book.id === bookId ? { ...book, notes } : book
    );
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
};

export const getBookCoverUrl = (book: Book): string => {
    if (book.source === 'archive' && book.ia_identifier) return `https://archive.org/services/img/${book.ia_identifier}`;
    if (book.formats['image/jpeg']) return book.formats['image/jpeg'];
    return 'https://placehold.co/300x450/e9d8b6/453a22?text=No+Cover';
};
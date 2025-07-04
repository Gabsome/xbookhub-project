import { BooksApiResponse, Book, OpenLibraryWork, OpenLibraryAuthor, ArchiveSearchResponse, ArchiveItem } from '../types';

export const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL || 'http://localhost:3001';
const GUTENBERG_EXTERNAL_BASE = 'https://gutendex.com';

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok) return response;
            if (response.status >= 500 && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
                continue;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText} for URL: ${url}`);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
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
            'image/jpeg': `https://archive.org/services/img/${meta.identifier}`,
        },
        download_count: parseInt(meta.downloads || '0'),
        source: 'archive',
        ia_identifier: meta.identifier,
    };
};

export const fetchBookContent = async (book: Book, format: 'html' | 'txt' = 'html', cleanHtml: boolean = false): Promise<string> => {
    let url = '';
    if (book.source === 'gutenberg') {
        url = book.formats['text/html'] || book.formats['text/plain'] || '';
    } else if (book.ia_identifier) {
        url = `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}_djvu.txt`;
    } else {
        url = book.formats['text/html'] || book.formats['text/plain'] || '';
    }
    if (!url) throw new Error('No readable content format available.');

    const response = await fetchContentViaProxy(url, cleanHtml);
    if (!response.ok) throw new Error(`Failed to fetch content: ${response.statusText}`);
    return response.text();
};

export const downloadBookAsFile = async (book: Book, format: 'txt' | 'html' = 'txt'): Promise<void> => {
    let url = '';
    if (format === 'html' && book.formats['text/html']) url = book.formats['text/html'];
    else url = book.formats['text/plain'] || book.formats['text/html'] || '';

    if (!url) throw new Error(`${format.toUpperCase()} format not available.`);

    const response = await fetchContentViaProxy(url, false);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${book.title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
};

export const saveBook = async (book: Book, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    if (!savedBooks.some(b => b.id === book.id)) {
        localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify([...savedBooks, { ...book, savedAt: new Date().toISOString() }]));
    }
};

export const getSavedBooks = (userId: string): Book[] => {
    const saved = localStorage.getItem(`xbook-saved-${userId}`);
    return saved ? JSON.parse(saved) : [];
};

export const removeSavedBook = async (bookId: number | string, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
    localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(savedBooks.filter(b => b.id !== bookId)));
};

export const getBookCoverUrl = (book: Book): string => {
    if (book.source === 'archive' && book.ia_identifier) return `https://archive.org/services/img/${book.ia_identifier}`;
    if (book.formats['image/jpeg']) return book.formats['image/jpeg'];
    return `${API_BASE_URL}/api/book/${book.source}/${book.id}/cover`;
};

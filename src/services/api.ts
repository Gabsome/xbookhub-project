import { BooksApiResponse, Book, OpenLibraryWork, OpenLibraryAuthor, OpenLibraryEdition, ArchiveSearchResponse, ArchiveItem } from '../types';

// Your backend proxy endpoint that handles external API calls
const BACKEND_PROXY_URL = 'https://xbookhub-project.onrender.com/api/fetch-book';

// External API base URLs (used to construct the URL passed to your proxy)
const GUTENBERG_EXTERNAL_BASE = 'https://gutendex.com';
const OPENLIBRARY_EXTERNAL_BASE = 'https://openlibrary.org';
const ARCHIVE_EXTERNAL_BASE = 'https://archive.org';

// Enhanced fetch with retry logic and better error handling
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased timeout to 20 seconds for proxy/external calls

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
                    ...options.headers,
                },
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

// Helper function to route requests through the backend proxy
const fetchViaProxy = async (externalUrl: string, options: RequestInit = {}): Promise<Response> => {
    const proxyRequestUrl = `${BACKEND_PROXY_URL}?url=${encodeURIComponent(externalUrl)}`;
    return fetchWithRetry(proxyRequestUrl, options);
};

// Project Gutenberg API functions
export const fetchGutenbergBooks = async (page = 1): Promise<BooksApiResponse> => {
    try {
        const response = await fetchViaProxy(`${GUTENBERG_EXTERNAL_BASE}/books?page=${page}`);
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
        const response = await fetchViaProxy(`${GUTENBERG_EXTERNAL_BASE}/books?search=${encodeURIComponent(query)}&page=${page}`);
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
        const response = await fetchViaProxy(
            `${OPENLIBRARY_EXTERNAL_BASE}/search.json?q=*&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`
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
        const response = await fetchViaProxy(
            `${OPENLIBRARY_EXTERNAL_BASE}/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&limit=${limit}&offset=${offset}&sort=downloads desc`
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
        const response = await fetchViaProxy(
            `${ARCHIVE_EXTERNAL_BASE}/advancedsearch.php?q=collection:opensource AND mediatype:texts AND format:pdf&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`
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
        const response = await fetchViaProxy(
            `${ARCHIVE_EXTERNAL_BASE}/advancedsearch.php?q=${encodeURIComponent(query)} AND collection:opensource AND mediatype:texts&fl=identifier,title,creator,subject,description,date,publisher,language,downloads&sort[]=downloads desc&rows=${limit}&page=${page}&output=json`
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
                const response = await fetchViaProxy(`${GUTENBERG_EXTERNAL_BASE}/books/${id}`);
                const book = await response.json();
                return { ...book, source: 'gutenberg' };
            } catch (error) {
                console.warn('Book not found in Gutenberg via proxy, trying other sources...');
            }
        }

        if (id.toString().startsWith('/works/') || id.toString().startsWith('OL')) {
            try {
                const response = await fetchViaProxy(`${OPENLIBRARY_EXTERNAL_BASE}${id.toString().startsWith('/') ? id : `/works/${id}`}.json`);
                const work = await response.json();
                return await convertOpenLibraryWorkToBook(work);
            } catch (error) {
                console.warn('Book not found in Open Library via proxy...');
            }
        }

        try {
            const response = await fetchViaProxy(`${ARCHIVE_EXTERNAL_BASE}/metadata/${id}`);
            const metadata = await response.json();
            return await convertArchiveMetadataToBook(metadata);
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
            formats: {},
            download_count: doc.readinglog_count || 0,
            source: 'openlibrary',
            isbn: [...(doc.isbn || []), ...(doc.isbn_13 || [])],
            publish_date: doc.first_publish_year?.toString(),
            publisher: doc.publisher || [],
            language: doc.language || ['en']
        };

        if (doc.cover_i) {
            book.formats['image/jpeg'] = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }

        if (doc.ia) {
            book.ia_identifier = Array.isArray(doc.ia) ? doc.ia[0] : doc.ia;
            book.formats['text/html'] = `https://archive.org/stream/${book.ia_identifier}`;
            book.formats['application/pdf'] = `https://archive.org/download/${book.ia_identifier}/${book.ia_identifier}.pdf`;
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
        title: work.title || 'Unknown Title',
        authors: [],
        subjects: work.subjects || [],
        formats: {},
        download_count: 0,
        source: 'openlibrary',
        description: typeof work.description === 'string' ? work.description : work.description?.value
    };

    if (work.authors) {
        for (const authorRef of work.authors) {
            try {
                // Fetch author details via proxy
                const authorResponse = await fetchViaProxy(`${OPENLIBRARY_EXTERNAL_BASE}${authorRef.author.key}.json`);
                const author: OpenLibraryAuthor = await authorResponse.json();
                book.authors.push({
                    name: author.name,
                    birth_year: author.birth_date ? parseInt(author.birth_date) : undefined,
                    death_year: author.death_date ? parseInt(author.death_date) : undefined
                });
            } catch (error) {
                console.warn(`Could not fetch author ${authorRef.author.key} via proxy.`, error);
                book.authors.push({ name: 'Unknown Author' });
            }
        }
    }

    if (work.covers && work.covers[0]) {
        book.formats['image/jpeg'] = `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`;
    }

    return book;
};

// Helper function to convert Internet Archive item to Book
const convertArchiveToBook = async (doc: ArchiveItem): Promise<Book | null> => {
    try {
        const book: Book = {
            id: doc.identifier,
            title: doc.title || 'Unknown Title',
            authors: [],
            subjects: typeof doc.subject === 'string' ? [doc.subject] : (doc.subject || []),
            formats: {
                'text/html': `https://archive.org/details/${doc.identifier}`,
                'application/pdf': `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`
            },
            download_count: doc.downloads || 0,
            source: 'archive',
            ia_identifier: doc.identifier,
            publish_date: doc.date,
            publisher: typeof doc.publisher === 'string' ? [doc.publisher] : (doc.publisher || []),
            description: doc.description,
            language: typeof doc.language === 'string' ? [doc.language] : (doc.language || ['en'])
        };

        if (doc.creator) {
            const creators = typeof doc.creator === 'string' ? [doc.creator] : doc.creator;
            book.authors = creators.map(name => ({ name }));
        } else {
            book.authors = [{ name: 'Unknown Author' }];
        }

        return book;
    } catch (error) {
        console.warn('Error converting Archive book:', error);
        return null;
    }
};

// Helper function to convert Internet Archive metadata to Book
const convertArchiveMetadataToBook = async (metadata: any): Promise<Book> => {
    const item = metadata.metadata;
    return {
        id: item.identifier,
        title: item.title || 'Unknown Title',
        authors: item.creator ? (Array.isArray(item.creator) ? item.creator.map((name: string) => ({ name })) : [{ name: item.creator }]) : [{ name: 'Unknown Author' }],
        subjects: item.subject ? (Array.isArray(item.subject) ? item.subject : [item.subject]) : [],
        formats: {
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
};

// Enhanced book content fetching with support for all sources
export const fetchBookContent = async (book: Book): Promise<string> => {
    const possibleFormats = [
        'text/html',
        'text/plain',
    ];

    const contentUrls: string[] = [];

    if (book.source === 'gutenberg') {
        for (const format of possibleFormats) {
            // Check if the format exists and is a string before adding
            const formatUrl = book.formats[format as keyof typeof book.formats];
            if (typeof formatUrl === 'string') {
                contentUrls.push(formatUrl);
            }
        }
    } else if (book.source === 'openlibrary' || book.source === 'archive') {
        if (book.ia_identifier) {
            contentUrls.push(
                `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}_djvu.txt`,
                `https://archive.org/download/${book.ia_identifier}/${book.ia_identifier}.txt`,
                `https://archive.org/stream/${book.ia_identifier}`
            );
        }
        const htmlFormatUrl = book.formats['text/html'];
        if (typeof htmlFormatUrl === 'string') {
            contentUrls.push(htmlFormatUrl);
        }
    }

    if (contentUrls.length === 0) {
        throw new Error('No readable content available for this book.');
    }

    let lastError: Error | null = null;

    for (const contentUrl of contentUrls) {
        try {
            // contentUrl is already guaranteed to be a string here due to checks above
            const response = await fetchViaProxy(contentUrl);
            if (response.ok) {
                const content = await response.text();
                if (content && content.trim().length > 0) {
                    return content;
                }
            }
        } catch (error) {
            console.warn(`Failed to fetch content from ${contentUrl} via proxy:`, error);
            lastError = error as Error;
        }
    }

    throw lastError || new Error('Failed to fetch book content from any available source via server.');
};

// Download book content as file
export const downloadBookAsFile = async (book: Book, format: 'txt' | 'html' | 'pdf' = 'txt'): Promise<void> => {
    try {
        let content: string;
        let filename: string;
        let blob: Blob;
        let mimeType: string;

        // Clean filename
        const cleanTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        if (format === 'pdf' && book.formats['application/pdf']) {
            // Direct PDF download for Internet Archive books (via proxy)
            const pdfUrl = book.formats['application/pdf'];
            if (!pdfUrl) {
                throw new Error('PDF download URL not found for this book.');
            }
            // Removed responseType, fetchViaProxy just needs the URL and options
            const response = await fetchViaProxy(pdfUrl);
            const pdfBlob = await response.blob();

            filename = `${cleanTitle}.pdf`;
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return;
        }

        // For text and HTML formats, fetch content
        content = await fetchBookContent(book); // This already uses the proxy
        filename = `${cleanTitle}.${format}`;

        if (format === 'html') {
            mimeType = 'text/html';
            blob = new Blob([content], { type: mimeType });
        } else if (format === 'pdf') {
            // If the above PDF direct download didn't happen, generate PDF from fetched content
            await downloadBookAsPDF(book);
            return;
        } else {
            // Convert HTML to plain text if needed
            const textContent = content.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
            mimeType = 'text/plain';
            blob = new Blob([textContent], { type: mimeType });
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(url);

        console.log(`Book "${book.title}" downloaded successfully as ${filename}`);
    } catch (error) {
        console.error('Error downloading book:', error);
        throw new Error('Failed to download book. Please try again.');
    }
};

// Enhanced PDF download with better formatting
export const downloadBookAsPDF = async (book: Book): Promise<void> => {
    try {
        const { jsPDF } = await import('jspdf');
        const content = await fetchBookContent(book); // This already uses the proxy

        // Clean and format text content
        const textContent = content
            .replace(/<[^>]*>/g, '\n')
            .replace(/&[^;]+;/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const lineHeight = 6;
        const maxLineWidth = pageWidth - 2 * margin;

        // Add title
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        const titleLines = pdf.splitTextToSize(book.title, maxLineWidth);
        let yPosition = margin + 10;

        titleLines.forEach((line: string) => {
            pdf.text(line, margin, yPosition);
            yPosition += lineHeight + 2;
        });

        // Add author
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'italic');
        const authorText = `by ${book.authors.map(a => a.name).join(', ')}`;
        pdf.text(authorText, margin, yPosition);
        yPosition += lineHeight * 2;

        // Add source info
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        const sourceText = `Source: ${book.source === 'gutenberg' ? 'Project Gutenberg' : book.source === 'openlibrary' ? 'Open Library' : 'Internet Archive'}`;
        pdf.text(sourceText, margin, yPosition);
        yPosition += lineHeight * 2;

        // Add content
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(textContent, maxLineWidth);

        lines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
            }
            pdf.text(line, margin, yPosition);
            yPosition += lineHeight;
        });

        // Save the PDF
        const filename = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        pdf.save(filename);

        console.log(`Book "${book.title}" downloaded successfully as PDF`);
    } catch (error) {
        console.error('Error creating PDF:', error);
        throw new Error('Failed to create PDF. Please try downloading as text instead.');
    }
};

// In a real application, these would connect to MongoDB
// For this demo, we'll use localStorage

// Save book to "MongoDB" (localStorage in this demo)
export const saveBook = async (book: Book, userId: string): Promise<void> => {
    const savedBooks = getSavedBooks(userId);
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
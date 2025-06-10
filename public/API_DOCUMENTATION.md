# API Documentation

## Overview

Xbook-Hub integrates with multiple APIs to provide a comprehensive book reading experience. This document outlines all API integrations, endpoints, and usage patterns for accessing books from Project Gutenberg, Open Library, and Internet Archive.

## Table of Contents

1. [Project Gutenberg API](#project-gutenberg-api)
2. [Open Library API](#open-library-api)
3. [Internet Archive API](#internet-archive-api)
4. [Proxy Server API](#proxy-server-api)
5. [Uploadcare API](#uploadcare-api)
6. [Local Storage API](#local-storage-api)
7. [IndexedDB API](#indexeddb-api)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Authentication](#authentication)

## Project Gutenberg API

### Base URL
```
https://gutendex.com
```

### Endpoints

#### Get Books
Retrieve a paginated list of books from Project Gutenberg.

```http
GET /books?page={page}&search={query}
```

**Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `search` (optional): Search query for filtering books

**Response:**
```json
{
  "count": 70000,
  "next": "https://gutendex.com/books?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "The Declaration of Independence of the United States of America",
      "authors": [
        {
          "name": "Jefferson, Thomas",
          "birth_year": 1743,
          "death_year": 1826
        }
      ],
      "subjects": [
        "United States -- History -- Revolution, 1775-1783 -- Sources"
      ],
      "formats": {
        "text/html": "https://www.gutenberg.org/files/1/1-h/1-h.htm",
        "text/plain": "https://www.gutenberg.org/files/1/1-0.txt",
        "image/jpeg": "https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg"
      },
      "download_count": 12345,
      "source": "gutenberg"
    }
  ]
}
```

## Open Library API

### Base URL
```
https://openlibrary.org
```

### Endpoints

#### Search Books
Search for books in the Open Library database.

```http
GET /search.json?q={query}&has_fulltext=true&limit={limit}&offset={offset}
```

**Parameters:**
- `q`: Search query
- `has_fulltext`: Filter for books with full text available
- `limit`: Number of results per page (default: 20)
- `offset`: Pagination offset

**Response:**
```json
{
  "numFound": 1000,
  "start": 0,
  "docs": [
    {
      "key": "/works/OL123456W",
      "title": "Example Book",
      "author_name": ["Author Name"],
      "first_publish_year": 1900,
      "cover_i": 123456,
      "ia": ["examplebook00auth"],
      "subject": ["Fiction", "Literature"],
      "isbn": ["1234567890"],
      "publisher": ["Example Publisher"],
      "language": ["eng"]
    }
  ]
}
```

#### Get Work Details
Retrieve detailed information about a specific work.

```http
GET /works/{work_id}.json
```

**Response:**
```json
{
  "key": "/works/OL123456W",
  "title": "Example Book",
  "authors": [
    {
      "author": {
        "key": "/authors/OL123456A"
      }
    }
  ],
  "subjects": ["Fiction", "Literature"],
  "description": "Book description...",
  "covers": [123456],
  "first_publish_date": "1900"
}
```

#### Get Author Details
Retrieve information about an author.

```http
GET /authors/{author_id}.json
```

**Response:**
```json
{
  "key": "/authors/OL123456A",
  "name": "Author Name",
  "birth_date": "1850",
  "death_date": "1920"
}
```

## Internet Archive API

### Base URL
```
https://archive.org
```

### Endpoints

#### Advanced Search
Search for books and texts in the Internet Archive.

```http
GET /advancedsearch.php?q={query}&fl={fields}&sort={sort}&rows={rows}&page={page}&output=json
```

**Parameters:**
- `q`: Search query with filters (e.g., `collection:opensource AND mediatype:texts`)
- `fl`: Fields to return (comma-separated)
- `sort`: Sort order (e.g., `downloads desc`)
- `rows`: Number of results per page
- `page`: Page number
- `output`: Response format (json)

**Response:**
```json
{
  "response": {
    "numFound": 5000,
    "start": 0,
    "docs": [
      {
        "identifier": "examplebook",
        "title": "Example Book",
        "creator": "Author Name",
        "subject": ["Fiction", "Literature"],
        "description": "Book description...",
        "date": "1900",
        "publisher": "Example Publisher",
        "language": "English",
        "downloads": 1000
      }
    ]
  }
}
```

#### Get Item Metadata
Retrieve detailed metadata for a specific item.

```http
GET /metadata/{identifier}
```

**Response:**
```json
{
  "metadata": {
    "identifier": "examplebook",
    "title": "Example Book",
    "creator": "Author Name",
    "subject": ["Fiction", "Literature"],
    "description": "Book description...",
    "date": "1900",
    "publisher": "Example Publisher",
    "language": "English"
  },
  "files": [
    {
      "name": "examplebook.pdf",
      "format": "PDF",
      "size": "1234567"
    }
  ]
}
```

#### Access Book Content
Access readable content from Internet Archive books.

```http
GET /stream/{identifier}/{filename}
GET /download/{identifier}/{filename}
```

**Common file formats:**
- `{identifier}.pdf` - PDF version
- `{identifier}_djvu.txt` - Plain text extracted from DjVu
- `{identifier}.txt` - Plain text version

## Proxy Server API

### Base URL
```
https://xbookhub-project.onrender.com/api
```

### Purpose
The proxy server handles CORS issues when fetching book content from various sources and provides additional API endpoints.

### Endpoints

#### Fetch Book Content
Retrieve book content through the proxy server.

```http
GET /fetch-book?url={encoded_url}
```

**Parameters:**
- `url`: URL-encoded book content URL from any supported source

**Headers:**
```http
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=3600
X-Content-Length: 123456
X-Source-URL: original_url
```

**Response:**
Raw book content (HTML, plain text, or PDF)

#### Open Library Proxy
Proxy requests to Open Library API to handle CORS.

```http
GET /openlibrary/{path}
```

#### Internet Archive Proxy
Proxy requests to Internet Archive API to handle CORS.

```http
GET /archive/{path}
```

#### Health Check
Check the status of the proxy server.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-07T10:30:00.000Z",
  "services": ["Project Gutenberg", "Open Library", "Internet Archive"]
}
```

## Combined API Usage

### Fetch Books from All Sources
```typescript
const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
  // Fetch from all sources and combine results
  const [gutenbergBooks, openLibraryBooks, archiveBooks] = await Promise.allSettled([
    fetchGutenbergBooks(page),
    fetchOpenLibraryBooks(page),
    fetchArchiveBooks(page)
  ]);

  const allBooks: Book[] = [];
  // Combine and shuffle results for variety
  // Return combined response
};
```

### Search Across All Sources
```typescript
const searchBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
  // Search all sources simultaneously
  const [gutenbergResults, openLibraryResults, archiveResults] = await Promise.allSettled([
    searchGutenbergBooks(query, page),
    searchOpenLibraryBooks(query, page),
    searchArchiveBooks(query, page)
  ]);

  // Combine and sort by relevance
  // Return sorted results
};
```

### Fetch Book by ID
```typescript
const fetchBookById = async (id: number | string): Promise<Book> => {
  // Determine source based on ID format
  if (typeof id === 'number' || /^\d+$/.test(id.toString())) {
    // Try Gutenberg first for numeric IDs
  } else if (id.toString().startsWith('/works/') || id.toString().startsWith('OL')) {
    // Try Open Library for work IDs
  } else {
    // Try Internet Archive for other identifiers
  }
};
```

## Content Fetching

### Multi-Source Content Fetching
```typescript
const fetchBookContent = async (book: Book): Promise<string> => {
  const contentFormats: string[] = [];

  // Determine content URLs based on source
  switch (book.source) {
    case 'gutenberg':
      contentFormats.push(
        book.formats['text/html'],
        book.formats['text/plain']
      );
      break;
    case 'openlibrary':
    case 'archive':
      if (book.ia_identifier) {
        contentFormats.push(
          `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}_djvu.txt`,
          `https://archive.org/download/${book.ia_identifier}/${book.ia_identifier}.txt`
        );
      }
      break;
  }

  // Try each format with fallback options
  for (const contentUrl of contentFormats.filter(Boolean)) {
    try {
      const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(contentUrl)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const content = await response.text();
        if (content && content.trim().length > 0) {
          return content;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${contentUrl}:`, error);
      continue;
    }
  }

  throw new Error('Failed to fetch book content from any available source.');
};
```

## Error Handling

### Error Types

#### Network Errors
```typescript
interface NetworkError extends Error {
  code: 'NETWORK_ERROR';
  status?: number;
  statusText?: string;
  source?: string;
}
```

#### Source-Specific Errors
```typescript
interface SourceError extends Error {
  code: 'SOURCE_ERROR';
  source: 'gutenberg' | 'openlibrary' | 'archive';
  originalError: Error;
}
```

### Error Handling Patterns

#### Graceful Degradation
```typescript
const fetchBooksWithFallback = async (page = 1): Promise<BooksApiResponse> => {
  const results = await Promise.allSettled([
    fetchGutenbergBooks(page),
    fetchOpenLibraryBooks(page),
    fetchArchiveBooks(page)
  ]);

  const successfulResults = results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  if (successfulResults.length === 0) {
    throw new Error('All book sources are currently unavailable');
  }

  // Combine successful results
  return combineBookResults(successfulResults);
};
```

## Rate Limiting

### Client-Side Rate Limiting
```typescript
class MultiSourceRequestQueue {
  private queues = {
    gutenberg: new RequestQueue(100), // 100ms delay
    openlibrary: new RequestQueue(200), // 200ms delay
    archive: new RequestQueue(300) // 300ms delay
  };

  async add<T>(source: string, request: () => Promise<T>): Promise<T> {
    const queue = this.queues[source] || this.queues.gutenberg;
    return queue.add(request);
  }
}
```

### Server-Side Rate Limiting
The proxy server implements different rate limits for each source:
- **Project Gutenberg**: 60 requests/minute
- **Open Library**: 100 requests/minute  
- **Internet Archive**: 30 requests/minute

## Data Models

### Unified Book Model
```typescript
interface Book {
  id: number | string;
  title: string;
  authors: Author[];
  subjects: string[];
  formats: {
    'image/jpeg'?: string;
    'text/html'?: string;
    'text/plain'?: string;
    'application/pdf'?: string;
    'application/epub+zip'?: string;
  };
  download_count: number;
  source: 'gutenberg' | 'openlibrary' | 'archive';
  isbn?: string[];
  publish_date?: string;
  publisher?: string[];
  description?: string;
  cover_id?: number;
  ia_identifier?: string;
  language?: string[];
}
```

### Source-Specific Conversions
```typescript
// Convert Open Library search result to unified Book model
const convertOpenLibraryToBook = async (doc: any): Promise<Book> => {
  return {
    id: doc.key || `ol_${doc.cover_edition_key}`,
    title: doc.title,
    authors: doc.author_name?.map(name => ({ name })) || [],
    subjects: doc.subject || [],
    source: 'openlibrary',
    // ... other fields
  };
};

// Convert Internet Archive item to unified Book model
const convertArchiveToBook = async (doc: ArchiveItem): Promise<Book> => {
  return {
    id: doc.identifier,
    title: doc.title,
    authors: Array.isArray(doc.creator) 
      ? doc.creator.map(name => ({ name }))
      : [{ name: doc.creator || 'Unknown Author' }],
    source: 'archive',
    // ... other fields
  };
};
```

## Best Practices

### Performance Optimization
1. **Parallel Requests**: Fetch from multiple sources simultaneously
2. **Caching**: Cache responses for frequently accessed books
3. **Lazy Loading**: Load book details on demand
4. **Image Optimization**: Use appropriate image sizes for covers

### Error Recovery
1. **Retry Logic**: Implement exponential backoff for failed requests
2. **Fallback Sources**: Try alternative sources when primary fails
3. **Partial Results**: Show available results even if some sources fail
4. **User Feedback**: Provide clear error messages and recovery options

### Security
1. **Input Validation**: Validate all search queries and IDs
2. **Rate Limiting**: Respect API rate limits for all sources
3. **CORS Handling**: Use proxy server for cross-origin requests
4. **Content Filtering**: Validate content types and sizes

---

**Last Updated**: December 2024  
**Version**: 2.0  
**Contact**: api@xbook-hub.com

This documentation covers the integration of Project Gutenberg, Open Library, and Internet Archive APIs to provide a comprehensive book reading experience across multiple sources.
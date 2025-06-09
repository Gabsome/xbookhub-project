# API Documentation

## Overview

Xbook-Hub integrates with several APIs to provide a comprehensive book reading experience. This document outlines all API integrations, endpoints, and usage patterns.

## Table of Contents

1. [Project Gutenberg API](#project-gutenberg-api)
2. [Proxy Server API](#proxy-server-api)
3. [Uploadcare API](#uploadcare-api)
4. [Local Storage API](#local-storage-api)
5. [IndexedDB API](#indexeddb-api)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Authentication](#authentication)

## Project Gutenberg API

### Base URL
```
https://gutendex.com
```

### Endpoints

#### Get Books
Retrieve a paginated list of books.

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
      "download_count": 12345
    }
  ]
}
```

#### Get Book by ID
Retrieve detailed information about a specific book.

```http
GET /books/{id}
```

**Parameters:**
- `id`: Unique identifier for the book

**Response:**
```json
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
  "download_count": 12345
}
```

### Usage Examples

#### Fetch Books
```typescript
const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
  const response = await fetch(`https://gutendex.com/books?page=${page}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
};
```

#### Search Books
```typescript
const searchBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
  const response = await fetch(
    `https://gutendex.com/books?search=${encodeURIComponent(query)}&page=${page}`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
};
```

## Proxy Server API

### Base URL
```
https://xbookhub-project.onrender.com/api
```

### Purpose
The proxy server handles CORS issues when fetching book content from Project Gutenberg.

### Endpoints

#### Fetch Book Content
Retrieve book content through the proxy server.

```http
GET /fetch-book?url={encoded_url}
```

**Parameters:**
- `url`: URL-encoded book content URL from Project Gutenberg

**Headers:**
```http
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=3600
X-Content-Length: 123456
```

**Response:**
Raw book content (HTML or plain text)

#### Health Check
Check the status of the proxy server.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-07T10:30:00.000Z"
}
```

### Usage Examples

#### Fetch Book Content
```typescript
const fetchBookContent = async (book: Book): Promise<string> => {
  const contentUrl = book.formats['text/html'] || book.formats['text/plain'];
  const proxyUrl = `https://xbookhub-project.onrender.com/api/fetch-book?url=${encodeURIComponent(contentUrl)}`;
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }
  
  return await response.text();
};
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Missing URL parameter",
  "message": "Please provide a URL to fetch content from"
}
```

#### 408 Request Timeout
```json
{
  "error": "Request timeout",
  "message": "The request took too long to complete. Please try again.",
  "url": "https://example.com/book.txt"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred while fetching the content",
  "url": "https://example.com/book.txt"
}
```

## Uploadcare API

### Configuration
```javascript
window.UPLOADCARE_PUBLIC_KEY = 'cb2ddbdec0cd01373ea6';
```

### Widget Integration

#### Initialize Widget
```typescript
import { Widget } from 'uploadcare-widget';

const createUploadcareWidget = (element: HTMLElement, options = {}) => {
  return Widget(element, {
    publicKey: 'cb2ddbdec0cd01373ea6',
    imagesOnly: true,
    previewStep: true,
    ...options,
  });
};
```

#### Upload File
```typescript
const uploadFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const widget = Widget.create({
      publicKey: 'cb2ddbdec0cd01373ea6',
      imagesOnly: true,
      previewStep: true,
    });

    widget.value(file).then(
      (fileInfo) => {
        resolve(fileInfo.cdnUrl);
      },
      (error) => {
        reject(error);
      }
    );
  });
};
```

### Response Format
```json
{
  "uuid": "12345678-1234-1234-1234-123456789012",
  "name": "avatar.jpg",
  "size": 123456,
  "isStored": true,
  "isImage": true,
  "cdnUrl": "https://ucarecdn.com/12345678-1234-1234-1234-123456789012/",
  "originalUrl": "https://ucarecdn.com/12345678-1234-1234-1234-123456789012/avatar.jpg"
}
```

## Local Storage API

### User Data Management

#### Save User Data
```typescript
const saveUserData = (userId: string, data: any): void => {
  localStorage.setItem(`xbook-user-${userId}`, JSON.stringify(data));
};
```

#### Get User Data
```typescript
const getUserData = (userId: string): any => {
  const data = localStorage.getItem(`xbook-user-${userId}`);
  return data ? JSON.parse(data) : null;
};
```

### Saved Books Management

#### Save Book
```typescript
const saveBook = (book: Book, userId: string): void => {
  const savedBooks = getSavedBooks(userId);
  const bookToSave = {
    ...book,
    savedAt: new Date().toISOString(),
  };
  const updatedBooks = [...savedBooks, bookToSave];
  localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
};
```

#### Get Saved Books
```typescript
const getSavedBooks = (userId: string): SavedBook[] => {
  const saved = localStorage.getItem(`xbook-saved-${userId}`);
  return saved ? JSON.parse(saved) : [];
};
```

### Settings Management

#### Save Settings
```typescript
const saveSettings = (settings: UserSettings): void => {
  localStorage.setItem('xbook-settings', JSON.stringify(settings));
};
```

#### Get Settings
```typescript
const getSettings = (): UserSettings => {
  const settings = localStorage.getItem('xbook-settings');
  return settings ? JSON.parse(settings) : {
    theme: 'vintage',
    fontSize: 'medium'
  };
};
```

## IndexedDB API

### Database Schema

#### Database: xbook-offline-db (version 2)

**Object Stores:**
1. `books` - Stores book metadata
   - Key path: `id`
   - Indexes: `title`, `authors`

2. `content` - Stores book content
   - Key path: `bookId`

### Operations

#### Save Book Offline
```typescript
const saveBookOffline = async (book: Book): Promise<void> => {
  const db = await openDB('xbook-offline-db', 2);
  
  // Save book metadata
  await db.put('books', {
    ...book,
    savedAt: new Date().toISOString(),
  });
  
  // Fetch and save content
  const content = await fetchBookContent(book);
  await db.put('content', {
    bookId: book.id,
    content: content,
    fetchedAt: new Date().toISOString(),
  });
};
```

#### Get Offline Book
```typescript
const getOfflineBook = async (id: number): Promise<Book | undefined> => {
  const db = await openDB('xbook-offline-db', 2);
  return await db.get('books', id);
};
```

#### Get All Offline Books
```typescript
const getAllOfflineBooks = async (): Promise<Book[]> => {
  const db = await openDB('xbook-offline-db', 2);
  return await db.getAll('books');
};
```

#### Remove Offline Book
```typescript
const removeOfflineBook = async (id: number): Promise<void> => {
  const db = await openDB('xbook-offline-db', 2);
  const tx = db.transaction(['books', 'content'], 'readwrite');
  
  await tx.objectStore('books').delete(id);
  await tx.objectStore('content').delete(id);
  
  await tx.done;
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
}
```

#### Timeout Errors
```typescript
interface TimeoutError extends Error {
  code: 'TIMEOUT_ERROR';
  timeout: number;
}
```

#### Content Errors
```typescript
interface ContentError extends Error {
  code: 'CONTENT_ERROR';
  contentType?: string;
}
```

### Error Handling Patterns

#### Retry Logic
```typescript
const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      
      if (response.status >= 500 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
};
```

#### Graceful Degradation
```typescript
const fetchBookContent = async (book: Book): Promise<string> => {
  const contentFormats = [
    book.formats['text/html'],
    book.formats['text/plain'],
  ].filter(Boolean);

  for (const contentUrl of contentFormats) {
    try {
      const content = await fetchWithRetry(contentUrl);
      if (content) return content;
    } catch (error) {
      console.warn(`Failed to fetch from ${contentUrl}:`, error);
      continue;
    }
  }
  
  throw new Error('No content available');
};
```

## Rate Limiting

### Client-Side Rate Limiting

#### Request Queue
```typescript
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private delay = 100; // ms between requests

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      await request();
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    
    this.processing = false;
  }
}
```

### Server-Side Rate Limiting

The proxy server implements rate limiting:

- **Requests per minute**: 60
- **Burst limit**: 10
- **Timeout**: 15 seconds per request

## Authentication

### User Authentication

#### Login
```typescript
const login = async (email: string, password: string): Promise<User> => {
  // Mock authentication for demo
  const mockUser: User = {
    id: 'user-123',
    name: 'Demo User',
    email,
    preferredTheme: 'vintage',
  };
  
  localStorage.setItem('xbook-user', JSON.stringify(mockUser));
  return mockUser;
};
```

#### Check Authentication
```typescript
const checkAuth = (): User | null => {
  const storedUser = localStorage.getItem('xbook-user');
  return storedUser ? JSON.parse(storedUser) : null;
};
```

#### Logout
```typescript
const logout = (): void => {
  localStorage.removeItem('xbook-user');
};
```

### API Key Management

#### Uploadcare
```typescript
// Public key (safe for client-side use)
const UPLOADCARE_PUBLIC_KEY = 'cb2ddbdec0cd01373ea6';

// Initialize widget with public key
const widget = Widget.create({
  publicKey: UPLOADCARE_PUBLIC_KEY,
  // ... other options
});
```

## Best Practices

### Performance Optimization

1. **Caching**: Implement proper caching strategies
2. **Pagination**: Use pagination for large datasets
3. **Lazy Loading**: Load content on demand
4. **Compression**: Use gzip compression for text content

### Security

1. **Input Validation**: Validate all user inputs
2. **HTTPS**: Use HTTPS for all communications
3. **CORS**: Properly configure CORS headers
4. **Rate Limiting**: Implement rate limiting to prevent abuse

### Error Handling

1. **Graceful Degradation**: Provide fallbacks for failed requests
2. **User Feedback**: Show meaningful error messages to users
3. **Logging**: Log errors for debugging and monitoring
4. **Retry Logic**: Implement intelligent retry mechanisms

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Contact**: api@xbook-hub.com
import { openDB } from 'idb';
import { Book } from '../types';
import { fetchBookContent } from './api';

// Setup IndexedDB for offline reading
const dbPromise = openDB('xbook-offline-db', 3, {
  upgrade(db, oldVersion) {
    // Create a store for offline books
    if (!db.objectStoreNames.contains('books')) {
      const booksStore = db.createObjectStore('books', { keyPath: 'id' });
      booksStore.createIndex('title', 'title');
      booksStore.createIndex('authors', 'authors', { multiEntry: true });
      booksStore.createIndex('source', 'source');
    }
    
    // Create a store for book content
    if (!db.objectStoreNames.contains('content')) {
      db.createObjectStore('content', { keyPath: 'bookId' });
    }

    // Add source index if upgrading from version 2
    if (oldVersion < 3) {
      const transaction = db.transaction(['books'], 'readwrite');
      const booksStore = transaction.objectStore('books');
      if (!booksStore.indexNames.contains('source')) {
        booksStore.createIndex('source', 'source');
      }
    }
  },
});

// Save a book for offline reading with content
export const saveBookOffline = async (book: Book): Promise<void> => {
  try {
    const db = await dbPromise;
    
    // Save book metadata with source information
    await db.put('books', {
      ...book,
      savedAt: new Date().toISOString(),
    });
    
    // Try to fetch and save content
    try {
      console.log(`Fetching content for offline storage: ${book.title} (${book.source})`);
      const content = await fetchBookContent(book);
      
      await db.put('content', {
        bookId: book.id,
        content: content,
        fetchedAt: new Date().toISOString(),
        source: book.source
      });
      
      console.log(`Successfully saved book "${book.title}" with content for offline reading`);
    } catch (contentError) {
      console.warn(`Failed to fetch content for "${book.title}", saving metadata only:`, contentError);
      // Book metadata is still saved even if content fetch fails
    }
  } catch (error) {
    console.error('Error saving book offline:', error);
    throw new Error('Failed to save book for offline reading');
  }
};

// Get a book from offline storage
export const getOfflineBook = async (id: number | string): Promise<Book | undefined> => {
  try {
    const db = await dbPromise;
    return await db.get('books', id);
  } catch (error) {
    console.error('Error getting offline book:', error);
    return undefined;
  }
};

// Get book content from offline storage
export const getOfflineBookContent = async (id: number | string): Promise<string | null> => {
  try {
    const db = await dbPromise;
    const contentRecord = await db.get('content', id);
    return contentRecord?.content || null;
  } catch (error) {
    console.error('Error getting offline book content:', error);
    return null;
  }
};

// Get all offline books
export const getAllOfflineBooks = async (): Promise<Book[]> => {
  try {
    const db = await dbPromise;
    return await db.getAll('books');
  } catch (error) {
    console.error('Error getting all offline books:', error);
    return [];
  }
};

// Get offline books by source
export const getOfflineBooksBySource = async (source: 'gutenberg' | 'openlibrary' | 'archive'): Promise<Book[]> => {
  try {
    const db = await dbPromise;
    const index = db.transaction('books').store.index('source');
    return await index.getAll(source);
  } catch (error) {
    console.error('Error getting offline books by source:', error);
    return [];
  }
};

// Remove a book from offline storage
export const removeOfflineBook = async (id: number | string): Promise<void> => {
  try {
    const db = await dbPromise;
    const tx = db.transaction(['books', 'content'], 'readwrite');
    
    // Remove book metadata
    await tx.objectStore('books').delete(id);
    
    // Remove book content
    await tx.objectStore('content').delete(id);
    
    await tx.done;
    console.log(`Removed book (ID: ${id}) from offline storage`);
  } catch (error) {
    console.error('Error removing offline book:', error);
    throw new Error('Failed to remove book from offline storage');
  }
};

// Check if a book is available offline
export const isBookAvailableOffline = async (id: number | string): Promise<boolean> => {
  try {
    const db = await dbPromise;
    const book = await db.get('books', id);
    return !!book;
  } catch (error) {
    console.error('Error checking offline availability:', error);
    return false;
  }
};

// Check if book content is available offline
export const isBookContentAvailableOffline = async (id: number | string): Promise<boolean> => {
  try {
    const db = await dbPromise;
    const content = await db.get('content', id);
    return !!content;
  } catch (error) {
    console.error('Error checking offline content availability:', error);
    return false;
  }
};

// Get offline storage statistics
export const getOfflineStorageStats = async (): Promise<{
  totalBooks: number;
  totalSize: number;
  booksWithContent: number;
  bySource: {
    gutenberg: number;
    openlibrary: number;
    archive: number;
  };
}> => {
  try {
    const db = await dbPromise;
    const books = await db.getAll('books');
    const contents = await db.getAll('content');
    
    let totalSize = 0;
    contents.forEach(content => {
      totalSize += content.content?.length || 0;
    });

    const bySource = {
      gutenberg: books.filter(book => book.source === 'gutenberg').length,
      openlibrary: books.filter(book => book.source === 'openlibrary').length,
      archive: books.filter(book => book.source === 'archive').length,
    };
    
    return {
      totalBooks: books.length,
      totalSize,
      booksWithContent: contents.length,
      bySource
    };
  } catch (error) {
    console.error('Error getting offline storage stats:', error);
    return {
      totalBooks: 0,
      totalSize: 0,
      booksWithContent: 0,
      bySource: {
        gutenberg: 0,
        openlibrary: 0,
        archive: 0
      }
    };
  }
};

// Clear all offline data
export const clearOfflineStorage = async (): Promise<void> => {
  try {
    const db = await dbPromise;
    const tx = db.transaction(['books', 'content'], 'readwrite');
    
    await tx.objectStore('books').clear();
    await tx.objectStore('content').clear();
    
    await tx.done;
    console.log('Cleared all offline storage');
  } catch (error) {
    console.error('Error clearing offline storage:', error);
    throw new Error('Failed to clear offline storage');
  }
};

// Clear offline data by source
export const clearOfflineStorageBySource = async (source: 'gutenberg' | 'openlibrary' | 'archive'): Promise<void> => {
  try {
    const db = await dbPromise;
    const books = await getOfflineBooksBySource(source);
    
    const tx = db.transaction(['books', 'content'], 'readwrite');
    const booksStore = tx.objectStore('books');
    const contentStore = tx.objectStore('content');
    
    for (const book of books) {
      await booksStore.delete(book.id);
      await contentStore.delete(book.id);
    }
    
    await tx.done;
    console.log(`Cleared offline storage for source: ${source}`);
  } catch (error) {
    console.error('Error clearing offline storage by source:', error);
    throw new Error(`Failed to clear offline storage for ${source}`);
  }
};
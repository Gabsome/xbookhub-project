import { openDB, DBSchema } from 'idb';
import { Book } from '../types';
import { fetchBookContent } from './api';

// Define your database schema for better type safety with idb
interface MyDB extends DBSchema {
    books: {
        key: string | number;
        value: Book & { savedAt: string }; // Add savedAt to the stored Book type
        indexes: { 'title': string, 'authors': string[], 'source': string };
    };
    content: {
        key: string | number;
        value: { bookId: string | number; content: string; fetchedAt: string; source: string };
    };
}

const DB_NAME = 'xbook-offline-db';
const DB_VERSION = 3;

const dbPromise = openDB<MyDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) { // transaction parameter is the upgrade transaction
    console.log(`IndexedDB upgrade needed. Old version: ${oldVersion}, New version: ${newVersion}`);
    
    // Define booksStore here to be accessible throughout the upgrade logic
    let booksStore: ReturnType<typeof db.createObjectStore<'books'>> | null = null;

    // Create or get the 'books' store
    if (!db.objectStoreNames.contains('books')) {
      console.log("Creating 'books' object store.");
      booksStore = db.createObjectStore('books', { keyPath: 'id' });
      booksStore.createIndex('title', 'title');
      booksStore.createIndex('authors', 'authors', { multiEntry: true });
      // The 'source' index will be added in the oldVersion < 3 block if it's new
    } else {
      // If the store already exists, get a reference to it for modifications
      // Use the transaction object provided to the upgrade function to get the store.
      booksStore = transaction.objectStore('books');
      console.log("Existing 'books' object store found.");
    }
    
    // Create or get the 'content' store
    if (!db.objectStoreNames.contains('content')) {
      console.log("Creating 'content' object store.");
      db.createObjectStore('content', { keyPath: 'bookId' });
    }

    // Add source index if upgrading from version 2 (or from a version that didn't have it)
    if (oldVersion < 3) {
      console.log("Upgrading to version 3: Adding 'source' index to 'books' store.");
      if (booksStore && !booksStore.indexNames.contains('source')) {
        booksStore.createIndex('source', 'source');
      }
    }
    // Handle other version upgrades if needed in the future
    // if (oldVersion < 4) { ... }
  },
  blocked() {
    console.warn('Database upgrade is blocked. Please close other tabs of this application.');
  },
  blocking() {
    console.warn('Database is blocking a new version. Please close all old connections to allow upgrade.');
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
    const book = await db.get('books', id);
    // Remove the 'savedAt' property if you only want the original Book type returned
    if (book) {
        const { savedAt, ...rest } = book;
        return rest as Book;
    }
    return undefined;
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
    const booksWithMeta = await db.getAll('books');
    // Map back to original Book type
    return booksWithMeta.map(({ savedAt, ...rest }) => rest as Book);
  } catch (error) {
    console.error('Error getting all offline books:', error);
    return [];
  }
};

// Get offline books by source
export const getOfflineBooksBySource = async (source: 'gutenberg' | 'openlibrary' | 'archive'): Promise<Book[]> => {
  try {
    const db = await dbPromise;
    const booksWithMeta = await db.getAllFromIndex('books', 'source', source); // Use getAllFromIndex
    // Map back to original Book type
    return booksWithMeta.map(({ savedAt, ...rest }) => rest as Book);
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
      totalSize += content.content?.length || 0; // Check for content existence
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
    const books = await getOfflineBooksBySource(source); // Uses existing function to get books by source
    
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
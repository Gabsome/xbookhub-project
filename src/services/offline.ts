import { openDB } from 'idb';
import { Book } from '../types';
import { fetchBookContent } from './api';

// Setup IndexedDB for offline reading
const dbPromise = openDB('xbook-offline-db', 2, {
  upgrade(db, oldVersion) {
    // Create a store for offline books
    if (!db.objectStoreNames.contains('books')) {
      const booksStore = db.createObjectStore('books', { keyPath: 'id' });
      booksStore.createIndex('title', 'title');
      booksStore.createIndex('authors', 'authors', { multiEntry: true });
    }
    
    // Create a store for book content
    if (!db.objectStoreNames.contains('content')) {
      db.createObjectStore('content', { keyPath: 'bookId' });
    }
  },
});

// Save a book for offline reading with content
export const saveBookOffline = async (book: Book): Promise<void> => {
  try {
    const db = await dbPromise;
    
    // Save book metadata
    await db.put('books', {
      ...book,
      savedAt: new Date().toISOString(),
    });
    
    // Try to fetch and save content
    try {
      console.log(`Fetching content for offline storage: ${book.title}`);
      const content = await fetchBookContent(book);
      
      await db.put('content', {
        bookId: book.id,
        content: content,
        fetchedAt: new Date().toISOString(),
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
export const getOfflineBook = async (id: number): Promise<Book | undefined> => {
  try {
    const db = await dbPromise;
    return await db.get('books', id);
  } catch (error) {
    console.error('Error getting offline book:', error);
    return undefined;
  }
};

// Get book content from offline storage
export const getOfflineBookContent = async (id: number): Promise<string | null> => {
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

// Remove a book from offline storage
export const removeOfflineBook = async (id: number): Promise<void> => {
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
export const isBookAvailableOffline = async (id: number): Promise<boolean> => {
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
export const isBookContentAvailableOffline = async (id: number): Promise<boolean> => {
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
}> => {
  try {
    const db = await dbPromise;
    const books = await db.getAll('books');
    const contents = await db.getAll('content');
    
    let totalSize = 0;
    contents.forEach(content => {
      totalSize += content.content?.length || 0;
    });
    
    return {
      totalBooks: books.length,
      totalSize,
      booksWithContent: contents.length,
    };
  } catch (error) {
    console.error('Error getting offline storage stats:', error);
    return {
      totalBooks: 0,
      totalSize: 0,
      booksWithContent: 0,
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
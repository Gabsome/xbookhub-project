import { openDB } from 'idb';
import { Book } from '../types';

// Setup IndexedDB for offline reading
const dbPromise = openDB('xbook-offline-db', 1, {
  upgrade(db) {
    // Create a store for offline books
    db.createObjectStore('books', { keyPath: 'id' });
  },
});

// Save a book for offline reading
export const saveBookOffline = async (book: Book): Promise<void> => {
  const db = await dbPromise;
  await db.put('books', book);
};

// Get a book from offline storage
export const getOfflineBook = async (id: number): Promise<Book | undefined> => {
  const db = await dbPromise;
  return db.get('books', id);
};

// Get all offline books
export const getAllOfflineBooks = async (): Promise<Book[]> => {
  const db = await dbPromise;
  return db.getAll('books');
};

// Remove a book from offline storage
export const removeOfflineBook = async (id: number): Promise<void> => {
  const db = await dbPromise;
  await db.delete('books', id);
};

// Check if a book is available offline
export const isBookAvailableOffline = async (id: number): Promise<boolean> => {
  const db = await dbPromise;
  const book = await db.get('books', id);
  return !!book;
};

// Function to download text content for offline reading
export const downloadBookContent = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download book content');
  }
  return response.text();
};

// Save book content for offline reading
export const saveBookContent = async (bookId: number, content: string): Promise<void> => {
  const db = await dbPromise;
  const tx = db.transaction('books', 'readwrite');
  const store = tx.objectStore('books');
  
  const book = await store.get(bookId);
  if (book) {
    book.offlineContent = content;
    await store.put(book);
  }
  
  await tx.done;
};
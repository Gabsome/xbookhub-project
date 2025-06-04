import { BooksApiResponse, Book } from '../types';

const BASE_URL = 'https://gutendex.com';

// Fetch books with pagination support
export const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
  const response = await fetch(`${BASE_URL}/books?page=${page}`);
  if (!response.ok) {
    throw new Error('Failed to fetch books');
  }
  return response.json();
};

// Fetch books by search term
export const searchBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
  const response = await fetch(`${BASE_URL}/books?search=${encodeURIComponent(query)}&page=${page}`);
  if (!response.ok) {
    throw new Error('Failed to search books');
  }
  return response.json();
};

// Fetch book by ID
export const fetchBookById = async (id: number): Promise<Book> => {
  const response = await fetch(`${BASE_URL}/books/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch book details');
  }
  return response.json();
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
export const removeSavedBook = async (bookId: number, userId: string): Promise<void> => {
  const savedBooks = getSavedBooks(userId);
  const updatedBooks = savedBooks.filter(book => book.id !== bookId);
  localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
};

// Update user note for a book
export const updateBookNote = async (bookId: number, userId: string, note: string): Promise<void> => {
  const savedBooks = getSavedBooks(userId);
  const updatedBooks = savedBooks.map(book => 
    book.id === bookId ? { ...book, notes: note } : book
  );
  localStorage.setItem(`xbook-saved-${userId}`, JSON.stringify(updatedBooks));
};
import { BooksApiResponse, Book } from '../types';

const BASE_URL = 'https://gutendex.com';
const PROXY_URL = 'https://xbookhub-project.onrender.com/api/fetch-book';

// Enhanced fetch with retry logic and better error handling
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      if (response.status >= 500 && i < retries - 1) {
        // Server error, retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw new Error('Max retries exceeded');
};

// Fetch books with pagination support
export const fetchBooks = async (page = 1): Promise<BooksApiResponse> => {
  try {
    const response = await fetchWithRetry(`${BASE_URL}/books?page=${page}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching books:', error);
    throw new Error('Failed to fetch books. Please check your internet connection and try again.');
  }
};

// Fetch books by search term
export const searchBooks = async (query: string, page = 1): Promise<BooksApiResponse> => {
  try {
    const response = await fetchWithRetry(`${BASE_URL}/books?search=${encodeURIComponent(query)}&page=${page}`);
    return await response.json();
  } catch (error) {
    console.error('Error searching books:', error);
    throw new Error('Failed to search books. Please check your internet connection and try again.');
  }
};

// Fetch book by ID
export const fetchBookById = async (id: number): Promise<Book> => {
  try {
    const response = await fetchWithRetry(`${BASE_URL}/books/${id}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching book details:', error);
    throw new Error('Failed to fetch book details. Please check your internet connection and try again.');
  }
};

// Enhanced book content fetching with fallback options
export const fetchBookContent = async (book: Book): Promise<string> => {
  const contentFormats = [
    book.formats['text/html'],
    book.formats['text/plain'],
    book.formats['text/html; charset=utf-8'],
    book.formats['text/plain; charset=utf-8']
  ].filter(Boolean);

  if (contentFormats.length === 0) {
    throw new Error('No readable content available for this book.');
  }

  let lastError: Error | null = null;

  // Try each format until one works
  for (const contentUrl of contentFormats) {
    try {
      const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(contentUrl)}`;
      const response = await fetchWithRetry(proxyUrl);
      
      if (response.ok) {
        const content = await response.text();
        if (content && content.trim().length > 0) {
          return content;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch content from ${contentUrl}:`, error);
      lastError = error as Error;
      continue;
    }
  }

  // If proxy fails, try direct fetch as fallback (may work in some cases)
  for (const contentUrl of contentFormats) {
    try {
      const response = await fetchWithRetry(contentUrl);
      if (response.ok) {
        const content = await response.text();
        if (content && content.trim().length > 0) {
          return content;
        }
      }
    } catch (error) {
      console.warn(`Direct fetch also failed for ${contentUrl}:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error('Failed to fetch book content from any available source.');
};

// Download book content as file
export const downloadBookAsFile = async (book: Book, format: 'txt' | 'html' = 'txt'): Promise<void> => {
  try {
    const content = await fetchBookContent(book);
    
    // Clean filename
    const filename = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
    
    // Create blob based on format
    let blob: Blob;
    let mimeType: string;
    
    if (format === 'html') {
      mimeType = 'text/html';
      blob = new Blob([content], { type: mimeType });
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
    const content = await fetchBookContent(book);
    
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
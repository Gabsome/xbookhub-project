import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Bookmark, Download, Share, Book as BookIcon,
  Calendar, Clock, Users
} from 'lucide-react';
import { fetchBookById } from '../services/api';
import { saveBook, getSavedBooks, removeSavedBook } from '../services/api';
import { saveBookOffline, isBookAvailableOffline, removeOfflineBook } from '../services/offline';
import { useAuth } from '../context/AuthContext';
import { Book } from '../types';

const BookDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [readingContent, setReadingContent] = useState<string | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);
        if (!id) return;
        
        // Fetch book details
        const bookData = await fetchBookById(Number(id));
        setBook(bookData);
        
        // Check if book is saved
        if (currentUser) {
          const savedBooks = getSavedBooks(currentUser.id);
          setIsSaved(savedBooks.some(savedBook => savedBook.id === Number(id)));
        }
        
        // Check if book is available offline
        const offlineStatus = await isBookAvailableOffline(Number(id));
        setIsOffline(offlineStatus);
      } catch (err) {
        console.error('Error fetching book:', err);
        setError('Failed to load book details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBook();
  }, [id, currentUser]);

  const handleSaveBook = async () => {
    if (!book || !currentUser) return;
    
    try {
      if (isSaved) {
        await removeSavedBook(book.id, currentUser.id);
        setIsSaved(false);
      } else {
        await saveBook(book, currentUser.id);
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Error saving/removing book:', err);
    }
  };

  const handleToggleOffline = async () => {
    if (!book) return;
    
    try {
      if (isOffline) {
        await removeOfflineBook(book.id);
        setIsOffline(false);
      } else {
        await saveBookOffline(book);
        setIsOffline(true);
      }
    } catch (err) {
      console.error('Error with offline book:', err);
    }
  };

  const handleShareBook = () => {
    if (navigator.share && book) {
      navigator.share({
        title: book.title,
        text: `Check out "${book.title}" by ${book.authors.map(a => a.name).join(', ')} on Xbook-Hub!`,
        url: window.location.href,
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const fetchBookContent = async () => {
    if (!book) return;
    
    try {
      setLoading(true);
      
      // Try to get HTML content first, then plaintext
      const contentUrl = book.formats['text/html'] || book.formats['text/plain'];
      
      if (!contentUrl) {
        setError('No readable content available for this book.');
        return;
      }
      
      const response = await fetch(contentUrl);
      if (!response.ok) throw new Error('Failed to fetch book content');
      
      const content = await response.text();
      setReadingContent(content);
      setIsReadingMode(true);
    } catch (err) {
      console.error('Error fetching book content:', err);
      setError('Failed to load book content. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center text-amber-900 dark:text-amber-400"
        >
          <ArrowLeft className="h-5 w-5 mr-1" /> Go Back
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12">
        <BookIcon className="h-16 w-16 text-amber-300 dark:text-amber-700 mx-auto mb-4" />
        <h2 className="text-xl font-serif font-medium text-amber-900 dark:text-amber-300">
          Book not found
        </h2>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 flex items-center mx-auto text-amber-900 dark:text-amber-400"
        >
          <ArrowLeft className="h-5 w-5 mr-1" /> Return to Home
        </button>
      </div>
    );
  }

  if (isReadingMode && readingContent) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => setIsReadingMode(false)}
            className="flex items-center text-amber-900 dark:text-amber-400"
          >
            <ArrowLeft className="h-5 w-5 mr-1" /> Back to Details
          </button>
          
          <div className="flex space-x-3">
            <button 
              onClick={handleSaveBook}
              className={`p-2 rounded-full ${
                isSaved 
                  ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-200' 
                  : 'bg-amber-100 text-amber-800 dark:bg-gray-800 dark:text-amber-400'
              }`}
              aria-label={isSaved ? 'Remove from saved' : 'Save book'}
            >
              <Bookmark className="h-5 w-5" />
            </button>
            
            <button 
              onClick={handleToggleOffline}
              className={`p-2 rounded-full ${
                isOffline 
                  ? 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-200' 
                  : 'bg-amber-100 text-amber-800 dark:bg-gray-800 dark:text-amber-400'
              }`}
              aria-label={isOffline ? 'Remove from offline' : 'Save for offline'}
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-gray-800 rounded-lg p-6 md:p-10 shadow-md">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-amber-900 dark:text-amber-300 mb-4">
            {book.title}
          </h1>
          
          <div 
            className="prose prose-amber dark:prose-invert max-w-none font-serif" 
            dangerouslySetInnerHTML={{ __html: readingContent }}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-amber-900 dark:text-amber-400 mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-1" /> Back to Books
      </button>
      
      <div className="bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-lg">
        <div className="md:flex">
          <div className="md:w-1/3 lg:w-1/4 p-6 flex justify-center">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="relative"
            >
              <img 
                src={book.formats['image/jpeg'] || 'https://placehold.co/300x450/e9d8b6/453a22?text=No+Cover'}
                alt={`Cover for ${book.title}`}
                className="w-full max-w-xs object-cover rounded shadow-md border border-amber-200 dark:border-gray-700"
              />
              
              <div className="absolute -top-4 -right-4 flex space-x-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSaveBook}
                  className={`p-3 rounded-full shadow-md ${
                    isSaved 
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-200' 
                      : 'bg-white text-amber-800 dark:bg-gray-800 dark:text-amber-400'
                  }`}
                  aria-label={isSaved ? 'Remove from saved' : 'Save book'}
                >
                  <Bookmark className="h-5 w-5" />
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleOffline}
                  className={`p-3 rounded-full shadow-md ${
                    isOffline 
                      ? 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-200' 
                      : 'bg-white text-amber-800 dark:bg-gray-800 dark:text-amber-400'
                  }`}
                  aria-label={isOffline ? 'Remove from offline' : 'Save for offline'}
                >
                  <Download className="h-5 w-5" />
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShareBook}
                  className="p-3 rounded-full shadow-md bg-white text-amber-800 dark:bg-gray-800 dark:text-amber-400"
                  aria-label="Share book"
                >
                  <Share className="h-5 w-5" />
                </motion.button>
              </div>
            </motion.div>
          </div>
          
          <div className="md:w-2/3 lg:w-3/4 p-6 md:p-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-amber-900 dark:text-amber-300">
                {book.title}
              </h1>
              
              <div className="mt-3 flex flex-wrap items-center text-amber-800 dark:text-amber-400">
                <span className="flex items-center mr-4 mb-2">
                  <Users className="h-4 w-4 mr-1" />
                  {book.authors.map(author => 
                    <span key={author.name} className="font-medium italic">
                      {author.name}
                      {author.birth_year && author.death_year 
                        ? ` (${author.birth_year}-${author.death_year})` 
                        : author.birth_year 
                          ? ` (b. ${author.birth_year})` 
                          : ''}
                    </span>
                  )}
                </span>
                
                <span className="flex items-center mr-4 mb-2">
                  <BookIcon className="h-4 w-4 mr-1" />
                  {book.download_count.toLocaleString()} downloads
                </span>
                
                {book.subjects.length > 0 && (
                  <span className="flex items-center mb-2">
                    <Calendar className="h-4 w-4 mr-1" />
                    {book.subjects
                      .filter(s => s.includes('Fiction') || s.includes('Non-Fiction'))
                      .slice(0, 1)
                      .map(s => s.split(' -- ')[0])[0] || 'Unknown Genre'}
                  </span>
                )}
              </div>
              
              <div className="mt-6">
                <h2 className="text-lg font-serif font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  Subjects
                </h2>
                <div className="flex flex-wrap gap-2">
                  {book.subjects.slice(0, 8).map((subject, index) => (
                    <span 
                      key={index}
                      className="text-sm bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 
                        px-3 py-1 rounded-full"
                    >
                      {subject.split(' -- ')[0].substring(0, 30)}
                      {subject.split(' -- ')[0].length > 30 ? '...' : ''}
                    </span>
                  ))}
                  {book.subjects.length > 8 && (
                    <span className="text-sm text-amber-700 dark:text-amber-500">
                      +{book.subjects.length - 8} more
                    </span>
                  )}
                </div>
              </div>
              
              <div className="mt-8">
                <h2 className="text-lg font-serif font-semibold text-amber-900 dark:text-amber-300 mb-3">
                  Available Formats
                </h2>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(book.formats).map(([format, url]) => {
                    const formatName = format.split('/')[1]?.toUpperCase() || format;
                    // Filter out image formats for the format list
                    if (format.startsWith('image/')) return null;
                    
                    return (
                      <a 
                        key={format}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-400
                          px-3 py-2 rounded border border-amber-200 dark:border-gray-700
                          hover:bg-amber-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        {formatName}
                      </a>
                    );
                  })}
                </div>
              </div>
              
              <div className="mt-10 flex flex-wrap gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={fetchBookContent}
                  className="px-6 py-3 bg-amber-700 dark:bg-amber-800 text-white rounded-lg 
                    shadow-md hover:bg-amber-800 dark:hover:bg-amber-700 transition-colors
                    flex items-center font-medium"
                >
                  <Clock className="h-5 w-5 mr-2" /> 
                  Read Now
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleToggleOffline}
                  className={`px-6 py-3 rounded-lg shadow-md flex items-center font-medium ${
                    isOffline
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                      : 'bg-amber-100 text-amber-800 dark:bg-gray-800 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Download className="h-5 w-5 mr-2" />
                  {isOffline ? 'Saved Offline' : 'Save for Offline'}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BookDetail;
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bookmark, Download, Share, Book as BookIcon,
  Calendar, Clock, Users, FileText, File, Loader2, Globe, Archive, Library, Sun, Moon
} from 'lucide-react';
import { fetchBookById, fetchBookContent, downloadBookAsFile, downloadBookAsPDF } from '../services/api';
import { saveBook, getSavedBooks, removeSavedBook } from '../services/api';
import { saveBookOffline, isBookAvailableOffline, removeOfflineBook } from '../services/offline';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; // Assuming you have a ThemeContext
import { Book } from '../types';

// Utility for showing toast messages (placeholder, you'd integrate a real toast library)
const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
  console.log(`Toast (${type}): ${message}`);
  // In a real app, you'd use a toast library like react-hot-toast, react-toastify, etc.
  // Example: toast[type](message);
  alert(message); // Fallback to alert for demonstration
};

const BookDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme(); // Use theme context for dynamic styles

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [readingContent, setReadingContent] = useState<string | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'html' | 'pdf'>('txt');
  const [showFullDescription, setShowFullDescription] = useState(false); // New state for description toggle
  const [fontSize, setFontSize] = useState(16); // New state for reading font size
  const [lineHeight, setLineHeight] = useState(1.6); // New state for reading line height

  // Ref for reading content scroll position
  const readingContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) return;

        const bookId = /^\d+$/.test(id) ? Number(id) : id;

        const bookData = await fetchBookById(bookId);
        setBook(bookData);

        if (currentUser) {
          const savedBooks = getSavedBooks(currentUser.id);
          setIsSaved(savedBooks.some(savedBook => savedBook.id === bookId));
        }

        const offlineStatus = await isBookAvailableOffline(bookId);
        setIsOffline(offlineStatus);
      } catch (err) {
        console.error('Error fetching book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchBook();
  }, [id, currentUser]);

  // Scroll to top when entering reading mode
  useEffect(() => {
    if (isReadingMode && readingContentRef.current) {
      readingContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isReadingMode]);

  const handleSaveBook = async () => {
    if (!book || !currentUser) {
      showToast('Please log in to save books.', 'info');
      return;
    }

    try {
      if (isSaved) {
        await removeSavedBook(book.id, currentUser.id);
        setIsSaved(false);
        showToast(`"${book.title}" removed from your saved list.`, 'info');
      } else {
        await saveBook(book, currentUser.id);
        setIsSaved(true);
        showToast(`"${book.title}" saved to your list!`, 'success');
      }
    } catch (err) {
      console.error('Error saving/removing book:', err);
      showToast('Failed to save/remove book. Please try again.', 'error');
    }
  };

  const handleToggleOffline = async () => {
    if (!book) {
      console.warn('No book selected to toggle offline status.');
      showToast('No book data available for offline saving.', 'error');
      return;
    }

    try {
      if (isOffline) {
        await removeOfflineBook(book.id);
        setIsOffline(false);
        showToast(`"${book.title}" removed from offline storage.`, 'info');
      } else {
        // Option to fetch content first for offline saving if not already in reading mode
        if (!readingContent && !isLoadingContent) {
          // You might want to pre-fetch content to ensure it's available offline
          // For now, let's assume saveBookOffline handles content fetching internally
          // or we are just saving metadata. If content must be fetched first, uncomment below:
          // await fetchBookContentForReading();
        }
        await saveBookOffline(book); // Assuming this also saves content if available
        setIsOffline(true);
        showToast(`"${book.title}" saved for offline reading!`, 'success');
      }
    } catch (err) {
      console.error('Error handling offline storage:', err);
      showToast('Failed to save/remove book for offline use. See console for details.', 'error');
    }
  };

  const handleShareBook = () => {
    if (navigator.share && book) {
      navigator.share({
        title: book.title,
        text: `Check out "${book.title}" by ${book.authors.map(a => a.name).join(', ')} on Xbook-Hub!`,
        url: window.location.href,
      }).then(() => {
        showToast('Book shared successfully!', 'success');
      }).catch(err => {
        console.error('Error sharing:', err);
        showToast('Failed to share book.', 'error');
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard!', 'info');
    }
  };

  const fetchBookContentForReading = async () => {
    if (!book) return;

    try {
      setIsLoadingContent(true);
      setError(null);

      const content = await fetchBookContent(book);
      setReadingContent(content);
      setIsReadingMode(true);
    } catch (err) {
      console.error('Error fetching book content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book content. Please try again later.');
      showToast('Failed to load book content for reading.', 'error');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleDownload = async () => {
    if (!book) return;

    try {
      setIsDownloading(true);
      setError(null);

      if (downloadFormat === 'pdf') {
        await downloadBookAsPDF(book);
      } else {
        await downloadBookAsFile(book, downloadFormat);
      }
      showToast(`"${book.title}" downloaded as ${downloadFormat.toUpperCase()}.`, 'success');
    } catch (err) {
      console.error('Error downloading book:', err);
      setError(err instanceof Error ? err.message : 'Failed to download book. Please try again.');
      showToast('Failed to download book. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Get source icon and name
  const getSourceInfo = () => {
    if (!book) return { icon: <BookIcon className="h-4 w-4" />, name: 'Unknown' };

    switch (book.source) {
      case 'gutenberg':
        return { icon: <Globe className="h-4 w-4" />, name: 'Project Gutenberg' };
      case 'openlibrary':
        return { icon: <Library className="h-4 w-4" />, name: 'Open Library' };
      case 'archive':
        return { icon: <Archive className="h-4 w-4" />, name: 'Internet Archive' };
      default:
        return { icon: <BookIcon className="h-4 w-4" />, name: 'Unknown Source' };
    }
  };

  // Get cover image
  const getCoverImage = () => {
    if (!book) return 'https://placehold.co/300x450/e9d8b6/453a22?text=No+Cover';

    if (book.formats['image/jpeg']) {
      return book.formats['image/jpeg'];
    }

    // For Open Library books, try to construct cover URL
    if (book.source === 'openlibrary' && book.cover_id) {
      return `https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg`;
    }

    return 'https://placehold.co/300x450/e9d8b6/453a22?text=No+Cover';
  };

  const sourceInfo = getSourceInfo();

  // Variants for Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.3 } } // For AnimatePresence
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (loading) {
    return (
      <motion.div
        className="flex justify-center items-center min-h-[60vh] flex-col"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Loader2 className="h-12 w-12 animate-spin text-amber-700 dark:text-amber-500 mb-4" />
        <span className="text-xl font-serif text-amber-800 dark:text-amber-400">Loading book details...</span>
        {/* Simple skeleton for visual continuity */}
        <div className="w-64 h-4 bg-amber-200 dark:bg-gray-700 rounded-full mt-4 animate-pulse"></div>
        <div className="w-48 h-4 bg-amber-200 dark:bg-gray-700 rounded-full mt-2 animate-pulse"></div>
      </motion.div>
    );
  }

  if (error && !book) {
    return (
      <motion.div
        className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-8 rounded-lg shadow-lg max-w-md mx-auto my-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <h2 className="text-2xl font-serif font-semibold mb-4">Error Loading Book</h2>
        <p className="mb-6">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" /> Go Back
        </button>
      </motion.div>
    );
  }

  if (!book) {
    return (
      <motion.div
        className="text-center py-16 bg-amber-50 dark:bg-gray-900 rounded-lg shadow-lg max-w-xl mx-auto my-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <BookIcon className="h-20 w-20 text-amber-300 dark:text-amber-700 mx-auto mb-6 opacity-75" />
        <h2 className="text-2xl font-serif font-medium text-amber-900 dark:text-amber-300 mb-4">
          Book not found or an unexpected error occurred.
        </h2>
        <p className="text-amber-800 dark:text-amber-400 mb-6">
          The book you are looking for might have been moved or doesn't exist.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 flex items-center mx-auto text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" /> Return to Home
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isReadingMode && readingContent ? (
        <motion.div
          key="reading-mode"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit" // Exit animation when switching back
          className="max-w-4xl mx-auto py-4 sm:py-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsReadingMode(false)}
              className="flex items-center text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors font-medium text-lg"
            >
              <ArrowLeft className="h-6 w-6 mr-2" /> Back to Details
            </motion.button>

            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
              {/* Reading Controls */}
              <div className="flex items-center space-x-2 bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-300 px-3 py-2 rounded-lg shadow-inner">
                <label htmlFor="fontSize" className="sr-only">Font Size</label>
                <input
                  id="fontSize"
                  type="range"
                  min="12"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-20 h-2 bg-amber-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                />
                 <span className="text-sm font-semibold">{fontSize}px</span>

                <label htmlFor="lineHeight" className="sr-only">Line Height</label>
                <input
                  id="lineHeight"
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  value={lineHeight}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                  className="w-20 h-2 bg-amber-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                />
                <span className="text-sm font-semibold">{lineHeight.toFixed(1)}</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSaveBook}
                className={`p-3 rounded-full shadow-md transition-all duration-200 ${
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
                className={`p-3 rounded-full shadow-md transition-all duration-200 ${
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
                onClick={toggleTheme}
                className="p-3 rounded-full shadow-md bg-white text-amber-800 dark:bg-gray-800 dark:text-amber-400"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </motion.button>
            </div>
          </div>

          <div
            ref={readingContentRef} // Attach ref here
            className="bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-gray-800 rounded-lg p-6 md:p-10 shadow-xl overflow-y-auto max-h-[80vh] custom-scrollbar" // Added max-h and custom-scrollbar
          >
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-amber-900 dark:text-amber-300 mb-6 text-center">
              {book.title}
            </h1>
            <p className="text-center text-lg text-amber-700 dark:text-amber-500 mb-8 italic">
              by {book.authors.map(a => a.name).join(', ')}
            </p>

            <div
              className="prose prose-amber dark:prose-invert max-w-none font-serif text-amber-900 dark:text-amber-100"
              style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}` }} // Apply dynamic styles
              dangerouslySetInnerHTML={{ __html: readingContent }}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="detail-mode"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit" // Exit animation when switching to reading mode
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-amber-900 dark:text-amber-400 mb-6 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-lg font-medium"
          >
            <ArrowLeft className="h-6 w-6 mr-2" /> Back to Books
          </button>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-md mb-6 shadow-md"
            >
              <p>{error}</p>
            </motion.div>
          )}

          <div className="bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-xl"> {/* Enhanced shadow */}
            <div className="md:flex">
              <div className="md:w-1/3 lg:w-1/4 p-6 flex justify-center items-center relative"> {/* Added items-center for vertical alignment */}
                <motion.div
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="relative group" // Added group for hover effects
                >
                  <img
                    src={getCoverImage()}
                    alt={`Cover for ${book.title}`}
                    className="w-full max-w-xs object-cover rounded-lg shadow-lg border border-amber-200 dark:border-gray-700 transform transition-transform duration-300 group-hover:scale-105" // Rounded-lg and hover effect
                  />

                  <div className="absolute -top-4 -right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"> {/* Hidden until hover */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSaveBook}
                      className={`p-3 rounded-full shadow-lg transition-all duration-200 ${
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
                      className={`p-3 rounded-full shadow-lg transition-all duration-200 ${
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
                      className="p-3 rounded-full shadow-lg bg-white text-amber-800 dark:bg-gray-800 dark:text-amber-400 transition-colors duration-200"
                      aria-label="Share book"
                    >
                      <Share className="h-5 w-5" />
                    </motion.button>
                  </div>
                </motion.div>
              </div>

              <div className="md:w-2/3 lg:w-3/4 p-6 md:p-8">
                <motion.div
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="flex items-center gap-1 text-sm bg-amber-100 dark:bg-gray-800
                      text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full font-medium"> {/* Larger tag, font-medium */}
                      {sourceInfo.icon}
                      <span>{sourceInfo.name}</span>
                    </div>

                    {book.language && book.language.length > 0 && (
                      <span className="text-sm bg-amber-100 dark:bg-gray-800 text-amber-800
                        dark:text-amber-300 px-3 py-1 rounded-full font-medium"> {/* Larger tag, font-medium */}
                        {book.language[0].toUpperCase()}
                      </span>
                    )}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleTheme}
                        className="p-2 rounded-full shadow-sm bg-amber-100 text-amber-800 dark:bg-gray-800 dark:text-amber-400 transition-colors duration-200"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </motion.button>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-amber-900 dark:text-amber-300 leading-tight mb-4"> {/* Larger title, tighter line-height */}
                    {book.title}
                  </h1>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-amber-800 dark:text-amber-400 text-sm"> {/* Grid for better alignment */}
                    <span className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-500" /> {/* Icon color */}
                      {book.authors.map(author =>
                        <span key={author.name} className="font-semibold italic"> {/* Stronger author styling */}
                          {author.name}
                          {author.birth_year && author.death_year
                            ? ` (${author.birth_year}-${author.death_year})`
                            : author.birth_year
                              ? ` (b. ${author.birth_year})`
                              : ''}
                        </span>
                      )}
                    </span>

                    <span className="flex items-center">
                      <BookIcon className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-500" /> {/* Icon color */}
                      <span className="font-semibold">{book.download_count.toLocaleString()}</span> downloads
                    </span>

                    {book.publish_date && (
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-500" /> {/* Icon color */}
                        Published: <span className="font-semibold ml-1">{book.publish_date}</span>
                      </span>
                    )}
                     {book.publisher && book.publisher.length > 0 && (
                        <span className="flex items-center col-span-full md:col-span-1"> {/* Spans full width on small screens */}
                            <FileText className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-500" />
                            Publisher: <span className="font-semibold ml-1">{book.publisher.join(', ')}</span>
                        </span>
                    )}
                  </div>

                  {/* Description */}
                  {book.description && (
                    <div className="mt-6 border-t border-amber-200 dark:border-gray-700 pt-6"> {/* Separator */}
                      <h3 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-3">
                        Description
                      </h3>
                      <p className="text-amber-800 dark:text-amber-400 text-base leading-relaxed"> {/* Slightly larger text */}
                        {showFullDescription || book.description.length <= 400
                          ? book.description
                          : `${book.description.substring(0, 400)}...`}
                      </p>
                      {book.description.length > 400 && (
                        <button
                          onClick={() => setShowFullDescription(!showFullDescription)}
                          className="text-amber-700 dark:text-amber-400 hover:underline mt-2 text-sm font-medium"
                        >
                          {showFullDescription ? 'Show Less' : 'Read More'}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-8 border-t border-amber-200 dark:border-gray-700 pt-6"> {/* Separator */}
                    <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-3">
                      Subjects
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {book.subjects.slice(0, 8).map((subject, index) => (
                        <motion.span
                          key={index}
                          whileHover={{ scale: 1.05 }}
                          className="text-sm bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200
                            px-3 py-1 rounded-full font-medium cursor-pointer hover:shadow-md transition-all duration-200" // Interactive tag
                        >
                          {subject.split(' -- ')[0].substring(0, 30)}
                          {subject.split(' -- ')[0].length > 30 ? '...' : ''}
                        </motion.span>
                      ))}
                      {book.subjects.length > 8 && (
                        <span className="text-sm text-amber-700 dark:text-amber-500 px-3 py-1">
                          +{book.subjects.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-10 border-t border-amber-200 dark:border-gray-700 pt-6 space-y-4"> {/* Separator */}
                    <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-4">
                      Actions
                    </h2>
                    <div className="flex flex-wrap gap-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={fetchBookContentForReading}
                        disabled={isLoadingContent}
                        className="px-6 py-3 bg-amber-700 dark:bg-amber-800 text-white rounded-lg
                          shadow-lg hover:bg-amber-800 dark:hover:bg-amber-700 transition-all duration-200
                          flex items-center font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:rotate-1" // Bold text, slight rotation on hover
                      >
                        {isLoadingContent ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Loading Content...
                          </>
                        ) : (
                          <>
                            <Clock className="h-5 w-5 mr-2" />
                            Read Now
                          </>
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleToggleOffline}
                        className={`px-6 py-3 rounded-lg shadow-lg flex items-center font-bold text-lg transition-all duration-200 ${ // Bold text
                          isOffline
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                            : 'bg-amber-100 text-amber-800 dark:bg-gray-800 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-gray-700'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <Download className="h-5 w-5 mr-2" />
                        {isOffline ? 'Saved Offline' : 'Save for Offline'}
                      </motion.button>
                    </div>

                    {/* Download Section */}
                    <div className="bg-amber-100 dark:bg-gray-800 p-5 rounded-lg border border-amber-200 dark:border-gray-700 shadow-inner mt-6"> {/* Nicer styling */}
                      <h3 className="text-base font-semibold text-amber-900 dark:text-amber-300 mb-4">
                        Download to Device
                      </h3>

                      <div className="flex flex-wrap items-center gap-4">
                        <select
                          value={downloadFormat}
                          onChange={(e) => setDownloadFormat(e.target.value as 'txt' | 'html' | 'pdf')}
                          className="px-4 py-2 border border-amber-300 dark:border-gray-600 rounded-md
                            bg-white dark:bg-gray-900 text-amber-900 dark:text-amber-100
                            focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                            transition-colors duration-200" // Added focus styles
                        >
                          {/* Dynamically generate options based on available formats if needed
                          {Object.keys(book.formats).filter(f => !f.startsWith('image/')).map(format => (
                            <option key={format} value={format.split('/')[1] || format}>
                              {format.split('/')[1]?.toUpperCase() || format}
                            </option>
                          ))}
                          */}
                          <option value="txt">Text (.txt)</option>
                          <option value="html">HTML (.html)</option>
                          <option value="pdf">PDF (.pdf)</option>
                        </select>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className="px-5 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-md
                            hover:bg-amber-700 dark:hover:bg-amber-600 transition-all duration-200
                            flex items-center font-semibold disabled:opacity-60 disabled:cursor-not-allowed" // Font-semibold
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              {downloadFormat === 'pdf' ? (
                                <File className="h-4 w-4 mr-2" />
                              ) : (
                                <FileText className="h-4 w-4 mr-2" />
                              )}
                              Download {downloadFormat.toUpperCase()}
                            </>
                          )}
                        </motion.button>
                      </div>

                      <p className="text-xs text-amber-700 dark:text-amber-500 mt-3">
                        Downloads will be saved to your device's Downloads folder.
                      </p>
                    </div>

                     <div className="mt-6 border-t border-amber-200 dark:border-gray-700 pt-6">
                        <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-3">
                            Available Formats
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(book.formats).filter(([format]) => !format.startsWith('image/') && !format.includes('zip') && !format.includes('opf') && !format.includes('rst')).map(([format, url]) => { // Filter out more irrelevant formats
                                const formatName = format.split('/')[1]?.toUpperCase() || format;

                                return (
                                    <a
                                        key={format}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-400
                                            px-4 py-2 rounded-md border border-amber-200 dark:border-gray-700
                                            hover:bg-amber-200 dark:hover:bg-gray-700 transition-colors duration-200 font-medium flex items-center" // Rounded-md, font-medium
                                    >
                                        <FileText className="h-4 w-4 mr-1.5" /> {formatName}
                                    </a>
                                );
                            })}
                            {Object.keys(book.formats).filter(f => !f.startsWith('image/') && !f.includes('zip') && !f.includes('opf') && !f.includes('rst')).length === 0 && (
                                <p className="text-amber-700 dark:text-amber-500 text-sm italic">No direct read-or-download formats available. Try the 'Read Now' button if enabled.</p>
                            )}
                        </div>
                    </div>
                </div> {/* <--- THIS IS THE MISSING CLOSING TAG FOR THE "Actions" Separator DIV */}
            </motion.div> {/* This closes the large motion.div for the right panel content */}
        </div>
    </div>
</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BookDetail;
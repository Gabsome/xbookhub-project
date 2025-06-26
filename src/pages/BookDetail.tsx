import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bookmark, Download, Share, Book as BookIcon,
  Calendar, Clock, Users, FileText, File, Loader2, Globe, Archive, Library
} from 'lucide-react';
import { fetchBookById, fetchBookContent, downloadBookAsFile } from '../services/api';
import { saveBook, getSavedBooks, removeSavedBook } from '../services/api';
import { saveBookOffline, isBookAvailableOffline, removeOfflineBook } from '../services/offline';
import { useAuth } from '../context/AuthContext';
import { Book } from '../types';
import DOMPurify from 'dompurify';
import { downloadBookAsPDF } from '../utils/downloadBookAsPDF'; // Correctly import the utility

const BOOK_CONTENT_DIV_ID = 'book-content-for-pdf';

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
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'html' | 'pdf'>('txt');

  // Ref to the div that contains the book content for PDF generation
  const pdfContentRef = useRef<HTMLDivElement>(null);

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
    if (!book) {
      console.warn('No book selected to toggle offline status.');
      return;
    }
    try {
      if (isOffline) {
        await removeOfflineBook(book.id);
        setIsOffline(false);
        console.log(`Book (ID: ${book.id}) removed from offline storage.`);
      } else {
        console.log(`Attempting to save book (ID: ${book.id}) offline...`);
        await saveBookOffline(book);
        setIsOffline(true);
        console.log(`Book (ID: ${book.id}) saved to offline storage.`);
      }
    } catch (err) {
      console.error('Error handling offline storage:', err);
      alert('Failed to save/remove book for offline use. See console for details.');
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
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const fetchBookContentForReading = async () => {
    if (!book) return;
    try {
      setIsLoadingContent(true);
      setError(null);
      const content = await fetchBookContent(book);
      setReadingContent(DOMPurify.sanitize(content, { USE_PROFILES: { html: true } }));
      setIsReadingMode(true);
    } catch (err) {
      console.error('Error fetching book content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book content. Please try again later.');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleDownload = async () => {
    if (!book) {
      setError("No book data available for download.");
      return;
    }

    try {
      setIsDownloading(true);
      setError(null);

      const filename = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_${book.id}`;

      if (downloadFormat === 'pdf') {
        let contentToRender = readingContent; // Start with content if already loaded for reading

        // If not in reading mode, or content hasn't been loaded yet
        if (!contentToRender) {
          console.log("Fetching content specifically for PDF generation...");
          const fetchedContent = await fetchBookContent(book);
          contentToRender = DOMPurify.sanitize(fetchedContent, { USE_PROFILES: { html: true } });
        }

        if (pdfContentRef.current) {
            // Temporarily set the content to the hidden div for html2canvas to capture
            // This is crucial if not in reading mode or content was just fetched for PDF
            pdfContentRef.current.innerHTML = contentToRender || ''; // Ensure it's never null/undefined

            // --- IMPORTANT: Add a small delay to allow content to render in the DOM ---
            await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay, adjust if needed
            // --- END IMPORTANT ADDITION ---

            await downloadBookAsPDF(BOOK_CONTENT_DIV_ID, `${filename}.pdf`);

            // Clear the content from the hidden div after generating PDF
            // Only clear if we're not currently in reading mode
            if (!isReadingMode) {
                pdfContentRef.current.innerHTML = '';
            }
        } else {
            throw new Error("PDF content element reference not found in the DOM.");
        }
      } else {
        // For 'txt' and 'html' downloads, continue using the existing downloadBookAsFile
        await downloadBookAsFile(book, downloadFormat);
      }
    } catch (err) {
      console.error('Error downloading book:', err);
      setError(err instanceof Error ? err.message : 'Failed to download book. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getSourceInfo = () => {
    if (!book) return { icon: <BookIcon className="h-4 w-4" />, name: 'Unknown' };
    switch (book.source) {
      case 'gutenberg': return { icon: <Globe className="h-4 w-4" />, name: 'Project Gutenberg' };
      case 'openlibrary': return { icon: <Library className="h-4 w-4" />, name: 'Open Library' };
      case 'archive': return { icon: <Archive className="h-4 w-4" />, name: 'Internet Archive' };
      default: return { icon: <BookIcon className="h-4 w-4" />, name: 'Unknown Source' };
    }
  };

  const getCoverImage = () => {
    if (!book) return 'https://placehold.co/300x450/e9d8b6/453a22?text=No+Cover';
    if (book.formats && book.formats['image/jpeg']) {
      return book.formats['image/jpeg'];
    }
    if (book.source === 'openlibrary' && book.cover_id) {
      return `https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg`;
    }
    return 'https://placehold.co/300x450/e9d8b6/453a22?text=No+Cover';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-700 dark:text-amber-500" />
          <span className="text-amber-800 dark:text-amber-400">Loading book details...</span>
        </div>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p>{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
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
          className="mt-4 flex items-center mx-auto text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
        >
          <ArrowLeft className="h-5 w-5 mr-1" /> Return to Home
        </button>
      </div>
    );
  }

  // Reading Mode View
  if (isReadingMode && readingContent !== null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setIsReadingMode(false)}
            className="flex items-center text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
          >
            <ArrowLeft className="h-5 w-5 mr-1" /> Back to Details
          </button>

          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-gray-800
              text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full">
              {getSourceInfo().icon}
              <span>{getSourceInfo().name}</span>
            </div>

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

          {/* This is the div that contains the book content for display and PDF conversion */}
          <div
            id={BOOK_CONTENT_DIV_ID} // Crucial ID for html2pdf.js
            ref={pdfContentRef} // Attach ref here
            className="prose prose-amber dark:prose-invert max-w-none font-serif text-amber-900 dark:text-amber-100"
            dangerouslySetInnerHTML={{ __html: readingContent }}
          />
        </div>
      </div>
    );
  }

  const sourceInfo = getSourceInfo();

  // Book Detail View
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-amber-900 dark:text-amber-400 mb-6 hover:text-amber-700 dark:hover:text-amber-300"
      >
        <ArrowLeft className="h-5 w-5 mr-1" /> Back to Books
      </button>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-md mb-6">
          <p>{error}</p>
        </div>
      )}

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
                src={getCoverImage()}
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
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-gray-800
                  text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full">
                  {sourceInfo.icon}
                  <span>{sourceInfo.name}</span>
                </div>

                {book.language && book.language.length > 0 && (
                  <span className="text-xs bg-amber-100 dark:bg-gray-800 text-amber-800
                    dark:text-amber-300 px-2 py-1 rounded-full">
                    {book.language[0].toUpperCase()}
                  </span>
                )}
              </div>

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

                {book.publish_date && (
                  <span className="flex items-center mb-2">
                    <Calendar className="h-4 w-4 mr-1" />
                    {book.publish_date}
                  </span>
                )}
              </div>

              {/* Publisher info */}
              {book.publisher && book.publisher.length > 0 && (
                <div className="mt-3">
                  <span className="text-sm text-amber-700 dark:text-amber-500">
                    Publisher: {book.publisher.join(', ')}
                  </span>
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div className="mt-4">
                  <h3 className="text-lg font-serif font-semibold text-amber-900 dark:text-amber-300 mb-2">
                    Description
                  </h3>
                  <p className="text-amber-800 dark:text-amber-400 text-sm leading-relaxed">
                    {book.description.length > 300
                      ? `${book.description.substring(0, 300)}...`
                      : book.description}
                  </p>
                </div>
              )}

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

              <div className="mt-10 space-y-4">
                <div className="flex flex-wrap gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchBookContentForReading}
                    disabled={isLoadingContent}
                    className="px-6 py-3 bg-amber-700 dark:bg-amber-800 text-white rounded-lg
                      shadow-md hover:bg-amber-800 dark:hover:bg-amber-700 transition-colors
                      flex items-center font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingContent ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Loading...
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

                {/* Download Section */}
                <div className="bg-amber-100 dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3">
                    Download to Device
                  </h3>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={downloadFormat}
                      onChange={(e) => setDownloadFormat(e.target.value as 'txt' | 'html' | 'pdf')}
                      className="px-3 py-2 border border-amber-300 dark:border-gray-600 rounded-md
                        bg-white dark:bg-gray-900 text-amber-900 dark:text-amber-100
                        focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="txt">Text (.txt)</option>
                      <option value="html">HTML (.html)</option>
                      <option value="pdf">PDF (.pdf)</option>
                    </select>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-md
                        hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors
                        flex items-center font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
                    Downloads will be saved to your device's Downloads folder
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      {/* This hidden div will be used specifically for PDF generation when not in reading mode.
          It must *always* be in the DOM to ensure `pdfContentRef.current` is available. */}
      <div
        id={BOOK_CONTENT_DIV_ID}
        ref={pdfContentRef}
        style={{
          position: 'absolute',
          left: '-9999px', // Position far off-screen
          top: '-9999px',
          width: '210mm', // A4 width, important for predictable PDF layout
          height: 'auto', // IMPORTANT: Allow height to expand
          overflow: 'visible', // IMPORTANT: Ensure all content is captured even if it overflows
          visibility: 'hidden', // Hide it
          // Apply print-friendly styles for PDF
          padding: '20mm', // Simulate page margins
          boxSizing: 'border-box', // Include padding in the width
          fontSize: '12pt',
          lineHeight: '1.5',
          fontFamily: 'serif', // Match the prose class for consistency
          backgroundColor: '#fff', // Explicit white background
          color: '#000', // Explicit black text
        }}
      >
        {/* Content will be injected here when PDF download is requested */}
      </div>
    </motion.div>
  );
};

export default BookDetail;
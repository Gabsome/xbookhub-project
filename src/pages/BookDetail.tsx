import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bookmark, Download, Share, Book as BookIcon,
  Calendar, Clock, Users, FileText, File, Loader2, Globe, Archive, Library
} from 'lucide-react';
import { fetchBookById, fetchBookContent, downloadBookAsFile, getBookCoverUrl } from '../services/api';
import { saveBook, getSavedBooks, removeSavedBook } from '../services/api';
import { saveBookOffline, isBookAvailableOffline, removeOfflineBook } from '../services/offline';
import { useAuth } from '../context/AuthContext';
import { Book } from '../types';
import DOMPurify from 'dompurify';
import downloadBookAsPDF from '../utils/downloadBookAsPDF';

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

  useEffect(() => {
    const fetchBookData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const bookId = /^\d+$/.test(id) ? Number(id) : id;
        const bookData = await fetchBookById(bookId);
        setBook(bookData);

        if (currentUser) {
          const savedBooks = getSavedBooks(currentUser.id);
          setIsSaved(savedBooks.some(b => b.id === bookId));
        }
        const offlineStatus = await isBookAvailableOffline(bookId);
        setIsOffline(offlineStatus);
      } catch (err) {
        console.error('Error fetching book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book details.');
      } finally {
        setLoading(false);
      }
    };
    fetchBookData();
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
      console.error('Error handling offline storage:', err);
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
      const content = await fetchBookContent(book, 'html', false);
      setReadingContent(DOMPurify.sanitize(content, { USE_PROFILES: { html: true } }));
      setIsReadingMode(true);
    } catch (err) {
      console.error('Error fetching book content for reading:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book content.');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const getContentUrlForPDF = (book: Book): string => {
    if (book.source === 'gutenberg') {
      return book.formats['text/html'] || book.formats['text/plain'] || '';
    } else if (book.source === 'archive' || book.source === 'openlibrary') {
      if (book.ia_identifier) {
        return `https://archive.org/stream/${book.ia_identifier}/${book.ia_identifier}_djvu.txt`;
      }
      return book.formats['text/plain'] || book.formats['text/html'] || '';
    }
    return book.formats['text/html'] || book.formats['text/plain'] || '';
  };

  const handleDownload = async () => {
    if (!book) {
      setError("No book data available for download.");
      return;
    }

    setIsDownloading(true);
    setError(null);
    const filename = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_${book.id}`;

    try {
      if (downloadFormat === 'pdf') {
        console.log("Initiating PDF download via server...");
        
        const contentUrl = getContentUrlForPDF(book);
        
        if (!contentUrl) {
          throw new Error('No content URL found for this book to generate a PDF.');
        }

        await downloadBookAsPDF(
          contentUrl, 
          book.title, 
          book.authors.map(a => a.name).join(', '), 
          `${filename}.pdf`
        );
      } else {
        await downloadBookAsFile(book, downloadFormat as 'txt' | 'html');
      }
    } catch (err) {
      console.error('Error downloading book:', err);
      setError(err instanceof Error ? err.message : 'Failed to download book.');
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
    return getBookCoverUrl(book);
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-amber-700 dark:text-amber-500" /></div>;
  }
  
  if (error && !book) {
    return <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-6 rounded-lg"><h2 className="text-xl font-semibold mb-2">Error</h2><p>{error}</p></div>;
  }
  
  if (!book) {
    return <div className="text-center py-12"><BookIcon className="h-16 w-16 text-amber-300 dark:text-amber-700 mx-auto mb-4" /><h2 className="text-xl font-serif font-medium">Book not found</h2></div>;
  }

  const sourceInfo = getSourceInfo();

  if (isReadingMode && readingContent !== null) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setIsReadingMode(false)} className="flex items-center text-amber-900 dark:text-amber-400 mb-6 hover:text-amber-700 dark:hover:text-amber-300"><ArrowLeft className="h-5 w-5 mr-1" /> Back to Details</button>
        <div className="prose prose-amber dark:prose-invert max-w-none font-serif" dangerouslySetInnerHTML={{ __html: readingContent }} />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <button onClick={() => navigate(-1)} className="flex items-center text-amber-900 dark:text-amber-400 mb-6 hover:text-amber-700 dark:hover:text-amber-300"><ArrowLeft className="h-5 w-5 mr-1" /> Back to Books</button>
      {error && <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-md mb-6"><p>{error}</p></div>}
      <div className="bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-lg">
        <div className="md:flex">
          <div className="md:w-1/3 lg:w-1/4 p-6 flex justify-center">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="relative">
              <img src={getCoverImage()} alt={`Cover for ${book.title}`} className="w-full max-w-xs object-cover rounded shadow-md border border-amber-200 dark:border-gray-700" />
              <div className="absolute -top-4 -right-4 flex space-x-2">
                {currentUser && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={handleSaveBook} className={`p-3 rounded-full shadow-md ${isSaved ? 'bg-amber-200 text-amber-900' : 'bg-white text-amber-800'}`}><Bookmark className="h-5 w-5" /></motion.button>
                )}
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleToggleOffline} className={`p-3 rounded-full shadow-md ${isOffline ? 'bg-blue-200 text-blue-900' : 'bg-white text-amber-800'}`}><Download className="h-5 w-5" /></motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleShareBook} className="p-3 rounded-full shadow-md bg-white text-amber-800"><Share className="h-5 w-5" /></motion.button>
              </div>
            </motion.div>
          </div>
          <div className="md:w-2/3 lg:w-3/4 p-6 md:p-8">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full">{sourceInfo.icon}<span>{sourceInfo.name}</span></div>
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-amber-900 dark:text-amber-300">{book.title}</h1>
              <div className="mt-3 flex flex-wrap items-center text-amber-800 dark:text-amber-400">
                <span className="flex items-center mr-4 mb-2"><Users className="h-4 w-4 mr-1" />{book.authors.map(author => <span key={author.name} className="font-medium italic">{author.name}</span>)}</span>
              </div>
              <div className="mt-6">
                <h2 className="text-lg font-serif font-semibold text-amber-900 dark:text-amber-300 mb-2">Subjects</h2>
                <div className="flex flex-wrap gap-2">
                  {book.subjects.slice(0, 8).map((subject, index) => (<span key={index} className="text-sm bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-3 py-1 rounded-full">{subject.split(' -- ')[0].substring(0, 30)}</span>))}
                </div>
              </div>
              <div className="mt-10 space-y-4">
                <div className="flex flex-wrap gap-4">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={fetchBookContentForReading} disabled={isLoadingContent} className="px-6 py-3 bg-amber-700 text-white rounded-lg shadow-md flex items-center font-medium disabled:opacity-50">
                    {isLoadingContent ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Loading...</> : <><Clock className="h-5 w-5 mr-2" />Read Now</>}
                  </motion.button>
                </div>
                <div className="bg-amber-100 dark:bg-gray-800 p-4 rounded-lg border border-amber-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3">Download to Device</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value as 'txt' | 'html' | 'pdf')} className="px-3 py-2 border rounded-md bg-white dark:bg-gray-900">
                      <option value="txt">Text (.txt)</option>
                      <option value="html">HTML (.html)</option>
                      <option value="pdf">PDF (.pdf)</option>
                    </select>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleDownload} disabled={isDownloading} className="px-4 py-2 bg-amber-600 text-white rounded-md flex items-center font-medium disabled:opacity-50">
                      {isDownloading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Downloading...</> : <>{downloadFormat === 'pdf' ? <File className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}Download {downloadFormat.toUpperCase()}</>}
                    </motion.button>
                  </div>
                  {downloadFormat === 'pdf' && (
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
                      PDF generation may take a moment for books from Internet Archive.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BookDetail;
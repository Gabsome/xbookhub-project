import React from 'react';
import { Link } from 'react-router-dom';
import { Book, Bookmark, Download, Loader2, Globe, Archive, Library } from 'lucide-react';
import { motion } from 'framer-motion';
import { Book as BookType } from '../types';
import { saveBook } from '../services/api';
import { saveBookOffline, isBookAvailableOffline } from '../services/offline';
import { useAuth } from '../context/AuthContext';

interface BookCardProps {
  book: BookType;
}

const BookCard: React.FC<BookCardProps> = ({ book }) => {
  const { currentUser } = useAuth();
  const [isSaved, setIsSaved] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Check if book is saved offline
  React.useEffect(() => {
    const checkOfflineStatus = async () => {
      const offlineStatus = await isBookAvailableOffline(book.id);
      setIsOffline(offlineStatus);
    };
    checkOfflineStatus();
  }, [book.id]);

  const handleSaveBook = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (currentUser) {
      try {
        await saveBook(book, currentUser.id);
        setIsSaved(true);
        
        // Show temporary notification
        setTimeout(() => setIsSaved(false), 1500);
      } catch (error) {
        console.error('Failed to save book:', error);
      }
    } else {
      alert('Please log in to save books');
    }
  };

  const handleSaveOffline = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      await saveBookOffline(book);
      setIsOffline(true);
      
      // Show temporary notification
      setTimeout(() => {
        // Keep the offline status as true since it's actually saved
      }, 1500);
    } catch (error) {
      console.error('Failed to save book offline:', error);
      // Show user-friendly error message
      alert('Failed to save book for offline reading. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get cover image or use a placeholder
  const getCoverImage = () => {
    if (book.formats['image/jpeg']) {
      return book.formats['image/jpeg'];
    }
    
    // For Open Library books, try to construct cover URL
    if (book.source === 'openlibrary' && book.cover_id) {
      return `https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg`;
    }
    
    // Default placeholder
    return 'https://placehold.co/200x300/e9d8b6/453a22?text=No+Cover';
  };

  // Get source icon
  const getSourceIcon = () => {
    switch (book.source) {
      case 'gutenberg':
        return <Globe className="h-3 w-3" />;
      case 'openlibrary':
        return <Library className="h-3 w-3" />;
      case 'archive':
        return <Archive className="h-3 w-3" />;
      default:
        return <Book className="h-3 w-3" />;
    }
  };

  // Get source name
  const getSourceName = () => {
    switch (book.source) {
      case 'gutenberg':
        return 'Project Gutenberg';
      case 'openlibrary':
        return 'Open Library';
      case 'archive':
        return 'Internet Archive';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="relative h-full bg-amber-50 dark:bg-gray-800 rounded-lg overflow-hidden shadow-md 
        border border-amber-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
    >
      <Link to={`/book/${book.id}`} className="block h-full">
        <div className="relative pb-[140%] overflow-hidden">
          <img 
            src={getCoverImage()}
            alt={`Cover for ${book.title}`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 
              hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'https://placehold.co/200x300/e9d8b6/453a22?text=No+Cover';
            }}
          />
          
          {/* Source indicator */}
          <div className="absolute top-2 left-2 flex items-center gap-1 text-xs bg-white/90 dark:bg-gray-900/90 
            text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full">
            {getSourceIcon()}
            <span className="hidden sm:inline">{getSourceName()}</span>
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="text-lg font-serif font-semibold text-amber-900 dark:text-amber-300 line-clamp-2">
            {book.title}
          </h3>
          
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-400 italic line-clamp-1">
            {book.authors.map(author => author.name).join(', ')}
          </p>
          
          {/* Publication info */}
          {book.publish_date && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
              Published: {book.publish_date}
            </p>
          )}
          
          <div className="mt-3 flex flex-wrap gap-1">
            {book.subjects.slice(0, 2).map((subject, index) => (
              <span 
                key={index}
                className="text-xs bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 
                  px-2 py-1 rounded-full"
              >
                {subject.split(' -- ')[0].substring(0, 15)}
                {subject.split(' -- ')[0].length > 15 ? '...' : ''}
              </span>
            ))}
          </div>
        </div>
      </Link>
      
      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSaveBook}
          className={`p-2 rounded-full transition-colors ${
            isSaved 
              ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' 
              : 'bg-amber-100 text-amber-800 dark:bg-gray-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-gray-600'
          }`}
          aria-label="Save to my books"
        >
          <Bookmark className="h-5 w-5" />
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSaveOffline}
          disabled={isLoading}
          className={`p-2 rounded-full transition-colors ${
            isOffline 
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
              : 'bg-amber-100 text-amber-800 dark:bg-gray-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-gray-600'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Save for offline reading"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </motion.button>
      </div>
      
      {/* Download count indicator */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs bg-amber-100 
        dark:bg-gray-700 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full">
        <Book className="h-3 w-3" />
        <span>{book.download_count.toLocaleString()}</span>
      </div>
    </motion.div>
  );
};

export default BookCard;
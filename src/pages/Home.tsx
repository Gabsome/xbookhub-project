import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Book as BookIcon, ChevronUp, Loader2 } from 'lucide-react';
import BookCard from '../components/BookCard';
import { fetchBooks, searchBooks } from '../services/api';
import { Book } from '../types';

const Home: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);
  const location = useLocation();

  // Extract search query from URL
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('search');

  // Function to load books for a given page
  const loadBooks = useCallback(async (page: number, query?: string | null, isNewSearch = false) => {
    if (isLoading && !isNewSearch) return; // Prevent multiple simultaneous requests except for new searches
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Loading books - Page: ${page}, Query: ${query || 'none'}, IsNewSearch: ${isNewSearch}`);
      
      const response = query
        ? await searchBooks(query, page)
        : await fetchBooks(page);

      console.log(`Loaded ${response.results.length} books for page ${page}`);

      if (isNewSearch || page === 1) {
        // Reset books for new search or initial load
        setBooks(response.results);
        setCurrentPage(1);
      } else {
        // Append to existing books for pagination
        setBooks(prev => {
          const existingIds = new Set(prev.map(book => book.id));
          const newBooks = response.results.filter(book => !existingIds.has(book.id));
          console.log(`Adding ${newBooks.length} new books to existing ${prev.length} books`);
          return [...prev, ...newBooks];
        });
        setCurrentPage(page);
      }
      
      // Check if there are more pages
      setHasMore(!!response.next && response.results.length > 0);
      
    } catch (err) {
      console.error('Error loading books:', err);
      setError('Failed to load books. Please try again later.');
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [isLoading]);

  // Intersection Observer callback for infinite scroll
  const lastBookElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        console.log('Loading next page due to intersection');
        loadBooks(currentPage + 1, searchQuery);
      }
    }, {
      threshold: 0.5,
      rootMargin: '200px' // Start loading when element is 200px away from viewport
    });

    if (node) observer.current.observe(node);
  }, [hasMore, currentPage, searchQuery, loadBooks]);

  // Effect to handle initial load or search query changes
  useEffect(() => {
    console.log('Search query changed:', searchQuery);
    setBooks([]);
    setCurrentPage(1);
    setHasMore(true);
    setIsInitialLoading(true);
    loadBooks(1, searchQuery, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchQuery]);

  // Effect to track scroll position for the "Scroll to Top" button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 text-amber-700 dark:text-amber-500 animate-spin" />
          <span className="text-amber-800 dark:text-amber-400">Loading books...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-amber-900 dark:text-amber-300">
            {searchQuery
              ? `Search Results for "${searchQuery}"`
              : 'Discover Timeless Classics'}
          </h1>
          <p className="mt-3 text-amber-800 dark:text-amber-400 max-w-2xl mx-auto">
            {searchQuery
              ? `Browse our collection of books related to "${searchQuery}"`
              : 'Explore our curated collection of literary treasures from the world\'s greatest authors.'}
          </p>
        </header>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Books Grid */}
        {books.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {books.map((book, index) => {
              // Attach ref to the last few book cards for better infinite scrolling
              if (books.length === index + 1) {
                return (
                  <div ref={lastBookElementRef} key={`${book.source}-${book.id}`}>
                    <BookCard book={book} />
                  </div>
                );
              } else {
                return <BookCard key={`${book.source}-${book.id}`} book={book} />;
              }
            })}
          </div>
        )}

        {/* Loading indicator for pagination */}
        {isLoading && !isInitialLoading && (
          <div className="flex justify-center mt-10">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-6 w-6 text-amber-700 dark:text-amber-500 animate-spin" />
              <span className="text-amber-800 dark:text-amber-400">Loading more books...</span>
            </div>
          </div>
        )}

        {/* End of results indicator */}
        {!hasMore && books.length > 0 && !isLoading && (
          <div className="text-center mt-10 py-8">
            <BookIcon className="h-12 w-12 text-amber-300 dark:text-amber-700 mx-auto mb-4" />
            <p className="text-amber-700 dark:text-amber-500">
              You've reached the end of our collection for this search.
            </p>
          </div>
        )}

        {/* No books found state */}
        {!isLoading && !isInitialLoading && books.length === 0 && (
          <div className="text-center py-12">
            <BookIcon className="h-16 w-16 text-amber-300 dark:text-amber-700 mx-auto mb-4" />
            <h3 className="text-xl font-serif font-medium text-amber-900 dark:text-amber-300">
              No books found
            </h3>
            <p className="mt-2 text-amber-700 dark:text-amber-500">
              {searchQuery
                ? `We couldn't find any books matching "${searchQuery}". Try a different search term.`
                : 'Our library appears to be empty. Please check back later.'}
            </p>
          </div>
        )}

        {/* Scroll to top button */}
        <motion.button
          className={`fixed right-6 bottom-6 p-3 rounded-full bg-amber-100 dark:bg-gray-800
            text-amber-800 dark:text-amber-400 shadow-lg border border-amber-200
            dark:border-gray-700 z-10 transition-opacity duration-200 ${
              showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          onClick={scrollToTop}
          initial={{ scale: 0.8 }}
          animate={{ scale: showScrollTop ? 1 : 0.8 }}
          transition={{ duration: 0.2 }}
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default Home;
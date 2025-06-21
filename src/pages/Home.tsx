import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Book as BookIcon, ChevronUp } from 'lucide-react';
import BookCard from '../components/BookCard';
import { fetchBooks, searchBooks } from '../services/api';
import { Book } from '../types';

const Home: React.FC = () => {
  // Separate states for initial books and subsequently loaded books
  const [initialBooks, setInitialBooks] = useState<Book[]>([]);
  const [additionalBooks, setAdditionalBooks] = useState<Book[]>([]);
  const [currentPage, setCurrentPage] = useState(1); // Track current page number
  const [hasMore, setHasMore] = useState(true); // Indicates if there are more pages to load
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);
  const location = useLocation();

  // Extract search query from URL
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('search');

  // Function to load books for a given page, handles both initial and subsequent loads
  const loadPageOfBooks = useCallback(async (page: number, query?: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = query
        ? await searchBooks(query, page) // Pass page to searchBooks
        : await fetchBooks(page); // Pass page to fetchBooks

      if (page === 1) {
        // This is the initial load or a new search, so update initialBooks
        setInitialBooks(response.results);
        setAdditionalBooks([]); // Clear additional books on a new search or initial load
      } else {
        // Append to additional books for subsequent pages
        setAdditionalBooks(prev => [...prev, ...response.results]);
      }
      setCurrentPage(page);
      // Determine if there's a next page. 'response.next' can be a URL or 'null'
      setHasMore(!!response.next);
    } catch (err) {
      setError('Failed to load books. Please try again later.');
      console.error('Error fetching books:', err);
      setHasMore(false); // Stop trying to load more if there's an error
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependencies for useCallback: none, as it handles its own internal state updates

  // Intersection Observer callback to load more books
  const lastBookElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || !hasMore) return; // Don't load if already loading or no more pages

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        // Load the next page
        loadPageOfBooks(currentPage + 1, searchQuery);
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, currentPage, searchQuery, loadPageOfBooks]);

  // Effect to handle initial load or search query changes
  useEffect(() => {
    // When searchQuery changes or on initial mount, load the first page
    loadPageOfBooks(1, searchQuery);
    // Reset scroll position when search query changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchQuery, loadPageOfBooks]); // Depend on searchQuery and loadPageOfBooks

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

  const allBooksDisplayed = [...initialBooks, ...additionalBooks];

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

        {/* Display Initial Books Section */}
        {initialBooks.length > 0 && (
          <section className="mb-8"> {/* Added a section for initial books */}
            <h2 className="sr-only">Initial Books</h2> {/* Accessibility title */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {initialBooks.map(book => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        )}

        {/* Separator or title for additional books, only if initial books loaded and there's more to show */}
        {initialBooks.length > 0 && hasMore && (
          <div className="text-center my-8">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-amber-900 dark:text-amber-300">
              More to Explore
            </h2>
            <p className="mt-2 text-amber-800 dark:text-amber-400">
              Keep scrolling to discover more books...
            </p>
          </div>
        )}

        {/* Display Additional Books Section */}
        {additionalBooks.length > 0 && (
          <section> {/* Added a section for additional books */}
            <h2 className="sr-only">Additional Books</h2> {/* Accessibility title */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {additionalBooks.map((book, index) => {
                // Attach ref to the last book card for infinite scrolling
                if (additionalBooks.length === index + 1) {
                  return (
                    <div ref={lastBookElementRef} key={book.id}>
                      <BookCard book={book} />
                    </div>
                  );
                } else {
                  return <BookCard key={book.id} book={book} />;
                }
              })}
            </div>
          </section>
        )}

        {isLoading && (
          <div className="flex justify-center mt-10">
            <div className="flex items-center space-x-2">
              <BookIcon className="h-6 w-6 text-amber-700 dark:text-amber-500 animate-pulse" />
              <span className="text-amber-800 dark:text-amber-400">Loading more books...</span>
            </div>
          </div>
        )}

        {/* No books found state - check both initial and additional */}
        {!isLoading && allBooksDisplayed.length === 0 && (
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
            dark:border-gray-700 z-10 ${showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
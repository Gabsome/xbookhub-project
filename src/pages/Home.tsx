import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Book as BookIcon, ChevronUp } from 'lucide-react';
import BookCard from '../components/BookCard';
import { fetchBooks, searchBooks } from '../services/api';
import { Book } from '../types';

const Home: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const location = useLocation();
  
  // Extract search query from URL
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('search');

  // Load initial books
  const loadBooks = useCallback(async (query?: string | null, reset = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = query 
        ? await searchBooks(query) 
        : await fetchBooks();
      
      setBooks(reset ? response.results : [...books, ...response.results]);
      setNextPage(response.next);
    } catch (err) {
      setError('Failed to load books. Please try again later.');
      console.error('Error fetching books:', err);
    } finally {
      setIsLoading(false);
    }
  }, [books]);

  // Load more books when scrolling
  const lastBookElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading) return;
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextPage) {
        const pageNumber = new URL(nextPage).searchParams.get('page');
        if (pageNumber) {
          if (searchQuery) {
            searchBooks(searchQuery, parseInt(pageNumber))
              .then(response => {
                setBooks(prev => [...prev, ...response.results]);
                setNextPage(response.next);
              })
              .catch(err => console.error('Error fetching more books:', err));
          } else {
            fetchBooks(parseInt(pageNumber))
              .then(response => {
                setBooks(prev => [...prev, ...response.results]);
                setNextPage(response.next);
              })
              .catch(err => console.error('Error fetching more books:', err));
          }
        }
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, nextPage, searchQuery]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load books on initial render or when search query changes
  useEffect(() => {
    loadBooks(searchQuery, true);
  }, [searchQuery, loadBooks]);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {books.map((book, index) => {
            if (books.length === index + 1) {
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

        {isLoading && (
          <div className="flex justify-center mt-10">
            <div className="flex items-center space-x-2">
              <BookIcon className="h-6 w-6 text-amber-700 dark:text-amber-500 animate-pulse" />
              <span className="text-amber-800 dark:text-amber-400">Loading more books...</span>
            </div>
          </div>
        )}

        {!isLoading && books.length === 0 && (
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
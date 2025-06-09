import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookX, Home } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <BookX className="h-24 w-24 text-amber-300 dark:text-amber-700 mx-auto mb-6" />
        
        <h1 className="text-4xl font-serif font-bold text-amber-900 dark:text-amber-300 mb-4">
          Page Not Found
        </h1>
        
        <p className="text-lg text-amber-800 dark:text-amber-400 max-w-md mx-auto mb-8">
          The page you're looking for appears to be missing from our library. 
          Perhaps it was borrowed and never returned?
        </p>
        
        <Link 
          to="/"
          className="inline-flex items-center px-6 py-3 bg-amber-700 dark:bg-amber-800 text-white
            rounded-lg shadow-md hover:bg-amber-800 dark:hover:bg-amber-700 transition-colors"
        >
          <Home className="h-5 w-5 mr-2" /> Return Home
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
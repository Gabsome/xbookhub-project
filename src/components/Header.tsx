import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Moon, Sun, BookOpen, User, LogOut, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
  const { currentUser, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
      setIsMenuOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-amber-50 dark:bg-gray-900 shadow-md' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:py-6">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <BookOpen className="h-8 w-8 text-amber-800 dark:text-amber-500" />
            <span className="ml-2 text-xl font-serif font-bold text-amber-900 dark:text-amber-400">
              Xbook-Hub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 py-2 px-4 pr-10 rounded-full bg-amber-100 dark:bg-gray-800 
                  border border-amber-300 dark:border-gray-700 focus:outline-none 
                  focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <Search className="h-5 w-5 text-amber-700 dark:text-amber-500" />
              </button>
            </form>

            <Link 
              to="/saved" 
              className="text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-serif"
            >
              My Books
            </Link>

            {isAuthenticated ? (
              <>
                <Link 
                  to="/settings" 
                  className="text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-serif"
                >
                  Settings
                </Link>
                <button 
                  onClick={handleLogout}
                  className="flex items-center text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-serif"
                >
                  <LogOut className="h-5 w-5 mr-1" /> 
                  Logout
                </button>
              </>
            ) : (
              <Link 
                to="/login" 
                className="flex items-center text-amber-900 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-serif"
              >
                <User className="h-5 w-5 mr-1" /> 
                Login
              </Link>
            )}

            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-500"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-amber-900 dark:text-amber-400"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-amber-50 dark:bg-gray-900"
          >
            <div className="px-4 pt-2 pb-6 space-y-4">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2 px-4 pr-10 rounded-full bg-amber-100 dark:bg-gray-800 
                    border border-amber-300 dark:border-gray-700 focus:outline-none 
                    focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <Search className="h-5 w-5 text-amber-700 dark:text-amber-500" />
                </button>
              </form>

              <Link 
                to="/saved" 
                className="block py-2 text-amber-900 dark:text-amber-400 font-serif"
                onClick={() => setIsMenuOpen(false)}
              >
                My Books
              </Link>

              {isAuthenticated ? (
                <>
                  <Link 
                    to="/settings" 
                    className="block py-2 text-amber-900 dark:text-amber-400 font-serif"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center py-2 text-amber-900 dark:text-amber-400 font-serif"
                  >
                    <LogOut className="h-5 w-5 mr-1" /> 
                    Logout
                  </button>
                </>
              ) : (
                <Link 
                  to="/login" 
                  className="flex items-center py-2 text-amber-900 dark:text-amber-400 font-serif"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="h-5 w-5 mr-1" /> 
                  Login
                </Link>
              )}

              <button 
                onClick={() => {
                  toggleTheme();
                  setIsMenuOpen(false);
                }} 
                className="flex items-center py-2 text-amber-900 dark:text-amber-400 font-serif"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-5 w-5 mr-1" /> 
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-5 w-5 mr-1" /> 
                    Dark Mode
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
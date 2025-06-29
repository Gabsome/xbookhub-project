import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Book, Upload, User, Save, Trash2, Globe, Archive, Library } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAllOfflineBooks, removeOfflineBook, getOfflineStorageStats, clearOfflineStorageBySource } from '../services/offline';
import { initUploadcare, createUploadcareWidget, saveFileToUserProfile } from '../services/uploadcare';

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [offlineBooks, setOfflineBooks] = useState<any[]>([]);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [showOfflineBooks, setShowOfflineBooks] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Initialize Uploadcare
  React.useEffect(() => {
    initUploadcare();
  }, []);

  // Load offline books and stats
  const loadOfflineData = async () => {
    const books = await getAllOfflineBooks();
    const stats = await getOfflineStorageStats();
    setOfflineBooks(books);
    setStorageStats(stats);
    setShowOfflineBooks(true);
  };

  const handleRemoveOfflineBook = async (id: number | string) => {
    await removeOfflineBook(id);
    setOfflineBooks(prev => prev.filter(book => book.id !== id));
    // Refresh stats
    const stats = await getOfflineStorageStats();
    setStorageStats(stats);
  };

  const handleClearSourceBooks = async (source: 'gutenberg' | 'openlibrary' | 'archive') => {
    if (confirm(`Are you sure you want to remove all ${source} books from offline storage?`)) {
      await clearOfflineStorageBySource(source);
      // Refresh data
      await loadOfflineData();
      setSuccessMessage(`All ${source} books removed from offline storage`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'vintage' | 'dark') => {
    setTheme(newTheme);
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    document.documentElement.style.fontSize = 
      size === 'small' ? '14px' : 
      size === 'large' ? '18px' : '16px';
  };

  const handleProfileUpdate = () => {
    // In a real app, this would update the user profile in the database
    // For this demo, we'll just show a success message
    setSuccessMessage('Profile updated successfully!');
    
    // Clear the message after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleUploadAvatar = () => {
    const uploadButton = document.getElementById('avatar-upload');
    if (uploadButton) {
      const widget = createUploadcareWidget(uploadButton);
      
      widget.onUploadComplete((info) => {
        if (currentUser) {
          saveFileToUserProfile(currentUser.id, info.cdnUrl, 'avatar');
          setSuccessMessage('Avatar uploaded successfully!');
          
          // Clear the message after 3 seconds
          setTimeout(() => {
            setSuccessMessage(null);
          }, 3000);
        }
      });
      
      widget.openDialog();
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'gutenberg':
        return <Globe className="h-4 w-4" />;
      case 'openlibrary':
        return <Library className="h-4 w-4" />;
      case 'archive':
        return <Archive className="h-4 w-4" />;
      default:
        return <Book className="h-4 w-4" />;
    }
  };

  const getSourceName = (source: string) => {
    switch (source) {
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-2xl md:text-3xl font-serif font-bold text-amber-900 dark:text-amber-300 mb-8">
        Settings
      </h1>
      
      {successMessage && (
        <div className="mb-6 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-4 rounded-md">
          {successMessage}
        </div>
      )}
      
      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-amber-50 dark:bg-gray-900 rounded-lg p-6 border border-amber-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" /> Profile
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
                Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full p-2 border border-amber-300 dark:border-gray-700 rounded-md 
                  bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full p-2 border border-amber-300 dark:border-gray-700 rounded-md 
                  bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">
                Profile Picture
              </label>
              <button 
                id="avatar-upload"
                onClick={handleUploadAvatar}
                className="flex items-center px-4 py-2 bg-amber-100 dark:bg-gray-800 text-amber-800 
                  dark:text-amber-400 rounded-md border border-amber-300 dark:border-gray-700
                  hover:bg-amber-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" /> Upload Image
              </button>
            </div>
            
            <div className="pt-2">
              <button
                onClick={handleProfileUpdate}
                className="flex items-center px-4 py-2 bg-amber-700 dark:bg-amber-800 text-white
                  rounded-md hover:bg-amber-800 dark:hover:bg-amber-700 transition-colors"
              >
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </button>
            </div>
          </div>
        </section>
        
        {/* Appearance Section */}
        <section className="bg-amber-50 dark:bg-gray-900 rounded-lg p-6 border border-amber-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-4 flex items-center">
            <Sun className="h-5 w-5 mr-2" /> Appearance
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-3">
                Theme
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`p-4 rounded-lg border ${
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500'
                      : 'border-amber-300 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <Sun className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                  </div>
                  <p className="text-center text-amber-900 dark:text-amber-300 font-medium">Light</p>
                </button>
                
                <button
                  onClick={() => handleThemeChange('vintage')}
                  className={`p-4 rounded-lg border ${
                    theme === 'vintage'
                      ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500'
                      : 'border-amber-300 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <Book className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                  </div>
                  <p className="text-center text-amber-900 dark:text-amber-300 font-medium">Vintage</p>
                </button>
                
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`p-4 rounded-lg border ${
                    theme === 'dark'
                      ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500'
                      : 'border-amber-300 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <Moon className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                  </div>
                  <p className="text-center text-amber-900 dark:text-amber-300 font-medium">Dark</p>
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-3">
                Font Size
              </h3>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleFontSizeChange('small')}
                  className={`px-4 py-2 rounded-md ${
                    fontSize === 'small'
                      ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                      : 'bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-400'
                  }`}
                >
                  Small
                </button>
                
                <button
                  onClick={() => handleFontSizeChange('medium')}
                  className={`px-4 py-2 rounded-md ${
                    fontSize === 'medium'
                      ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                      : 'bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-400'
                  }`}
                >
                  Medium
                </button>
                
                <button
                  onClick={() => handleFontSizeChange('large')}
                  className={`px-4 py-2 rounded-md ${
                    fontSize === 'large'
                      ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                      : 'bg-amber-100 dark:bg-gray-800 text-amber-800 dark:text-amber-400'
                  }`}
                >
                  Large
                </button>
              </div>
            </div>
          </div>
        </section>
        
        {/* Offline Books Section */}
        <section className="bg-amber-50 dark:bg-gray-900 rounded-lg p-6 border border-amber-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300 mb-4 flex items-center">
            <Book className="h-5 w-5 mr-2" /> Offline Books
          </h2>
          
          {!showOfflineBooks ? (
            <button
              onClick={loadOfflineData}
              className="px-4 py-2 bg-amber-100 dark:bg-gray-800 text-amber-800 
                dark:text-amber-400 rounded-md border border-amber-300 dark:border-gray-700
                hover:bg-amber-200 dark:hover:bg-gray-700 transition-colors"
            >
              Show Offline Books
            </button>
          ) : (
            <div className="space-y-4">
              {/* Storage Statistics */}
              {storageStats && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-md border border-amber-200 dark:border-gray-700">
                  <h3 className="font-medium text-amber-900 dark:text-amber-300 mb-3">Storage Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-amber-700 dark:text-amber-500">Total Books</p>
                      <p className="font-semibold text-amber-900 dark:text-amber-300">{storageStats.totalBooks}</p>
                    </div>
                    <div>
                      <p className="text-amber-700 dark:text-amber-500">With Content</p>
                      <p className="font-semibold text-amber-900 dark:text-amber-300">{storageStats.booksWithContent}</p>
                    </div>
                    <div>
                      <p className="text-amber-700 dark:text-amber-500">Storage Used</p>
                      <p className="font-semibold text-amber-900 dark:text-amber-300">{formatBytes(storageStats.totalSize)}</p>
                    </div>
                    <div>
                      <p className="text-amber-700 dark:text-amber-500">Sources</p>
                      <div className="flex gap-1 mt-1">
                        {storageStats.bySource.gutenberg > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                            PG: {storageStats.bySource.gutenberg}
                          </span>
                        )}
                        {storageStats.bySource.openlibrary > 0 && (
                          <span className="text-xs bg-green-100 text-green-800 px-1 rounded">
                            OL: {storageStats.bySource.openlibrary}
                          </span>
                        )}
                        {storageStats.bySource.archive > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">
                            IA: {storageStats.bySource.archive}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Clear by source buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {storageStats.bySource.gutenberg > 0 && (
                      <button
                        onClick={() => handleClearSourceBooks('gutenberg')}
                        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Clear Gutenberg ({storageStats.bySource.gutenberg})
                      </button>
                    )}
                    {storageStats.bySource.openlibrary > 0 && (
                      <button
                        onClick={() => handleClearSourceBooks('openlibrary')}
                        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Clear Open Library ({storageStats.bySource.openlibrary})
                      </button>
                    )}
                    {storageStats.bySource.archive > 0 && (
                      <button
                        onClick={() => handleClearSourceBooks('archive')}
                        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Clear Archive ({storageStats.bySource.archive})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {offlineBooks.length === 0 ? (
                <p className="text-amber-700 dark:text-amber-500">
                  You don't have any books saved for offline reading.
                </p>
              ) : (
                <div className="space-y-4">
                  {offlineBooks.map(book => (
                    <div 
                      key={book.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 
                        rounded-md border border-amber-200 dark:border-gray-700"
                    >
                      <div className="flex items-center">
                        <img 
                          src={book.formats['image/jpeg'] || 'https://placehold.co/60x80/e9d8b6/453a22?text=No+Cover'}
                          alt={`Cover for ${book.title}`}
                          className="w-12 h-auto mr-3 rounded border border-amber-200 dark:border-gray-700"
                        />
                        <div>
                          <h3 className="font-medium text-amber-900 dark:text-amber-300 text-sm">
                            {book.title}
                          </h3>
                          <p className="text-xs text-amber-700 dark:text-amber-500">
                            {book.authors.map(author => author.name).join(', ')}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {getSourceIcon(book.source)}
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {getSourceName(book.source)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveOfflineBook(book.id)}
                        className="p-1 rounded-full text-amber-700 dark:text-amber-500 
                          hover:text-amber-900 dark:hover:text-amber-300"
                        aria-label="Remove from offline storage"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
};

export default Settings;
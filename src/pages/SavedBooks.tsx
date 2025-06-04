import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, BookOpen, Search, PenSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSavedBooks, removeSavedBook, updateBookNote } from '../services/api';
import { SavedBook } from '../types';

const SavedBooks: React.FC = () => {
  const { currentUser } = useAuth();
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState('');
  
  useEffect(() => {
    if (currentUser) {
      const books = getSavedBooks(currentUser.id);
      setSavedBooks(books);
    }
  }, [currentUser]);

  const handleRemoveBook = async (bookId: number) => {
    if (!currentUser) return;
    
    try {
      await removeSavedBook(bookId, currentUser.id);
      setSavedBooks(prev => prev.filter(book => book.id !== bookId));
    } catch (err) {
      console.error('Error removing book:', err);
    }
  };

  const handleEditNote = (book: SavedBook) => {
    setEditingNoteId(book.id);
    setNoteContent(book.notes || '');
  };

  const handleSaveNote = async (bookId: number) => {
    if (!currentUser) return;
    
    try {
      await updateBookNote(bookId, currentUser.id, noteContent);
      setSavedBooks(prev => 
        prev.map(book => 
          book.id === bookId ? { ...book, notes: noteContent } : book
        )
      );
      setEditingNoteId(null);
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const filteredBooks = searchQuery
    ? savedBooks.filter(book => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.authors.some(author => author.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : savedBooks;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-amber-900 dark:text-amber-300">
            My Saved Books
          </h1>
          <p className="mt-2 text-amber-800 dark:text-amber-400">
            Your personal collection of saved literary treasures
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 relative">
          <input
            type="text"
            placeholder="Search your books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 py-2 px-4 pr-10 rounded-lg bg-amber-100 dark:bg-gray-800 
              border border-amber-300 dark:border-gray-700 focus:outline-none 
              focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-600"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-amber-700 dark:text-amber-500" />
        </div>
      </div>
      
      {savedBooks.length === 0 ? (
        <div className="text-center py-12 bg-amber-50 dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-gray-800">
          <BookOpen className="h-16 w-16 text-amber-300 dark:text-amber-700 mx-auto mb-4" />
          <h3 className="text-xl font-serif font-medium text-amber-900 dark:text-amber-300">
            No saved books yet
          </h3>
          <p className="mt-2 text-amber-700 dark:text-amber-500 max-w-md mx-auto">
            Start exploring our collection and save your favorite books to build your personal library.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm 
              text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 dark:bg-amber-800 
              dark:hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            Discover Books
          </Link>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-8 bg-amber-50 dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-gray-800">
          <Search className="h-12 w-12 text-amber-300 dark:text-amber-700 mx-auto mb-3" />
          <h3 className="text-lg font-serif font-medium text-amber-900 dark:text-amber-300">
            No matches found
          </h3>
          <p className="mt-2 text-amber-700 dark:text-amber-500">
            No books match your search query "{searchQuery}".
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredBooks.map(book => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-amber-50 dark:bg-gray-900 rounded-lg overflow-hidden shadow-md 
                border border-amber-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
            >
              <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4">
                <div className="md:w-1/6 flex-shrink-0">
                  <Link to={`/book/${book.id}`}>
                    <img 
                      src={book.formats['image/jpeg'] || 'https://placehold.co/200x300/e9d8b6/453a22?text=No+Cover'}
                      alt={`Cover for ${book.title}`}
                      className="w-full h-auto object-cover rounded shadow-sm border border-amber-200 dark:border-gray-700"
                    />
                  </Link>
                </div>
                
                <div className="md:w-5/6">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={`/book/${book.id}`} className="hover:underline">
                        <h2 className="text-xl font-serif font-semibold text-amber-900 dark:text-amber-300">
                          {book.title}
                        </h2>
                      </Link>
                      
                      <p className="mt-1 text-sm text-amber-800 dark:text-amber-400 italic">
                        {book.authors.map(author => author.name).join(', ')}
                      </p>
                      
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                        Saved on {new Date(book.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleRemoveBook(book.id)}
                      className="p-2 rounded-full bg-amber-100 dark:bg-gray-800 text-amber-700 
                        dark:text-amber-500 hover:bg-amber-200 dark:hover:bg-gray-700"
                      aria-label="Remove book"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-amber-900 dark:text-amber-300">
                        My Notes
                      </h3>
                      
                      {editingNoteId !== book.id && (
                        <button
                          onClick={() => handleEditNote(book)}
                          className="flex items-center text-xs text-amber-700 dark:text-amber-500 
                            hover:text-amber-900 dark:hover:text-amber-300"
                        >
                          <PenSquare className="h-3 w-3 mr-1" /> Edit
                        </button>
                      )}
                    </div>
                    
                    {editingNoteId === book.id ? (
                      <div>
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          className="w-full p-3 border border-amber-300 dark:border-gray-700 rounded-md 
                            bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100
                            focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          rows={3}
                          placeholder="Add your notes about this book..."
                        />
                        
                        <div className="mt-2 flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="px-3 py-1 text-sm text-amber-800 dark:text-amber-400 
                              hover:text-amber-900 dark:hover:text-amber-300"
                          >
                            Cancel
                          </button>
                          
                          <button
                            onClick={() => handleSaveNote(book.id)}
                            className="px-3 py-1 text-sm bg-amber-700 dark:bg-amber-800 text-white 
                              rounded hover:bg-amber-800 dark:hover:bg-amber-700"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-md border border-amber-200 dark:border-gray-700 min-h-[60px]">
                        {book.notes ? (
                          <p className="text-amber-900 dark:text-amber-100 text-sm whitespace-pre-wrap">
                            {book.notes}
                          </p>
                        ) : (
                          <p className="text-amber-500 dark:text-amber-600 text-sm italic">
                            No notes yet. Click edit to add your thoughts about this book.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default SavedBooks;
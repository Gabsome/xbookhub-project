import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BookDetail from './pages/BookDetail';
import SavedBooks from './pages/SavedBooks';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import IntroAnimation from './components/IntroAnimation';

// Context
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

// Types
import { UserSettings } from './types';

function App() {
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'vintage',
    fontSize: 'medium',
  });

  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    // Apply theme class to the body
    document.body.className = `theme-${settings.theme}`;

    // Apply font size class
    document.documentElement.style.fontSize =
      settings.fontSize === 'small' ? '14px' :
      settings.fontSize === 'large' ? '18px' : '16px';
  }, [settings]);

  return (
    <MotionConfig reducedMotion="user">
      {showIntro ? (
        <IntroAnimation onComplete={() => setShowIntro(false)} />
      ) : (
        <AuthProvider>
          <ThemeProvider initialTheme={settings.theme} setSettings={setSettings}>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="book/:id" element={<BookDetail />} />
                  <Route
                    path="saved"
                    element={
                      <ProtectedRoute>
                        <SavedBooks />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Router>
          </ThemeProvider>
        </AuthProvider>
      )}
    </MotionConfig>
  );
}

export default App;

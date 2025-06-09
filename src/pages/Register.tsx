import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, User, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-amber-50 dark:bg-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-amber-800 dark:text-amber-500" />
          </Link>
          <h2 className="mt-4 text-3xl font-serif font-bold text-amber-900 dark:text-amber-300">
            Create an Account
          </h2>
          <p className="mt-2 text-amber-800 dark:text-amber-400">
            Join Xbook-Hub and discover a world of timeless literature
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-md rounded-lg border border-amber-200 dark:border-gray-700">
          {error && (
            <div className="mb-4 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 p-3 rounded">
              {error}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-amber-900 dark:text-amber-300">
                Full Name
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-amber-700 dark:text-amber-500" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-amber-300 dark:border-gray-700 
                    rounded-md shadow-sm placeholder-amber-400 dark:placeholder-gray-500
                    bg-amber-50 dark:bg-gray-900 text-amber-900 dark:text-amber-100
                    focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Your Name"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-amber-900 dark:text-amber-300">
                Email Address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-amber-700 dark:text-amber-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-amber-300 dark:border-gray-700 
                    rounded-md shadow-sm placeholder-amber-400 dark:placeholder-gray-500
                    bg-amber-50 dark:bg-gray-900 text-amber-900 dark:text-amber-100
                    focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-amber-900 dark:text-amber-300">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-amber-700 dark:text-amber-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-amber-300 dark:border-gray-700 
                    rounded-md shadow-sm placeholder-amber-400 dark:placeholder-gray-500
                    bg-amber-50 dark:bg-gray-900 text-amber-900 dark:text-amber-100
                    focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-amber-900 dark:text-amber-300">
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-amber-700 dark:text-amber-500" />
                </div>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-amber-300 dark:border-gray-700 
                    rounded-md shadow-sm placeholder-amber-400 dark:placeholder-gray-500
                    bg-amber-50 dark:bg-gray-900 text-amber-900 dark:text-amber-100
                    focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-amber-600 focus:ring-amber-500 
                  border-amber-300 dark:border-gray-700 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-amber-800 dark:text-amber-400">
                I agree to the{' '}
                <a href="#" className="font-medium text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="font-medium text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                  Privacy Policy
                </a>
              </label>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md 
                shadow-sm text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 
                dark:bg-amber-800 dark:hover:bg-amber-700 focus:outline-none focus:ring-2 
                focus:ring-offset-2 focus:ring-amber-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </motion.button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-amber-800 dark:text-amber-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
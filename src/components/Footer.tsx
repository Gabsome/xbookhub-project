import React from 'react';
import { Heart, Mail, Globe, Github } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-amber-100 dark:bg-gray-900 py-8 border-t border-amber-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <h3 className="text-xl font-serif font-bold text-amber-900 dark:text-amber-400">
              Xbook-Hub
            </h3>
            <p className="mt-2 text-amber-800 dark:text-amber-500 max-w-md">
              A vintage-themed book reading platform for book lovers, 
              curated with classics from public domain sources.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-8 md:gap-16">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-400">
                About
              </h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <a href="#" className="text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                    Our Story
                  </a>
                </li>
                <li>
                  <a href="#" className="text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-400">
                Connect
              </h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <a href="#" className="flex items-center text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                    <Globe className="h-4 w-4 mr-2" />
                    Website
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300">
                    <Github className="h-4 w-4 mr-2" />
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-8 border-t border-amber-200 dark:border-gray-800 pt-6 flex flex-col items-center">
          <p className="text-amber-800 dark:text-amber-500 text-sm">
            © {new Date().getFullYear()} Gabriel Maina Mwangi. All rights reserved.
          </p>
          <p className="flex items-center text-amber-700 dark:text-amber-500 text-xs mt-2">
            Made with <Heart className="h-3 w-3 mx-1 text-red-500" /> in Nakuru, Kenya
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
// Types for the Xbook-Hub application

export interface User {
  id: string;
  name: string;
  email: string;
  preferredTheme: 'light' | 'vintage' | 'dark';
}

export interface Book {
  id: number;
  title: string;
  authors: Author[];
  subjects: string[];
  formats: {
    'image/jpeg'?: string;
    'text/html'?: string;
    'text/plain'?: string;
  };
  download_count: number;
}

export interface Author {
  name: string;
  birth_year?: number;
  death_year?: number;
}

export interface SavedBook extends Book {
  savedAt: string;
  notes?: string;
}

export interface UserSettings {
  theme: 'light' | 'vintage' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
}

export interface BooksApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Book[];
}
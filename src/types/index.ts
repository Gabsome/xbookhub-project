// Types for the Xbook-Hub application

export interface User {
  id: string;
  name: string;
  email: string;
  preferredTheme: 'light' | 'vintage' | 'dark';
}

export interface Author {
  name: string;
  birth_year?: number;
  death_year?: number;
  key?: string;
}

export interface Book {
  id: number | string;
  title: string;
  authors: Author[];
  subjects: string[];
  formats: {
    'image/jpeg'?: string;
    'text/html'?: string;
    'text/plain'?: string;
    'application/pdf'?: string;
    'application/epub+zip'?: string;
  };
  download_count: number;
  source: 'gutenberg' | 'openlibrary' | 'archive';
  isbn?: string[];
  publish_date?: string;
  publisher?: string[];
  description?: string;
  cover_id?: number;
  ia_identifier?: string;
  language?: string[];
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
  source: 'gutenberg' | 'openlibrary' | 'archive';
}

// Open Library specific types
export interface OpenLibraryWork {
  key: string;
  title: string;
  authors?: Array<{
    author: {
      key: string;
    };
    type: {
      key: string;
    };
  }>;
  subjects?: string[];
  description?: string | { value: string };
  covers?: number[];
  first_publish_date?: string;
}

export interface OpenLibraryAuthor {
  key: string;
  name: string;
  birth_date?: string;
  death_date?: string;
}

export interface OpenLibraryEdition {
  key: string;
  title: string;
  authors?: Array<{
    key: string;
  }>;
  isbn_10?: string[];
  isbn_13?: string[];
  publishers?: string[];
  publish_date?: string;
  covers?: number[];
  ia_identifier?: string;
  ocaid?: string;
  languages?: Array<{
    key: string;
  }>;
}

// Internet Archive specific types
export interface ArchiveItem {
  identifier: string;
  title: string;
  creator?: string | string[];
  subject?: string | string[];
  description?: string;
  date?: string;
  publisher?: string | string[];
  language?: string | string[];
  downloads?: number;
  format?: string[];
}

export interface ArchiveSearchResponse {
  response: {
    numFound: number;
    start: number;
    docs: ArchiveItem[];
  };
}
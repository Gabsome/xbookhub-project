const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['https://xbook-hub.netlify.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent'],
  credentials: true
}));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: ['Project Gutenberg', 'Open Library', 'Internet Archive']
  });
});

// Enhanced book fetching endpoint with support for multiple sources
app.get('/api/fetch-book', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ 
      error: 'Missing URL parameter',
      message: 'Please provide a URL to fetch content from'
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid URL format',
      message: 'The provided URL is not valid'
    });
  }

  console.log(`Fetching content from: ${url}`);

  try {
    // Set timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for larger files

    const headers = {
      'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader; +https://xbook-hub.netlify.app)',
      'Accept': 'text/html,text/plain,application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    // Special handling for Internet Archive URLs
    if (url.includes('archive.org')) {
      headers['Referer'] = 'https://archive.org/';
      headers['Accept'] = 'text/html,text/plain,application/pdf,*/*';
    }

    // Special handling for Open Library URLs
    if (url.includes('openlibrary.org')) {
      headers['Referer'] = 'https://openlibrary.org/';
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
      redirect: 'follow',
      timeout: 20000
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `HTTP ${response.status}`,
        message: `Failed to fetch content: ${response.statusText}`,
        url: url
      });
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType}`);

    // Handle different content types
    if (contentType.includes('application/pdf')) {
      // For PDF files, return the binary data
      const buffer = await response.buffer();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      });
      return res.send(buffer);
    }

    // Check if content is text-based
    if (!contentType.includes('text/') && 
        !contentType.includes('application/xml') && 
        !contentType.includes('application/xhtml') &&
        !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Unsupported content type',
        message: `Content type ${contentType} is not supported. Only text-based content is allowed.`,
        contentType: contentType
      });
    }

    const content = await response.text();
    
    if (!content || content.trim().length === 0) {
      return res.status(204).json({
        error: 'Empty content',
        message: 'The fetched content is empty'
      });
    }

    console.log(`Successfully fetched ${content.length} characters`);

    // Set appropriate headers for the response
    res.set({
      'Content-Type': contentType.includes('html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-Content-Length': content.length.toString(),
      'X-Source-URL': url
    });

    res.send(content);

  } catch (error) {
    console.error('Error fetching book content:', error);
    
    if (error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'The request took too long to complete. Please try again.',
        url: url
      });
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Network error',
        message: 'Unable to connect to the content server. Please check your internet connection.',
        url: url
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the content',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      url: url
    });
  }
});

// Proxy endpoint for Open Library API
app.get('/api/openlibrary/*', async (req, res) => {
  try {
    const path = req.params[0];
    const queryString = req.url.split('?')[1] || '';
    const url = `https://openlibrary.org/${path}${queryString ? '?' + queryString : ''}`;
    
    console.log(`Proxying Open Library request: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Open Library API Error: ${response.status}`,
        message: response.statusText
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Open Library proxy error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: 'Failed to fetch from Open Library API'
    });
  }
});

// Proxy endpoint for Internet Archive API
app.get('/api/archive/*', async (req, res) => {
  try {
    const path = req.params[0];
    const queryString = req.url.split('?')[1] || '';
    const url = `https://archive.org/${path}${queryString ? '?' + queryString : ''}`;
    
    console.log(`Proxying Internet Archive request: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Internet Archive API Error: ${response.status}`,
        message: response.statusText
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Internet Archive proxy error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: 'Failed to fetch from Internet Archive API'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.url} not found`
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Enhanced proxy server is running on http://localhost:${PORT}`);
  console.log(`📚 Ready to fetch content from:`);
  console.log(`   - Project Gutenberg`);
  console.log(`   - Open Library`);
  console.log(`   - Internet Archive`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
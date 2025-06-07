const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: 'https://xbook-hub.netlify.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Enhanced book fetching endpoint with better error handling
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
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Xbook-Hub/1.0 (Educational Book Reader)',
        'Accept': 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
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

    // Check if content is text-based
    if (!contentType.includes('text/') && !contentType.includes('application/xml') && !contentType.includes('application/xhtml')) {
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
      'X-Content-Length': content.length.toString()
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
  console.log(`🚀 Proxy server is running on http://localhost:${PORT}`);
  console.log(`📚 Ready to fetch book content from Project Gutenberg`);
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
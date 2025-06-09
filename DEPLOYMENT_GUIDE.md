# Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying Xbook-Hub to production environments. The application consists of a React frontend and an Express.js proxy server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Frontend Deployment (Netlify)](#frontend-deployment-netlify)
4. [Backend Deployment (Render)](#backend-deployment-render)
5. [Domain Configuration](#domain-configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring and Analytics](#monitoring-and-analytics)
8. [Performance Optimization](#performance-optimization)
9. [Backup and Recovery](#backup-and-recovery)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
- [GitHub](https://github.com) account for code repository
- [Netlify](https://netlify.com) account for frontend hosting
- [Render](https://render.com) account for backend hosting
- [Uploadcare](https://uploadcare.com) account for file uploads
- Domain registrar account (optional, for custom domain)

### Required Tools
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git 2.30.0 or higher

### Required Knowledge
- Basic understanding of React applications
- Familiarity with Node.js and Express
- Understanding of DNS and domain configuration
- Basic knowledge of CI/CD concepts

## Environment Setup

### Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/gabrielmaina/xbook-hub.git
   cd xbook-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Create environment files**

   **Frontend (.env)**
   ```env
   VITE_UPLOADCARE_PUBLIC_KEY=cb2ddbdec0cd01373ea6
   VITE_API_BASE_URL=https://gutendex.com
   VITE_PROXY_URL=http://localhost:5000/api/fetch-book
   ```

   **Backend (server/.env)**
   ```env
   NODE_ENV=development
   PORT=5000
   CORS_ORIGIN=http://localhost:5173
   ```

### Production Environment Variables

**Frontend**
```env
VITE_UPLOADCARE_PUBLIC_KEY=cb2ddbdec0cd01373ea6
VITE_API_BASE_URL=https://gutendex.com
VITE_PROXY_URL=https://your-backend-domain.onrender.com/api/fetch-book
```

**Backend**
```env
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://your-frontend-domain.netlify.app
```

## Frontend Deployment (Netlify)

### Automatic Deployment via GitHub

1. **Prepare the repository**
   ```bash
   # Ensure all changes are committed
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Log in to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Choose GitHub and authorize access
   - Select your repository

3. **Configure build settings**
   ```yaml
   Build command: npm run build
   Publish directory: dist
   Node version: 18
   ```

4. **Set environment variables**
   - Go to Site settings → Environment variables
   - Add the following variables:
     ```
     VITE_UPLOADCARE_PUBLIC_KEY=cb2ddbdec0cd01373ea6
     VITE_API_BASE_URL=https://gutendex.com
     VITE_PROXY_URL=https://your-backend-domain.onrender.com/api/fetch-book
     ```

5. **Configure redirects**
   Create `public/_redirects` file:
   ```
   /*    /index.html   200
   ```

6. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Note the generated URL (e.g., `https://amazing-site-123456.netlify.app`)

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login to Netlify
   netlify login
   
   # Deploy
   netlify deploy --prod --dir=dist
   ```

### Custom Domain Setup

1. **Add custom domain**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter your domain name

2. **Configure DNS**
   Add the following DNS records:
   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   
   Type: A
   Name: @
   Value: 75.2.60.5
   ```

3. **Enable HTTPS**
   - Netlify automatically provisions SSL certificates
   - Force HTTPS redirect in Site settings

## Backend Deployment (Render)

### Automatic Deployment

1. **Prepare server code**
   Ensure `server/package.json` has correct start script:
   ```json
   {
     "scripts": {
       "start": "node index.js",
       "dev": "node index.js"
     }
   }
   ```

2. **Connect to Render**
   - Log in to [Render](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

3. **Configure service**
   ```yaml
   Name: xbook-hub-proxy
   Environment: Node
   Region: Oregon (US West)
   Branch: main
   Root Directory: server
   Build Command: npm install
   Start Command: npm start
   ```

4. **Set environment variables**
   ```
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend-domain.netlify.app
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the service URL

### Manual Deployment

1. **Prepare for deployment**
   ```bash
   cd server
   npm install --production
   ```

2. **Deploy via Render CLI**
   ```bash
   # Install Render CLI
   npm install -g @render/cli
   
   # Deploy
   render deploy
   ```

### Health Checks

Configure health check endpoint:
```
Health Check Path: /api/health
```

## Domain Configuration

### DNS Setup

1. **Frontend (Netlify)**
   ```
   Type: CNAME
   Name: www
   Value: your-site.netlify.app
   
   Type: A
   Name: @
   Value: 75.2.60.5
   ```

2. **Backend (Render)**
   ```
   Type: CNAME
   Name: api
   Value: your-service.onrender.com
   ```

### Subdomain Configuration

For API subdomain (api.yourdomain.com):

1. **Add custom domain in Render**
   - Go to service settings
   - Add custom domain: `api.yourdomain.com`

2. **Update DNS**
   ```
   Type: CNAME
   Name: api
   Value: your-service.onrender.com
   ```

3. **Update environment variables**
   ```env
   VITE_PROXY_URL=https://api.yourdomain.com/api/fetch-book
   ```

## SSL/TLS Setup

### Automatic SSL (Recommended)

Both Netlify and Render provide automatic SSL:

1. **Netlify**
   - Automatic Let's Encrypt certificates
   - Auto-renewal
   - Force HTTPS redirect

2. **Render**
   - Automatic SSL for custom domains
   - Managed certificates
   - HTTPS enforcement

### Manual SSL Configuration

If using custom SSL certificates:

1. **Generate certificates**
   ```bash
   # Using Let's Encrypt
   certbot certonly --manual -d yourdomain.com -d www.yourdomain.com
   ```

2. **Upload to hosting provider**
   - Follow provider-specific instructions
   - Configure certificate renewal

## Monitoring and Analytics

### Application Monitoring

1. **Error Tracking**
   ```typescript
   // Add to main.tsx
   window.addEventListener('error', (event) => {
     console.error('Global error:', event.error);
     // Send to monitoring service
   });
   ```

2. **Performance Monitoring**
   ```typescript
   // Add performance tracking
   const observer = new PerformanceObserver((list) => {
     for (const entry of list.getEntries()) {
       console.log('Performance:', entry);
     }
   });
   observer.observe({ entryTypes: ['navigation', 'paint'] });
   ```

### Analytics Setup

1. **Google Analytics**
   ```html
   <!-- Add to index.html -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_MEASUREMENT_ID');
   </script>
   ```

2. **Custom Analytics**
   ```typescript
   // Track user interactions
   const trackEvent = (action: string, category: string, label?: string) => {
     gtag('event', action, {
       event_category: category,
       event_label: label,
     });
   };
   ```

### Uptime Monitoring

1. **Netlify**
   - Built-in uptime monitoring
   - Deploy notifications
   - Form submissions tracking

2. **Render**
   - Service health checks
   - Deployment notifications
   - Resource usage monitoring

## Performance Optimization

### Frontend Optimization

1. **Build Optimization**
   ```javascript
   // vite.config.ts
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             router: ['react-router-dom'],
             ui: ['framer-motion', 'lucide-react'],
           },
         },
       },
     },
   });
   ```

2. **Asset Optimization**
   ```bash
   # Optimize images
   npm install -D vite-plugin-imagemin
   ```

3. **Caching Strategy**
   ```javascript
   // netlify.toml
   [[headers]]
     for = "/assets/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"
   ```

### Backend Optimization

1. **Compression**
   ```javascript
   // server/index.js
   const compression = require('compression');
   app.use(compression());
   ```

2. **Caching**
   ```javascript
   // Add response caching
   app.use((req, res, next) => {
     if (req.method === 'GET') {
       res.set('Cache-Control', 'public, max-age=3600');
     }
     next();
   });
   ```

3. **Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // limit each IP to 100 requests per windowMs
   });
   
   app.use(limiter);
   ```

## Backup and Recovery

### Code Backup

1. **Git Repository**
   - Ensure all code is committed to Git
   - Use multiple remotes for redundancy
   - Tag releases for easy rollback

2. **Automated Backups**
   ```bash
   # GitHub Actions backup
   name: Backup
   on:
     schedule:
       - cron: '0 2 * * *'
   jobs:
     backup:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - name: Create backup
           run: |
             tar -czf backup-$(date +%Y%m%d).tar.gz .
             # Upload to backup storage
   ```

### Data Backup

1. **User Data**
   - Data is stored locally in browsers
   - Provide export functionality
   - Consider cloud sync for premium users

2. **Configuration Backup**
   ```bash
   # Backup environment variables
   netlify env:list > netlify-env-backup.txt
   ```

### Disaster Recovery

1. **Recovery Plan**
   - Document recovery procedures
   - Test recovery process regularly
   - Maintain emergency contacts

2. **Rollback Strategy**
   ```bash
   # Quick rollback using Git
   git revert HEAD
   git push origin main
   
   # Netlify will auto-deploy the rollback
   ```

## Troubleshooting

### Common Issues

#### Build Failures

1. **Node Version Mismatch**
   ```bash
   # Check Node version
   node --version
   
   # Update package.json
   "engines": {
     "node": ">=18.0.0"
   }
   ```

2. **Dependency Issues**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Environment Variables**
   ```bash
   # Check if variables are set
   echo $VITE_UPLOADCARE_PUBLIC_KEY
   
   # Verify in build logs
   ```

#### Runtime Errors

1. **CORS Issues**
   ```javascript
   // Update server CORS configuration
   app.use(cors({
     origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
     credentials: true
   }));
   ```

2. **API Connectivity**
   ```bash
   # Test API endpoint
   curl https://your-api-domain.com/api/health
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   openssl s_client -connect yourdomain.com:443
   ```

### Debugging Tools

1. **Browser DevTools**
   - Network tab for API calls
   - Console for JavaScript errors
   - Application tab for storage

2. **Server Logs**
   ```bash
   # Render logs
   render logs --service your-service-id
   
   # Netlify logs
   netlify logs
   ```

3. **Performance Analysis**
   ```bash
   # Lighthouse audit
   npm install -g lighthouse
   lighthouse https://yourdomain.com
   ```

### Support Resources

1. **Documentation**
   - [Netlify Docs](https://docs.netlify.com)
   - [Render Docs](https://render.com/docs)
   - [React Docs](https://reactjs.org/docs)

2. **Community Support**
   - GitHub Issues
   - Stack Overflow
   - Discord/Slack communities

3. **Professional Support**
   - Netlify Support (paid plans)
   - Render Support
   - Custom development services

## Maintenance

### Regular Tasks

1. **Weekly**
   - Check application health
   - Review error logs
   - Monitor performance metrics

2. **Monthly**
   - Update dependencies
   - Review security alerts
   - Backup configurations

3. **Quarterly**
   - Security audit
   - Performance optimization
   - Disaster recovery testing

### Update Process

1. **Dependency Updates**
   ```bash
   # Check for updates
   npm outdated
   
   # Update dependencies
   npm update
   
   # Test thoroughly before deploying
   npm test
   ```

2. **Security Updates**
   ```bash
   # Check for security vulnerabilities
   npm audit
   
   # Fix automatically
   npm audit fix
   ```

3. **Deployment Pipeline**
   ```bash
   # Development → Staging → Production
   git checkout develop
   git merge feature-branch
   git checkout staging
   git merge develop
   git checkout main
   git merge staging
   ```

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Contact**: deployment@xbook-hub.com

For additional support or questions about deployment, please contact our technical team.
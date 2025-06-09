const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// Software Requirements Specification (SRS)
const srsContent = `
# Software Requirements Specification (SRS)
## Xbook-Hub - Vintage Book Reading Platform

**Document Version:** 1.0  
**Date:** December 2024  
**Author:** Gabriel Maina Mwangi  
**Project:** Xbook-Hub  

---

## Table of Contents

1. [Introduction](#introduction)
2. [Overall Description](#overall-description)
3. [System Features](#system-features)
4. [External Interface Requirements](#external-interface-requirements)
5. [Non-Functional Requirements](#non-functional-requirements)
6. [Other Requirements](#other-requirements)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document describes the functional and non-functional requirements for Xbook-Hub, a vintage-themed book reading platform. This document is intended for developers, project managers, testers, and stakeholders involved in the development and maintenance of the system.

### 1.2 Scope
Xbook-Hub is a web-based application that provides users with access to a curated collection of classic literature from Project Gutenberg. The platform offers both online and offline reading capabilities, personal library management, and a vintage-themed user interface.

**Key Features:**
- Access to thousands of public domain books
- Online and offline reading capabilities
- Personal library management
- User authentication and profiles
- Responsive design for all devices
- Multiple theme options (vintage, light, dark)
- Book search and filtering
- Download capabilities (TXT, HTML, PDF)

### 1.3 Definitions, Acronyms, and Abbreviations
- **API:** Application Programming Interface
- **CORS:** Cross-Origin Resource Sharing
- **CSS:** Cascading Style Sheets
- **HTML:** HyperText Markup Language
- **HTTP:** HyperText Transfer Protocol
- **HTTPS:** HyperText Transfer Protocol Secure
- **IndexedDB:** Browser-based database for client-side storage
- **JSON:** JavaScript Object Notation
- **PDF:** Portable Document Format
- **PWA:** Progressive Web Application
- **REST:** Representational State Transfer
- **SPA:** Single Page Application
- **UI:** User Interface
- **UX:** User Experience

### 1.4 References
- Project Gutenberg API Documentation
- React.js Documentation
- TypeScript Documentation
- Tailwind CSS Documentation
- Web Content Accessibility Guidelines (WCAG) 2.1

### 1.5 Overview
This document is organized into six main sections covering the introduction, overall description, system features, interface requirements, non-functional requirements, and other requirements.

---

## 2. Overall Description

### 2.1 Product Perspective
Xbook-Hub is a standalone web application that integrates with external APIs and services:

**External Dependencies:**
- Project Gutenberg API (Gutendex) for book metadata
- Custom proxy server for CORS handling
- Uploadcare for file upload services
- Netlify for frontend hosting
- Render for backend hosting

**System Architecture:**
- Frontend: React.js with TypeScript
- Backend: Express.js proxy server
- Storage: Browser LocalStorage and IndexedDB
- Styling: Tailwind CSS with custom vintage theme
- Build Tool: Vite

### 2.2 Product Functions
The main functions of Xbook-Hub include:

1. **Book Discovery and Search**
   - Browse curated collection of classic literature
   - Search books by title, author, or subject
   - Filter and sort search results
   - Pagination for large result sets

2. **Reading Experience**
   - Online reading with formatted text
   - Offline reading capabilities
   - Adjustable font sizes and themes
   - Reading progress tracking

3. **Personal Library Management**
   - Save books to personal collection
   - Add personal notes to saved books
   - Organize and manage saved books
   - Export personal library data

4. **User Account Management**
   - User registration and authentication
   - Profile customization
   - Settings management
   - Avatar upload

5. **Download and Export**
   - Download books in multiple formats (TXT, HTML, PDF)
   - Export personal notes and collections
   - Offline storage management

### 2.3 User Classes and Characteristics
**Primary Users:**
- **Book Enthusiasts:** Individuals who enjoy reading classic literature
- **Students:** Academic users researching classic texts
- **Educators:** Teachers and professors using classic literature in curriculum
- **Researchers:** Scholars studying literary works

**User Characteristics:**
- Age range: 16-65 years
- Technical proficiency: Basic to intermediate
- Device usage: Desktop, tablet, and mobile devices
- Internet connectivity: Variable (offline capability required)

### 2.4 Operating Environment
**Client-Side Requirements:**
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- JavaScript enabled
- Minimum 1GB RAM
- 100MB available storage for offline books

**Server-Side Environment:**
- Node.js 18.0+ runtime
- Express.js framework
- Cloud hosting (Netlify, Render)
- CDN for static assets

**Network Requirements:**
- Internet connection for initial access and book downloads
- HTTPS support required
- Bandwidth: Minimum 1 Mbps for optimal experience

### 2.5 Design and Implementation Constraints
**Technical Constraints:**
- Must work in modern web browsers without plugins
- Client-side storage limitations (browser quotas)
- CORS restrictions for external API access
- Mobile device performance limitations

**Business Constraints:**
- Must use only public domain content
- Compliance with copyright laws
- Privacy regulations (GDPR, CCPA)
- Accessibility standards (WCAG 2.1 AA)

**Security Constraints:**
- HTTPS-only communication
- Input validation and sanitization
- Protection against XSS and CSRF attacks
- Secure file upload handling

### 2.6 Assumptions and Dependencies
**Assumptions:**
- Users have basic computer literacy
- Project Gutenberg API remains available and stable
- Modern browsers continue to support required web standards
- Internet connectivity is available for initial setup

**Dependencies:**
- Project Gutenberg API availability
- Third-party service reliability (Uploadcare, hosting providers)
- Browser support for modern web standards
- CDN availability for static assets

---

## 3. System Features

### 3.1 Book Discovery and Browsing

#### 3.1.1 Description
Users can discover and browse the collection of available books through various methods including browsing, searching, and filtering.

#### 3.1.2 Functional Requirements
**REQ-3.1.1:** The system shall display a paginated list of available books on the home page.
**REQ-3.1.2:** The system shall provide search functionality for books by title, author, and subject.
**REQ-3.1.3:** The system shall display book covers, titles, authors, and download counts.
**REQ-3.1.4:** The system shall support infinite scrolling for book lists.
**REQ-3.1.5:** The system shall provide filtering options by genre and subject.

#### 3.1.3 Priority
High

### 3.2 User Authentication and Profiles

#### 3.2.1 Description
Users can create accounts, log in, and manage their profiles to access personalized features.

#### 3.2.2 Functional Requirements
**REQ-3.2.1:** The system shall allow users to register with email and password.
**REQ-3.2.2:** The system shall provide secure login functionality.
**REQ-3.2.3:** The system shall allow users to update their profile information.
**REQ-3.2.4:** The system shall support avatar upload functionality.
**REQ-3.2.5:** The system shall provide password reset capabilities.

#### 3.2.3 Priority
High

### 3.3 Reading Experience

#### 3.3.1 Description
Users can read books online with various customization options and reading aids.

#### 3.3.2 Functional Requirements
**REQ-3.3.1:** The system shall display book content in a readable format.
**REQ-3.3.2:** The system shall provide font size adjustment options.
**REQ-3.3.3:** The system shall offer multiple theme options (vintage, light, dark).
**REQ-3.3.4:** The system shall support responsive design for all screen sizes.
**REQ-3.3.5:** The system shall maintain reading position across sessions.

#### 3.3.3 Priority
High

### 3.4 Offline Reading

#### 3.4.1 Description
Users can download books for offline reading when internet connectivity is unavailable.

#### 3.4.2 Functional Requirements
**REQ-3.4.1:** The system shall allow users to save books for offline reading.
**REQ-3.4.2:** The system shall store book content in browser IndexedDB.
**REQ-3.4.3:** The system shall provide offline book management interface.
**REQ-3.4.4:** The system shall indicate offline availability status for books.
**REQ-3.4.5:** The system shall allow removal of offline books to free storage.

#### 3.4.4 Priority
Medium

### 3.5 Personal Library Management

#### 3.5.1 Description
Users can save books to their personal library and add notes for future reference.

#### 3.5.2 Functional Requirements
**REQ-3.5.1:** The system shall allow users to save books to their personal library.
**REQ-3.5.2:** The system shall provide note-taking functionality for saved books.
**REQ-3.5.3:** The system shall display saved books in an organized manner.
**REQ-3.5.4:** The system shall allow users to remove books from their library.
**REQ-3.5.5:** The system shall provide search functionality within saved books.

#### 3.5.3 Priority
Medium

### 3.6 Download and Export

#### 3.6.1 Description
Users can download books in various formats for use outside the platform.

#### 3.6.2 Functional Requirements
**REQ-3.6.1:** The system shall provide book download in TXT format.
**REQ-3.6.2:** The system shall provide book download in HTML format.
**REQ-3.6.3:** The system shall generate and provide PDF downloads.
**REQ-3.6.4:** The system shall allow export of personal library data.
**REQ-3.6.5:** The system shall provide download progress indicators.

#### 3.6.3 Priority
Low

---

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 General UI Requirements
**REQ-4.1.1:** The interface shall follow vintage design aesthetics with modern usability.
**REQ-4.1.2:** The interface shall be responsive and work on devices from 320px to 4K resolution.
**REQ-4.1.3:** The interface shall provide clear navigation and breadcrumbs.
**REQ-4.1.4:** The interface shall use consistent typography and color schemes.
**REQ-4.1.5:** The interface shall provide visual feedback for user actions.

#### 4.1.2 Accessibility Requirements
**REQ-4.1.6:** The interface shall meet WCAG 2.1 AA accessibility standards.
**REQ-4.1.7:** The interface shall support keyboard navigation.
**REQ-4.1.8:** The interface shall provide appropriate ARIA labels and roles.
**REQ-4.1.9:** The interface shall maintain sufficient color contrast ratios.
**REQ-4.1.10:** The interface shall support screen readers.

### 4.2 Hardware Interfaces
**REQ-4.2.1:** The system shall work on standard computer hardware with modern browsers.
**REQ-4.2.2:** The system shall support touch interfaces on mobile devices.
**REQ-4.2.3:** The system shall utilize available storage for offline functionality.

### 4.3 Software Interfaces

#### 4.3.1 Project Gutenberg API
**REQ-4.3.1:** The system shall integrate with Gutendex API for book metadata.
**REQ-4.3.2:** The system shall handle API rate limiting gracefully.
**REQ-4.3.3:** The system shall implement retry logic for failed API calls.
**REQ-4.3.4:** The system shall cache API responses when appropriate.

#### 4.3.2 Proxy Server Interface
**REQ-4.3.5:** The system shall use a proxy server to handle CORS restrictions.
**REQ-4.3.6:** The system shall implement timeout handling for proxy requests.
**REQ-4.3.7:** The system shall provide fallback mechanisms for proxy failures.

#### 4.3.3 File Upload Interface
**REQ-4.3.8:** The system shall integrate with Uploadcare for file uploads.
**REQ-4.3.9:** The system shall validate uploaded file types and sizes.
**REQ-4.3.10:** The system shall provide upload progress indicators.

### 4.4 Communication Interfaces
**REQ-4.4.1:** All communication shall use HTTPS protocol.
**REQ-4.4.2:** The system shall implement proper CORS headers.
**REQ-4.4.3:** The system shall use JSON for data exchange.
**REQ-4.4.4:** The system shall implement request/response compression.

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

#### 5.1.1 Response Time
**REQ-5.1.1:** Page load time shall not exceed 3 seconds on broadband connections.
**REQ-5.1.2:** Search results shall be displayed within 2 seconds.
**REQ-5.1.3:** Book content shall load within 5 seconds.
**REQ-5.1.4:** User interface interactions shall respond within 100ms.

#### 5.1.2 Throughput
**REQ-5.1.5:** The system shall support at least 1000 concurrent users.
**REQ-5.1.6:** The system shall handle at least 100 requests per second.

#### 5.1.3 Resource Utilization
**REQ-5.1.7:** Client-side memory usage shall not exceed 500MB.
**REQ-5.1.8:** Offline storage shall be limited to 1GB per user.
**REQ-5.1.9:** CPU usage shall remain below 50% during normal operation.

### 5.2 Security Requirements

#### 5.2.1 Authentication and Authorization
**REQ-5.2.1:** User passwords shall be securely hashed and stored.
**REQ-5.2.2:** Session management shall use secure tokens.
**REQ-5.2.3:** The system shall implement proper access controls.
**REQ-5.2.4:** The system shall protect against brute force attacks.

#### 5.2.2 Data Protection
**REQ-5.2.5:** All data transmission shall be encrypted using HTTPS.
**REQ-5.2.6:** Sensitive data shall be encrypted at rest.
**REQ-5.2.7:** The system shall implement input validation and sanitization.
**REQ-5.2.8:** The system shall protect against XSS and CSRF attacks.

#### 5.2.3 Privacy
**REQ-5.2.9:** The system shall comply with GDPR requirements.
**REQ-5.2.10:** User data shall be anonymized where possible.
**REQ-5.2.11:** The system shall provide data export and deletion capabilities.

### 5.3 Reliability Requirements
**REQ-5.3.1:** The system shall have 99.5% uptime availability.
**REQ-5.3.2:** The system shall gracefully handle network failures.
**REQ-5.3.3:** The system shall implement automatic error recovery.
**REQ-5.3.4:** Data integrity shall be maintained during failures.

### 5.4 Availability Requirements
**REQ-5.4.1:** The system shall be available 24/7 with planned maintenance windows.
**REQ-5.4.2:** Maintenance windows shall not exceed 4 hours per month.
**REQ-5.4.3:** The system shall provide offline functionality when network is unavailable.

### 5.5 Maintainability Requirements
**REQ-5.5.1:** Code shall follow established coding standards and best practices.
**REQ-5.5.2:** The system shall have comprehensive documentation.
**REQ-5.5.3:** The system shall support automated testing.
**REQ-5.5.4:** The system shall use modular architecture for easy updates.

### 5.6 Portability Requirements
**REQ-5.6.1:** The system shall work on major operating systems (Windows, macOS, Linux).
**REQ-5.6.2:** The system shall work on major browsers (Chrome, Firefox, Safari, Edge).
**REQ-5.6.3:** The system shall be responsive across different screen sizes.

---

## 6. Other Requirements

### 6.1 Legal Requirements
**REQ-6.1.1:** The system shall only use public domain content.
**REQ-6.1.2:** The system shall comply with copyright laws.
**REQ-6.1.3:** The system shall provide proper attribution for content sources.
**REQ-6.1.4:** The system shall comply with accessibility laws (ADA, Section 508).

### 6.2 Standards Compliance
**REQ-6.2.1:** The system shall follow W3C web standards.
**REQ-6.2.2:** The system shall comply with WCAG 2.1 AA accessibility guidelines.
**REQ-6.2.3:** The system shall follow REST API design principles.
**REQ-6.2.4:** The system shall use semantic HTML markup.

### 6.3 Cultural and Localization Requirements
**REQ-6.3.1:** The system shall support UTF-8 character encoding.
**REQ-6.3.2:** The system shall be designed for future localization.
**REQ-6.3.3:** The system shall respect cultural sensitivities in content presentation.

### 6.4 Environmental Requirements
**REQ-6.4.1:** The system shall be optimized for energy efficiency.
**REQ-6.4.2:** The system shall minimize bandwidth usage where possible.
**REQ-6.4.3:** The system shall support green hosting practices.

---

## Appendices

### Appendix A: Glossary
- **Classic Literature:** Literary works that have stood the test of time and are considered to have lasting artistic merit
- **Public Domain:** Creative works not protected by intellectual property laws and available for public use
- **Progressive Web App:** Web applications that use modern web capabilities to provide app-like experiences
- **Responsive Design:** Web design approach that makes web pages render well on various devices and screen sizes

### Appendix B: Requirements Traceability Matrix
[This section would contain a detailed traceability matrix linking requirements to design elements, test cases, and implementation components]

### Appendix C: Risk Analysis
[This section would contain identified risks, their impact, probability, and mitigation strategies]

---

**Document Control:**
- **Version:** 1.0
- **Date:** December 2024
- **Author:** Gabriel Maina Mwangi
- **Approved by:** Gabriel Maina Mwangi
- **Next Review Date:** March 2025

**Copyright © 2024 Gabriel Maina Mwangi. All rights reserved.**
`;

// Development Lifecycle Documentation
const developmentLifecycleContent = `
# Development Lifecycle Documentation
## Xbook-Hub Project

**Document Version:** 1.0  
**Date:** December 2024  
**Author:** Gabriel Maina Mwangi  
**Project:** Xbook-Hub  

---

## Table of Contents

1. [Introduction](#introduction)
2. [Development Methodology](#development-methodology)
3. [Project Phases](#project-phases)
4. [Development Environment Setup](#development-environment-setup)
5. [Version Control Strategy](#version-control-strategy)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Pipeline](#deployment-pipeline)
8. [Quality Assurance](#quality-assurance)
9. [Risk Management](#risk-management)
10. [Project Timeline](#project-timeline)

---

## 1. Introduction

### 1.1 Purpose
This document outlines the development lifecycle methodology, processes, and procedures used in the development of Xbook-Hub, a vintage-themed book reading platform.

### 1.2 Scope
This document covers the entire software development lifecycle from initial planning through deployment and maintenance, including development methodologies, tools, processes, and quality assurance measures.

### 1.3 Audience
- Development team members
- Project managers
- Quality assurance engineers
- DevOps engineers
- Stakeholders and clients

---

## 2. Development Methodology

### 2.1 Agile Development Approach
Xbook-Hub follows an Agile development methodology with the following characteristics:

**Sprint Duration:** 2 weeks  
**Team Size:** 1-3 developers  
**Methodology:** Scrum with Kanban elements  

### 2.2 Agile Principles Applied
1. **Individuals and interactions** over processes and tools
2. **Working software** over comprehensive documentation
3. **Customer collaboration** over contract negotiation
4. **Responding to change** over following a plan

### 2.3 Development Practices
- **Test-Driven Development (TDD):** Write tests before implementation
- **Continuous Integration:** Automated testing and integration
- **Code Reviews:** Peer review of all code changes
- **Pair Programming:** Collaborative coding for complex features
- **Refactoring:** Continuous code improvement

---

## 3. Project Phases

### 3.1 Phase 1: Planning and Analysis (Week 1-2)

#### 3.1.1 Requirements Gathering
- **Stakeholder Interviews:** Identify user needs and expectations
- **Market Research:** Analyze existing book reading platforms
- **Technical Feasibility:** Assess technical requirements and constraints
- **Risk Assessment:** Identify potential risks and mitigation strategies

#### 3.1.2 System Design
- **Architecture Design:** Define system architecture and components
- **Database Design:** Plan data storage and retrieval strategies
- **UI/UX Design:** Create wireframes and mockups
- **API Design:** Define external API integrations

#### 3.1.3 Project Planning
- **Work Breakdown Structure:** Break down project into manageable tasks
- **Resource Allocation:** Assign team members and responsibilities
- **Timeline Creation:** Establish project milestones and deadlines
- **Tool Selection:** Choose development tools and technologies

### 3.2 Phase 2: Foundation Development (Week 3-6)

#### 3.2.1 Environment Setup
- **Development Environment:** Set up local development environment
- **Version Control:** Initialize Git repository and branching strategy
- **CI/CD Pipeline:** Configure automated testing and deployment
- **Documentation:** Create initial project documentation

#### 3.2.2 Core Infrastructure
- **Project Structure:** Establish folder structure and organization
- **Build System:** Configure Vite build system and optimization
- **Styling Framework:** Implement Tailwind CSS and custom themes
- **Routing:** Set up React Router for navigation

#### 3.2.3 Basic Components
- **Layout Components:** Header, footer, and navigation
- **UI Components:** Buttons, forms, and basic elements
- **Theme System:** Implement vintage, light, and dark themes
- **Responsive Design:** Ensure mobile-first responsive layout

### 3.3 Phase 3: Core Feature Development (Week 7-12)

#### 3.3.1 Book Discovery and Display
- **API Integration:** Connect to Project Gutenberg API
- **Book Listing:** Implement book browsing and pagination
- **Search Functionality:** Add search and filtering capabilities
- **Book Details:** Create detailed book information pages

#### 3.3.2 User Authentication
- **Registration System:** User account creation
- **Login/Logout:** Secure authentication flow
- **Profile Management:** User profile and settings
- **Session Management:** Maintain user sessions

#### 3.3.3 Reading Experience
- **Book Reader:** Online book reading interface
- **Content Formatting:** Proper text formatting and styling
- **Reading Preferences:** Font size and theme customization
- **Progress Tracking:** Save reading position and progress

### 3.4 Phase 4: Advanced Features (Week 13-16)

#### 3.4.1 Offline Functionality
- **IndexedDB Integration:** Client-side data storage
- **Offline Book Storage:** Download books for offline reading
- **Sync Mechanism:** Synchronize online and offline data
- **Storage Management:** Manage offline storage limits

#### 3.4.2 Personal Library
- **Save Books:** Add books to personal collection
- **Note Taking:** Add personal notes to books
- **Library Management:** Organize and manage saved books
- **Export Functionality:** Export library data

#### 3.4.3 Download Features
- **Multiple Formats:** Support TXT, HTML, and PDF downloads
- **PDF Generation:** Client-side PDF creation
- **File Management:** Handle file downloads and storage
- **Progress Indicators:** Show download progress

### 3.5 Phase 5: Testing and Quality Assurance (Week 17-18)

#### 3.5.1 Testing Implementation
- **Unit Testing:** Test individual components and functions
- **Integration Testing:** Test component interactions
- **End-to-End Testing:** Test complete user workflows
- **Performance Testing:** Optimize application performance

#### 3.5.2 Quality Assurance
- **Code Review:** Comprehensive code review process
- **Security Audit:** Security vulnerability assessment
- **Accessibility Testing:** WCAG compliance verification
- **Cross-Browser Testing:** Ensure compatibility across browsers

#### 3.5.3 Bug Fixing and Optimization
- **Bug Identification:** Identify and document bugs
- **Issue Resolution:** Fix identified issues and bugs
- **Performance Optimization:** Optimize loading times and responsiveness
- **Code Refactoring:** Improve code quality and maintainability

### 3.6 Phase 6: Deployment and Launch (Week 19-20)

#### 3.6.1 Production Preparation
- **Environment Configuration:** Set up production environment
- **Security Hardening:** Implement security best practices
- **Performance Optimization:** Final performance tuning
- **Documentation Completion:** Complete all documentation

#### 3.6.2 Deployment
- **Frontend Deployment:** Deploy to Netlify
- **Backend Deployment:** Deploy proxy server to Render
- **Domain Configuration:** Set up custom domain and SSL
- **Monitoring Setup:** Implement application monitoring

#### 3.6.3 Launch Activities
- **Soft Launch:** Limited release for testing
- **User Acceptance Testing:** Final user testing
- **Production Launch:** Full public release
- **Post-Launch Monitoring:** Monitor application performance

---

## 4. Development Environment Setup

### 4.1 Required Software
- **Node.js:** Version 18.0 or higher
- **npm:** Version 9.0 or higher
- **Git:** Version 2.30 or higher
- **VS Code:** Recommended IDE with extensions
- **Modern Browser:** Chrome, Firefox, or Safari for testing

### 4.2 Development Tools
- **Vite:** Build tool and development server
- **TypeScript:** Type-safe JavaScript development
- **ESLint:** Code linting and quality checks
- **Prettier:** Code formatting
- **React Developer Tools:** Browser extension for debugging

### 4.3 Environment Configuration
``\`bash
# Clone repository
git clone https://github.com/gabrielmaina/xbook-hub.git
cd xbook-hub

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

### 4.4 IDE Configuration
**VS Code Extensions:**
- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Prettier - Code formatter
- ESLint
- Tailwind CSS IntelliSense
- GitLens

---

## 5. Version Control Strategy

### 5.1 Git Workflow
**Branching Strategy:** Git Flow with feature branches

**Main Branches:**
- **main:** Production-ready code
- **develop:** Integration branch for features
- **feature/*:** Individual feature development
- **hotfix/*:** Critical bug fixes
- **release/*:** Release preparation

### 5.2 Commit Standards
**Commit Message Format:**
```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes
- **refactor:** Code refactoring
- **test:** Test additions or modifications
- **chore:** Build process or auxiliary tool changes

### 5.3 Code Review Process
1. **Create Feature Branch:** Branch from develop
2. **Implement Feature:** Write code and tests
3. **Self Review:** Review own code before submission
4. **Create Pull Request:** Submit for peer review
5. **Address Feedback:** Make requested changes
6. **Merge:** Merge after approval

---

## 6. Testing Strategy

### 6.1 Testing Pyramid
**Unit Tests (70%):**
- Individual component testing
- Function and method testing
- Mock external dependencies
- Fast execution and high coverage

**Integration Tests (20%):**
- Component interaction testing
- API integration testing
- Database interaction testing
- Service integration testing

**End-to-End Tests (10%):**
- Complete user workflow testing
- Cross-browser compatibility
- Performance testing
- User acceptance testing

### 6.2 Testing Tools
- **Jest:** Unit testing framework
- **React Testing Library:** Component testing
- **Cypress:** End-to-end testing
- **Lighthouse:** Performance testing
- **axe-core:** Accessibility testing

### 6.3 Testing Process
1. **Test Planning:** Define test cases and scenarios
2. **Test Implementation:** Write automated tests
3. **Test Execution:** Run tests in CI/CD pipeline
4. **Result Analysis:** Analyze test results and coverage
5. **Bug Reporting:** Document and track issues

---

## 7. Deployment Pipeline

### 7.1 Continuous Integration
**Automated Processes:**
- Code linting and formatting checks
- Unit and integration test execution
- Build verification
- Security vulnerability scanning
- Code quality analysis

### 7.2 Continuous Deployment
**Deployment Stages:**
1. **Development:** Automatic deployment to dev environment
2. **Staging:** Manual deployment for testing
3. **Production:** Manual deployment after approval

### 7.3 Deployment Configuration
**Frontend (Netlify):**
- Build command: \`npm run build`
- Publish directory: \`dist`
- Environment variables configuration
- Custom domain and SSL setup

**Backend (Render):**
- Build command: `npm install`
- Start command: `npm start`
- Environment variables configuration
- Health check endpoints

---

## 8. Quality Assurance

### 8.1 Code Quality Standards
- **TypeScript:** Strict type checking enabled
- **ESLint:** Comprehensive linting rules
- **Prettier:** Consistent code formatting
- **Code Coverage:** Minimum 80% test coverage
- **Documentation:** JSDoc comments for all functions

### 8.2 Performance Standards
- **Page Load Time:** < 3 seconds on 3G connection
- **First Contentful Paint:** < 1.5 seconds
- **Time to Interactive:** < 3 seconds
- **Lighthouse Score:** > 90 for all categories
- **Bundle Size:** < 500KB gzipped

### 8.3 Security Standards
- **HTTPS Only:** All communications encrypted
- **Input Validation:** All user inputs validated
- **XSS Protection:** Content Security Policy implemented
- **CSRF Protection:** Anti-CSRF tokens used
- **Dependency Scanning:** Regular security audits

### 8.4 Accessibility Standards
- **WCAG 2.1 AA:** Full compliance required
- **Keyboard Navigation:** All features accessible via keyboard
- **Screen Reader Support:** Proper ARIA labels and roles
- **Color Contrast:** Minimum 4.5:1 ratio
- **Focus Management:** Clear focus indicators

---

## 9. Risk Management

### 9.1 Technical Risks
**Risk:** API Dependency Failure  
**Impact:** High  
**Probability:** Medium  
**Mitigation:** Implement caching and fallback mechanisms

**Risk:** Browser Compatibility Issues  
**Impact:** Medium  
**Probability:** Low  
**Mitigation:** Comprehensive cross-browser testing

**Risk:** Performance Degradation  
**Impact:** Medium  
**Probability:** Medium  
**Mitigation:** Regular performance monitoring and optimization

### 9.2 Project Risks
**Risk:** Scope Creep  
**Impact:** High  
**Probability:** Medium  
**Mitigation:** Clear requirements documentation and change control

**Risk:** Resource Constraints  
**Impact:** High  
**Probability:** Low  
**Mitigation:** Flexible timeline and priority management

**Risk:** Third-Party Service Outages  
**Impact:** Medium  
**Probability:** Low  
**Mitigation:** Multiple service providers and fallback options

### 9.3 Risk Monitoring
- **Weekly Risk Assessment:** Review and update risk register
- **Mitigation Tracking:** Monitor effectiveness of mitigation strategies
- **Contingency Planning:** Prepare backup plans for high-impact risks
- **Stakeholder Communication:** Regular risk status updates

---

## 10. Project Timeline

### 10.1 Milestone Schedule
**Week 1-2:** Requirements and Planning  
**Week 3-6:** Foundation Development  
**Week 7-12:** Core Feature Development  
**Week 13-16:** Advanced Features  
**Week 17-18:** Testing and QA  
**Week 19-20:** Deployment and Launch  

### 10.2 Critical Path Activities
1. **API Integration:** Must be completed before book features
2. **Authentication System:** Required for personal features
3. **Offline Storage:** Complex feature requiring early planning
4. **Testing Phase:** Cannot be compressed without quality impact

### 10.3 Resource Allocation
**Development:** 70% of total effort  
**Testing:** 20% of total effort  
**Documentation:** 5% of total effort  
**Deployment:** 5% of total effort  

---

## Appendices

### Appendix A: Development Standards
[Detailed coding standards and best practices]

### Appendix B: Tool Configuration
[Configuration files and setup instructions]

### Appendix C: Troubleshooting Guide
[Common issues and solutions]

---

**Document Control:**
- **Version:** 1.0
- **Date:** December 2024
- **Author:** Gabriel Maina Mwangi
- **Approved by:** Gabriel Maina Mwangi
- **Next Review Date:** March 2025

**Copyright © 2024 Gabriel Maina Mwangi. All rights reserved.**
`;

// Project Documentation
const projectDocumentationContent = `
# Project Documentation
## Xbook-Hub - Comprehensive Project Guide

**Document Version:** 1.0  
**Date:** December 2024  
**Author:** Gabriel Maina Mwangi  
**Project:** Xbook-Hub  

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Documentation](#architecture-documentation)
3. [Technical Specifications](#technical-specifications)
4. [User Guide](#user-guide)
5. [Administrator Guide](#administrator-guide)
6. [API Documentation](#api-documentation)
7. [Database Documentation](#database-documentation)
8. [Security Documentation](#security-documentation)
9. [Performance Documentation](#performance-documentation)
10. [Maintenance Guide](#maintenance-guide)

---

## 1. Project Overview

### 1.1 Project Description
Xbook-Hub is a vintage-themed web application that provides users with access to a curated collection of classic literature from Project Gutenberg. The platform combines modern web technologies with a nostalgic design aesthetic to create an immersive reading experience.

### 1.2 Key Features
- **Extensive Library:** Access to thousands of public domain books
- **Vintage Design:** Carefully crafted vintage aesthetic with modern usability
- **Offline Reading:** Download books for offline access using IndexedDB
- **Personal Library:** Save and organize favorite books with personal notes
- **Multiple Formats:** Download books as TXT, HTML, or PDF
- **Responsive Design:** Optimized for all devices from mobile to desktop
- **Theme Options:** Vintage, light, and dark theme variants
- **Search and Filter:** Advanced search and filtering capabilities

### 1.3 Target Audience
- **Primary Users:** Book enthusiasts, students, educators, researchers
- **Age Range:** 16-65 years
- **Technical Level:** Basic to intermediate computer users
- **Usage Context:** Personal reading, academic research, educational use

### 1.4 Business Objectives
- Provide free access to classic literature
- Preserve and promote literary heritage
- Create an engaging reading experience
- Build a community of book lovers
- Demonstrate modern web development capabilities

---

## 2. Architecture Documentation

### 2.1 System Architecture

#### 2.1.1 High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Proxy Server  │    │  External APIs  │
│   (React SPA)   │◄──►│   (Express.js)  │◄──►│ (Project        │
│                 │    │                 │    │  Gutenberg)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Cloud         │    │   CDN           │
│   Storage       │    │   Hosting       │    │   Services      │
│   (IndexedDB)   │    │   (Render)      │    │   (Uploadcare)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### 2.1.2 Component Architecture
**Frontend Components:**
- **Presentation Layer:** React components and UI elements
- **Business Logic Layer:** Custom hooks and context providers
- **Data Access Layer:** API services and local storage utilities
- **Routing Layer:** React Router for navigation

**Backend Components:**
- **API Gateway:** Express.js proxy server
- **CORS Handler:** Cross-origin request management
- **Error Handler:** Centralized error processing
- **Logging System:** Request and error logging

### 2.2 Technology Stack

#### 2.2.1 Frontend Technologies
- **React 18.3.1:** Modern React with hooks and concurrent features
- **TypeScript 5.5.3:** Type-safe JavaScript development
- **Vite 5.4.2:** Fast build tool and development server
- **Tailwind CSS 3.4.1:** Utility-first CSS framework
- **Framer Motion 11.18.2:** Animation and motion library
- **React Router DOM 6.22.0:** Client-side routing

#### 2.2.2 Backend Technologies
- **Node.js 18+:** JavaScript runtime environment
- **Express.js 4.18.2:** Web application framework
- **CORS 2.8.5:** Cross-origin resource sharing middleware
- **Node-fetch 3.3.2:** HTTP client for API requests

#### 2.2.3 Storage Technologies
- **IndexedDB:** Client-side database for offline storage
- **LocalStorage:** Browser storage for user preferences
- **Session Storage:** Temporary session data storage

#### 2.2.4 External Services
- **Project Gutenberg API:** Book metadata and content
- **Uploadcare:** File upload and management
- **Netlify:** Frontend hosting and deployment
- **Render:** Backend hosting and deployment

### 2.3 Data Flow Architecture

#### 2.3.1 User Interaction Flow
1. **User Request:** User interacts with React components
2. **State Management:** Context providers manage application state
3. **API Calls:** Services make requests to external APIs
4. **Data Processing:** Response data is processed and formatted
5. **UI Update:** Components re-render with new data
6. **Local Storage:** Data is cached locally when appropriate

#### 2.3.2 Offline Data Flow
1. **Online Fetch:** Content is fetched from external APIs
2. **IndexedDB Storage:** Content is stored in browser database
3. **Offline Access:** Content is retrieved from local storage
4. **Sync Management:** Online and offline data is synchronized

---

## 3. Technical Specifications

### 3.1 System Requirements

#### 3.1.1 Client-Side Requirements
- **Browser:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **JavaScript:** ES2020+ support required
- **Memory:** Minimum 1GB RAM
- **Storage:** 100MB available for offline books
- **Network:** Broadband internet for initial setup

#### 3.1.2 Server-Side Requirements
- **Runtime:** Node.js 18.0+
- **Memory:** 512MB RAM minimum
- **Storage:** 1GB disk space
- **Network:** Stable internet connection
- **SSL:** HTTPS certificate required

### 3.2 Performance Specifications

#### 3.2.1 Response Time Requirements
- **Page Load:** < 3 seconds on 3G connection
- **Search Results:** < 2 seconds
- **Book Content:** < 5 seconds
- **UI Interactions:** < 100ms

#### 3.2.2 Scalability Requirements
- **Concurrent Users:** 1000+ simultaneous users
- **Request Rate:** 100+ requests per second
- **Data Transfer:** 10GB+ daily bandwidth
- **Storage Growth:** 1GB+ monthly increase

### 3.3 Security Specifications

#### 3.3.1 Data Security
- **Encryption:** HTTPS/TLS 1.3 for all communications
- **Authentication:** Secure session management
- **Input Validation:** All user inputs sanitized
- **XSS Protection:** Content Security Policy implemented

#### 3.3.2 Privacy Protection
- **Data Minimization:** Collect only necessary data
- **Local Storage:** Sensitive data stored locally
- **Anonymization:** User data anonymized where possible
- **Compliance:** GDPR and CCPA compliant

---

## 4. User Guide

### 4.1 Getting Started

#### 4.1.1 Account Creation
1. **Visit Website:** Navigate to Xbook-Hub homepage
2. **Click Register:** Select "Sign up" from navigation
3. **Fill Form:** Enter name, email, and password
4. **Verify Email:** Check email for verification (if implemented)
5. **Complete Profile:** Add optional profile information

#### 4.1.2 First Login
1. **Navigate to Login:** Click "Login" from homepage
2. **Enter Credentials:** Provide email and password
3. **Access Dashboard:** Explore the main interface
4. **Customize Settings:** Adjust theme and preferences

### 4.2 Core Features

#### 4.2.1 Browsing Books
- **Homepage:** Browse featured and popular books
- **Search:** Use search bar to find specific titles or authors
- **Filters:** Apply genre and subject filters
- **Pagination:** Navigate through multiple pages of results

#### 4.2.2 Reading Books
- **Book Details:** Click on any book to view details
- **Read Online:** Click "Read Now" to start reading
- **Customize View:** Adjust font size and theme
- **Save Progress:** Reading position is automatically saved

#### 4.2.3 Personal Library
- **Save Books:** Click bookmark icon to save books
- **View Library:** Access saved books from navigation
- **Add Notes:** Write personal notes for saved books
- **Organize:** Search and filter your saved books

#### 4.2.4 Offline Reading
- **Download Books:** Click download icon for offline access
- **Manage Storage:** View and manage offline books in settings
- **Read Offline:** Access downloaded books without internet

### 4.3 Advanced Features

#### 4.3.1 Download Options
- **Multiple Formats:** Choose TXT, HTML, or PDF format
- **PDF Generation:** Create formatted PDF documents
- **File Management:** Downloads saved to device storage

#### 4.3.2 Customization
- **Theme Selection:** Choose vintage, light, or dark theme
- **Font Size:** Adjust reading font size
- **Profile Settings:** Update personal information

---

## 5. Administrator Guide

### 5.1 System Administration

#### 5.1.1 Deployment Management
- **Frontend Deployment:** Netlify dashboard management
- **Backend Deployment:** Render service management
- **Domain Configuration:** DNS and SSL certificate setup
- **Environment Variables:** Production configuration management

#### 5.1.2 Monitoring and Maintenance
- **Performance Monitoring:** Track application performance metrics
- **Error Monitoring:** Monitor and respond to application errors
- **Security Monitoring:** Regular security audits and updates
- **Backup Management:** Data backup and recovery procedures

### 5.2 Content Management

#### 5.2.1 Book Content
- **Source Management:** Project Gutenberg API integration
- **Content Validation:** Ensure content quality and availability
- **Metadata Management:** Book information and categorization
- **Content Updates:** Handle content changes and additions

#### 5.2.2 User Management
- **Account Administration:** User account management
- **Access Control:** Permission and role management
- **Data Privacy:** User data protection and compliance
- **Support:** User support and issue resolution

---

## 6. API Documentation

### 6.1 External API Integration

#### 6.1.1 Project Gutenberg API (Gutendex)
**Base URL:** `https://gutendex.com`

**Endpoints:**
- `GET /books` - Retrieve paginated book list
- `GET /books?search={query}` - Search books
- `GET /books/{id}` - Get specific book details

**Response Format:**
```json
{
  "count": 70000,
  "next": "https://gutendex.com/books?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Book Title",
      "authors": [{"name": "Author Name"}],
      "subjects": ["Subject 1", "Subject 2"],
      "formats": {
        "text/html": "https://example.com/book.html",
        "text/plain": "https://example.com/book.txt"
      },
      "download_count": 12345
    }
  ]
}
```

#### 6.1.2 Proxy Server API
**Base URL:** `https://xbookhub-project.onrender.com/api`

**Endpoints:**
- `GET /fetch-book?url={encoded_url}` - Fetch book content
- `GET /health` - Health check endpoint

### 6.2 Internal API Services

#### 6.2.1 Book Service
```typescript
// Fetch books with pagination
fetchBooks(page?: number): Promise<BooksApiResponse>

// Search books by query
searchBooks(query: string, page?: number): Promise<BooksApiResponse>

// Get book by ID
fetchBookById(id: number): Promise<Book>

// Fetch book content
fetchBookContent(book: Book): Promise<string>
```

#### 6.2.2 Storage Service
```typescript
// Save book for offline reading
saveBookOffline(book: Book): Promise<void>

// Get offline book
getOfflineBook(id: number): Promise<Book | undefined>

// Remove offline book
removeOfflineBook(id: number): Promise<void>

// Check offline availability
isBookAvailableOffline(id: number): Promise<boolean>
```

---

## 7. Database Documentation

### 7.1 Client-Side Storage

#### 7.1.1 IndexedDB Schema
**Database:** `xbook-offline-db` (version 2)

**Object Stores:**
1. **books** - Book metadata storage
   - Key path: `id`
   - Indexes: `title`, `authors`
   
2. **content** - Book content storage
   - Key path: `bookId`

#### 7.1.2 LocalStorage Schema
**User Data:**
- `xbook-user` - Current user information
- `xbook-saved-{userId}` - User's saved books
- `xbook-settings` - Application settings
- `xbook-theme` - Current theme selection

### 7.2 Data Models

#### 7.2.1 Book Model
```typescript
interface Book {
  id: number;
  title: string;
  authors: Author[];
  subjects: string[];
  formats: Record<string, string>;
  download_count: number;
}
```

#### 7.2.2 User Model
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  preferredTheme: 'light' | 'vintage' | 'dark';
}
```

#### 7.2.3 Saved Book Model
```typescript
interface SavedBook extends Book {
  savedAt: string;
  notes?: string;
}
```

---

## 8. Security Documentation

### 8.1 Security Architecture

#### 8.1.1 Authentication Security
- **Password Hashing:** Secure password storage (demo uses localStorage)
- **Session Management:** Secure session token handling
- **Access Control:** Role-based access control implementation
- **Brute Force Protection:** Rate limiting and account lockout

#### 8.1.2 Data Security
- **HTTPS Enforcement:** All communications encrypted
- **Input Validation:** Comprehensive input sanitization
- **XSS Protection:** Content Security Policy implementation
- **CSRF Protection:** Anti-CSRF token usage

### 8.2 Privacy Protection

#### 8.2.1 Data Handling
- **Data Minimization:** Collect only necessary information
- **Local Storage:** Sensitive data stored client-side
- **Anonymization:** Personal data anonymized where possible
- **Retention Policies:** Data retention and deletion policies

#### 8.2.2 Compliance
- **GDPR Compliance:** European data protection standards
- **CCPA Compliance:** California privacy rights
- **Cookie Policy:** Transparent cookie usage
- **Privacy Policy:** Comprehensive privacy documentation

---

## 9. Performance Documentation

### 9.1 Performance Optimization

#### 9.1.1 Frontend Optimization
- **Code Splitting:** React.lazy for route-based splitting
- **Bundle Optimization:** Vite's built-in optimizations
- **Image Optimization:** Lazy loading and proper sizing
- **Caching Strategy:** Browser caching and service workers

#### 9.1.2 Backend Optimization
- **Response Compression:** Gzip compression enabled
- **Caching Headers:** Appropriate cache control headers
- **Rate Limiting:** API rate limiting implementation
- **Connection Pooling:** Efficient database connections

### 9.2 Performance Metrics

#### 9.2.1 Core Web Vitals
- **Largest Contentful Paint (LCP):** < 2.5 seconds
- **First Input Delay (FID):** < 100 milliseconds
- **Cumulative Layout Shift (CLS):** < 0.1

#### 9.2.2 Additional Metrics
- **First Contentful Paint:** < 1.5 seconds
- **Time to Interactive:** < 3 seconds
- **Speed Index:** < 3 seconds
- **Total Blocking Time:** < 200 milliseconds

---

## 10. Maintenance Guide

### 10.1 Regular Maintenance

#### 10.1.1 Daily Tasks
- **Monitor Application:** Check application health and performance
- **Review Logs:** Analyze error logs and user activity
- **Security Scan:** Automated security vulnerability scanning
- **Backup Verification:** Verify backup integrity and availability

#### 10.1.2 Weekly Tasks
- **Dependency Updates:** Check for and apply security updates
- **Performance Review:** Analyze performance metrics and trends
- **User Feedback:** Review user feedback and support requests
- **Content Validation:** Verify content availability and quality

#### 10.1.3 Monthly Tasks
- **Security Audit:** Comprehensive security assessment
- **Performance Optimization:** Identify and implement optimizations
- **Documentation Update:** Update documentation and procedures
- **Disaster Recovery Test:** Test backup and recovery procedures

### 10.2 Troubleshooting

#### 10.2.1 Common Issues
**Issue:** Books not loading  
**Cause:** API connectivity or CORS issues  
**Solution:** Check proxy server status and API availability

**Issue:** Offline books not working  
**Cause:** IndexedDB storage issues  
**Solution:** Clear browser storage and re-download books

**Issue:** Performance degradation  
**Cause:** Large bundle size or memory leaks  
**Solution:** Analyze bundle size and implement code splitting

#### 10.2.2 Emergency Procedures
- **Service Outage:** Immediate response and communication plan
- **Security Breach:** Incident response and containment procedures
- **Data Loss:** Recovery procedures and user communication
- **Performance Crisis:** Scaling and optimization emergency procedures

---

## Appendices

### Appendix A: Configuration Files
[Detailed configuration examples and templates]

### Appendix B: Deployment Scripts
[Automated deployment and maintenance scripts]

### Appendix C: Monitoring Setup
[Application monitoring and alerting configuration]

### Appendix D: Backup Procedures
[Data backup and recovery procedures]

---

**Document Control:**
- **Version:** 1.0
- **Date:** December 2024
- **Author:** Gabriel Maina Mwangi
- **Approved by:** Gabriel Maina Mwangi
- **Next Review Date:** March 2025

**Copyright © 2024 Gabriel Maina Mwangi. All rights reserved.**
`;

// Function to generate PDF from markdown content
async function generatePDF(content, filename) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Convert markdown to HTML
  const htmlContent = marked(content);
  
  // Create full HTML document with styling
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${filename}</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #2c3e50;
          margin-top: 30px;
          margin-bottom: 15px;
        }
        h1 {
          border-bottom: 3px solid #3498db;
          padding-bottom: 10px;
        }
        h2 {
          border-bottom: 2px solid #95a5a6;
          padding-bottom: 5px;
        }
        code {
          background-color: #f8f9fa;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        pre {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
        }
        blockquote {
          border-left: 4px solid #3498db;
          margin: 20px 0;
          padding-left: 20px;
          font-style: italic;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;
  
  await page.setContent(fullHtml);
  
  const pdf = await page.pdf({
    format: 'A4',
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    },
    printBackground: true
  });
  
  await browser.close();
  
  // Save PDF file
  fs.writeFileSync(filename, pdf);
  console.log(\`Generated ${filename}`);
}

// Generate all PDFs
async function generateAllPDFs() {
  try {
    await generatePDF(srsContent, 'Xbook-Hub_SRS_Document.pdf');
    await generatePDF(developmentLifecycleContent, 'Xbook-Hub_Development_Lifecycle.pdf');
    await generatePDF(projectDocumentationContent, 'Xbook-Hub_Project_Documentation.pdf');
    
    console.log('All PDF documents generated successfully!');
  } catch (error) {
    console.error('Error generating PDFs:', error);
  }
}

// Run the PDF generation
generateAllPDFs();
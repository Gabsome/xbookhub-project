# Contributing to Xbook-Hub

Thank you for your interest in contributing to Xbook-Hub! This document provides guidelines and information for contributors.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Contributing Guidelines](#contributing-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)
7. [Testing Guidelines](#testing-guidelines)
8. [Documentation](#documentation)
9. [Issue Reporting](#issue-reporting)
10. [Community](#community)

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at conduct@xbook-hub.com. All complaints will be reviewed and investigated promptly and fairly.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git 2.30.0 or higher
- A GitHub account

### First Contribution

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   # Then clone your fork
   git clone https://github.com/YOUR_USERNAME/xbook-hub.git
   cd xbook-hub
   ```

2. **Set up upstream remote**
   ```bash
   git remote add upstream https://github.com/gabrielmaina/xbook-hub.git
   ```

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
   - Follow the coding standards
   - Add tests if applicable
   - Update documentation

5. **Submit a pull request**
   - Push your changes to your fork
   - Create a pull request on GitHub

## Development Setup

### Local Environment

1. **Clone and install**
   ```bash
   git clone https://github.com/gabrielmaina/xbook-hub.git
   cd xbook-hub
   npm install
   cd server && npm install && cd ..
   ```

2. **Environment configuration**
   ```bash
   # Copy example environment files
   cp .env.example .env
   cp server/.env.example server/.env
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend
   cd server && npm run dev
   ```

### Development Tools

**Recommended VS Code Extensions:**
- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Prettier - Code formatter
- ESLint
- Tailwind CSS IntelliSense
- GitLens

**Browser Extensions:**
- React Developer Tools
- Redux DevTools (if using Redux)

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

1. **Bug Fixes**
   - Fix existing bugs
   - Improve error handling
   - Performance optimizations

2. **New Features**
   - User interface improvements
   - New functionality
   - API integrations

3. **Documentation**
   - Code documentation
   - User guides
   - API documentation

4. **Testing**
   - Unit tests
   - Integration tests
   - End-to-end tests

### Contribution Process

1. **Check existing issues**
   - Look for existing issues or feature requests
   - Comment on issues you'd like to work on
   - Ask questions if anything is unclear

2. **Create an issue** (for new features)
   - Describe the feature or bug
   - Provide use cases and examples
   - Wait for maintainer approval before starting work

3. **Development workflow**
   ```bash
   # Update your fork
   git fetch upstream
   git checkout main
   git merge upstream/main
   
   # Create feature branch
   git checkout -b feature/your-feature
   
   # Make changes and commit
   git add .
   git commit -m "feat: add new feature"
   
   # Push to your fork
   git push origin feature/your-feature
   ```

4. **Submit pull request**
   - Use the pull request template
   - Provide clear description
   - Link related issues
   - Request review from maintainers

## Pull Request Process

### Before Submitting

1. **Code quality**
   ```bash
   # Run linting
   npm run lint
   
   # Run tests
   npm test
   
   # Build successfully
   npm run build
   ```

2. **Documentation**
   - Update README if needed
   - Add JSDoc comments for new functions
   - Update API documentation

3. **Testing**
   - Add tests for new features
   - Ensure all tests pass
   - Test manually in browser

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Manual testing completed
- [ ] New tests added

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks**
   - Linting and formatting
   - Test suite execution
   - Build verification

2. **Code review**
   - At least one maintainer review required
   - Address feedback promptly
   - Make requested changes

3. **Merge criteria**
   - All checks pass
   - Approved by maintainer
   - No conflicts with main branch
   - Documentation updated

## Coding Standards

### TypeScript/JavaScript

1. **General principles**
   ```typescript
   // Use TypeScript for all new code
   interface Props {
     title: string;
     optional?: boolean;
   }
   
   // Use descriptive names
   const fetchUserBooks = async (userId: string) => {
     // Implementation
   };
   
   // Prefer const over let
   const API_BASE_URL = 'https://api.example.com';
   ```

2. **React components**
   ```typescript
   // Use functional components with hooks
   const BookCard: React.FC<BookCardProps> = ({ book, onSave }) => {
     const [isLoading, setIsLoading] = useState(false);
     
     // Event handlers
     const handleSave = useCallback(async () => {
       setIsLoading(true);
       try {
         await onSave(book);
       } catch (error) {
         console.error('Failed to save book:', error);
       } finally {
         setIsLoading(false);
       }
     }, [book, onSave]);
     
     return (
       <div className="book-card">
         {/* JSX content */}
       </div>
     );
   };
   ```

3. **Error handling**
   ```typescript
   // Always handle errors gracefully
   try {
     const result = await apiCall();
     return result;
   } catch (error) {
     console.error('API call failed:', error);
     throw new Error('User-friendly error message');
   }
   ```

### CSS/Styling

1. **Tailwind CSS**
   ```jsx
   // Use Tailwind utility classes
   <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
     <h2 className="text-xl font-serif font-semibold text-amber-900">
       Book Title
     </h2>
   </div>
   ```

2. **Responsive design**
   ```jsx
   // Mobile-first approach
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
     {/* Content */}
   </div>
   ```

3. **Dark mode support**
   ```jsx
   // Include dark mode variants
   <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
     {/* Content */}
   </div>
   ```

### File Organization

```
src/
├── components/          # Reusable components
│   ├── ui/             # Basic UI components
│   └── features/       # Feature-specific components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API and external services
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── context/            # React context providers
└── assets/             # Static assets
```

### Naming Conventions

1. **Files and directories**
   ```
   PascalCase for components: BookCard.tsx
   camelCase for utilities: formatDate.ts
   kebab-case for assets: book-cover.jpg
   ```

2. **Variables and functions**
   ```typescript
   // camelCase for variables and functions
   const userName = 'john_doe';
   const fetchUserData = async () => {};
   
   // PascalCase for components and classes
   const BookList = () => {};
   class ApiService {}
   
   // UPPER_SNAKE_CASE for constants
   const API_BASE_URL = 'https://api.example.com';
   ```

## Testing Guidelines

### Testing Strategy

1. **Unit tests**
   - Test individual functions and components
   - Mock external dependencies
   - Focus on business logic

2. **Integration tests**
   - Test component interactions
   - Test API integrations
   - Test user workflows

3. **End-to-end tests**
   - Test complete user journeys
   - Test critical paths
   - Test across different browsers

### Writing Tests

1. **Component testing**
   ```typescript
   import { render, screen, fireEvent } from '@testing-library/react';
   import BookCard from './BookCard';
   
   describe('BookCard', () => {
     const mockBook = {
       id: 1,
       title: 'Test Book',
       authors: [{ name: 'Test Author' }],
     };
     
     it('renders book title', () => {
       render(<BookCard book={mockBook} />);
       expect(screen.getByText('Test Book')).toBeInTheDocument();
     });
     
     it('calls onSave when save button is clicked', () => {
       const mockOnSave = jest.fn();
       render(<BookCard book={mockBook} onSave={mockOnSave} />);
       
       fireEvent.click(screen.getByRole('button', { name: /save/i }));
       expect(mockOnSave).toHaveBeenCalledWith(mockBook);
     });
   });
   ```

2. **API testing**
   ```typescript
   import { fetchBooks } from './api';
   
   // Mock fetch
   global.fetch = jest.fn();
   
   describe('API functions', () => {
     beforeEach(() => {
       (fetch as jest.Mock).mockClear();
     });
     
     it('fetches books successfully', async () => {
       const mockResponse = {
         results: [{ id: 1, title: 'Test Book' }],
       };
       
       (fetch as jest.Mock).mockResolvedValueOnce({
         ok: true,
         json: async () => mockResponse,
       });
       
       const result = await fetchBooks();
       expect(result).toEqual(mockResponse);
     });
   });
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test BookCard.test.tsx
```

## Documentation

### Code Documentation

1. **JSDoc comments**
   ```typescript
   /**
    * Fetches book content from the API
    * @param book - The book object containing format URLs
    * @returns Promise that resolves to the book content as a string
    * @throws Error when no readable content is available
    */
   const fetchBookContent = async (book: Book): Promise<string> => {
     // Implementation
   };
   ```

2. **README updates**
   - Update installation instructions
   - Document new features
   - Update API documentation

3. **Type definitions**
   ```typescript
   /**
    * Represents a book from the Project Gutenberg API
    */
   interface Book {
     /** Unique identifier for the book */
     id: number;
     /** The title of the book */
     title: string;
     /** Array of authors who wrote the book */
     authors: Author[];
     /** Available download formats */
     formats: Record<string, string>;
   }
   ```

### Documentation Standards

1. **Clear and concise**
   - Use simple language
   - Provide examples
   - Include common use cases

2. **Up-to-date**
   - Update docs with code changes
   - Remove outdated information
   - Verify examples work

3. **Accessible**
   - Use proper headings
   - Include table of contents
   - Provide search functionality

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
A clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
What you expected to happen

**Screenshots**
If applicable, add screenshots

**Environment**
- OS: [e.g. iOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]

**Additional Context**
Any other context about the problem
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
A clear description of the feature

**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other solutions you've considered

**Additional Context**
Any other context or screenshots
```

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `priority: high`: High priority issue
- `priority: low`: Low priority issue

## Community

### Communication Channels

1. **GitHub Discussions**
   - General questions
   - Feature discussions
   - Community showcase

2. **Issues**
   - Bug reports
   - Feature requests
   - Technical discussions

3. **Email**
   - Private matters: contact@xbook-hub.com
   - Security issues: security@xbook-hub.com

### Community Guidelines

1. **Be respectful**
   - Treat everyone with respect
   - Be patient with newcomers
   - Provide constructive feedback

2. **Be helpful**
   - Answer questions when you can
   - Share knowledge and resources
   - Help others learn

3. **Stay on topic**
   - Keep discussions relevant
   - Use appropriate channels
   - Search before asking

### Recognition

Contributors are recognized through:

1. **Contributors list**
   - Added to README
   - GitHub contributors page
   - Release notes

2. **Special recognition**
   - Significant contributions highlighted
   - Community spotlights
   - Conference mentions

## Getting Help

### Resources

1. **Documentation**
   - README.md
   - API documentation
   - Deployment guide

2. **Code examples**
   - Example components
   - Integration examples
   - Best practices

3. **Community support**
   - GitHub Discussions
   - Stack Overflow (tag: xbook-hub)
   - Discord community

### Mentorship

New contributors can get help through:

1. **Good first issues**
   - Labeled for beginners
   - Clear requirements
   - Mentorship available

2. **Pair programming**
   - Available for complex features
   - Schedule through GitHub
   - Video calls welcome

3. **Code reviews**
   - Detailed feedback
   - Learning opportunities
   - Best practice sharing

---

**Thank you for contributing to Xbook-Hub!**

Your contributions help make this project better for everyone. Whether you're fixing bugs, adding features, or improving documentation, every contribution is valuable.

For questions about contributing, please reach out to: contribute@xbook-hub.com

**Copyright © 2024 Gabriel Maina Mwangi. All rights reserved.**
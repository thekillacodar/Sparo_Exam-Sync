# 🧪 ExamSync Testing Suite

This comprehensive testing suite ensures the reliability, security, and performance of the ExamSync backend API.

## 📋 Testing Overview

### Test Coverage
- ✅ **Unit Tests**: Individual API endpoints and functions
- ✅ **Integration Tests**: Complete user workflows and system interactions
- ✅ **Middleware Tests**: Authentication, authorization, and validation
- ✅ **Performance Tests**: Load testing and response time validation
- ✅ **Security Tests**: Vulnerability scanning and authentication testing

### Test Structure
```
backend/tests/
├── setup.js              # Global test configuration and utilities
├── auth.test.js          # Authentication endpoint tests
├── exams.test.js         # Exam CRUD operation tests
├── notifications.test.js # Notification system tests
├── middleware.test.js    # Middleware functionality tests
├── integration.test.js   # Full workflow integration tests
└── __mocks__/           # Mock implementations
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- npm or yarn package manager

### Installation
```bash
cd backend
npm install
```

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test Suites
```bash
# Authentication tests only
npm run test:runner -- --auth

# Integration tests only
npm run test:runner -- --integration

# API tests only
npm run test:runner -- --api

# Performance tests
npm run test:runner -- --performance
```

## 📊 Test Results & Coverage

### Coverage Targets
- **Lines**: ≥80%
- **Functions**: ≥80%
- **Branches**: ≥70%
- **Statements**: ≥80%

### Viewing Coverage Reports
```bash
# HTML Report
npm run test:runner -- --html
open coverage/lcov-report/index.html

# JSON Summary
cat coverage/coverage-summary.json
```

## 🛠️ Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'config/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Environment Variables for Testing
```bash
NODE_ENV=test
DB_PATH=:memory:  # In-memory database for tests
JWT_SECRET=test-jwt-secret-key
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=8
```

## 🧪 Test Categories

### 1. Authentication Tests (`auth.test.js`)
```javascript
describe('POST /api/auth/register', () => {
  it('should register a new user successfully', async () => {
    // Test user registration flow
  });

  it('should return error for existing email', async () => {
    // Test duplicate email handling
  });
});
```

**Covers:**
- User registration with validation
- User login with credentials
- Token verification
- Password hashing
- Error handling

### 2. Exam Management Tests (`exams.test.js`)
```javascript
describe('POST /api/exams', () => {
  it('should create new exam with valid data', async () => {
    // Test exam creation
  });

  it('should detect and prevent conflicts', async () => {
    // Test conflict detection
  });
});
```

**Covers:**
- CRUD operations for exams
- Conflict detection algorithm
- Validation and error handling
- Search and filtering
- Export functionality

### 3. Notification Tests (`notifications.test.js`)
```javascript
describe('POST /api/notifications', () => {
  it('should create new notification', async () => {
    // Test notification creation
  });

  it('should mark notification as read', async () => {
    // Test read status updates
  });
});
```

**Covers:**
- Notification creation and delivery
- Read/unread status management
- Bulk operations
- Admin notification sending
- Statistics and filtering

### 4. Integration Tests (`integration.test.js`)
```javascript
describe('Complete User Registration and Login Flow', () => {
  it('should complete full registration and login cycle', async () => {
    // End-to-end user flow testing
  });
});
```

**Covers:**
- Complete user workflows
- Cross-API interactions
- Database consistency
- Error handling across systems
- Performance under load

### 5. Middleware Tests (`middleware.test.js`)
```javascript
describe('authenticateToken', () => {
  it('should pass with valid token', () => {
    // Test token validation
  });

  it('should return 401 without token', () => {
    // Test missing token handling
  });
});
```

**Covers:**
- JWT authentication
- Role-based authorization
- Request validation
- Rate limiting
- CORS configuration

## 🎭 Mocking Strategy

### Database Mocking
```javascript
jest.mock('../config/database.js', () => ({
  runQuery: jest.fn(),
  getRow: jest.fn(),
  getAllRows: jest.fn(),
  initializeDatabase: jest.fn().mockResolvedValue()
}));
```

### External API Mocking
```javascript
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn() },
    calendar: jest.fn()
  }
}));
```

### Utility Functions
```javascript
global.testUtils = {
  createTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User',
    role: 'student',
    ...overrides
  })
};
```

## 🚦 CI/CD Integration

### GitHub Actions Workflow
```yaml
jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - name: Run tests
        run: |
          cd backend
          npm run test:ci

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
```

### Automated Testing Triggers
- ✅ Push to main/develop branches
- ✅ Pull request creation
- ✅ Manual workflow dispatch
- ✅ Scheduled nightly runs

## 🔒 Security Testing

### Authentication Security
```javascript
describe('Security Tests', () => {
  it('should prevent brute force attacks', async () => {
    // Test rate limiting effectiveness
  });

  it('should validate JWT tokens securely', async () => {
    // Test token validation
  });
});
```

### Data Validation
```javascript
describe('Input Validation', () => {
  it('should prevent SQL injection', async () => {
    // Test parameterized queries
  });

  it('should validate all input data', async () => {
    // Test input sanitization
  });
});
```

## ⚡ Performance Testing

### Load Testing
```javascript
describe('Performance Tests', () => {
  it('should handle multiple concurrent requests', async () => {
    // Test concurrency handling
  });

  it('should respond within acceptable time limits', async () => {
    // Test response times
  });
});
```

### Database Performance
```javascript
describe('Database Performance', () => {
  it('should handle large datasets efficiently', async () => {
    // Test query performance
  });

  it('should use indexes effectively', async () => {
    // Test index utilization
  });
});
```

## 🐛 Debugging Tests

### Running Tests in Debug Mode
```bash
# Run specific test with verbose output
npm run test:runner -- --verbose -- testNamePattern="specific test"

# Run with debugger
node --inspect-brk node_modules/.bin/jest
```

### Test Debugging Tips
```javascript
// Add console logs to tests
console.log('Debug info:', response.body);

// Use Jest debuggers
debugger; // Add breakpoint

// Skip specific tests
it.skip('should do something', () => {
  // This test will be skipped
});

// Focus on specific tests
it.only('should do something', () => {
  // Only this test will run
});
```

## 📈 Test Metrics & Reporting

### Coverage Reporting
- **HTML Reports**: `coverage/lcov-report/index.html`
- **JSON Summary**: `coverage/coverage-summary.json`
- **Badge Generation**: Automatic coverage badges

### Test Results Analysis
```bash
# Generate detailed test report
npm run test:runner -- --html

# Check test performance
npm run test:runner -- --performance

# Validate test environment
npm run test:runner -- --validate
```

## 🔧 Maintenance

### Adding New Tests
1. Create test file in `tests/` directory
2. Follow naming convention: `*.test.js`
3. Use `describe` and `it` blocks for organization
4. Mock external dependencies
5. Follow existing patterns

### Updating Test Configuration
1. Modify `jest.config.js` for global settings
2. Update `tests/setup.js` for shared utilities
3. Modify CI/CD workflow for new requirements

### Test Data Management
```javascript
// Use test utilities for consistent data
const testUser = testUtils.createTestUser({
  email: 'custom@example.com',
  role: 'lecturer'
});

// Clean up after tests
afterEach(async () => {
  await testUtils.cleanupDatabase(db);
});
```

## 📚 Best Practices

### Test Organization
- ✅ Group related tests in `describe` blocks
- ✅ Use descriptive test names
- ✅ Follow AAA pattern (Arrange, Act, Assert)
- ✅ Keep tests independent and isolated

### Mocking Guidelines
- ✅ Mock external dependencies
- ✅ Use realistic mock data
- ✅ Avoid over-mocking internal functions
- ✅ Reset mocks between tests

### Performance Considerations
- ✅ Keep tests fast (< 100ms per test)
- ✅ Use in-memory database for speed
- ✅ Parallel test execution when possible
- ✅ Skip slow tests in CI when necessary

### Security Testing
- ✅ Test authentication thoroughly
- ✅ Validate input sanitization
- ✅ Test authorization for all endpoints
- ✅ Check rate limiting effectiveness

## 🚀 Advanced Testing

### End-to-End Testing
```bash
# Run E2E tests (requires full app setup)
npm run test:e2e
```

### API Contract Testing
```javascript
// Test API contracts against documentation
describe('API Contracts', () => {
  it('should match OpenAPI specification', () => {
    // Validate against API spec
  });
});
```

### Chaos Engineering
```javascript
// Test system resilience
describe('Chaos Tests', () => {
  it('should handle database connection failures', () => {
    // Simulate database failures
  });

  it('should recover from network timeouts', () => {
    // Test timeout handling
  });
});
```

This testing suite provides comprehensive coverage and ensures the ExamSync backend maintains high quality and reliability across all features and use cases. 🧪✨

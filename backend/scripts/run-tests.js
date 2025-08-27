#!/usr/bin/env node
/**
 * Test Runner Script for ExamSync Backend
 *
 * This script provides a comprehensive test runner with:
 * - Test execution with different modes
 * - Coverage reporting
 * - Test results summary
 * - CI/CD integration
 * - Pre-test setup and post-test cleanup
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.coverageDir = path.join(this.projectRoot, 'coverage');
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      coverage: {},
      duration: 0
    };
  }

  /**
   * Run all tests with specified configuration
   */
  async runTests(options = {}) {
    const {
      watch = false,
      coverage = true,
      ci = false,
      verbose = false,
      testPath = null
    } = options;

    console.log('🚀 Starting ExamSync Test Suite\n');

    const startTime = Date.now();

    try {
      // Pre-test setup
      await this.setupTestEnvironment();

      // Build Jest command
      let jestCommand = 'npx jest';

      if (coverage) {
        jestCommand += ' --coverage';
      }

      if (watch) {
        jestCommand += ' --watch';
      }

      if (ci) {
        jestCommand += ' --watchAll=false --passWithNoTests --ci';
      }

      if (verbose) {
        jestCommand += ' --verbose';
      }

      if (testPath) {
        jestCommand += ` ${testPath}`;
      }

      // Execute tests
      console.log(`📋 Running command: ${jestCommand}\n`);

      const output = execSync(jestCommand, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: ci ? 'pipe' : 'inherit'
      });

      // Parse results
      this.parseTestResults(output);

      // Generate coverage report
      if (coverage && fs.existsSync(this.coverageDir)) {
        await this.generateCoverageReport();
      }

      // Post-test cleanup
      await this.cleanupTestEnvironment();

      const duration = Date.now() - startTime;
      this.testResults.duration = duration;

      // Display results
      this.displayResults();

      // Exit with appropriate code
      const exitCode = this.testResults.failed > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    // Ensure test database directory exists
    const testDbDir = path.join(this.projectRoot, 'data');
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    // Clean up old test files
    const testDbPath = path.join(testDbDir, 'exam-sync-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    console.log('✅ Test environment ready\n');
  }

  /**
   * Parse Jest test output
   */
  parseTestResults(output) {
    // Simple parsing - in a real implementation you might use a more sophisticated parser
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('PASS')) {
        this.testResults.passed++;
        this.testResults.total++;
      } else if (line.includes('FAIL')) {
        this.testResults.failed++;
        this.testResults.total++;
      }
    }
  }

  /**
   * Generate coverage report
   */
  async generateCoverageReport() {
    console.log('📊 Generating coverage report...');

    const coveragePath = path.join(this.coverageDir, 'coverage-summary.json');

    if (fs.existsSync(coveragePath)) {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      this.testResults.coverage = coverageData.total;

      console.log('✅ Coverage report generated\n');
    }
  }

  /**
   * Clean up test environment
   */
  async cleanupTestEnvironment() {
    console.log('🧹 Cleaning up test environment...');

    // Remove test database
    const testDbPath = path.join(this.projectRoot, 'data', 'exam-sync-test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    console.log('✅ Test environment cleaned\n');
  }

  /**
   * Display test results
   */
  displayResults() {
    console.log('📋 Test Results Summary');
    console.log('═'.repeat(50));

    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`⏱️ Duration: ${this.testResults.duration}ms`);

    if (Object.keys(this.testResults.coverage).length > 0) {
      console.log('\n📊 Code Coverage:');
      console.log(`   Lines: ${this.testResults.coverage.lines?.pct || 0}%`);
      console.log(`   Functions: ${this.testResults.coverage.functions?.pct || 0}%`);
      console.log(`   Branches: ${this.testResults.coverage.branches?.pct || 0}%`);
      console.log(`   Statements: ${this.testResults.coverage.statements?.pct || 0}%`);
    }

    console.log('═'.repeat(50));

    if (this.testResults.failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`⚠️ ${this.testResults.failed} test(s) failed.`);
    }

    console.log('');
  }

  /**
   * Run specific test suites
   */
  async runUnitTests() {
    console.log('🧪 Running Unit Tests...');
    await this.runTests({ testPath: 'tests/*.test.js' });
  }

  async runIntegrationTests() {
    console.log('🔗 Running Integration Tests...');
    await this.runTests({ testPath: 'tests/integration.test.js' });
  }

  async runAuthTests() {
    console.log('🔐 Running Authentication Tests...');
    await this.runTests({ testPath: 'tests/auth.test.js' });
  }

  async runApiTests() {
    console.log('🌐 Running API Tests...');
    await this.runTests({ testPath: 'tests/exams.test.js tests/notifications.test.js' });
  }

  /**
   * Generate HTML coverage report
   */
  async generateHtmlReport() {
    console.log('📄 Generating HTML coverage report...');

    execSync('npx jest --coverage --coverageReporters=html', {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    const htmlReportPath = path.join(this.coverageDir, 'lcov-report', 'index.html');
    if (fs.existsSync(htmlReportPath)) {
      console.log(`✅ HTML report generated: ${htmlReportPath}`);
    }
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests() {
    console.log('⚡ Running Performance Tests...');

    // Simple performance test for API response times
    const startTime = Date.now();

    try {
      // You can add more sophisticated performance tests here
      execSync('npx jest tests/integration.test.js --testNamePattern="Performance"', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️ Performance tests completed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Performance tests failed:', error.message);
    }
  }

  /**
   * Run tests with CI configuration
   */
  async runCI() {
    console.log('🔄 Running CI Tests...');
    await this.runTests({
      ci: true,
      coverage: true,
      watch: false
    });
  }

  /**
   * Validate test environment
   */
  validateEnvironment() {
    console.log('🔍 Validating test environment...');

    const requiredFiles = [
      'package.json',
      'jest.config.js',
      'tests/setup.js'
    ];

    let allValid = true;

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing required file: ${file}`);
        allValid = false;
      } else {
        console.log(`✅ Found: ${file}`);
      }
    }

    if (!allValid) {
      console.error('\n❌ Test environment validation failed');
      process.exit(1);
    }

    console.log('✅ Test environment validated\n');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const testRunner = new TestRunner();

  // Parse command line arguments
  const options = {
    watch: args.includes('--watch'),
    coverage: !args.includes('--no-coverage'),
    ci: args.includes('--ci'),
    verbose: args.includes('--verbose'),
    unit: args.includes('--unit'),
    integration: args.includes('--integration'),
    auth: args.includes('--auth'),
    api: args.includes('--api'),
    performance: args.includes('--performance'),
    html: args.includes('--html'),
    validate: args.includes('--validate')
  };

  try {
    // Validate environment if requested
    if (options.validate) {
      testRunner.validateEnvironment();
    }

    // Run specific test suites
    if (options.unit) {
      await testRunner.runUnitTests();
    } else if (options.integration) {
      await testRunner.runIntegrationTests();
    } else if (options.auth) {
      await testRunner.runAuthTests();
    } else if (options.api) {
      await testRunner.runApiTests();
    } else if (options.performance) {
      await testRunner.runPerformanceTests();
    } else if (options.html) {
      await testRunner.generateHtmlReport();
    } else if (options.ci) {
      await testRunner.runCI();
    } else {
      // Run all tests
      await testRunner.runTests(options);
    }

  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export default TestRunner;

#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

class ProjectSetup {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
  }

  async setup() {
    console.log('🔧 FAIR CÂMBIO BOT - PROJECT SETUP');
    console.log('==================================');

    try {
      await this.checkPrerequisites();
      await this.createDirectories();
      await this.setupGitignore();
      await this.createBasicConfigurations();
      await this.installDevDependencies();
      await this.generateDocumentation();

      console.log('\n✅ PROJECT SETUP COMPLETED');
      console.log('==========================');
      this.printNextSteps();

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('\n📋 Checking prerequisites...');

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`   Node.js: ${nodeVersion}`);

    if (parseInt(nodeVersion.slice(1)) < 16) {
      throw new Error('Node.js 16 or higher is required');
    }

    // Check npm
    try {
      await this.executeCommand('npm --version');
      console.log('   ✅ npm is available');
    } catch (error) {
      throw new Error('npm is not available');
    }

    console.log('   ✅ Prerequisites check passed');
  }

  async createDirectories() {
    console.log('\n📁 Creating directory structure...');

    const directories = [
      'data',
      'logs',
      'sessions',
      'tests',
      'tests/unit',
      'tests/integration',
      'tests/e2e',
      'tests/data',
      'src/dashboard',
      'src/dashboard/public',
      'src/dashboard/routes',
      'src/dashboard/views',
      'src/logging',
      'src/coordination',
      'src/multibranch',
      'scripts',
      'docs'
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.projectRoot, dir);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`   ✅ Created ${dir}/`);
    }
  }

  async setupGitignore() {
    console.log('\n🚫 Setting up .gitignore...');

    const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test
.env.production
.env.local

# parcel-bundler cache
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# WhatsApp sessions
sessions/
*.session.json

# Logs
logs/
*.log

# Test data
tests/data/
coverage/

# Database
data/
*.db
*.sqlite

# Production builds
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Backup files
*.backup
*.bak
*.tmp
`;

    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    await fs.writeFile(gitignorePath, gitignoreContent);
    console.log('   ✅ .gitignore created');
  }

  async createBasicConfigurations() {
    console.log('\n⚙️ Creating configuration files...');

    // Jest configuration
    const jestConfig = {
      testEnvironment: 'node',
      collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/coordination/start.js'
      ],
      coverageDirectory: 'coverage',
      coverageReporters: ['text', 'lcov', 'html'],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
    };

    await fs.writeFile(
      path.join(this.projectRoot, 'jest.config.json'),
      JSON.stringify(jestConfig, null, 2)
    );
    console.log('   ✅ jest.config.json created');

    // ESLint configuration
    const eslintConfig = {
      env: {
        node: true,
        es2021: true,
        jest: true
      },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
      },
      rules: {
        'no-console': 'off',
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'prefer-const': 'error',
        'no-var': 'error'
      }
    };

    await fs.writeFile(
      path.join(this.projectRoot, '.eslintrc.json'),
      JSON.stringify(eslintConfig, null, 2)
    );
    console.log('   ✅ .eslintrc.json created');

    // EditorConfig
    const editorConfig = `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
`;

    await fs.writeFile(
      path.join(this.projectRoot, '.editorconfig'),
      editorConfig
    );
    console.log('   ✅ .editorconfig created');
  }

  async installDevDependencies() {
    console.log('\n📦 Installing development dependencies...');

    const devDependencies = [
      'jest',
      'supertest',
      'eslint',
      'nodemon',
      'concurrently'
    ];

    try {
      const command = `npm install --save-dev ${devDependencies.join(' ')}`;
      await this.executeCommand(command);
      console.log('   ✅ Development dependencies installed');
    } catch (error) {
      console.log('   ⚠️ Some dependencies might have failed to install');
    }
  }

  async generateDocumentation() {
    console.log('\n📚 Generating documentation...');

    // Create API documentation template
    const apiDocs = `# Fair Câmbio Bot - API Documentation

## Overview
This document describes the API endpoints and coordination system for the Fair Câmbio WhatsApp Bot.

## Master Coordination API

### Base URL
\`http://localhost:3000\`

### Endpoints

#### Health Check
\`GET /health\`

Returns the health status of all system components.

#### Agent Registration
\`POST /agents/register\`

Register a new agent with the coordination system.

#### Inter-Agent Communication
\`POST /agents/communicate\`

Send messages between agents.

## Agent-Specific APIs

### Agent 1: Testing Framework
- Endpoint: TBD
- Purpose: Test execution and validation

### Agent 2: Multi-Branch System
- Endpoint: TBD
- Purpose: Branch coordination and synchronization

### Agent 3: Logging System
- Endpoint: TBD
- Purpose: Centralized logging and monitoring

### Agent 4: Dashboard
- Endpoint: \`http://localhost:3001\`
- Purpose: Web-based administration interface

## Authentication
Admin endpoints require authentication using the credentials defined in the .env file.

## Rate Limiting
API endpoints are rate-limited to prevent abuse. See coordination/api.js for configuration.
`;

    await fs.writeFile(
      path.join(this.projectRoot, 'docs/API.md'),
      apiDocs
    );
    console.log('   ✅ API documentation created');

    // Create development guide
    const devGuide = `# Development Guide

## Getting Started

1. Clone the repository
2. Run \`npm run setup\` (this script)
3. Configure your .env file
4. Run \`npm run deploy\` for coordinated deployment

## Development Workflow

### Starting the System
\`\`\`bash
# Terminal 1: Master Coordinator
npm run coordinator

# Terminal 2: WhatsApp Bot
npm start

# Terminal 3: Dashboard
npm run dashboard

# Terminal 4: Tests (watch mode)
npm run test:watch
\`\`\`

### Agent Development
Each agent has specific responsibilities:

- **Agent 1 (Tests)**: Comprehensive testing framework
- **Agent 2 (Multi-Branch)**: Multi-instance bot coordination
- **Agent 3 (Logging)**: Centralized logging and monitoring
- **Agent 4 (Dashboard)**: Web administration interface

### Code Quality
- Run \`npm test\` before committing
- Maintain >80% test coverage
- Follow ESLint rules
- Update documentation for API changes

### Debugging
- Check logs in the \`logs/\` directory
- Use the health check endpoint: \`/health\`
- Monitor agent status via dashboard
- Check coordination API status

## Architecture
The system uses a master-coordinator pattern with shared database and configuration management.

See COORDINATION_INSTRUCTIONS.md for detailed agent coordination information.
`;

    await fs.writeFile(
      path.join(this.projectRoot, 'docs/DEVELOPMENT.md'),
      devGuide
    );
    console.log('   ✅ Development guide created');
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  printNextSteps() {
    console.log('\n📋 NEXT STEPS');
    console.log('=============');
    console.log('');
    console.log('1. Configure your environment:');
    console.log('   - Edit .env file with your settings');
    console.log('   - Set ADMIN_NUMBERS to your WhatsApp numbers');
    console.log('   - Configure database connection if using MongoDB');
    console.log('');
    console.log('2. Deploy the system:');
    console.log('   npm run deploy');
    console.log('');
    console.log('3. Start development:');
    console.log('   npm run coordinator  # Start coordination system');
    console.log('   npm start           # Start WhatsApp bot');
    console.log('   npm run dashboard   # Start web dashboard');
    console.log('');
    console.log('4. Read the documentation:');
    console.log('   - COORDINATION_INSTRUCTIONS.md');
    console.log('   - docs/DEVELOPMENT.md');
    console.log('   - docs/API.md');
    console.log('');
    console.log('5. Run tests:');
    console.log('   npm test');
    console.log('');
    console.log('Happy coding! 🚀');
    console.log('');
  }
}

// Run setup if script is executed directly
if (require.main === module) {
  const setup = new ProjectSetup();
  setup.setup().catch(console.error);
}

module.exports = ProjectSetup;
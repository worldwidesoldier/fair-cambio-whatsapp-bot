require('dotenv').config();

// Shared configuration for all agents
const sharedConfig = {
  // Bot Configuration
  bot: {
    name: process.env.BOT_NAME || 'Fair Câmbio',
    sessionName: process.env.SESSION_NAME || 'fair-cambio-bot',
    adminNumbers: process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',').map(n => n.trim()) : [],
    timezone: process.env.TZ || 'America/Sao_Paulo'
  },

  // Business Hours
  businessHours: {
    opening: parseInt(process.env.OPENING_HOUR) || 9,
    closing: parseInt(process.env.CLOSING_HOUR) || 18,
    saturdayClosing: parseInt(process.env.SATURDAY_CLOSING) || 14,
    timezone: process.env.TZ || 'America/Sao_Paulo'
  },

  // Database Configuration
  database: {
    mongodb: process.env.MONGODB_URI || 'mongodb://localhost:27017/faircambio',
    fallbackToFiles: true,
    dataPath: './data'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: './logs',
    maxFiles: 30,
    maxSize: '10m',
    format: 'json'
  },

  // Multi-branch Configuration
  multiBranch: {
    enabled: process.env.MULTI_BRANCH_ENABLED === 'true',
    syncInterval: parseInt(process.env.SYNC_INTERVAL) || 5000, // 5 seconds
    sharedDatabase: process.env.SHARED_DATABASE === 'true'
  },

  // Dashboard Configuration
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED === 'true',
    port: parseInt(process.env.DASHBOARD_PORT) || 3001,
    auth: {
      username: process.env.DASHBOARD_USER || 'admin',
      password: process.env.DASHBOARD_PASS || 'admin123'
    },
    cors: {
      origin: process.env.DASHBOARD_CORS || '*'
    }
  },

  // Testing Configuration
  testing: {
    enabled: process.env.TESTING_ENABLED === 'true',
    mockWhatsApp: process.env.MOCK_WHATSAPP === 'true',
    testDataPath: './tests/data',
    coverage: {
      threshold: parseInt(process.env.COVERAGE_THRESHOLD) || 80
    }
  },

  // API Configuration for inter-agent communication
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    port: parseInt(process.env.API_PORT) || 3000,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  // Currency Configuration
  currencies: {
    updateInterval: parseInt(process.env.CURRENCY_UPDATE_INTERVAL) || 300000, // 5 minutes
    autoUpdate: process.env.AUTO_UPDATE_RATES === 'true',
    externalApi: process.env.CURRENCY_API_URL || null
  },

  // Performance and Monitoring
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000, // 1 minute
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000 // 30 seconds
  }
};

// Agent-specific configurations
const agentConfigs = {
  tests: {
    enabled: sharedConfig.testing.enabled,
    frameworks: ['jest', 'supertest'],
    testTypes: ['unit', 'integration', 'e2e'],
    mockServices: ['whatsapp', 'database', 'external-apis']
  },

  multiBranch: {
    enabled: sharedConfig.multiBranch.enabled,
    coordination: {
      lockTimeout: 5000,
      syncStrategy: 'eventual-consistency',
      conflictResolution: 'last-write-wins'
    }
  },

  logging: {
    structured: true,
    correlation: {
      enabled: true,
      headerName: 'x-correlation-id'
    },
    retention: {
      days: 30,
      compressionAfterDays: 7
    }
  },

  dashboard: {
    enabled: sharedConfig.dashboard.enabled,
    features: ['rates', 'branches', 'logs', 'stats', 'users'],
    realtime: {
      enabled: true,
      updateInterval: 2000
    }
  }
};

// Environment validation
const validateConfig = () => {
  const errors = [];

  // Required environment variables
  const required = ['ADMIN_NUMBERS'];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate admin numbers format
  if (process.env.ADMIN_NUMBERS) {
    const numbers = process.env.ADMIN_NUMBERS.split(',');
    for (const number of numbers) {
      if (!/^\d{10,15}$/.test(number.trim())) {
        errors.push(`Invalid admin number format: ${number}`);
      }
    }
  }

  // Validate ports
  const ports = [sharedConfig.api.port, sharedConfig.dashboard.port];
  for (const port of ports) {
    if (port < 1000 || port > 65535) {
      errors.push(`Invalid port number: ${port}`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  return true;
};

// Get configuration for specific agent
const getAgentConfig = (agentName) => {
  return {
    shared: sharedConfig,
    agent: agentConfigs[agentName] || {},
    isValid: validateConfig()
  };
};

// Update configuration at runtime
const updateConfig = (path, value) => {
  const keys = path.split('.');
  let current = sharedConfig;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  console.log(`Configuration updated: ${path} = ${value}`);
};

module.exports = {
  sharedConfig,
  agentConfigs,
  getAgentConfig,
  updateConfig,
  validateConfig
};
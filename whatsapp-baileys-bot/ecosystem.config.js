module.exports = {
  apps: [
    // Enhanced Bot Configuration - Optimized for Long-term Stability
    {
      name: 'fair-cambio-bot-enhanced',
      script: './src/bot-enhanced.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,

      // Enhanced memory management
      max_memory_restart: '200M',

      // Environment configuration
      env: {
        NODE_ENV: 'development',
        BOT_SYNC_PORT: 3002,
        LOG_LEVEL: 'info'
      },
      env_production: {
        NODE_ENV: 'production',
        BOT_SYNC_PORT: 3002,
        LOG_LEVEL: 'warn'
      },

      // Enhanced logging
      log_file: './logs/enhanced-combined.log',
      out_file: './logs/enhanced-out.log',
      error_file: './logs/enhanced-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Stability optimizations
      autorestart: true,
      max_restarts: 15, // More restart attempts
      min_uptime: '10s',
      restart_delay: 4000,
      exponential_backoff_restart_delay: 100,

      // Process management
      kill_timeout: 5000,
      listen_timeout: 8000,
      wait_ready: true,
      shutdown_with_message: true,

      // Node.js optimizations for stability
      node_args: [
        '--max-old-space-size=256',
        '--optimize-for-size',
        '--expose-gc', // Enable manual garbage collection
        '--gc-interval=100'
      ],

      // Monitoring and health checks
      pmx: true,
      health_check_grace_period: 3000,

      // Auto-restart schedule (daily at 3 AM)
      cron_restart: '0 3 * * *',

      // Watch exclusions
      ignore_watch: ['node_modules', 'logs', 'sessions', 'sessions-backup']
    },

    // Multi-branch configuration (legacy support)
    {
      name: 'fair-cambio-multi-branch',
      script: './src/multi-branch.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      autorestart: false, // Disabled by default in favor of enhanced bot

      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        ENABLE_MONITORING_API: 'true',
        MONITORING_PORT: '3001'
      },
      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        ENABLE_MONITORING_API: 'true',
        MONITORING_PORT: '3001'
      },

      log_file: './logs/multi-combined.log',
      out_file: './logs/multi-out.log',
      error_file: './logs/multi-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 5000,
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 10000
    },

    // Configuração alternativa para filiais individuais (caso necessário)
    {
      name: 'fair-cambio-matriz',
      script: './src/single-branch.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false, // Desabilitado por padrão, usar apenas se necessário
      env: {
        NODE_ENV: 'production',
        BRANCH_ID: 'matriz',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/branches/matriz-combined.log',
      out_file: './logs/branches/matriz-out.log',
      error_file: './logs/branches/matriz-error.log'
    },

    {
      name: 'fair-cambio-manauara',
      script: './src/single-branch.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        BRANCH_ID: 'shopping-manauara',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/branches/manauara-combined.log',
      out_file: './logs/branches/manauara-out.log',
      error_file: './logs/branches/manauara-error.log'
    },

    {
      name: 'fair-cambio-amazonas',
      script: './src/single-branch.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        BRANCH_ID: 'amazonas-shopping',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/branches/amazonas-combined.log',
      out_file: './logs/branches/amazonas-out.log',
      error_file: './logs/branches/amazonas-error.log'
    },

    {
      name: 'fair-cambio-ponta-negra',
      script: './src/single-branch.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        BRANCH_ID: 'ponta-negra',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/branches/ponta-negra-combined.log',
      out_file: './logs/branches/ponta-negra-out.log',
      error_file: './logs/branches/ponta-negra-error.log'
    },

    {
      name: 'fair-cambio-aeroporto',
      script: './src/single-branch.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        BRANCH_ID: 'aeroporto',
        LOG_LEVEL: 'info'
      },
      log_file: './logs/branches/aeroporto-combined.log',
      out_file: './logs/branches/aeroporto-out.log',
      error_file: './logs/branches/aeroporto-error.log'
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['servidor-producao.com'],
      ref: 'origin/main',
      repo: 'git@github.com:usuario/whatsapp-baileys-bot.git',
      path: '/var/www/fair-cambio-bot',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    },

    staging: {
      user: 'deploy',
      host: ['servidor-staging.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:usuario/whatsapp-baileys-bot.git',
      path: '/var/www/fair-cambio-bot-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development',
      'pre-setup': 'apt update && apt install git -y'
    }
  }
};
module.exports = {
  apps: [
    {
      name: 'fair-cambio-multi-branch',
      script: './src/multi-branch.js',
      instances: 1, // Apenas uma instância para gerenciar todas as filiais
      exec_mode: 'fork',
      watch: false, // Desabilitado para produção
      max_memory_restart: '1G',
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
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
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
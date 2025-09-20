const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const analytics = require('../utils/analytics');
const logger = require('../utils/logger');
const cors = require('cors');
const RatesManager = require('../handlers/rates');
const MessagesController = require('./controllers/messages');
const BranchesController = require('./controllers/branches');

class DashboardServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
        methods: ["GET", "POST"]
      }
    });
    this.port = process.env.DASHBOARD_PORT || 3001;

    // Store bot status and stats
    this.botStatus = {
      connected: false,
      connectionStatus: 'disconnected',
      qrCode: null,
      lastSeen: null
    };
    this.stats = {
      totalMessages: 0,
      connectedUsers: 0,
      uptime: '0h 0m'
    };
    this.logs = [];

    // Initialize rates manager
    this.ratesManager = new RatesManager();

    // Initialize messages controller
    this.messagesController = new MessagesController();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    // Enable CORS for development
    this.app.use(cors({
      origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],
      credentials: true
    }));

    // Serve static files from React build
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use(express.json());

    // Simple authentication middleware (disabled for development)
    // this.app.use((req, res, next) => {
    //   const auth = req.headers.authorization;
    //   const expectedAuth = Buffer.from(`admin:${process.env.DASHBOARD_PASSWORD || 'dashboard123'}`).toString('base64');

    //   if (req.path === '/health' || req.path === '/') {
    //     return next();
    //   }

    //   if (!auth || auth !== `Basic ${expectedAuth}`) {
    //     res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    //     return res.status(401).json({ error: 'Authentication required' });
    //   }

    //   next();
    // });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });

    // Dashboard main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API endpoints
    this.app.get('/api/metrics', (req, res) => {
      try {
        const metrics = analytics.getMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error('Failed to get metrics', { error: error.message });
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    this.app.get('/api/daily-stats/:date?', (req, res) => {
      try {
        const date = req.params.date || null;
        const stats = analytics.getDailyStats(date);
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get daily stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get daily stats' });
      }
    });

    this.app.get('/api/hourly-activity', (req, res) => {
      try {
        const activity = analytics.getHourlyActivity();
        res.json(activity);
      } catch (error) {
        logger.error('Failed to get hourly activity', { error: error.message });
        res.status(500).json({ error: 'Failed to get hourly activity' });
      }
    });

    this.app.get('/api/top-commands', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 10;
        const commands = analytics.getTopCommands(limit);
        res.json(commands);
      } catch (error) {
        logger.error('Failed to get top commands', { error: error.message });
        res.status(500).json({ error: 'Failed to get top commands' });
      }
    });

    this.app.get('/api/system-health', (req, res) => {
      try {
        const health = analytics.getSystemHealth();
        res.json(health);
      } catch (error) {
        logger.error('Failed to get system health', { error: error.message });
        res.status(500).json({ error: 'Failed to get system health' });
      }
    });

    this.app.get('/api/weekly-report', (req, res) => {
      try {
        const report = analytics.getWeeklyReport();
        res.json(report);
      } catch (error) {
        logger.error('Failed to get weekly report', { error: error.message });
        res.status(500).json({ error: 'Failed to get weekly report' });
      }
    });

    this.app.get('/api/logs/:date?', async (req, res) => {
      try {
        const date = req.params.date || new Date().toISOString().split('T')[0];
        const category = req.query.category || null;
        const logs = await logger.getLogs(date, category);
        res.json(logs);
      } catch (error) {
        logger.error('Failed to get logs', { error: error.message });
        res.status(500).json({ error: 'Failed to get logs' });
      }
    });

    this.app.get('/api/logs-summary/:date?', async (req, res) => {
      try {
        const date = req.params.date || new Date().toISOString().split('T')[0];
        const summary = await logger.getLogsSummary(date);
        res.json(summary);
      } catch (error) {
        logger.error('Failed to get logs summary', { error: error.message });
        res.status(500).json({ error: 'Failed to get logs summary' });
      }
    });

    // User stats endpoint
    this.app.get('/api/user/:userId', (req, res) => {
      try {
        const userId = req.params.userId;
        const stats = analytics.getUserStats(userId);

        if (!stats) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(stats);
      } catch (error) {
        logger.error('Failed to get user stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get user stats' });
      }
    });

    // Exchange rates endpoints
    this.app.get('/api/exchange-rates', async (req, res) => {
      try {
        const rates = await this.ratesManager.getAllRates();
        const formattedRates = this.formatRatesForDashboard(rates);
        res.json(formattedRates);
      } catch (error) {
        logger.error('Failed to get exchange rates', { error: error.message });
        res.status(500).json({ error: 'Failed to get exchange rates' });
      }
    });

    this.app.post('/api/exchange-rates/:currency', async (req, res) => {
      try {
        const { currency } = req.params;
        const { buyRate, sellRate } = req.body;

        if (!buyRate || !sellRate) {
          return res.status(400).json({ error: 'buyRate and sellRate are required' });
        }

        // Update both buy and sell rates
        const buyResult = await this.ratesManager.updateRate(currency, 'buy', buyRate);
        const sellResult = await this.ratesManager.updateRate(currency, 'sell', sellRate);

        if (!buyResult.success || !sellResult.success) {
          return res.status(400).json({
            error: buyResult.message || sellResult.message
          });
        }

        // Get updated rates and broadcast
        const rates = await this.ratesManager.getAllRates();
        const formattedRates = this.formatRatesForDashboard(rates);

        this.io.emit('exchangeRatesUpdate', formattedRates);

        logger.info(`Exchange rate updated for ${currency}`, {
          currency,
          buyRate,
          sellRate,
          category: 'exchange-rates'
        });

        res.json({ success: true, message: 'Rates updated successfully' });
      } catch (error) {
        logger.error('Failed to update exchange rate', { error: error.message });
        res.status(500).json({ error: 'Failed to update exchange rate' });
      }
    });

    // Real-time data endpoint for testing
    this.app.get('/api/realtime-test', (req, res) => {
      const testData = {
        timestamp: new Date().toISOString(),
        randomValue: Math.floor(Math.random() * 100),
        activeUsers: analytics.getActiveUsers(),
        uptime: process.uptime()
      };

      // Emit to all connected clients
      this.io.emit('test-data', testData);
      res.json(testData);
    });

    // Messages management routes (NOVA FUNCIONALIDADE - NÃO REMOVER)
    this.app.get('/api/messages', (req, res) => {
      this.messagesController.getMessages(req, res);
    });

    this.app.put('/api/messages/:messageType', (req, res) => {
      this.messagesController.updateMessage(req, res);
    });

    this.app.put('/api/messages/:messageType/variables/:variableName', (req, res) => {
      this.messagesController.updateVariable(req, res);
    });

    this.app.post('/api/messages/:messageType/preview', (req, res) => {
      this.messagesController.previewMessage(req, res);
    });

    this.app.post('/api/messages/reset', (req, res) => {
      this.messagesController.resetMessages(req, res);
    });

    // Branches API Routes
    this.app.get('/api/branches', BranchesController.getAllBranches);
    this.app.get('/api/branches/active', BranchesController.getActiveBranches);
    this.app.get('/api/branches/statistics', BranchesController.getBranchStatistics);
    this.app.get('/api/branches/status', BranchesController.getBranchesStatus);
    this.app.get('/api/branches/:id', BranchesController.getBranch);

    this.app.post('/api/branches', BranchesController.createBranch);
    this.app.put('/api/branches/:id', BranchesController.updateBranch);
    this.app.patch('/api/branches/:id/toggle', BranchesController.toggleBranch);
    this.app.delete('/api/branches/:id', BranchesController.deleteBranch);

    this.app.patch('/api/branches/bulk-toggle', BranchesController.bulkToggleBranches);

    // Bot management endpoints
    this.app.get('/api/bot/status', (req, res) => {
      res.json(this.botStatus);
    });

    this.app.get('/api/bot/stats', (req, res) => {
      res.json(this.stats);
    });

    this.app.post('/api/bot/generate-qr', (req, res) => {
      try {
        // Emit request to bot to generate new QR code
        this.io.emit('generate-qr-request');

        // Send current QR if available, or pending status
        const response = {
          success: true,
          message: 'QR generation requested',
          qrCode: this.botStatus.qrCode || null,
          status: this.botStatus.connectionStatus
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to generate QR code', { error: error.message });
        res.status(500).json({ error: 'Failed to generate QR code' });
      }
    });

    this.app.post('/api/bot/disconnect', (req, res) => {
      try {
        // Emit disconnect request to bot
        this.io.emit('disconnect-bot-request');

        res.json({ success: true, message: 'Disconnect request sent to bot' });
      } catch (error) {
        logger.error('Failed to disconnect bot', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect bot' });
      }
    });

    this.app.post('/api/bot/reconnect', (req, res) => {
      try {
        // Emit reconnect request to bot
        this.io.emit('reconnect-bot-request');

        res.json({ success: true, message: 'Reconnect request sent to bot' });
      } catch (error) {
        logger.error('Failed to reconnect bot', { error: error.message });
        res.status(500).json({ error: 'Failed to reconnect bot' });
      }
    });

    // Status endpoint for real-time monitoring
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        botStatus: this.botStatus,
        stats: this.stats
      });
    });

    // Catch-all handler: send back React's index.html file for SPA routing
    // This must be the LAST route
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Dashboard client connected', {
        socketId: socket.id,
        category: 'dashboard'
      });

      // Handle request for current status
      socket.on('requestStatus', () => {
        // Send bot status
        socket.emit('botStatus', this.botStatus);

        // Send current stats
        socket.emit('stats', this.stats);

        // Send recent logs
        socket.emit('logs', this.logs.slice(-20)); // Last 20 logs

        // Send exchange rates
        this.sendExchangeRates(socket);

        // Send branches data
        this.sendBranches(socket);
      });

      // Send initial data immediately
      console.log('📊 Sending initial data to dashboard:', this.botStatus);
      socket.emit('botStatus', this.botStatus);
      socket.emit('stats', this.stats);
      socket.emit('logs', this.logs.slice(-20));
      this.sendExchangeRates(socket);
      this.sendBranches(socket);

      // Handle bot updates from WhatsApp bot
      socket.on('botUpdate', (update) => {
        const { method, data } = update;

        try {
          switch (method) {
            case 'updateQRCode':
              this.updateQRCode(data);
              break;
            case 'setBotConnected':
              this.setBotConnected();
              break;
            case 'setBotDisconnected':
              this.setBotDisconnected();
              break;
            case 'addLog':
              this.addLog(data);
              break;
            default:
              console.log('Unknown bot update method:', method);
          }
        } catch (error) {
          console.error('Error handling bot update:', error);
        }
      });

      // Handle exchange rate updates from frontend
      socket.on('updateExchangeRate', async (data) => {
        try {
          const { currency, buyRate, sellRate } = data;

          if (!currency || !buyRate || !sellRate) {
            console.error('Invalid exchange rate data:', data);
            return;
          }

          // Update both buy and sell rates using RatesManager
          const buyResult = await this.ratesManager.updateRate(currency, 'buy', buyRate);
          const sellResult = await this.ratesManager.updateRate(currency, 'sell', sellRate);

          if (!buyResult.success || !sellResult.success) {
            console.error('Failed to update rates:', buyResult.message || sellResult.message);
            return;
          }

          // Get updated rates and broadcast to all clients
          const rates = await this.ratesManager.getAllRates();
          const formattedRates = this.formatRatesForDashboard(rates);

          this.io.emit('exchangeRatesUpdate', formattedRates);

          logger.info(`Exchange rate updated via socket for ${currency}`, {
            currency,
            buyRate,
            sellRate,
            category: 'exchange-rates'
          });

          console.log(`💱 Updated ${currency}: Buy R$${buyRate} | Sell R$${sellRate}`);
        } catch (error) {
          console.error('Error updating exchange rate via socket:', error);
        }
      });

      // Handle branch updates from frontend
      socket.on('updateBranch', (data) => {
        try {
          const { id, name, phone, hours, address } = data;

          if (!id || !name || !phone || !hours || !address) {
            console.error('Invalid branch data:', data);
            return;
          }

          // Update branch in the config
          this.updateBranchData(id, { name, phone, hours, address });

          // Get updated branches and broadcast to all clients
          const branches = this.getBranchesData();
          this.io.emit('branchesUpdate', branches);

          console.log(`🏢 Updated branch ${id}: ${name}`);
        } catch (error) {
          console.error('Error updating branch via socket:', error);
        }
      });

      // Handle bot management requests from frontend
      socket.on('generateQRRequest', () => {
        try {
          // Request bot to generate new QR code
          this.io.emit('bot-generate-qr');
          console.log('🔄 QR generation requested by dashboard');
        } catch (error) {
          console.error('Error requesting QR generation:', error);
        }
      });

      // Handler para o evento do frontend React
      socket.on('bot-generate-qr', () => {
        try {
          // Request bot to generate new QR code
          this.io.emit('bot-generate-qr');
          console.log('🔄 QR generation requested by React frontend');
        } catch (error) {
          console.error('Error requesting QR generation from frontend:', error);
        }
      });

      socket.on('disconnectBotRequest', () => {
        try {
          // Request bot to disconnect
          this.io.emit('bot-disconnect');
          console.log('🔌 Bot disconnect requested by dashboard');
        } catch (error) {
          console.error('Error requesting bot disconnect:', error);
        }
      });

      socket.on('reconnectBotRequest', () => {
        try {
          // Request bot to reconnect
          this.io.emit('bot-reconnect');
          console.log('🔄 Bot reconnect requested by dashboard');
        } catch (error) {
          console.error('Error requesting bot reconnect:', error);
        }
      });

      // Handle client disconnection
      socket.on('disconnect', () => {
        logger.info('Dashboard client disconnected', {
          socketId: socket.id,
          category: 'dashboard'
        });
      });

      // Handle legacy requests for specific data (keeping for compatibility)
      socket.on('request-data', async (dataType) => {
        try {
          let data = {};

          switch (dataType) {
            case 'metrics':
              data = analytics.getMetrics();
              break;
            case 'daily-stats':
              data = analytics.getDailyStats();
              break;
            case 'hourly-activity':
              data = analytics.getHourlyActivity();
              break;
            case 'system-health':
              data = analytics.getSystemHealth();
              break;
            case 'weekly-report':
              data = analytics.getWeeklyReport();
              break;
            default:
              data = { error: 'Unknown data type' };
          }

          socket.emit('data-response', { type: dataType, data });
        } catch (error) {
          logger.error('Failed to handle socket data request', {
            error: error.message,
            dataType,
            category: 'dashboard'
          });
          socket.emit('data-response', {
            type: dataType,
            error: 'Failed to get data'
          });
        }
      });
    });

    // Send periodic updates to all connected clients
    setInterval(() => {
      // Update uptime
      const uptimeSeconds = process.uptime();
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      this.stats.uptime = `${hours}h ${minutes}m`;

      // Broadcast updates
      this.io.emit('botStatus', this.botStatus);
      this.io.emit('stats', this.stats);

      // Legacy update for backward compatibility
      this.io.emit('metrics-update', {
        metrics: analytics.getMetrics(),
        systemHealth: analytics.getSystemHealth(),
        timestamp: new Date().toISOString()
      });
    }, 30000); // Every 30 seconds
  }

  start() {
    this.server.listen(this.port, () => {
      logger.info(`Dashboard server started on port ${this.port}`, {
        port: this.port,
        category: 'dashboard'
      });
      console.log(`📊 Dashboard available at: http://localhost:${this.port}`);
      console.log(`🔐 Login: admin / ${process.env.DASHBOARD_PASSWORD || 'dashboard123'}`);
    });
  }

  stop() {
    this.server.close(() => {
      logger.info('Dashboard server stopped', { category: 'dashboard' });
    });
  }

  // Method to update bot status
  updateBotStatus(status) {
    this.botStatus = {
      ...this.botStatus,
      ...status,
      lastSeen: new Date()
    };
    this.io.emit('botStatus', this.botStatus);
  }

  // Method to update QR code
  updateQRCode(qrCode) {
    this.botStatus.qrCode = qrCode;
    this.botStatus.connectionStatus = 'qr';
    console.log('🔥 Enviando QR Code para clientes:', qrCode ? 'SIM' : 'VAZIO');

    // Emit via botStatus
    this.io.emit('botStatus', this.botStatus);

    // Emit via evento específico para o frontend
    this.io.emit('qrCode', qrCode);

    // Log para debug
    console.log('📊 QR Code emitido via WebSocket para todos os clientes conectados');
  }

  // Method to set bot as connected
  setBotConnected() {
    this.botStatus.connected = true;
    this.botStatus.connectionStatus = 'connected';
    this.botStatus.qrCode = null;
    this.botStatus.lastSeen = new Date();
    this.io.emit('botStatus', this.botStatus);
  }

  // Method to set bot as disconnected
  setBotDisconnected() {
    this.botStatus.connected = false;
    this.botStatus.connectionStatus = 'disconnected';
    this.botStatus.qrCode = null;
    this.io.emit('botStatus', this.botStatus);
  }

  // Method to update statistics
  updateStats(newStats) {
    this.stats = {
      ...this.stats,
      ...newStats
    };
    this.io.emit('stats', this.stats);
  }

  // Method to add logs
  addLog(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);

    // Keep only the last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }

    this.io.emit('logs', [logEntry]);
  }

  // Method to send real-time updates from the bot
  broadcastUpdate(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Method to send alerts
  broadcastAlert(alert) {
    this.io.emit('alert', {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }

  // Helper method to format rates for dashboard
  formatRatesForDashboard(rates) {
    if (!rates || !rates.currencies) return [];

    return Object.entries(rates.currencies)
      .filter(([code]) => ['USD', 'EUR', 'GBP'].includes(code)) // Filter for main currencies
      .map(([code, data]) => ({
        currency: code,
        symbol: code === 'USD' ? '$' : code === 'EUR' ? '€' : '£',
        buyRate: data.buy,
        sellRate: data.sell,
        lastUpdated: new Date(rates.lastUpdate)
      }));
  }

  // Helper method to send exchange rates to a socket
  async sendExchangeRates(socket) {
    try {
      const rates = await this.ratesManager.getAllRates();
      const formattedRates = this.formatRatesForDashboard(rates);
      socket.emit('exchangeRates', formattedRates);
    } catch (error) {
      console.error('Error sending exchange rates:', error);
    }
  }

  // Branch management methods
  getBranchesData() {
    const branches = require('../config/branches');
    return branches.getActiveBranches();
  }

  updateBranchData(branchId, updateData) {
    const fs = require('fs');
    const path = require('path');
    const branchesPath = path.join(__dirname, '../config/branches.js');

    try {
      // Read current branches file
      let branchesContent = fs.readFileSync(branchesPath, 'utf8');

      // Simple update approach - find and replace the branch data
      // This is a basic implementation - for production you might want a more robust solution
      const branches = require('../config/branches');
      const branchIndex = branches.branches.findIndex(b => b.id === branchId);

      if (branchIndex !== -1) {
        // Update the branch object
        Object.assign(branches.branches[branchIndex], updateData);

        // Write back to file (in a real implementation, you'd want better file handling)
        const newContent = `module.exports = ${JSON.stringify({ branches: branches.branches }, null, 2)};

// Add all the methods back
Object.assign(module.exports, {
  getActiveBranches() {
    return this.branches.filter(b => b.active);
  },
  getBranchByPhone(phone) {
    return this.branches.find(b => b.phone === phone);
  },
  getBranchById(id) {
    return this.branches.find(b => b.id === id);
  },
  getBranchesByRegion(region) {
    return this.branches.filter(b => b.region === region);
  },
  getBranchesByPriority() {
    return this.branches.sort((a, b) => a.priority - b.priority);
  },
  getBranchByFeature(feature) {
    return this.branches.filter(b => b.features.includes(feature));
  },
  getAllLocations() {
    return this.branches.map(b => ({
      id: b.id,
      name: b.name,
      address: b.address,
      hours: b.hours,
      maps: b.maps,
      region: b.region,
      manager: b.manager,
      active: b.active
    }));
  }
});`;

        fs.writeFileSync(branchesPath, newContent, 'utf8');

        // Clear require cache to reload the updated file
        delete require.cache[require.resolve('../config/branches')];

        console.log(`✅ Branch ${branchId} updated successfully`);
        return true;
      }
    } catch (error) {
      console.error('Error updating branch data:', error);
      return false;
    }
  }

  sendBranches(socket) {
    try {
      const branches = this.getBranchesData();
      console.log('🏢 Sending branches data:', branches.length, 'branches');
      socket.emit('branches', branches);
    } catch (error) {
      console.error('Error sending branches:', error);
    }
  }
}

// Initialize and start the server if this file is run directly
if (require.main === module) {
  const dashboard = new DashboardServer();
  dashboard.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🔄 Gracefully shutting down dashboard server...');
    dashboard.stop();
    process.exit(0);
  });
}

module.exports = DashboardServer;
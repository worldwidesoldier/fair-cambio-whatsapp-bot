const logger = require('../utils/logger');
const analytics = require('../utils/analytics');
const alerts = require('../utils/alerts');
const health = require('../utils/health');
const backup = require('../utils/backup');
const reports = require('../utils/reports');
const audit = require('../utils/audit');
const DashboardServer = require('../dashboard/server');

class MonitoringSystem {
  constructor() {
    this.isInitialized = false;
    this.dashboardServer = null;
    this.whatsappBot = null;

    this.components = {
      logger,
      analytics,
      alerts,
      health,
      backup,
      reports,
      audit
    };
  }

  async initialize(whatsappBot = null) {
    try {
      logger.info('Initializing monitoring system', { category: 'monitoring' });

      // Set WhatsApp bot reference
      if (whatsappBot) {
        this.whatsappBot = whatsappBot;
        alerts.setWhatsAppBot(whatsappBot);
      }

      // Initialize dashboard server
      this.dashboardServer = new DashboardServer();
      alerts.setDashboardServer(this.dashboardServer);

      // Start dashboard server
      this.dashboardServer.start();

      // Set up component integrations
      this.setupIntegrations();

      // Mark as initialized
      this.isInitialized = true;

      logger.info('Monitoring system initialized successfully', {
        components: Object.keys(this.components),
        category: 'monitoring'
      });

      // Send initialization alert
      await alerts.sendCustomAlert(
        'Sistema de Monitoramento Iniciado',
        'Todos os componentes de monitoramento foram inicializados com sucesso.',
        'success',
        'low'
      );

      return true;

    } catch (error) {
      logger.error('Failed to initialize monitoring system', {
        error: error.message,
        category: 'monitoring'
      });
      throw error;
    }
  }

  setupIntegrations() {
    // Setup health monitoring for WhatsApp connection
    if (this.whatsappBot) {
      // Monitor WhatsApp connection status
      health.updateWhatsAppStatus(this.whatsappBot.isConnected, Date.now());
    }

    logger.info('Monitoring integrations configured', { category: 'monitoring' });
  }

  // Event handlers for the main bot
  onMessage(from, message, pushName) {
    try {
      // Track message in analytics
      analytics.trackMessage(from, message, 'received');

      // Update activity for alerts
      alerts.updateActivity();

      // Update health monitor
      health.updateWhatsAppStatus(true, Date.now());

      // Log message
      logger.logMessage('received', from, null, message, { pushName });

      // Broadcast to dashboard
      if (this.dashboardServer) {
        this.dashboardServer.broadcastUpdate('new-message', {
          from,
          message: message.substring(0, 100), // Truncate for security
          pushName,
          type: 'received'
        });
      }

    } catch (error) {
      logger.error('Error in message monitoring', {
        error: error.message,
        from,
        category: 'monitoring'
      });
    }
  }

  onMessageSent(to, message) {
    try {
      // Track outgoing message
      analytics.trackMessage(to, message, 'sent');

      // Log message
      logger.logMessage('sent', null, to, message);

      // Broadcast to dashboard
      if (this.dashboardServer) {
        this.dashboardServer.broadcastUpdate('message-sent', {
          to,
          message: message.substring(0, 100),
          type: 'sent'
        });
      }

    } catch (error) {
      logger.error('Error in sent message monitoring', {
        error: error.message,
        to,
        category: 'monitoring'
      });
    }
  }

  onConnection(status, details = {}) {
    try {
      // Update health monitor
      health.updateWhatsAppStatus(status === 'open', Date.now());

      // Track connection event
      analytics.trackConnection(status, details);

      // Log connection event
      logger.logConnection(status, details);

      // Send alert for connection changes
      if (status === 'open') {
        alerts.sendConnectionAlert('connected', details);
      } else if (status === 'close') {
        alerts.sendConnectionAlert('disconnected', details);
      }

      // Broadcast to dashboard
      if (this.dashboardServer) {
        this.dashboardServer.broadcastUpdate('connection-status', {
          status,
          details,
          connected: status === 'open'
        });
      }

    } catch (error) {
      logger.error('Error in connection monitoring', {
        error: error.message,
        status,
        category: 'monitoring'
      });
    }
  }

  onError(error, context = {}) {
    try {
      // Track error in analytics
      analytics.trackError(error, context);

      // Log error
      logger.logError(error, context);

      // Send error alert
      alerts.sendErrorAlert(error, context);

      // Broadcast to dashboard
      if (this.dashboardServer) {
        this.dashboardServer.broadcastAlert({
          type: 'error',
          title: 'Erro no Sistema',
          message: error.message,
          context
        });
      }

    } catch (monitoringError) {
      // Use console.error to avoid infinite loop
      console.error('Error in error monitoring:', monitoringError);
    }
  }

  onAdminAction(admin, action, details = {}) {
    try {
      // Track admin action
      analytics.trackAdminAction(admin, action, details);

      // Audit admin action
      audit.logAdminAction(admin, action, details);

      // Log admin action
      logger.logAdmin(action, admin, details);

      // Update session if available
      if (details.sessionId) {
        audit.updateSession(details.sessionId, action);
      }

      // Broadcast to dashboard
      if (this.dashboardServer) {
        this.dashboardServer.broadcastUpdate('admin-action', {
          admin,
          action,
          details
        });
      }

    } catch (error) {
      logger.error('Error in admin action monitoring', {
        error: error.message,
        admin,
        action,
        category: 'monitoring'
      });
    }
  }

  // Response time tracking
  trackResponseTime(startTime) {
    try {
      const duration = Date.now() - startTime;
      analytics.trackResponseTime(duration);
      return duration;
    } catch (error) {
      logger.error('Error tracking response time', {
        error: error.message,
        category: 'monitoring'
      });
      return 0;
    }
  }

  // Manual operations
  async generateReport(type = 'daily') {
    try {
      let report;

      switch (type) {
        case 'daily':
          report = await reports.generateDailyReport();
          break;
        case 'weekly':
          report = await reports.generateWeeklyReport();
          break;
        case 'monthly':
          report = await reports.generateMonthlyReport();
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      logger.info(`${type} report generated manually`, {
        reportTitle: report.title,
        category: 'monitoring'
      });

      return report;

    } catch (error) {
      logger.error(`Failed to generate ${type} report`, {
        error: error.message,
        category: 'monitoring'
      });
      throw error;
    }
  }

  async createBackup(description = 'Manual backup') {
    try {
      const backupInfo = await backup.manualBackup(description);

      logger.info('Manual backup created', {
        backupName: backupInfo.name,
        size: backup.formatFileSize(backupInfo.size),
        category: 'monitoring'
      });

      return backupInfo;

    } catch (error) {
      logger.error('Failed to create backup', {
        error: error.message,
        category: 'monitoring'
      });
      throw error;
    }
  }

  async getSystemStatus() {
    try {
      const status = {
        monitoring: {
          initialized: this.isInitialized,
          components: Object.keys(this.components)
        },
        health: await health.getHealthSummary(),
        analytics: analytics.getMetrics(),
        alerts: alerts.getAlertStats(),
        backup: await backup.getBackupStats(),
        audit: audit.getStats()
      };

      return status;

    } catch (error) {
      logger.error('Failed to get system status', {
        error: error.message,
        category: 'monitoring'
      });
      throw error;
    }
  }

  async getDashboardData() {
    try {
      const data = {
        metrics: analytics.getMetrics(),
        systemHealth: analytics.getSystemHealth(),
        dailyStats: analytics.getDailyStats(),
        hourlyActivity: analytics.getHourlyActivity(),
        topCommands: analytics.getTopCommands(),
        weeklyReport: analytics.getWeeklyReport(),
        alerts: alerts.getAlertHistory(10),
        backups: await backup.getBackupStats(),
        audit: await audit.getAuditSummary(7)
      };

      return data;

    } catch (error) {
      logger.error('Failed to get dashboard data', {
        error: error.message,
        category: 'monitoring'
      });
      throw error;
    }
  }

  // Configuration
  updateConfig(component, config) {
    try {
      if (!this.components[component]) {
        throw new Error(`Unknown component: ${component}`);
      }

      if (typeof this.components[component].updateConfig === 'function') {
        this.components[component].updateConfig(config);

        audit.logConfigurationChange(
          'system',
          `${component}_config`,
          'previous_config',
          config
        );

        logger.info(`${component} configuration updated`, {
          config,
          category: 'monitoring'
        });
      } else {
        throw new Error(`Component ${component} does not support configuration updates`);
      }

    } catch (error) {
      logger.error('Failed to update component configuration', {
        component,
        error: error.message,
        category: 'monitoring'
      });
      throw error;
    }
  }

  // Shutdown
  async shutdown() {
    try {
      logger.info('Shutting down monitoring system', { category: 'monitoring' });

      // Flush any pending audit entries
      await audit.flushBuffer();

      // Stop dashboard server
      if (this.dashboardServer) {
        this.dashboardServer.stop();
      }

      // Send shutdown alert
      await alerts.sendCustomAlert(
        'Sistema de Monitoramento Desligado',
        'O sistema de monitoramento está sendo desligado.',
        'warning',
        'medium'
      );

      // Log system shutdown
      await audit.logSystemEvent('system_shutdown', {
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });

      this.isInitialized = false;

      logger.info('Monitoring system shutdown completed', { category: 'monitoring' });

    } catch (error) {
      logger.error('Error during monitoring system shutdown', {
        error: error.message,
        category: 'monitoring'
      });
    }
  }

  // Getters for individual components
  get Logger() { return logger; }
  get Analytics() { return analytics; }
  get Alerts() { return alerts; }
  get Health() { return health; }
  get Backup() { return backup; }
  get Reports() { return reports; }
  get Audit() { return audit; }
  get Dashboard() { return this.dashboardServer; }
}

// Export singleton instance
module.exports = new MonitoringSystem();
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const analytics = require('./analytics');

class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.checks = new Map();
    this.checkHistory = [];
    this.maxHistorySize = 1000;

    this.registerDefaultChecks();
    this.startPeriodicChecks();

    logger.info('Health monitor initialized', { category: 'health' });
  }

  registerDefaultChecks() {
    // System health checks
    this.registerCheck('memory', this.checkMemoryUsage.bind(this));
    this.registerCheck('disk', this.checkDiskSpace.bind(this));
    this.registerCheck('cpu', this.checkCPUUsage.bind(this));
    this.registerCheck('uptime', this.checkUptime.bind(this));

    // Application health checks
    this.registerCheck('database', this.checkDatabase.bind(this));
    this.registerCheck('logs', this.checkLogSystem.bind(this));
    this.registerCheck('analytics', this.checkAnalytics.bind(this));
    this.registerCheck('whatsapp', this.checkWhatsAppConnection.bind(this));

    logger.info('Default health checks registered', {
      checks: Array.from(this.checks.keys()),
      category: 'health'
    });
  }

  registerCheck(name, checkFunction) {
    this.checks.set(name, {
      name,
      function: checkFunction,
      enabled: true,
      lastRun: null,
      lastResult: null,
      failures: 0,
      consecutiveFailures: 0
    });
  }

  startPeriodicChecks() {
    // Run health checks every 5 minutes
    setInterval(async () => {
      await this.runAllChecks();
    }, 5 * 60 * 1000);

    // Run initial check
    setTimeout(() => {
      this.runAllChecks();
    }, 10000); // Wait 10 seconds after startup
  }

  async runAllChecks() {
    const results = {};
    const startTime = Date.now();

    logger.debug('Starting health check cycle', { category: 'health' });

    for (const [name, check] of this.checks) {
      if (!check.enabled) continue;

      try {
        const result = await this.runSingleCheck(name);
        results[name] = result;
      } catch (error) {
        results[name] = {
          status: 'error',
          message: `Health check failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          error: error.message
        };
        logger.error(`Health check ${name} failed`, { error: error.message, category: 'health' });
      }
    }

    const duration = Date.now() - startTime;
    const overallStatus = this.calculateOverallStatus(results);

    const healthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration,
      checks: results,
      summary: this.generateSummary(results)
    };

    this.addToHistory(healthReport);

    logger.info('Health check completed', {
      status: overallStatus,
      duration,
      checkCount: Object.keys(results).length,
      category: 'health'
    });

    return healthReport;
  }

  async runSingleCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();

    try {
      const result = await check.function();
      const duration = Date.now() - startTime;

      const checkResult = {
        status: result.status || 'healthy',
        message: result.message || 'OK',
        data: result.data || {},
        timestamp: new Date().toISOString(),
        duration
      };

      check.lastRun = new Date().toISOString();
      check.lastResult = checkResult;

      if (checkResult.status === 'healthy') {
        check.consecutiveFailures = 0;
      } else {
        check.failures++;
        check.consecutiveFailures++;
      }

      return checkResult;

    } catch (error) {
      check.failures++;
      check.consecutiveFailures++;
      throw error;
    }
  }

  calculateOverallStatus(results) {
    const statuses = Object.values(results).map(result => result.status);

    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  generateSummary(results) {
    const summary = {
      total: Object.keys(results).length,
      healthy: 0,
      warning: 0,
      unhealthy: 0,
      error: 0
    };

    Object.values(results).forEach(result => {
      summary[result.status]++;
    });

    return summary;
  }

  addToHistory(healthReport) {
    this.checkHistory.push(healthReport);

    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory = this.checkHistory.slice(-this.maxHistorySize);
    }
  }

  // Individual health check methods
  async checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const totalMemoryMB = Math.round(totalMemory / 1024 / 1024);
    const usedMemoryPercent = Math.round((usedMemory / totalMemory) * 100);

    let status = 'healthy';
    let message = 'Memory usage is normal';

    if (heapUsedMB > 500) {
      status = 'warning';
      message = 'High heap memory usage';
    }

    if (heapUsedMB > 1000 || usedMemoryPercent > 90) {
      status = 'unhealthy';
      message = 'Critical memory usage';
    }

    return {
      status,
      message,
      data: {
        heapUsedMB,
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        totalMemoryMB,
        usedMemoryPercent,
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      }
    };
  }

  async checkDiskSpace() {
    try {
      const stats = await fs.stat(process.cwd());

      // This is a simplified check - in production, you might want to use a library
      // like 'check-disk-space' for more accurate disk space information

      let status = 'healthy';
      let message = 'Disk space is adequate';

      return {
        status,
        message,
        data: {
          directory: process.cwd(),
          accessible: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Cannot access file system',
        data: { error: error.message }
      };
    }
  }

  async checkCPUUsage() {
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;

    const userCPU = cpuUsage.user / 1000000; // Convert to seconds
    const systemCPU = cpuUsage.system / 1000000;

    let status = 'healthy';
    let message = 'CPU usage is normal';

    const avgLoad = loadAverage[0] / cpuCount;

    if (avgLoad > 0.7) {
      status = 'warning';
      message = 'High CPU load';
    }

    if (avgLoad > 1.0) {
      status = 'unhealthy';
      message = 'Critical CPU load';
    }

    return {
      status,
      message,
      data: {
        userCPU: Math.round(userCPU * 100) / 100,
        systemCPU: Math.round(systemCPU * 100) / 100,
        loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
        cpuCount,
        avgLoad: Math.round(avgLoad * 100) / 100
      }
    };
  }

  async checkUptime() {
    const processUptime = process.uptime();
    const systemUptime = os.uptime();

    let status = 'healthy';
    let message = `Process running for ${this.formatUptime(processUptime)}`;

    if (processUptime < 60) {
      status = 'warning';
      message = 'Process recently restarted';
    }

    return {
      status,
      message,
      data: {
        processUptime: Math.round(processUptime),
        systemUptime: Math.round(systemUptime),
        startTime: new Date(this.startTime).toISOString(),
        processUptimeFormatted: this.formatUptime(processUptime),
        systemUptimeFormatted: this.formatUptime(systemUptime)
      }
    };
  }

  async checkDatabase() {
    // Check if data directories exist and are writable
    try {
      const dataDir = path.join(__dirname, '../../data');
      await fs.access(dataDir, fs.constants.R_OK | fs.constants.W_OK);

      // Check analytics data
      const metrics = analytics.getMetrics();
      const hasData = metrics.totalMessages > 0;

      return {
        status: 'healthy',
        message: 'Data storage is accessible',
        data: {
          dataDir,
          hasData,
          totalMessages: metrics.totalMessages,
          lastUpdated: metrics.lastUpdated
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Data storage is not accessible',
        data: { error: error.message }
      };
    }
  }

  async checkLogSystem() {
    try {
      const logsDir = path.join(__dirname, '../../logs');
      await fs.access(logsDir, fs.constants.R_OK | fs.constants.W_OK);

      const logFiles = await fs.readdir(logsDir);
      const today = new Date().toISOString().split('T')[0];
      const todayLogFile = `app-${today}.log`;

      return {
        status: 'healthy',
        message: 'Logging system is operational',
        data: {
          logsDir,
          logFiles: logFiles.length,
          todayLogExists: logFiles.includes(todayLogFile)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Logging system is not accessible',
        data: { error: error.message }
      };
    }
  }

  async checkAnalytics() {
    try {
      const metrics = analytics.getMetrics();
      const systemHealth = analytics.getSystemHealth();

      let status = 'healthy';
      let message = 'Analytics system is operational';

      const lastUpdate = new Date(metrics.lastUpdated);
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();

      if (timeSinceUpdate > 60 * 60 * 1000) { // 1 hour
        status = 'warning';
        message = 'Analytics data is outdated';
      }

      if (timeSinceUpdate > 24 * 60 * 60 * 1000) { // 24 hours
        status = 'unhealthy';
        message = 'Analytics data is very outdated';
      }

      return {
        status,
        message,
        data: {
          totalMessages: metrics.totalMessages,
          totalUsers: metrics.totalUsers,
          lastUpdated: metrics.lastUpdated,
          timeSinceUpdateMinutes: Math.round(timeSinceUpdate / 60000)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Analytics system error',
        data: { error: error.message }
      };
    }
  }

  async checkWhatsAppConnection() {
    // This would be set by the main bot when connection status changes
    const connectionStatus = this.whatsappConnected || false;
    const lastActivity = this.lastWhatsAppActivity || 0;

    let status = 'healthy';
    let message = 'WhatsApp connection is active';

    if (!connectionStatus) {
      status = 'unhealthy';
      message = 'WhatsApp is not connected';
    } else {
      const timeSinceActivity = Date.now() - lastActivity;
      if (timeSinceActivity > 30 * 60 * 1000) { // 30 minutes
        status = 'warning';
        message = 'No WhatsApp activity for 30+ minutes';
      }
    }

    return {
      status,
      message,
      data: {
        connected: connectionStatus,
        lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
        timeSinceActivityMinutes: lastActivity ? Math.round((Date.now() - lastActivity) / 60000) : null
      }
    };
  }

  // Public API methods
  async getHealthStatus() {
    return await this.runAllChecks();
  }

  async getHealthSummary() {
    const latestCheck = this.checkHistory[this.checkHistory.length - 1];

    if (!latestCheck) {
      return {
        status: 'unknown',
        message: 'No health checks have been run yet',
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: latestCheck.status,
      message: this.getStatusMessage(latestCheck),
      timestamp: latestCheck.timestamp,
      summary: latestCheck.summary,
      uptime: this.formatUptime(process.uptime())
    };
  }

  getStatusMessage(healthReport) {
    const { summary } = healthReport;

    if (summary.unhealthy > 0) {
      return `${summary.unhealthy} critical issue(s) detected`;
    }

    if (summary.warning > 0) {
      return `${summary.warning} warning(s) detected`;
    }

    if (summary.error > 0) {
      return `${summary.error} check(s) failed`;
    }

    return 'All systems operational';
  }

  getHealthHistory(limit = 50) {
    return this.checkHistory.slice(-limit);
  }

  getCheckDetails(checkName) {
    const check = this.checks.get(checkName);
    if (!check) {
      return null;
    }

    return {
      name: checkName,
      enabled: check.enabled,
      lastRun: check.lastRun,
      lastResult: check.lastResult,
      failures: check.failures,
      consecutiveFailures: check.consecutiveFailures
    };
  }

  enableCheck(checkName) {
    const check = this.checks.get(checkName);
    if (check) {
      check.enabled = true;
      logger.info(`Health check '${checkName}' enabled`, { category: 'health' });
    }
  }

  disableCheck(checkName) {
    const check = this.checks.get(checkName);
    if (check) {
      check.enabled = false;
      logger.info(`Health check '${checkName}' disabled`, { category: 'health' });
    }
  }

  // Update methods (called by other systems)
  updateWhatsAppStatus(connected, lastActivity = Date.now()) {
    this.whatsappConnected = connected;
    this.lastWhatsAppActivity = lastActivity;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Advanced health metrics
  getHealthTrends(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const recentChecks = this.checkHistory.filter(
      check => new Date(check.timestamp).getTime() > cutoff
    );

    const trends = {};

    for (const checkName of this.checks.keys()) {
      const checkResults = recentChecks
        .map(report => report.checks[checkName])
        .filter(result => result);

      trends[checkName] = {
        total: checkResults.length,
        healthy: checkResults.filter(r => r.status === 'healthy').length,
        warning: checkResults.filter(r => r.status === 'warning').length,
        unhealthy: checkResults.filter(r => r.status === 'unhealthy').length,
        error: checkResults.filter(r => r.status === 'error').length,
        avgDuration: checkResults.reduce((sum, r) => sum + (r.duration || 0), 0) / checkResults.length || 0
      };
    }

    return trends;
  }

  getUptimePercentage(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const recentChecks = this.checkHistory.filter(
      check => new Date(check.timestamp).getTime() > cutoff
    );

    if (recentChecks.length === 0) return 100;

    const healthyChecks = recentChecks.filter(check => check.status === 'healthy').length;
    return Math.round((healthyChecks / recentChecks.length) * 100 * 100) / 100;
  }
}

module.exports = new HealthMonitor();
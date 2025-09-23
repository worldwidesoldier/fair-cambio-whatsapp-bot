const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      // Monitoring intervals
      memoryCheckInterval: options.memoryCheckInterval || 60000, // 1 minute
      performanceLogInterval: options.performanceLogInterval || 300000, // 5 minutes
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds

      // Thresholds
      memoryThresholdMB: options.memoryThresholdMB || 200,
      cpuThresholdPercent: options.cpuThresholdPercent || 80,
      diskSpaceThresholdGB: options.diskSpaceThresholdGB || 1,

      // Alert settings
      enableAlerts: options.enableAlerts !== false,
      alertCooldownMs: options.alertCooldownMs || 600000, // 10 minutes

      // Logging
      logToFile: options.logToFile !== false,
      logFilePath: options.logFilePath || './logs/performance.log',
      retainLogDays: options.retainLogDays || 7
    };

    this.metrics = {
      startTime: Date.now(),
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      messagesPerMinute: 0,
      avgResponseTime: 0,
      lastHealthCheck: null,
      memoryUsage: [],
      cpuUsage: [],
      diskUsage: null,
      uptime: 0,
      lastRestart: null,
      errors: [],
      warnings: []
    };

    this.intervals = {
      memory: null,
      performance: null,
      health: null
    };

    this.lastAlerts = new Map();
    this.isMonitoring = false;

    // Message tracking
    this.messageTimestamps = [];
    this.responseTimestamps = [];

    // Connection tracking
    this.connectionEvents = [];
  }

  start() {
    if (this.isMonitoring) {
      console.log('⚠️ Performance monitor já está rodando');
      return;
    }

    console.log('📊 Iniciando monitor de performance...');

    this.isMonitoring = true;
    this.metrics.startTime = Date.now();

    // Start monitoring intervals
    this.intervals.memory = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.memoryCheckInterval);

    this.intervals.performance = setInterval(() => {
      this.logPerformanceMetrics();
    }, this.options.performanceLogInterval);

    this.intervals.health = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);

    console.log('✅ Monitor de performance iniciado');
  }

  stop() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🛑 Parando monitor de performance...');

    // Clear all intervals
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });

    // Reset intervals
    this.intervals = { memory: null, performance: null, health: null };
    this.isMonitoring = false;

    console.log('✅ Monitor de performance parado');
  }

  // ==================== MEMORY MONITORING ====================

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    // Store memory usage for trending
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsageMB,
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      rss: memUsage.rss / 1024 / 1024,
      external: memUsage.external / 1024 / 1024
    });

    // Keep only last 100 measurements
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
    }

    // Check if memory usage is above threshold
    if (memUsageMB > this.options.memoryThresholdMB) {
      this.handleMemoryAlert(memUsageMB);
    }

    // Log every 10 checks (roughly every 10 minutes)
    if (this.metrics.memoryUsage.length % 10 === 0) {
      console.log(`🧠 Memória: ${memUsageMB.toFixed(2)}MB heap, ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB RSS`);
    }
  }

  handleMemoryAlert(currentUsageMB) {
    const alertKey = 'memory';
    const lastAlert = this.lastAlerts.get(alertKey);

    // Check cooldown
    if (lastAlert && (Date.now() - lastAlert) < this.options.alertCooldownMs) {
      return;
    }

    console.warn(`⚠️ ALERTA: Uso de memória alto: ${currentUsageMB.toFixed(2)}MB (limite: ${this.options.memoryThresholdMB}MB)`);

    this.metrics.warnings.push({
      timestamp: Date.now(),
      type: 'memory',
      message: `Uso de memória alto: ${currentUsageMB.toFixed(2)}MB`,
      threshold: this.options.memoryThresholdMB
    });

    this.lastAlerts.set(alertKey, Date.now());

    // Trigger cleanup if available
    if (this.bot && typeof this.bot.performMemoryCleanup === 'function') {
      console.log('🧹 Executando limpeza de memória automática...');
      this.bot.performMemoryCleanup();
    }
  }

  // ==================== CPU MONITORING ====================

  async checkCPUUsage() {
    const cpuUsage = process.cpuUsage();
    const systemLoad = os.loadavg()[0]; // 1-minute load average

    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    this.metrics.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system,
      systemLoad: systemLoad,
      percent: cpuPercent
    });

    // Keep only last 100 measurements
    if (this.metrics.cpuUsage.length > 100) {
      this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-100);
    }

    // Check if CPU usage is above threshold
    if (systemLoad > this.options.cpuThresholdPercent / 100) {
      this.handleCPUAlert(systemLoad);
    }

    return { cpuPercent, systemLoad };
  }

  handleCPUAlert(systemLoad) {
    const alertKey = 'cpu';
    const lastAlert = this.lastAlerts.get(alertKey);

    if (lastAlert && (Date.now() - lastAlert) < this.options.alertCooldownMs) {
      return;
    }

    console.warn(`⚠️ ALERTA: Carga de CPU alta: ${(systemLoad * 100).toFixed(2)}% (limite: ${this.options.cpuThresholdPercent}%)`);

    this.metrics.warnings.push({
      timestamp: Date.now(),
      type: 'cpu',
      message: `Carga de CPU alta: ${(systemLoad * 100).toFixed(2)}%`,
      threshold: this.options.cpuThresholdPercent
    });

    this.lastAlerts.set(alertKey, Date.now());
  }

  // ==================== DISK MONITORING ====================

  async checkDiskUsage() {
    try {
      const stats = await fs.statfs('./');
      const totalGB = (stats.blocks * stats.blksize) / 1024 / 1024 / 1024;
      const freeGB = (stats.bavail * stats.blksize) / 1024 / 1024 / 1024;
      const usedGB = totalGB - freeGB;
      const usedPercent = (usedGB / totalGB) * 100;

      this.metrics.diskUsage = {
        timestamp: Date.now(),
        totalGB: totalGB,
        freeGB: freeGB,
        usedGB: usedGB,
        usedPercent: usedPercent
      };

      // Check if free space is below threshold
      if (freeGB < this.options.diskSpaceThresholdGB) {
        this.handleDiskAlert(freeGB);
      }

      return this.metrics.diskUsage;

    } catch (error) {
      console.error('❌ Erro ao verificar uso de disco:', error);
      return null;
    }
  }

  handleDiskAlert(freeGB) {
    const alertKey = 'disk';
    const lastAlert = this.lastAlerts.get(alertKey);

    if (lastAlert && (Date.now() - lastAlert) < this.options.alertCooldownMs) {
      return;
    }

    console.warn(`⚠️ ALERTA: Pouco espaço em disco: ${freeGB.toFixed(2)}GB livres (limite: ${this.options.diskSpaceThresholdGB}GB)`);

    this.metrics.warnings.push({
      timestamp: Date.now(),
      type: 'disk',
      message: `Pouco espaço em disco: ${freeGB.toFixed(2)}GB livres`,
      threshold: this.options.diskSpaceThresholdGB
    });

    this.lastAlerts.set(alertKey, Date.now());
  }

  // ==================== HEALTH CHECKS ====================

  async performHealthCheck() {
    const health = {
      timestamp: Date.now(),
      status: 'healthy',
      uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000),
      checks: {}
    };

    try {
      // Memory check
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;
      health.checks.memory = {
        status: memUsageMB < this.options.memoryThresholdMB ? 'ok' : 'warning',
        value: `${memUsageMB.toFixed(2)}MB`,
        threshold: `${this.options.memoryThresholdMB}MB`
      };

      // CPU check
      const cpuData = await this.checkCPUUsage();
      health.checks.cpu = {
        status: cpuData.systemLoad < (this.options.cpuThresholdPercent / 100) ? 'ok' : 'warning',
        value: `${(cpuData.systemLoad * 100).toFixed(2)}%`,
        threshold: `${this.options.cpuThresholdPercent}%`
      };

      // Disk check
      const diskData = await this.checkDiskUsage();
      if (diskData) {
        health.checks.disk = {
          status: diskData.freeGB > this.options.diskSpaceThresholdGB ? 'ok' : 'warning',
          value: `${diskData.freeGB.toFixed(2)}GB free`,
          threshold: `${this.options.diskSpaceThresholdGB}GB`
        };
      }

      // Bot status check (if bot reference is available)
      if (this.bot) {
        health.checks.whatsapp = {
          status: this.bot.isConnected ? 'ok' : 'error',
          value: this.bot.isConnected ? 'Connected' : 'Disconnected',
          lastConnection: this.bot.lastSuccessfulConnection || 'Never'
        };
      }

      // Determine overall status
      const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
      const hasWarnings = Object.values(health.checks).some(check => check.status === 'warning');

      if (hasErrors) {
        health.status = 'error';
      } else if (hasWarnings) {
        health.status = 'warning';
      }

      this.metrics.lastHealthCheck = health;

      // Log health status every 10 checks (roughly every 5 minutes)
      if (this.metrics.lastHealthCheck && (Date.now() - this.metrics.startTime) % 300000 < 30000) {
        console.log(`💊 Health Check: ${health.status} | Uptime: ${Math.floor(health.uptime / 60)}min`);
      }

    } catch (error) {
      console.error('❌ Erro no health check:', error);
      health.status = 'error';
      health.error = error.message;
    }

    return health;
  }

  // ==================== MESSAGE METRICS ====================

  recordMessage() {
    this.metrics.totalMessages++;
    this.messageTimestamps.push(Date.now());

    // Keep only last 1000 message timestamps
    if (this.messageTimestamps.length > 1000) {
      this.messageTimestamps = this.messageTimestamps.slice(-1000);
    }

    // Calculate messages per minute
    this.calculateMessagesPerMinute();
  }

  recordResponse(responseTime) {
    this.responseTimestamps.push({
      timestamp: Date.now(),
      responseTime: responseTime
    });

    // Keep only last 500 response times
    if (this.responseTimestamps.length > 500) {
      this.responseTimestamps = this.responseTimestamps.slice(-500);
    }

    // Calculate average response time
    this.calculateAverageResponseTime();
  }

  calculateMessagesPerMinute() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentMessages = this.messageTimestamps.filter(ts => ts > oneMinuteAgo);
    this.metrics.messagesPerMinute = recentMessages.length;
  }

  calculateAverageResponseTime() {
    if (this.responseTimestamps.length === 0) {
      this.metrics.avgResponseTime = 0;
      return;
    }

    const totalTime = this.responseTimestamps.reduce((sum, record) => sum + record.responseTime, 0);
    this.metrics.avgResponseTime = Math.round(totalTime / this.responseTimestamps.length);
  }

  // ==================== CONNECTION METRICS ====================

  recordConnection(success, details = {}) {
    this.metrics.totalConnections++;

    if (success) {
      this.metrics.successfulConnections++;
    } else {
      this.metrics.failedConnections++;
    }

    this.connectionEvents.push({
      timestamp: Date.now(),
      success: success,
      ...details
    });

    // Keep only last 100 connection events
    if (this.connectionEvents.length > 100) {
      this.connectionEvents = this.connectionEvents.slice(-100);
    }
  }

  // ==================== LOGGING ====================

  async logPerformanceMetrics() {
    const metrics = await this.getMetrics();

    console.log('📊 Performance Metrics:');
    console.log(`   Uptime: ${Math.floor(metrics.uptime / 60)}min`);
    console.log(`   Memory: ${metrics.currentMemoryMB.toFixed(2)}MB`);
    console.log(`   Messages: ${metrics.totalMessages} total, ${metrics.messagesPerMinute}/min`);
    console.log(`   Connections: ${metrics.successfulConnections}/${metrics.totalConnections} successful`);

    if (this.options.logToFile) {
      await this.writeToLogFile(metrics);
    }
  }

  async writeToLogFile(metrics) {
    try {
      const logDir = path.dirname(this.options.logFilePath);
      await fs.mkdir(logDir, { recursive: true });

      const logEntry = {
        timestamp: new Date().toISOString(),
        ...metrics
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.options.logFilePath, logLine);

    } catch (error) {
      console.error('❌ Erro ao escrever log de performance:', error);
    }
  }

  // ==================== METRICS RETRIEVAL ====================

  async getMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.metrics.startTime;

    return {
      ...this.metrics,
      uptime: Math.floor(uptime / 1000),
      currentMemoryMB: memUsage.heapUsed / 1024 / 1024,
      currentMemoryRSS: memUsage.rss / 1024 / 1024,
      connectionSuccessRate: this.metrics.totalConnections > 0
        ? ((this.metrics.successfulConnections / this.metrics.totalConnections) * 100).toFixed(2)
        : 0,
      lastHealthCheck: this.metrics.lastHealthCheck
    };
  }

  getHealthStatus() {
    return this.metrics.lastHealthCheck || {
      status: 'unknown',
      message: 'Health check não executado ainda'
    };
  }

  // ==================== INTEGRATION ====================

  setBotReference(bot) {
    this.bot = bot;
  }

  // ==================== ALERTS ====================

  recordError(error) {
    this.metrics.errors.push({
      timestamp: Date.now(),
      message: error.message || error,
      stack: error.stack
    });

    // Keep only last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }
  }

  recordWarning(warning) {
    this.metrics.warnings.push({
      timestamp: Date.now(),
      message: warning.message || warning
    });

    // Keep only last 100 warnings
    if (this.metrics.warnings.length > 100) {
      this.metrics.warnings = this.metrics.warnings.slice(-100);
    }
  }
}

module.exports = PerformanceMonitor;
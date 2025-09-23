const os = require('os');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      healthCheckInterval: options.healthCheckInterval || 5 * 60 * 1000, // 5 minutos
      performanceInterval: options.performanceInterval || 30 * 1000, // 30 segundos
      alertThresholds: {
        memoryUsage: options.alertThresholds?.memoryUsage || 85, // 85%
        cpuUsage: options.alertThresholds?.cpuUsage || 80, // 80%
        responseTime: options.alertThresholds?.responseTime || 5000, // 5s
        diskUsage: options.alertThresholds?.diskUsage || 90, // 90%
        ...options.alertThresholds
      },
      logRetention: options.logRetention || 7 * 24 * 60 * 60 * 1000, // 7 dias
      maxLogEntries: options.maxLogEntries || 1000,
      testMessageInterval: options.testMessageInterval || 5 * 60 * 1000, // 5 minutos
      ...options
    };

    this.status = {
      overall: 'healthy',
      services: {
        api: 'unknown',
        websocket: 'unknown',
        whatsapp: 'unknown',
        database: 'unknown'
      },
      metrics: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: null,
        lastTestMessage: null
      },
      alerts: [],
      logs: []
    };

    this.intervals = {};
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCheck = process.hrtime();

    // Bind methods
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.log = this.log.bind(this);
    this.createAlert = this.createAlert.bind(this);
  }

  init() {
    this.log('info', 'Health Monitor inicializado');

    // Iniciar monitoramento de performance
    this.startPerformanceMonitoring();

    // Iniciar health checks
    this.startHealthChecks();

    // Iniciar limpeza de logs
    this.startLogCleanup();

    this.emit('initialized');
    return this;
  }

  destroy() {
    this.log('info', 'Health Monitor sendo encerrado');

    // Limpar todos os intervalos
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });

    this.removeAllListeners();
    this.log('info', 'Health Monitor encerrado');
  }

  // Sistema de Logs Estruturados
  log(level, message, metadata = {}) {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        ...metadata
      }
    };

    // Adicionar ao array de logs
    this.status.logs.unshift(logEntry);

    // Manter apenas o número máximo de logs
    if (this.status.logs.length > this.options.maxLogEntries) {
      this.status.logs = this.status.logs.slice(0, this.options.maxLogEntries);
    }

    // Emitir evento de log
    this.emit('log', logEntry);

    // Log no console com cor
    const colors = {
      error: '\x1b[31m', // Vermelho
      warn: '\x1b[33m',  // Amarelo
      info: '\x1b[36m',  // Ciano
      success: '\x1b[32m', // Verde
      debug: '\x1b[90m'  // Cinza
    };

    const resetColor = '\x1b[0m';
    const color = colors[level] || colors.info;

    console.log(`${color}[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${resetColor}`,
                metadata && Object.keys(metadata).length > 0 ? metadata : '');

    // Salvar em arquivo se for erro ou warn
    if (level === 'error' || level === 'warn') {
      this.saveLogToFile(logEntry);
    }

    return logEntry;
  }

  // Salvar logs críticos em arquivo
  saveLogToFile(logEntry) {
    try {
      const logDir = path.join(__dirname, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, `health-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = `${logEntry.timestamp} [${logEntry.level.toUpperCase()}] ${logEntry.message} ${JSON.stringify(logEntry.metadata)}\n`;

      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Erro ao salvar log em arquivo:', error);
    }
  }

  // Sistema de Alertas
  createAlert(level, title, message, metadata = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level, // 'info', 'warning', 'error', 'critical'
      title,
      message,
      metadata,
      acknowledged: false
    };

    this.status.alerts.unshift(alert);

    // Manter apenas 50 alertas
    if (this.status.alerts.length > 50) {
      this.status.alerts = this.status.alerts.slice(0, 50);
    }

    this.log(level === 'critical' ? 'error' : level, `ALERTA: ${title} - ${message}`, metadata);
    this.emit('alert', alert);

    return alert;
  }

  // Health Check Principal
  async performHealthCheck() {
    const startTime = Date.now();

    try {
      this.log('info', 'Iniciando health check completo');

      const checks = await Promise.allSettled([
        this.checkApiHealth(),
        this.checkWebSocketHealth(),
        this.checkWhatsAppHealth(),
        this.checkSystemResources(),
        this.performTestMessage()
      ]);

      const results = {
        api: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', error: checks[0].reason },
        websocket: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', error: checks[1].reason },
        whatsapp: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'error', error: checks[2].reason },
        system: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'error', error: checks[3].reason },
        testMessage: checks[4].status === 'fulfilled' ? checks[4].value : { status: 'error', error: checks[4].reason }
      };

      // Atualizar status dos serviços
      this.status.services.api = results.api.status;
      this.status.services.websocket = results.websocket.status;
      this.status.services.whatsapp = results.whatsapp.status;

      // Determinar status geral
      const hasError = Object.values(this.status.services).some(status => status === 'error');
      const hasWarning = Object.values(this.status.services).some(status => status === 'warning');

      this.status.overall = hasError ? 'unhealthy' : hasWarning ? 'warning' : 'healthy';

      const responseTime = Date.now() - startTime;
      this.status.metrics.responseTime = responseTime;
      this.status.metrics.lastHealthCheck = new Date().toISOString();

      // Verificar thresholds e criar alertas
      this.checkThresholds(results);

      this.log('success', `Health check concluído em ${responseTime}ms - Status: ${this.status.overall}`);
      this.emit('healthCheckComplete', this.status);

      return this.status;

    } catch (error) {
      this.status.overall = 'unhealthy';
      this.log('error', 'Erro durante health check', { error: error.message, stack: error.stack });
      this.createAlert('critical', 'Health Check Failed', error.message, { error: error.stack });

      throw error;
    }
  }

  // Verificar saúde da API
  async checkApiHealth() {
    try {
      const http = require('http');

      return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3001/health', { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve({ status: 'healthy', statusCode: res.statusCode, response: data });
            } else {
              resolve({ status: 'warning', statusCode: res.statusCode, response: data });
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('API health check timeout'));
        });

        req.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  // Verificar WebSocket
  async checkWebSocketHealth() {
    // Verificar se há conexões WebSocket ativas
    if (this.socketIo && this.socketIo.engine && this.socketIo.engine.clientsCount > 0) {
      return { status: 'healthy', clients: this.socketIo.engine.clientsCount };
    }
    return { status: 'warning', message: 'Nenhum cliente WebSocket conectado' };
  }

  // Verificar WhatsApp
  async checkWhatsAppHealth() {
    if (this.whatsappStatus) {
      if (this.whatsappStatus.connected) {
        return { status: 'healthy', phone: this.whatsappStatus.phone };
      } else if (this.whatsappStatus.connectionStatus === 'qr') {
        return { status: 'warning', message: 'Aguardando QR scan' };
      }
    }
    return { status: 'error', message: 'WhatsApp desconectado' };
  }

  // Verificar recursos do sistema
  async checkSystemResources() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU Usage
    const currentUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTime = process.hrtime(this.lastCheck);
    const cpuPercent = (currentUsage.user + currentUsage.system) / (currentTime[0] * 1000000 + currentTime[1] / 1000) * 100;

    this.lastCpuUsage = process.cpuUsage();
    this.lastCheck = process.hrtime();

    // Memory Usage
    const memPercent = (usedMem / totalMem) * 100;

    // Disk Usage (simplified)
    let diskPercent = 0;
    try {
      const stats = fs.statSync(__dirname);
      diskPercent = 50; // Placeholder - implementar verificação real de disco se necessário
    } catch (error) {
      // Ignore disk check error
    }

    this.status.metrics.memoryUsage = memPercent;
    this.status.metrics.cpuUsage = cpuPercent;
    this.status.metrics.diskUsage = diskPercent;
    this.status.metrics.uptime = process.uptime();

    // Determinar status baseado nos thresholds
    let status = 'healthy';
    if (memPercent > this.options.alertThresholds.memoryUsage ||
        cpuPercent > this.options.alertThresholds.cpuUsage) {
      status = 'warning';
    }
    if (memPercent > 95 || cpuPercent > 95) {
      status = 'error';
    }

    return {
      status,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percent: memPercent
      },
      cpu: {
        percent: cpuPercent
      },
      disk: {
        percent: diskPercent
      },
      uptime: process.uptime()
    };
  }

  // Realizar teste de mensagem
  async performTestMessage() {
    try {
      // Simular envio de mensagem de teste
      if (this.whatsappStatus && this.whatsappStatus.connected && this.testMessageCallback) {
        const testResult = await this.testMessageCallback();
        this.status.metrics.lastTestMessage = new Date().toISOString();
        return { status: 'healthy', result: testResult };
      }
      return { status: 'warning', message: 'WhatsApp não conectado para teste' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  // Verificar thresholds e criar alertas
  checkThresholds(results) {
    const { metrics } = this.status;

    // Memory alert
    if (metrics.memoryUsage > this.options.alertThresholds.memoryUsage) {
      this.createAlert('warning', 'High Memory Usage',
        `Uso de memória em ${metrics.memoryUsage.toFixed(1)}%`,
        { memoryUsage: metrics.memoryUsage });
    }

    // CPU alert
    if (metrics.cpuUsage > this.options.alertThresholds.cpuUsage) {
      this.createAlert('warning', 'High CPU Usage',
        `Uso de CPU em ${metrics.cpuUsage.toFixed(1)}%`,
        { cpuUsage: metrics.cpuUsage });
    }

    // Response time alert
    if (metrics.responseTime > this.options.alertThresholds.responseTime) {
      this.createAlert('warning', 'Slow Response Time',
        `Health check demorou ${metrics.responseTime}ms`,
        { responseTime: metrics.responseTime });
    }

    // Service alerts
    Object.entries(this.status.services).forEach(([service, status]) => {
      if (status === 'error') {
        this.createAlert('error', `Service Down: ${service}`,
          `Serviço ${service} está com erro`,
          { service, status });
      }
    });

    // Error rate alert
    if (this.requestCount > 0) {
      const errorRate = (this.errorCount / this.requestCount) * 100;
      this.status.metrics.errorRate = errorRate;

      if (errorRate > 10) { // 10% error rate
        this.createAlert('warning', 'High Error Rate',
          `Taxa de erro em ${errorRate.toFixed(1)}%`,
          { errorRate, errorCount: this.errorCount, requestCount: this.requestCount });
      }
    }
  }

  // Monitoramento de Performance
  startPerformanceMonitoring() {
    this.intervals.performance = setInterval(() => {
      this.checkSystemResources();
      this.emit('performanceUpdate', this.status.metrics);
    }, this.options.performanceInterval);

    this.log('info', 'Monitoramento de performance iniciado', {
      interval: this.options.performanceInterval
    });
  }

  // Health Checks Periódicos
  startHealthChecks() {
    this.intervals.healthCheck = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.log('error', 'Erro em health check periódico', { error: error.message });
      });
    }, this.options.healthCheckInterval);

    // Executar health check inicial
    setTimeout(() => {
      this.performHealthCheck().catch(error => {
        this.log('error', 'Erro em health check inicial', { error: error.message });
      });
    }, 2000);

    this.log('info', 'Health checks periódicos iniciados', {
      interval: this.options.healthCheckInterval
    });
  }

  // Limpeza de Logs
  startLogCleanup() {
    this.intervals.logCleanup = setInterval(() => {
      const cutoffTime = Date.now() - this.options.logRetention;
      const initialCount = this.status.logs.length;

      this.status.logs = this.status.logs.filter(log =>
        new Date(log.timestamp).getTime() > cutoffTime
      );

      const removedCount = initialCount - this.status.logs.length;
      if (removedCount > 0) {
        this.log('info', `Limpeza de logs: ${removedCount} logs antigos removidos`);
      }
    }, 60 * 60 * 1000); // A cada hora

    this.log('info', 'Limpeza automática de logs iniciada');
  }

  // Métodos de controle
  setSocketIo(socketIo) {
    this.socketIo = socketIo;
    this.log('info', 'Socket.io configurado no health monitor');
  }

  setWhatsAppStatus(status) {
    this.whatsappStatus = status;
    this.emit('whatsappStatusUpdate', status);
  }

  setTestMessageCallback(callback) {
    this.testMessageCallback = callback;
    this.log('info', 'Callback de teste de mensagem configurado');
  }

  // Incrementar contadores
  incrementRequestCount() {
    this.requestCount++;
  }

  incrementErrorCount() {
    this.errorCount++;
  }

  // Obter status completo
  getStatus() {
    return {
      ...this.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }

  // Reconhecer alerta
  acknowledgeAlert(alertId) {
    const alert = this.status.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      this.log('info', `Alerta reconhecido: ${alert.title}`);
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  // Limpar alertas reconhecidos
  clearAcknowledgedAlerts() {
    const initialCount = this.status.alerts.length;
    this.status.alerts = this.status.alerts.filter(alert => !alert.acknowledged);
    const removedCount = initialCount - this.status.alerts.length;

    if (removedCount > 0) {
      this.log('info', `${removedCount} alertas reconhecidos removidos`);
    }

    return removedCount;
  }

  // Export para análise
  exportLogs(format = 'json') {
    const exportData = {
      timestamp: new Date().toISOString(),
      status: this.getStatus(),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        totalMemory: os.totalmem(),
        cpuCount: os.cpus().length
      }
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }

    // Implementar outros formatos se necessário
    return exportData;
  }
}

module.exports = HealthMonitor;
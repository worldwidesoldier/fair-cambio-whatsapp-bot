const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };

    this.logDir = path.join(__dirname, '../../logs');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 30; // Keep 30 days of logs
    this.currentLogLevel = this.logLevels.INFO;

    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  setLogLevel(level) {
    if (this.logLevels.hasOwnProperty(level)) {
      this.currentLogLevel = this.logLevels[level];
    }
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.currentLogLevel;
  }

  async log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: {
        ...metadata,
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    const logFile = this.getLogFileName();

    try {
      await this.writeLog(logFile, logEntry);
      await this.rotateLogsIfNeeded(logFile);
    } catch (error) {
      console.error('Failed to write log:', error);
    }

    // Also output to console for immediate visibility
    this.consoleLog(level, message, metadata);
  }

  consoleLog(level, message, metadata) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const metaStr = Object.keys(metadata).length > 0 ?
      ` | ${JSON.stringify(metadata)}` : '';

    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[32m',  // Green
      DEBUG: '\x1b[36m', // Cyan
      TRACE: '\x1b[35m'  // Magenta
    };

    const resetColor = '\x1b[0m';
    const color = colors[level] || '';

    console.log(`${color}[${timestamp}] ${level}: ${message}${metaStr}${resetColor}`);
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `app-${date}.log`);
  }

  async writeLog(logFile, logEntry) {
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logFile, logLine, 'utf8');
  }

  async rotateLogsIfNeeded(logFile) {
    try {
      const stats = await fs.stat(logFile);

      if (stats.size > this.maxLogSize) {
        const timestamp = Date.now();
        const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
        await fs.rename(logFile, rotatedFile);
      }

      await this.cleanOldLogs();
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  async cleanOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(file => file.startsWith('app-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          time: fs.stat(path.join(this.logDir, file)).then(stats => stats.mtime)
        }));

      const filesWithTime = await Promise.all(
        logFiles.map(async file => ({
          ...file,
          time: await file.time
        }))
      );

      filesWithTime.sort((a, b) => b.time - a.time);

      if (filesWithTime.length > this.maxLogFiles) {
        const filesToDelete = filesWithTime.slice(this.maxLogFiles);
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  // Convenience methods
  async error(message, metadata = {}) {
    await this.log('ERROR', message, metadata);
  }

  async warn(message, metadata = {}) {
    await this.log('WARN', message, metadata);
  }

  async info(message, metadata = {}) {
    await this.log('INFO', message, metadata);
  }

  async debug(message, metadata = {}) {
    await this.log('DEBUG', message, metadata);
  }

  async trace(message, metadata = {}) {
    await this.log('TRACE', message, metadata);
  }

  // Special logging methods for bot events
  async logMessage(type, from, to, message, metadata = {}) {
    await this.info(`Message ${type}`, {
      ...metadata,
      from,
      to,
      message: message.substring(0, 100), // Truncate long messages
      category: 'message'
    });
  }

  async logConnection(event, details = {}) {
    await this.info(`Connection ${event}`, {
      ...details,
      category: 'connection'
    });
  }

  async logAdmin(action, admin, details = {}) {
    await this.info(`Admin action: ${action}`, {
      ...details,
      admin,
      category: 'admin'
    });
  }

  async logError(error, context = {}) {
    await this.error(error.message || error, {
      ...context,
      stack: error.stack,
      category: 'error'
    });
  }

  // Get logs for analytics
  async getLogs(date, category = null) {
    const logFile = path.join(this.logDir, `app-${date}.log`);

    try {
      const content = await fs.readFile(logFile, 'utf8');
      const logs = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log !== null);

      if (category) {
        return logs.filter(log => log.metadata?.category === category);
      }

      return logs;
    } catch (error) {
      return [];
    }
  }

  async getLogsSummary(date) {
    const logs = await this.getLogs(date);

    const summary = {
      total: logs.length,
      byLevel: {},
      byCategory: {},
      errors: logs.filter(log => log.level === 'ERROR').length,
      warnings: logs.filter(log => log.level === 'WARN').length
    };

    logs.forEach(log => {
      summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
      if (log.metadata?.category) {
        summary.byCategory[log.metadata.category] =
          (summary.byCategory[log.metadata.category] || 0) + 1;
      }
    });

    return summary;
  }
}

module.exports = new Logger();
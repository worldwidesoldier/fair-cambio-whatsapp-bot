const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const analytics = require('./analytics');

class AuditSystem {
  constructor() {
    this.auditDir = path.join(__dirname, '../../audit');
    this.auditFile = path.join(this.auditDir, 'audit.log');
    this.sessionsFile = path.join(this.auditDir, 'sessions.json');

    this.config = {
      maxAuditEntries: parseInt(process.env.MAX_AUDIT_ENTRIES) || 10000,
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 90,
      enableIntegrityCheck: process.env.ENABLE_AUDIT_INTEGRITY === 'true',
      enableSessionTracking: process.env.ENABLE_SESSION_TRACKING !== 'false'
    };

    this.activeSessions = new Map();
    this.auditBuffer = [];
    this.bufferFlushInterval = 5000; // 5 seconds

    this.initialize();
  }

  async initialize() {
    try {
      await this.ensureAuditDirectory();
      this.startBufferFlushing();

      logger.info('Audit system initialized', {
        auditDir: this.auditDir,
        config: this.config,
        category: 'audit'
      });

      // Log system startup
      await this.logSystemEvent('system_start', {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
      });

    } catch (error) {
      logger.error('Failed to initialize audit system', {
        error: error.message,
        category: 'audit'
      });
    }
  }

  async ensureAuditDirectory() {
    await fs.mkdir(this.auditDir, { recursive: true });
  }

  startBufferFlushing() {
    setInterval(async () => {
      if (this.auditBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, this.bufferFlushInterval);
  }

  async flushBuffer() {
    if (this.auditBuffer.length === 0) return;

    try {
      const entries = [...this.auditBuffer];
      this.auditBuffer = [];

      const logEntries = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      await fs.appendFile(this.auditFile, logEntries, 'utf8');

      logger.trace(`Flushed ${entries.length} audit entries`, { category: 'audit' });

    } catch (error) {
      logger.error('Failed to flush audit buffer', {
        error: error.message,
        entriesCount: this.auditBuffer.length,
        category: 'audit'
      });
    }
  }

  generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async addAuditEntry(entry) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    // Add integrity hash if enabled
    if (this.config.enableIntegrityCheck) {
      auditEntry.hash = this.generateHash(auditEntry);
    }

    this.auditBuffer.push(auditEntry);

    // Force flush for critical events
    if (entry.level === 'critical' || entry.category === 'security') {
      await this.flushBuffer();
    }

    return auditEntry.id;
  }

  // Admin Actions Audit
  async logAdminAction(admin, action, details = {}, level = 'info') {
    return await this.addAuditEntry({
      type: 'admin_action',
      category: 'admin',
      level,
      admin,
      action,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      sessionId: details.sessionId
    });
  }

  async logAdminLogin(admin, success = true, details = {}) {
    const level = success ? 'info' : 'warning';
    const action = success ? 'login_success' : 'login_failed';

    return await this.addAuditEntry({
      type: 'authentication',
      category: 'security',
      level,
      admin,
      action,
      success,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    });
  }

  async logAdminLogout(admin, details = {}) {
    return await this.addAuditEntry({
      type: 'authentication',
      category: 'security',
      level: 'info',
      admin,
      action: 'logout',
      details,
      ip: details.ip || 'unknown',
      sessionId: details.sessionId
    });
  }

  async logConfigurationChange(admin, configKey, oldValue, newValue, details = {}) {
    return await this.addAuditEntry({
      type: 'configuration',
      category: 'admin',
      level: 'warning',
      admin,
      action: 'config_change',
      configKey,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
      details
    });
  }

  async logDataAccess(admin, dataType, operation, recordId = null, details = {}) {
    return await this.addAuditEntry({
      type: 'data_access',
      category: 'data',
      level: 'info',
      admin,
      action: `${dataType}_${operation}`,
      dataType,
      operation,
      recordId,
      details
    });
  }

  async logSystemEvent(event, details = {}) {
    return await this.addAuditEntry({
      type: 'system_event',
      category: 'system',
      level: 'info',
      event,
      details
    });
  }

  async logSecurityEvent(event, details = {}, level = 'warning') {
    return await this.addAuditEntry({
      type: 'security_event',
      category: 'security',
      level,
      event,
      details,
      ip: details.ip || 'unknown'
    });
  }

  async logAPIAccess(endpoint, method, admin = null, status = 200, details = {}) {
    return await this.addAuditEntry({
      type: 'api_access',
      category: 'api',
      level: status >= 400 ? 'warning' : 'info',
      admin,
      endpoint,
      method,
      status,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    });
  }

  // Session Management
  async startSession(admin, details = {}) {
    if (!this.config.enableSessionTracking) return null;

    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      admin,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      actions: 0,
      active: true
    };

    this.activeSessions.set(sessionId, session);
    await this.saveSession(session);

    await this.logSystemEvent('session_start', {
      sessionId,
      admin,
      ip: details.ip
    });

    return sessionId;
  }

  async updateSession(sessionId, action = null) {
    if (!this.config.enableSessionTracking) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date().toISOString();
    session.actions++;

    if (action) {
      if (!session.actionHistory) session.actionHistory = [];
      session.actionHistory.push({
        action,
        timestamp: new Date().toISOString()
      });

      // Keep only last 100 actions per session
      if (session.actionHistory.length > 100) {
        session.actionHistory = session.actionHistory.slice(-100);
      }
    }

    await this.saveSession(session);
  }

  async endSession(sessionId, reason = 'logout') {
    if (!this.config.enableSessionTracking) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();
    session.active = false;
    session.endReason = reason;

    const duration = new Date(session.endTime) - new Date(session.startTime);
    session.durationMs = duration;

    this.activeSessions.delete(sessionId);
    await this.saveSession(session);

    await this.logSystemEvent('session_end', {
      sessionId,
      admin: session.admin,
      duration,
      actions: session.actions,
      reason
    });
  }

  async saveSession(session) {
    try {
      const sessions = await this.loadSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);

      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // Keep only last 1000 sessions
      if (sessions.length > 1000) {
        sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        sessions.splice(1000);
      }

      await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));

    } catch (error) {
      logger.error('Failed to save session', {
        sessionId: session.id,
        error: error.message,
        category: 'audit'
      });
    }
  }

  async loadSessions() {
    try {
      const content = await fs.readFile(this.sessionsFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  // Query Methods
  async getAuditEntries(filters = {}, limit = 100, offset = 0) {
    try {
      const content = await fs.readFile(this.auditFile, 'utf8');
      const lines = content.trim().split('\n');

      let entries = lines
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null);

      // Apply filters
      entries = this.applyFilters(entries, filters);

      // Sort by timestamp (newest first)
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply pagination
      const total = entries.length;
      entries = entries.slice(offset, offset + limit);

      return {
        entries,
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total
      };

    } catch (error) {
      logger.error('Failed to get audit entries', {
        error: error.message,
        filters,
        category: 'audit'
      });
      return { entries: [], total: 0, limit, offset, hasMore: false };
    }
  }

  applyFilters(entries, filters) {
    return entries.filter(entry => {
      // Date range filter
      if (filters.startDate && new Date(entry.timestamp) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate && new Date(entry.timestamp) > new Date(filters.endDate)) {
        return false;
      }

      // Admin filter
      if (filters.admin && entry.admin !== filters.admin) {
        return false;
      }

      // Type filter
      if (filters.type && entry.type !== filters.type) {
        return false;
      }

      // Category filter
      if (filters.category && entry.category !== filters.category) {
        return false;
      }

      // Level filter
      if (filters.level && entry.level !== filters.level) {
        return false;
      }

      // Action filter
      if (filters.action && entry.action !== filters.action) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = JSON.stringify(entry).toLowerCase();
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  async getAuditSummary(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { entries } = await this.getAuditEntries({
        startDate: startDate.toISOString()
      }, 10000); // Get more entries for accurate summary

      const summary = {
        totalEntries: entries.length,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        byType: {},
        byCategory: {},
        byLevel: {},
        byAdmin: {},
        byDay: {},
        topActions: {},
        securityEvents: 0,
        failedLogins: 0,
        configChanges: 0
      };

      entries.forEach(entry => {
        // Count by type
        summary.byType[entry.type] = (summary.byType[entry.type] || 0) + 1;

        // Count by category
        summary.byCategory[entry.category] = (summary.byCategory[entry.category] || 0) + 1;

        // Count by level
        summary.byLevel[entry.level] = (summary.byLevel[entry.level] || 0) + 1;

        // Count by admin
        if (entry.admin) {
          summary.byAdmin[entry.admin] = (summary.byAdmin[entry.admin] || 0) + 1;
        }

        // Count by day
        const day = entry.timestamp.split('T')[0];
        summary.byDay[day] = (summary.byDay[day] || 0) + 1;

        // Count top actions
        if (entry.action) {
          summary.topActions[entry.action] = (summary.topActions[entry.action] || 0) + 1;
        }

        // Count special events
        if (entry.category === 'security') {
          summary.securityEvents++;
        }

        if (entry.action === 'login_failed') {
          summary.failedLogins++;
        }

        if (entry.type === 'configuration') {
          summary.configChanges++;
        }
      });

      // Convert top actions to sorted array
      summary.topActions = Object.entries(summary.topActions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      return summary;

    } catch (error) {
      logger.error('Failed to get audit summary', {
        error: error.message,
        days,
        category: 'audit'
      });
      return null;
    }
  }

  async getSessionHistory(admin = null, limit = 50) {
    try {
      const sessions = await this.loadSessions();

      let filteredSessions = sessions;
      if (admin) {
        filteredSessions = sessions.filter(s => s.admin === admin);
      }

      // Sort by start time (newest first)
      filteredSessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return filteredSessions.slice(0, limit);

    } catch (error) {
      logger.error('Failed to get session history', {
        error: error.message,
        admin,
        category: 'audit'
      });
      return [];
    }
  }

  async getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  async getActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  // Integrity and Maintenance
  async verifyIntegrity() {
    if (!this.config.enableIntegrityCheck) {
      return { verified: true, message: 'Integrity check disabled' };
    }

    try {
      const { entries } = await this.getAuditEntries({}, 10000);
      let corruptedEntries = 0;

      for (const entry of entries) {
        if (entry.hash) {
          const { hash, ...entryWithoutHash } = entry;
          const expectedHash = this.generateHash(entryWithoutHash);

          if (hash !== expectedHash) {
            corruptedEntries++;
            logger.warn('Corrupted audit entry detected', {
              entryId: entry.id,
              expectedHash,
              actualHash: hash,
              category: 'audit'
            });
          }
        }
      }

      const result = {
        verified: corruptedEntries === 0,
        totalEntries: entries.length,
        corruptedEntries,
        message: corruptedEntries === 0 ?
          'All audit entries are intact' :
          `${corruptedEntries} corrupted entries found`
      };

      // Log integrity check
      await this.logSystemEvent('integrity_check', result);

      return result;

    } catch (error) {
      logger.error('Failed to verify audit integrity', {
        error: error.message,
        category: 'audit'
      });
      return {
        verified: false,
        message: `Integrity check failed: ${error.message}`
      };
    }
  }

  async cleanupOldEntries() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const { entries } = await this.getAuditEntries({}, 50000); // Get many entries
      const validEntries = entries.filter(
        entry => new Date(entry.timestamp) > cutoffDate
      );

      if (validEntries.length < entries.length) {
        // Rewrite audit file with only valid entries
        const content = validEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
        await fs.writeFile(this.auditFile, content, 'utf8');

        const removedCount = entries.length - validEntries.length;

        logger.info('Old audit entries cleaned up', {
          removedCount,
          remainingCount: validEntries.length,
          retentionDays: this.config.retentionDays,
          category: 'audit'
        });

        await this.logSystemEvent('audit_cleanup', {
          removedCount,
          remainingCount: validEntries.length,
          cutoffDate: cutoffDate.toISOString()
        });

        return { removedCount, remainingCount: validEntries.length };
      }

      return { removedCount: 0, remainingCount: entries.length };

    } catch (error) {
      logger.error('Failed to cleanup old audit entries', {
        error: error.message,
        category: 'audit'
      });
      throw error;
    }
  }

  // Utility methods
  sanitizeValue(value) {
    if (typeof value === 'string') {
      // Mask sensitive data
      if (value.toLowerCase().includes('password') ||
          value.toLowerCase().includes('token') ||
          value.toLowerCase().includes('secret') ||
          value.toLowerCase().includes('key')) {
        return '[REDACTED]';
      }
    }
    return value;
  }

  async exportAuditLog(filters = {}, format = 'json') {
    try {
      const { entries } = await this.getAuditEntries(filters, 50000);

      if (format === 'csv') {
        return this.exportToCSV(entries);
      } else {
        return JSON.stringify(entries, null, 2);
      }

    } catch (error) {
      logger.error('Failed to export audit log', {
        error: error.message,
        filters,
        format,
        category: 'audit'
      });
      throw error;
    }
  }

  exportToCSV(entries) {
    if (entries.length === 0) return '';

    const headers = ['timestamp', 'type', 'category', 'level', 'admin', 'action', 'details'];
    const csvLines = [headers.join(',')];

    entries.forEach(entry => {
      const row = headers.map(header => {
        let value = entry[header] || '';
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        // Escape commas and quotes
        value = String(value).replace(/"/g, '""');
        return `"${value}"`;
      });
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  // Configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Audit configuration updated', {
      config: this.config,
      category: 'audit'
    });
  }

  getConfig() {
    return { ...this.config };
  }

  getStats() {
    return {
      config: this.config,
      activeSessions: this.activeSessions.size,
      bufferSize: this.auditBuffer.length,
      auditFile: this.auditFile,
      sessionsFile: this.sessionsFile
    };
  }
}

module.exports = new AuditSystem();
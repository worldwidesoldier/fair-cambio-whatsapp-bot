const nodemailer = require('nodemailer');
const logger = require('./logger');
const analytics = require('./analytics');

class AlertSystem {
  constructor() {
    this.thresholds = {
      errorRate: 5, // Alert if error rate > 5%
      responseTime: 5000, // Alert if avg response time > 5s
      memoryUsage: 500, // Alert if memory usage > 500MB
      messageVolume: 1000, // Alert if daily messages > 1000
      inactivityPeriod: 30 * 60 * 1000, // Alert if no activity for 30 minutes
      connectionLost: true // Alert on connection loss
    };

    this.emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    this.recipients = {
      email: process.env.ALERT_EMAILS ? process.env.ALERT_EMAILS.split(',') : [],
      whatsapp: process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : []
    };

    this.alertHistory = [];
    this.suppressionPeriod = 15 * 60 * 1000; // 15 minutes between same alerts
    this.lastActivityTime = Date.now();
    this.whatsappBot = null;
    this.dashboardServer = null;

    this.setupEmailTransporter();
    this.startMonitoring();

    logger.info('Alert system initialized', {
      emailRecipients: this.recipients.email.length,
      whatsappRecipients: this.recipients.whatsapp.length,
      category: 'alerts'
    });
  }

  setWhatsAppBot(bot) {
    this.whatsappBot = bot;
  }

  setDashboardServer(dashboard) {
    this.dashboardServer = dashboard;
  }

  setupEmailTransporter() {
    if (this.emailConfig.auth.user && this.emailConfig.auth.pass) {
      this.emailTransporter = nodemailer.createTransporter(this.emailConfig);

      // Test email configuration
      this.emailTransporter.verify((error, success) => {
        if (error) {
          logger.error('Email configuration error', { error: error.message, category: 'alerts' });
        } else {
          logger.info('Email transporter configured successfully', { category: 'alerts' });
        }
      });
    } else {
      logger.warn('Email alerts disabled - missing SMTP configuration', { category: 'alerts' });
    }
  }

  startMonitoring() {
    // Monitor system health every 5 minutes
    setInterval(() => {
      this.checkSystemHealth();
    }, 5 * 60 * 1000);

    // Monitor activity every 10 minutes
    setInterval(() => {
      this.checkActivity();
    }, 10 * 60 * 1000);

    // Monitor message volume every hour
    setInterval(() => {
      this.checkMessageVolume();
    }, 60 * 60 * 1000);

    logger.info('Alert monitoring started', { category: 'alerts' });
  }

  async checkSystemHealth() {
    try {
      const health = analytics.getSystemHealth();

      // Check error rate
      if (health.errorRate > this.thresholds.errorRate) {
        await this.sendAlert({
          type: 'error',
          title: 'Alta Taxa de Erro',
          message: `Taxa de erro atual: ${health.errorRate.toFixed(1)}% (limite: ${this.thresholds.errorRate}%)`,
          data: { errorRate: health.errorRate },
          severity: 'high'
        });
      }

      // Check response time
      if (health.averageResponseTime > this.thresholds.responseTime) {
        await this.sendAlert({
          type: 'warning',
          title: 'Tempo de Resposta Alto',
          message: `Tempo médio de resposta: ${health.averageResponseTime}ms (limite: ${this.thresholds.responseTime}ms)`,
          data: { responseTime: health.averageResponseTime },
          severity: 'medium'
        });
      }

      // Check memory usage
      const memoryMB = Math.round(health.memory.heapUsed / 1024 / 1024);
      if (memoryMB > this.thresholds.memoryUsage) {
        await this.sendAlert({
          type: 'warning',
          title: 'Alto Uso de Memória',
          message: `Memória em uso: ${memoryMB}MB (limite: ${this.thresholds.memoryUsage}MB)`,
          data: { memoryUsage: memoryMB },
          severity: 'medium'
        });
      }

      // Log health check
      logger.debug('System health check completed', {
        errorRate: health.errorRate,
        responseTime: health.averageResponseTime,
        memoryMB,
        category: 'alerts'
      });

    } catch (error) {
      logger.error('Failed to check system health', { error: error.message, category: 'alerts' });
    }
  }

  async checkActivity() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    if (timeSinceLastActivity > this.thresholds.inactivityPeriod) {
      await this.sendAlert({
        type: 'warning',
        title: 'Bot Inativo',
        message: `Nenhuma atividade detectada há ${Math.round(timeSinceLastActivity / 60000)} minutos`,
        data: { inactivityPeriod: timeSinceLastActivity },
        severity: 'medium'
      });
    }
  }

  async checkMessageVolume() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayStats = analytics.getDailyStats(today);

      if (todayStats.messages > this.thresholds.messageVolume) {
        await this.sendAlert({
          type: 'info',
          title: 'Alto Volume de Mensagens',
          message: `Volume de mensagens hoje: ${todayStats.messages} (limite: ${this.thresholds.messageVolume})`,
          data: { messageVolume: todayStats.messages },
          severity: 'low'
        });
      }

    } catch (error) {
      logger.error('Failed to check message volume', { error: error.message, category: 'alerts' });
    }
  }

  updateActivity() {
    this.lastActivityTime = Date.now();
  }

  async sendAlert(alert) {
    try {
      // Check if this alert was recently sent
      if (this.isAlertSuppressed(alert)) {
        logger.debug('Alert suppressed (recently sent)', { alert: alert.title, category: 'alerts' });
        return;
      }

      // Add timestamp and ID
      alert.id = Date.now().toString();
      alert.timestamp = new Date().toISOString();

      // Log the alert
      logger.warn('Sending alert', { alert, category: 'alerts' });

      // Send to dashboard (real-time)
      if (this.dashboardServer) {
        this.dashboardServer.broadcastAlert(alert);
      }

      // Send WhatsApp alerts for high severity
      if (alert.severity === 'high' || alert.type === 'error') {
        await this.sendWhatsAppAlert(alert);
      }

      // Send email alerts
      await this.sendEmailAlert(alert);

      // Record alert in history
      this.alertHistory.push({
        ...alert,
        sentAt: new Date().toISOString()
      });

      // Keep only last 100 alerts
      if (this.alertHistory.length > 100) {
        this.alertHistory = this.alertHistory.slice(-100);
      }

      // Track alert in analytics
      analytics.trackAdminAction('system', 'alert_sent', alert);

    } catch (error) {
      logger.error('Failed to send alert', { error: error.message, alert, category: 'alerts' });
    }
  }

  isAlertSuppressed(alert) {
    const now = Date.now();
    const recentAlert = this.alertHistory.find(
      h => h.title === alert.title &&
           h.type === alert.type &&
           (now - new Date(h.sentAt).getTime()) < this.suppressionPeriod
    );

    return !!recentAlert;
  }

  async sendWhatsAppAlert(alert) {
    if (!this.whatsappBot || this.recipients.whatsapp.length === 0) {
      return;
    }

    try {
      const message = this.formatWhatsAppAlert(alert);

      for (const number of this.recipients.whatsapp) {
        const formattedNumber = number.trim() + '@s.whatsapp.net';
        await this.whatsappBot.sendMessage(formattedNumber, message);
      }

      logger.info('WhatsApp alert sent', { alert: alert.title, recipients: this.recipients.whatsapp.length, category: 'alerts' });

    } catch (error) {
      logger.error('Failed to send WhatsApp alert', { error: error.message, category: 'alerts' });
    }
  }

  async sendEmailAlert(alert) {
    if (!this.emailTransporter || this.recipients.email.length === 0) {
      return;
    }

    try {
      const subject = `[Fair Câmbio Bot] ${alert.title}`;
      const html = this.formatEmailAlert(alert);

      const mailOptions = {
        from: `"Fair Câmbio Bot" <${this.emailConfig.auth.user}>`,
        to: this.recipients.email.join(','),
        subject,
        html
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      logger.info('Email alert sent', { alert: alert.title, messageId: info.messageId, category: 'alerts' });

    } catch (error) {
      logger.error('Failed to send email alert', { error: error.message, category: 'alerts' });
    }
  }

  formatWhatsAppAlert(alert) {
    const severity = alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : 'ℹ️';
    const timestamp = new Date(alert.timestamp).toLocaleString('pt-BR');

    return `${severity} *ALERTA - Fair Câmbio Bot*

*${alert.title}*
${alert.message}

📅 ${timestamp}

_Esta é uma mensagem automática do sistema de monitoramento._`;
  }

  formatEmailAlert(alert) {
    const severityColor = {
      high: '#dc2626',
      medium: '#d97706',
      low: '#059669'
    };

    const color = severityColor[alert.severity] || '#6b7280';
    const timestamp = new Date(alert.timestamp).toLocaleString('pt-BR');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${alert.title}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .header { border-left: 4px solid ${color}; padding-left: 16px; margin-bottom: 24px; }
            .title { color: ${color}; font-size: 20px; font-weight: bold; margin: 0; }
            .message { color: #374151; font-size: 16px; line-height: 1.5; margin: 16px 0; }
            .metadata { background-color: #f3f4f6; padding: 16px; border-radius: 4px; margin-top: 16px; }
            .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="title">${alert.title}</h1>
            </div>

            <div class="message">
                ${alert.message}
            </div>

            <div class="metadata">
                <strong>Timestamp:</strong> ${timestamp}<br>
                <strong>Severidade:</strong> ${alert.severity}<br>
                <strong>Tipo:</strong> ${alert.type}
                ${alert.data ? `<br><strong>Dados:</strong> ${JSON.stringify(alert.data, null, 2)}` : ''}
            </div>

            <div class="footer">
                Esta é uma mensagem automática do sistema de monitoramento do Fair Câmbio Bot.<br>
                Para mais detalhes, acesse o dashboard de monitoramento.
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Manual alert methods
  async sendConnectionAlert(status, details = {}) {
    const title = status === 'connected' ? 'Bot Conectado' : 'Bot Desconectado';
    const type = status === 'connected' ? 'success' : 'error';
    const severity = status === 'connected' ? 'low' : 'high';

    await this.sendAlert({
      type,
      title,
      message: `Status da conexão WhatsApp: ${status}`,
      data: details,
      severity
    });
  }

  async sendErrorAlert(error, context = {}) {
    await this.sendAlert({
      type: 'error',
      title: 'Erro no Sistema',
      message: `Erro detectado: ${error.message || error}`,
      data: { error: error.message, context },
      severity: 'high'
    });
  }

  async sendCustomAlert(title, message, type = 'info', severity = 'low', data = {}) {
    await this.sendAlert({
      type,
      title,
      message,
      data,
      severity
    });
  }

  // Configuration methods
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Alert thresholds updated', { thresholds: this.thresholds, category: 'alerts' });
  }

  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  getAlertStats() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const lastHour = this.alertHistory.filter(
      alert => (now - new Date(alert.sentAt).getTime()) < oneHour
    );

    const lastDay = this.alertHistory.filter(
      alert => (now - new Date(alert.sentAt).getTime()) < oneDay
    );

    return {
      total: this.alertHistory.length,
      lastHour: lastHour.length,
      lastDay: lastDay.length,
      byType: this.alertHistory.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: this.alertHistory.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = new AlertSystem();
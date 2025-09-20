const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const logger = require('./logger');
const analytics = require('./analytics');
const alerts = require('./alerts');
const health = require('./health');
const backup = require('./backup');

class ReportingSystem {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
    this.templateDir = path.join(__dirname, '../../templates/reports');

    this.config = {
      dailyReportTime: process.env.DAILY_REPORT_TIME || '08:00',
      weeklyReportDay: process.env.WEEKLY_REPORT_DAY || '1', // Monday
      weeklyReportTime: process.env.WEEKLY_REPORT_TIME || '09:00',
      monthlyReportDate: process.env.MONTHLY_REPORT_DATE || '1',
      monthlyReportTime: process.env.MONTHLY_REPORT_TIME || '10:00',
      enableEmailReports: process.env.ENABLE_EMAIL_REPORTS === 'true',
      enableWhatsAppReports: process.env.ENABLE_WHATSAPP_REPORTS === 'true'
    };

    this.initialize();
  }

  async initialize() {
    try {
      await this.ensureDirectories();
      this.scheduleReports();

      logger.info('Reporting system initialized', {
        reportsDir: this.reportsDir,
        config: this.config,
        category: 'reports'
      });

    } catch (error) {
      logger.error('Failed to initialize reporting system', {
        error: error.message,
        category: 'reports'
      });
    }
  }

  async ensureDirectories() {
    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.mkdir(path.join(this.reportsDir, 'daily'), { recursive: true });
    await fs.mkdir(path.join(this.reportsDir, 'weekly'), { recursive: true });
    await fs.mkdir(path.join(this.reportsDir, 'monthly'), { recursive: true });
    await fs.mkdir(this.templateDir, { recursive: true });
  }

  scheduleReports() {
    // Daily report
    const dailyCron = this.timeToCron(this.config.dailyReportTime);
    cron.schedule(dailyCron, async () => {
      await this.generateDailyReport();
    });

    // Weekly report
    const weeklyCron = this.timeToCron(this.config.weeklyReportTime, this.config.weeklyReportDay);
    cron.schedule(weeklyCron, async () => {
      await this.generateWeeklyReport();
    });

    // Monthly report
    const monthlyCron = this.timeToCron(this.config.monthlyReportTime, null, this.config.monthlyReportDate);
    cron.schedule(monthlyCron, async () => {
      await this.generateMonthlyReport();
    });

    logger.info('Report schedules configured', {
      daily: dailyCron,
      weekly: weeklyCron,
      monthly: monthlyCron,
      category: 'reports'
    });
  }

  timeToCron(time, dayOfWeek = null, dayOfMonth = null) {
    const [hour, minute] = time.split(':').map(Number);

    if (dayOfMonth) {
      return `${minute} ${hour} ${dayOfMonth} * *`;
    } else if (dayOfWeek) {
      return `${minute} ${hour} * * ${dayOfWeek}`;
    } else {
      return `${minute} ${hour} * * *`;
    }
  }

  async generateDailyReport(date = null) {
    const reportDate = date || new Date().toISOString().split('T')[0];
    const startTime = Date.now();

    try {
      logger.info('Generating daily report', { date: reportDate, category: 'reports' });

      // Collect data
      const data = await this.collectDailyData(reportDate);

      // Generate report
      const report = await this.createDailyReport(data);

      // Save report
      const reportPath = await this.saveReport('daily', reportDate, report);

      // Send notifications
      if (this.config.enableEmailReports || this.config.enableWhatsAppReports) {
        await this.sendDailyReport(report, reportPath);
      }

      const duration = Date.now() - startTime;

      logger.info('Daily report generated successfully', {
        date: reportDate,
        duration,
        reportPath,
        category: 'reports'
      });

      // Track in analytics
      analytics.trackAdminAction('system', 'daily_report_generated', {
        date: reportDate,
        duration
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate daily report', {
        date: reportDate,
        error: error.message,
        category: 'reports'
      });
      throw error;
    }
  }

  async generateWeeklyReport(endDate = null) {
    const reportEndDate = endDate || new Date().toISOString().split('T')[0];
    const endDateObj = new Date(reportEndDate);
    const startDateObj = new Date(endDateObj.getTime() - 6 * 24 * 60 * 60 * 1000);
    const reportStartDate = startDateObj.toISOString().split('T')[0];

    const startTime = Date.now();

    try {
      logger.info('Generating weekly report', {
        startDate: reportStartDate,
        endDate: reportEndDate,
        category: 'reports'
      });

      // Collect data
      const data = await this.collectWeeklyData(reportStartDate, reportEndDate);

      // Generate report
      const report = await this.createWeeklyReport(data);

      // Save report
      const reportPath = await this.saveReport('weekly', `${reportStartDate}_to_${reportEndDate}`, report);

      // Send notifications
      if (this.config.enableEmailReports || this.config.enableWhatsAppReports) {
        await this.sendWeeklyReport(report, reportPath);
      }

      const duration = Date.now() - startTime;

      logger.info('Weekly report generated successfully', {
        startDate: reportStartDate,
        endDate: reportEndDate,
        duration,
        reportPath,
        category: 'reports'
      });

      // Track in analytics
      analytics.trackAdminAction('system', 'weekly_report_generated', {
        startDate: reportStartDate,
        endDate: reportEndDate,
        duration
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate weekly report', {
        startDate: reportStartDate,
        endDate: reportEndDate,
        error: error.message,
        category: 'reports'
      });
      throw error;
    }
  }

  async generateMonthlyReport(month = null, year = null) {
    const now = new Date();
    const reportMonth = month || now.getMonth() + 1;
    const reportYear = year || now.getFullYear();

    const startTime = Date.now();

    try {
      logger.info('Generating monthly report', {
        month: reportMonth,
        year: reportYear,
        category: 'reports'
      });

      // Collect data
      const data = await this.collectMonthlyData(reportMonth, reportYear);

      // Generate report
      const report = await this.createMonthlyReport(data);

      // Save report
      const reportPath = await this.saveReport('monthly', `${reportYear}-${reportMonth.toString().padStart(2, '0')}`, report);

      // Send notifications
      if (this.config.enableEmailReports || this.config.enableWhatsAppReports) {
        await this.sendMonthlyReport(report, reportPath);
      }

      const duration = Date.now() - startTime;

      logger.info('Monthly report generated successfully', {
        month: reportMonth,
        year: reportYear,
        duration,
        reportPath,
        category: 'reports'
      });

      // Track in analytics
      analytics.trackAdminAction('system', 'monthly_report_generated', {
        month: reportMonth,
        year: reportYear,
        duration
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate monthly report', {
        month: reportMonth,
        year: reportYear,
        error: error.message,
        category: 'reports'
      });
      throw error;
    }
  }

  async collectDailyData(date) {
    const data = {
      date,
      timestamp: new Date().toISOString(),
      analytics: analytics.getDailyStats(date),
      health: await health.getHealthSummary(),
      logs: await logger.getLogsSummary(date),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    // Get yesterday's data for comparison
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    data.comparison = {
      yesterday: analytics.getDailyStats(yesterdayStr)
    };

    return data;
  }

  async collectWeeklyData(startDate, endDate) {
    const weeklyData = analytics.getWeeklyReport();

    const data = {
      period: `${startDate} to ${endDate}`,
      timestamp: new Date().toISOString(),
      analytics: weeklyData,
      health: {
        summary: await health.getHealthSummary(),
        trends: health.getHealthTrends(7 * 24), // 7 days
        uptime: health.getUptimePercentage(7 * 24)
      },
      backup: await backup.getBackupStats(),
      alerts: alerts.getAlertStats()
    };

    // Daily breakdown for the week
    data.dailyBreakdown = [];
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      data.dailyBreakdown.push({
        date: dateStr,
        ...analytics.getDailyStats(dateStr)
      });
    }

    return data;
  }

  async collectMonthlyData(month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const data = {
      month,
      year,
      period: `${year}-${month.toString().padStart(2, '0')}`,
      timestamp: new Date().toISOString(),
      analytics: {
        totalMessages: 0,
        totalUsers: 0,
        totalConversations: 0,
        dailyBreakdown: []
      },
      health: {
        summary: await health.getHealthSummary(),
        trends: health.getHealthTrends(30 * 24), // 30 days
        uptime: health.getUptimePercentage(30 * 24)
      },
      backup: await backup.getBackupStats(),
      alerts: alerts.getAlertStats()
    };

    // Collect daily data for the month
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dailyStats = analytics.getDailyStats(dateStr);

      data.analytics.totalMessages += dailyStats.messages;
      data.analytics.totalUsers += dailyStats.users;
      data.analytics.totalConversations += dailyStats.conversations;

      data.analytics.dailyBreakdown.push({
        date: dateStr,
        ...dailyStats
      });
    }

    return data;
  }

  async createDailyReport(data) {
    const report = {
      type: 'daily',
      title: `Relatório Diário - ${this.formatDate(data.date)}`,
      date: data.date,
      timestamp: data.timestamp,
      summary: this.createDailySummary(data),
      sections: [
        this.createAnalyticsSection(data.analytics, data.comparison),
        this.createHealthSection(data.health),
        this.createLogsSection(data.logs),
        this.createSystemSection(data.system)
      ]
    };

    return report;
  }

  async createWeeklyReport(data) {
    const report = {
      type: 'weekly',
      title: `Relatório Semanal - ${data.period}`,
      period: data.period,
      timestamp: data.timestamp,
      summary: this.createWeeklySummary(data),
      sections: [
        this.createWeeklyAnalyticsSection(data.analytics),
        this.createHealthTrendsSection(data.health),
        this.createBackupSection(data.backup),
        this.createAlertsSection(data.alerts),
        this.createDailyBreakdownSection(data.dailyBreakdown)
      ]
    };

    return report;
  }

  async createMonthlyReport(data) {
    const report = {
      type: 'monthly',
      title: `Relatório Mensal - ${this.formatMonth(data.month, data.year)}`,
      month: data.month,
      year: data.year,
      timestamp: data.timestamp,
      summary: this.createMonthlySummary(data),
      sections: [
        this.createMonthlyAnalyticsSection(data.analytics),
        this.createHealthTrendsSection(data.health),
        this.createBackupSection(data.backup),
        this.createAlertsSection(data.alerts)
      ]
    };

    return report;
  }

  createDailySummary(data) {
    const yesterday = data.comparison.yesterday;
    const today = data.analytics;

    const messageChange = today.messages - yesterday.messages;
    const userChange = today.users - yesterday.users;

    return {
      messages: {
        total: today.messages,
        change: messageChange,
        trend: messageChange > 0 ? 'up' : messageChange < 0 ? 'down' : 'stable'
      },
      users: {
        total: today.users,
        change: userChange,
        trend: userChange > 0 ? 'up' : userChange < 0 ? 'down' : 'stable'
      },
      conversations: today.conversations,
      errors: today.errors,
      healthStatus: data.health.status
    };
  }

  createWeeklySummary(data) {
    return {
      totalMessages: data.analytics.totalMessages,
      totalUsers: data.analytics.totalUsers,
      totalConversations: data.analytics.totalConversations,
      avgDailyMessages: data.analytics.avgDailyMessages,
      healthUptime: data.health.uptime,
      alertsCount: data.alerts.lastDay,
      backupsCount: data.backup.byType.weekly || 0
    };
  }

  createMonthlySummary(data) {
    const avgDaily = Math.round(data.analytics.totalMessages / data.analytics.dailyBreakdown.length);

    return {
      totalMessages: data.analytics.totalMessages,
      totalUsers: data.analytics.totalUsers,
      totalConversations: data.analytics.totalConversations,
      avgDailyMessages: avgDaily,
      healthUptime: data.health.uptime,
      alertsCount: data.alerts.total,
      backupsCount: data.backup.total
    };
  }

  createAnalyticsSection(analytics, comparison) {
    return {
      title: 'Análise de Atividade',
      data: {
        messages: analytics.messages,
        users: analytics.users,
        conversations: analytics.conversations,
        errors: analytics.errors,
        comparison: {
          yesterday: comparison.yesterday,
          messageChange: analytics.messages - comparison.yesterday.messages,
          userChange: analytics.users - comparison.yesterday.users
        }
      }
    };
  }

  createWeeklyAnalyticsSection(analytics) {
    return {
      title: 'Análise Semanal',
      data: analytics
    };
  }

  createMonthlyAnalyticsSection(analytics) {
    return {
      title: 'Análise Mensal',
      data: analytics
    };
  }

  createHealthSection(healthData) {
    return {
      title: 'Saúde do Sistema',
      data: {
        status: healthData.status,
        message: healthData.message,
        uptime: healthData.uptime,
        timestamp: healthData.timestamp
      }
    };
  }

  createHealthTrendsSection(healthData) {
    return {
      title: 'Tendências de Saúde',
      data: {
        summary: healthData.summary,
        uptime: healthData.uptime,
        trends: healthData.trends
      }
    };
  }

  createLogsSection(logs) {
    return {
      title: 'Resumo de Logs',
      data: logs
    };
  }

  createSystemSection(system) {
    return {
      title: 'Sistema',
      data: {
        uptime: this.formatUptime(system.uptime),
        memory: Math.round(system.memory.heapUsed / 1024 / 1024) + ' MB',
        platform: system.platform,
        nodeVersion: system.nodeVersion
      }
    };
  }

  createBackupSection(backup) {
    return {
      title: 'Backups',
      data: backup
    };
  }

  createAlertsSection(alerts) {
    return {
      title: 'Alertas',
      data: alerts
    };
  }

  createDailyBreakdownSection(dailyBreakdown) {
    return {
      title: 'Detalhamento Diário',
      data: dailyBreakdown
    };
  }

  async saveReport(type, identifier, report) {
    const filename = `report-${type}-${identifier}.json`;
    const filepath = path.join(this.reportsDir, type, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    return filepath;
  }

  async sendDailyReport(report, reportPath) {
    try {
      const summary = report.summary;
      const title = `📊 Relatório Diário - ${this.formatDate(report.date)}`;

      const message = this.formatDailyReportMessage(report);

      if (this.config.enableWhatsAppReports) {
        await alerts.sendCustomAlert(title, message, 'info', 'low', { reportPath });
      }

      if (this.config.enableEmailReports) {
        // Email implementation would go here
        logger.info('Email report functionality not implemented yet', { category: 'reports' });
      }

    } catch (error) {
      logger.error('Failed to send daily report', {
        error: error.message,
        reportPath,
        category: 'reports'
      });
    }
  }

  async sendWeeklyReport(report, reportPath) {
    try {
      const title = `📈 Relatório Semanal - ${report.period}`;
      const message = this.formatWeeklyReportMessage(report);

      if (this.config.enableWhatsAppReports) {
        await alerts.sendCustomAlert(title, message, 'info', 'low', { reportPath });
      }

      if (this.config.enableEmailReports) {
        // Email implementation would go here
        logger.info('Email report functionality not implemented yet', { category: 'reports' });
      }

    } catch (error) {
      logger.error('Failed to send weekly report', {
        error: error.message,
        reportPath,
        category: 'reports'
      });
    }
  }

  async sendMonthlyReport(report, reportPath) {
    try {
      const title = `📅 Relatório Mensal - ${this.formatMonth(report.month, report.year)}`;
      const message = this.formatMonthlyReportMessage(report);

      if (this.config.enableWhatsAppReports) {
        await alerts.sendCustomAlert(title, message, 'info', 'low', { reportPath });
      }

      if (this.config.enableEmailReports) {
        // Email implementation would go here
        logger.info('Email report functionality not implemented yet', { category: 'reports' });
      }

    } catch (error) {
      logger.error('Failed to send monthly report', {
        error: error.message,
        reportPath,
        category: 'reports'
      });
    }
  }

  formatDailyReportMessage(report) {
    const s = report.summary;
    const trendIcon = (trend) => trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';

    return `*Resumo do Dia:*

💬 Mensagens: ${s.messages.total} ${trendIcon(s.messages.trend)} (${s.messages.change >= 0 ? '+' : ''}${s.messages.change})
👥 Usuários: ${s.users.total} ${trendIcon(s.users.trend)} (${s.users.change >= 0 ? '+' : ''}${s.users.change})
💭 Conversas: ${s.conversations}
❌ Erros: ${s.errors}

🔧 Status do Sistema: ${s.healthStatus === 'healthy' ? '✅ Saudável' : s.healthStatus === 'warning' ? '⚠️ Atenção' : '🚨 Problema'}

_Relatório gerado automaticamente às ${new Date(report.timestamp).toLocaleString('pt-BR')}_`;
  }

  formatWeeklyReportMessage(report) {
    const s = report.summary;

    return `*Resumo da Semana:*

📊 *Estatísticas Gerais:*
• Total de mensagens: ${s.totalMessages}
• Total de usuários: ${s.totalUsers}
• Total de conversas: ${s.totalConversations}
• Média diária: ${s.avgDailyMessages} mensagens

🔧 *Sistema:*
• Uptime: ${s.healthUptime}%
• Alertas: ${s.alertsCount}
• Backups: ${s.backupsCount}

_Relatório semanal gerado automaticamente_`;
  }

  formatMonthlyReportMessage(report) {
    const s = report.summary;

    return `*Resumo do Mês:*

📊 *Estatísticas Gerais:*
• Total de mensagens: ${s.totalMessages}
• Total de usuários: ${s.totalUsers}
• Total de conversas: ${s.totalConversations}
• Média diária: ${s.avgDailyMessages} mensagens

🔧 *Sistema:*
• Uptime: ${s.healthUptime}%
• Total de alertas: ${s.alertsCount}
• Total de backups: ${s.backupsCount}

_Relatório mensal gerado automaticamente_`;
  }

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  formatMonth(month, year) {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[month - 1]} ${year}`;
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

  // Public API methods
  async getReportsList(type = null, limit = 50) {
    try {
      const reports = [];
      const types = type ? [type] : ['daily', 'weekly', 'monthly'];

      for (const reportType of types) {
        const typeDir = path.join(this.reportsDir, reportType);
        try {
          const files = await fs.readdir(typeDir);
          const jsonFiles = files.filter(file => file.endsWith('.json'));

          for (const file of jsonFiles) {
            const filePath = path.join(typeDir, file);
            const stats = await fs.stat(filePath);
            reports.push({
              type: reportType,
              filename: file,
              path: filePath,
              created: stats.birthtime.toISOString(),
              size: stats.size
            });
          }
        } catch (error) {
          // Directory might not exist
        }
      }

      // Sort by creation date (newest first) and limit
      return reports
        .sort((a, b) => new Date(b.created) - new Date(a.created))
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to get reports list', { error: error.message, category: 'reports' });
      return [];
    }
  }

  async getReport(filename) {
    try {
      // Find the report file
      const types = ['daily', 'weekly', 'monthly'];
      for (const type of types) {
        const filePath = path.join(this.reportsDir, type, filename);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          return JSON.parse(content);
        } catch (error) {
          // File not found in this type directory
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get report', { filename, error: error.message, category: 'reports' });
      return null;
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Reporting configuration updated', { config: this.config, category: 'reports' });
  }

  getConfig() {
    return { ...this.config };
  }
}

module.exports = new ReportingSystem();
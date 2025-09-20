const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class Analytics {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data/analytics');
    this.metricsFile = path.join(this.dataDir, 'metrics.json');
    this.conversationsFile = path.join(this.dataDir, 'conversations.json');
    this.usageFile = path.join(this.dataDir, 'usage.json');

    this.metrics = {
      totalMessages: 0,
      totalUsers: 0,
      totalConversations: 0,
      botUptime: 0,
      averageResponseTime: 0,
      topCommands: {},
      hourlyActivity: {},
      dailyActivity: {},
      userRetention: {},
      errorRate: 0,
      lastUpdated: new Date().toISOString()
    };

    this.conversations = {};
    this.usage = {};

    this.initializeAnalytics();
  }

  async initializeAnalytics() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.loadData();

      // Start periodic data saving
      setInterval(() => this.saveData(), 60000); // Save every minute

      logger.info('Analytics system initialized', { category: 'analytics' });
    } catch (error) {
      logger.error('Failed to initialize analytics', { error: error.message, category: 'analytics' });
    }
  }

  async loadData() {
    try {
      // Load metrics
      try {
        const metricsData = await fs.readFile(this.metricsFile, 'utf8');
        this.metrics = { ...this.metrics, ...JSON.parse(metricsData) };
      } catch (error) {
        // File doesn't exist, use defaults
      }

      // Load conversations
      try {
        const conversationsData = await fs.readFile(this.conversationsFile, 'utf8');
        this.conversations = JSON.parse(conversationsData);
      } catch (error) {
        // File doesn't exist, use defaults
      }

      // Load usage
      try {
        const usageData = await fs.readFile(this.usageFile, 'utf8');
        this.usage = JSON.parse(usageData);
      } catch (error) {
        // File doesn't exist, use defaults
      }

      logger.info('Analytics data loaded successfully', { category: 'analytics' });
    } catch (error) {
      logger.error('Failed to load analytics data', { error: error.message, category: 'analytics' });
    }
  }

  async saveData() {
    try {
      this.metrics.lastUpdated = new Date().toISOString();

      await fs.writeFile(this.metricsFile, JSON.stringify(this.metrics, null, 2));
      await fs.writeFile(this.conversationsFile, JSON.stringify(this.conversations, null, 2));
      await fs.writeFile(this.usageFile, JSON.stringify(this.usage, null, 2));

      logger.trace('Analytics data saved', { category: 'analytics' });
    } catch (error) {
      logger.error('Failed to save analytics data', { error: error.message, category: 'analytics' });
    }
  }

  // Message tracking
  trackMessage(from, message, type = 'received') {
    const userId = from.split('@')[0];
    const timestamp = new Date();
    const hour = timestamp.getHours();
    const date = timestamp.toISOString().split('T')[0];

    // Update total messages
    this.metrics.totalMessages++;

    // Track hourly activity
    this.metrics.hourlyActivity[hour] = (this.metrics.hourlyActivity[hour] || 0) + 1;

    // Track daily activity
    this.metrics.dailyActivity[date] = (this.metrics.dailyActivity[date] || 0) + 1;

    // Track user
    if (!this.conversations[userId]) {
      this.conversations[userId] = {
        firstContact: timestamp.toISOString(),
        lastContact: timestamp.toISOString(),
        totalMessages: 0,
        sessions: []
      };
      this.metrics.totalUsers++;
    }

    this.conversations[userId].lastContact = timestamp.toISOString();
    this.conversations[userId].totalMessages++;

    // Track commands
    if (message.startsWith('/') || message.match(/^\d+$/)) {
      const command = message.toLowerCase();
      this.metrics.topCommands[command] = (this.metrics.topCommands[command] || 0) + 1;
    }

    // Track session
    this.trackSession(userId, timestamp);

    logger.trace('Message tracked', {
      userId,
      type,
      message: message.substring(0, 50),
      category: 'analytics'
    });
  }

  trackSession(userId, timestamp) {
    const user = this.conversations[userId];
    if (!user.sessions || user.sessions.length === 0) {
      user.sessions = [{
        start: timestamp.toISOString(),
        end: timestamp.toISOString(),
        messageCount: 1
      }];
      this.metrics.totalConversations++;
      return;
    }

    const lastSession = user.sessions[user.sessions.length - 1];
    const lastTime = new Date(lastSession.end);
    const timeDiff = (timestamp - lastTime) / 1000 / 60; // minutes

    // If last message was more than 30 minutes ago, start new session
    if (timeDiff > 30) {
      user.sessions.push({
        start: timestamp.toISOString(),
        end: timestamp.toISOString(),
        messageCount: 1
      });
      this.metrics.totalConversations++;
    } else {
      // Continue current session
      lastSession.end = timestamp.toISOString();
      lastSession.messageCount++;
    }
  }

  // Connection tracking
  trackConnection(event, details = {}) {
    const timestamp = new Date().toISOString();

    if (!this.usage.connections) {
      this.usage.connections = [];
    }

    this.usage.connections.push({
      timestamp,
      event,
      details
    });

    if (event === 'connected') {
      this.usage.lastConnected = timestamp;
    }

    // Keep only last 1000 connection events
    if (this.usage.connections.length > 1000) {
      this.usage.connections = this.usage.connections.slice(-1000);
    }

    logger.info('Connection tracked', { event, details, category: 'analytics' });
  }

  // Error tracking
  trackError(error, context = {}) {
    const timestamp = new Date().toISOString();

    if (!this.usage.errors) {
      this.usage.errors = [];
    }

    this.usage.errors.push({
      timestamp,
      error: error.message || error,
      stack: error.stack,
      context
    });

    // Update error rate
    const today = timestamp.split('T')[0];
    const todayMessages = this.metrics.dailyActivity[today] || 1;
    const todayErrors = this.usage.errors.filter(e => e.timestamp.startsWith(today)).length;
    this.metrics.errorRate = (todayErrors / todayMessages) * 100;

    // Keep only last 500 errors
    if (this.usage.errors.length > 500) {
      this.usage.errors = this.usage.errors.slice(-500);
    }

    logger.error('Error tracked', { error: error.message, context, category: 'analytics' });
  }

  // Admin action tracking
  trackAdminAction(admin, action, details = {}) {
    const timestamp = new Date().toISOString();

    if (!this.usage.adminActions) {
      this.usage.adminActions = [];
    }

    this.usage.adminActions.push({
      timestamp,
      admin,
      action,
      details
    });

    // Keep only last 1000 admin actions
    if (this.usage.adminActions.length > 1000) {
      this.usage.adminActions = this.usage.adminActions.slice(-1000);
    }

    logger.info('Admin action tracked', { admin, action, details, category: 'analytics' });
  }

  // Response time tracking
  trackResponseTime(duration) {
    if (!this.usage.responseTimes) {
      this.usage.responseTimes = [];
    }

    this.usage.responseTimes.push({
      timestamp: new Date().toISOString(),
      duration
    });

    // Calculate average response time
    const recentTimes = this.usage.responseTimes.slice(-100); // Last 100 responses
    const avgTime = recentTimes.reduce((sum, time) => sum + time.duration, 0) / recentTimes.length;
    this.metrics.averageResponseTime = Math.round(avgTime);

    // Keep only last 1000 response times
    if (this.usage.responseTimes.length > 1000) {
      this.usage.responseTimes = this.usage.responseTimes.slice(-1000);
    }
  }

  // Analytics getters
  getMetrics() {
    return { ...this.metrics };
  }

  getDailyStats(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const dailyMessages = this.metrics.dailyActivity[targetDate] || 0;
    const dailyUsers = Object.values(this.conversations).filter(
      user => user.lastContact.startsWith(targetDate)
    ).length;

    const dailyConversations = Object.values(this.conversations).reduce((count, user) => {
      return count + (user.sessions?.filter(session =>
        session.start.startsWith(targetDate)
      ).length || 0);
    }, 0);

    return {
      date: targetDate,
      messages: dailyMessages,
      users: dailyUsers,
      conversations: dailyConversations,
      errors: this.usage.errors?.filter(e => e.timestamp.startsWith(targetDate)).length || 0
    };
  }

  getHourlyActivity() {
    return { ...this.metrics.hourlyActivity };
  }

  getTopCommands(limit = 10) {
    return Object.entries(this.metrics.topCommands)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
  }

  getUserStats(userId) {
    return this.conversations[userId] || null;
  }

  getActiveUsers(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return Object.entries(this.conversations)
      .filter(([, user]) => user.lastContact > cutoff)
      .length;
  }

  getSystemHealth() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      activeUsers: this.getActiveUsers(),
      todayStats: this.getDailyStats(today),
      errorRate: this.metrics.errorRate,
      averageResponseTime: this.metrics.averageResponseTime,
      lastUpdated: this.metrics.lastUpdated
    };
  }

  // Weekly/Monthly reports
  getWeeklyReport() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weeklyStats = {
      period: `${weekAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      totalMessages: 0,
      totalUsers: 0,
      totalConversations: 0,
      avgDailyMessages: 0,
      topCommands: {},
      dailyBreakdown: {}
    };

    // Calculate weekly stats
    for (let d = new Date(weekAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayStats = this.getDailyStats(dateStr);

      weeklyStats.totalMessages += dayStats.messages;
      weeklyStats.totalUsers += dayStats.users;
      weeklyStats.totalConversations += dayStats.conversations;
      weeklyStats.dailyBreakdown[dateStr] = dayStats;
    }

    weeklyStats.avgDailyMessages = Math.round(weeklyStats.totalMessages / 7);

    return weeklyStats;
  }

  // Clean old data
  async cleanOldData(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Clean old daily activity
    Object.keys(this.metrics.dailyActivity).forEach(date => {
      if (new Date(date) < cutoffDate) {
        delete this.metrics.dailyActivity[date];
      }
    });

    // Clean old errors
    if (this.usage.errors) {
      this.usage.errors = this.usage.errors.filter(
        error => new Date(error.timestamp) > cutoffDate
      );
    }

    // Clean old connections
    if (this.usage.connections) {
      this.usage.connections = this.usage.connections.filter(
        conn => new Date(conn.timestamp) > cutoffDate
      );
    }

    await this.saveData();
    logger.info('Old analytics data cleaned', { daysToKeep, category: 'analytics' });
  }
}

module.exports = new Analytics();
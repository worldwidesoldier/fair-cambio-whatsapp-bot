const { asyncHandler } = require('../middleware/error');
const fs = require('fs').promises;
const path = require('path');
const DashboardServer = require('../server');

class StatsManager {
    constructor() {
        this.logsPath = path.join(__dirname, '../../../logs');
        this.ratesHistoryPath = path.join(__dirname, '../../../logs/rates-history.json');
    }

    async getConversationStats(period = '7d') {
        const days = this.getPeriodDays(period);
        const stats = {
            period,
            totalConversations: 0,
            totalMessages: 0,
            uniqueUsers: new Set(),
            dailyStats: [],
            topUsers: [],
            hourlyDistribution: new Array(24).fill(0),
            averageResponseTime: 0
        };

        const today = new Date();

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            try {
                const logPath = path.join(this.logsPath, `chat-${dateStr}.json`);
                const logData = await fs.readFile(logPath, 'utf8');
                const logs = JSON.parse(logData);

                const dayStats = {
                    date: dateStr,
                    conversations: 0,
                    messages: logs.length,
                    uniqueUsers: new Set(),
                    averageMessageLength: 0
                };

                logs.forEach(log => {
                    stats.uniqueUsers.add(log.from);
                    dayStats.uniqueUsers.add(log.from);

                    // Track hourly distribution
                    const hour = new Date(log.timestamp).getHours();
                    stats.hourlyDistribution[hour]++;

                    // Track message length
                    dayStats.averageMessageLength += log.message.length;
                });

                dayStats.conversations = dayStats.uniqueUsers.size;
                dayStats.uniqueUsers = dayStats.uniqueUsers.size;
                dayStats.averageMessageLength = logs.length > 0
                    ? Math.round(dayStats.averageMessageLength / logs.length)
                    : 0;

                stats.totalConversations += dayStats.conversations;
                stats.totalMessages += dayStats.messages;
                stats.dailyStats.unshift(dayStats);

            } catch (error) {
                // No data for this day
                stats.dailyStats.unshift({
                    date: dateStr,
                    conversations: 0,
                    messages: 0,
                    uniqueUsers: 0,
                    averageMessageLength: 0
                });
            }
        }

        // Calculate top users
        stats.topUsers = await this.getTopUsers(days);
        stats.uniqueUsers = stats.uniqueUsers.size;

        return stats;
    }

    async getTopUsers(days = 7) {
        const userStats = new Map();
        const today = new Date();

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            try {
                const logPath = path.join(this.logsPath, `chat-${dateStr}.json`);
                const logData = await fs.readFile(logPath, 'utf8');
                const logs = JSON.parse(logData);

                logs.forEach(log => {
                    const userId = log.from;
                    if (!userStats.has(userId)) {
                        userStats.set(userId, {
                            userId,
                            name: log.name,
                            messageCount: 0,
                            lastMessage: log.timestamp,
                            averageMessageLength: 0,
                            totalLength: 0
                        });
                    }

                    const user = userStats.get(userId);
                    user.messageCount++;
                    user.totalLength += log.message.length;
                    user.averageMessageLength = Math.round(user.totalLength / user.messageCount);

                    if (new Date(log.timestamp) > new Date(user.lastMessage)) {
                        user.lastMessage = log.timestamp;
                    }
                });
            } catch (error) {
                // No data for this day
            }
        }

        return Array.from(userStats.values())
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, 10);
    }

    async getUserStats() {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        const lastMonth = new Date(today);
        lastMonth.setDate(lastMonth.getDate() - 30);

        const stats = {
            active: {
                today: new Set(),
                week: new Set(),
                month: new Set()
            },
            new: {
                today: new Set(),
                week: new Set(),
                month: new Set()
            },
            returning: new Set(),
            totalInteractions: 0
        };

        // Get all chat logs
        const files = await fs.readdir(this.logsPath);
        const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));

        for (const file of chatFiles) {
            const dateStr = file.replace('chat-', '').replace('.json', '');
            const fileDate = new Date(dateStr);

            try {
                const logPath = path.join(this.logsPath, file);
                const logData = await fs.readFile(logPath, 'utf8');
                const logs = JSON.parse(logData);

                logs.forEach(log => {
                    const userId = log.from;
                    stats.totalInteractions++;

                    // Check if user is active in different periods
                    if (fileDate >= today.setHours(0, 0, 0, 0)) {
                        stats.active.today.add(userId);
                    }
                    if (fileDate >= lastWeek) {
                        stats.active.week.add(userId);
                    }
                    if (fileDate >= lastMonth) {
                        stats.active.month.add(userId);
                    }
                });
            } catch (error) {
                console.error(`Error reading ${file}:`, error);
            }
        }

        // Convert sets to sizes
        stats.active.today = stats.active.today.size;
        stats.active.week = stats.active.week.size;
        stats.active.month = stats.active.month.size;

        return stats;
    }

    async getRatesStats() {
        try {
            const historyData = await fs.readFile(this.ratesHistoryPath, 'utf8');
            const history = JSON.parse(historyData);

            const stats = {
                totalUpdates: history.length,
                currencies: {},
                recentChanges: history.slice(-10),
                volatility: {},
                updateFrequency: {}
            };

            // Group by currency
            history.forEach(record => {
                if (!stats.currencies[record.currency]) {
                    stats.currencies[record.currency] = {
                        updates: 0,
                        averageChange: 0,
                        totalChange: 0,
                        lastUpdate: record.timestamp,
                        volatility: []
                    };
                }

                const currency = stats.currencies[record.currency];
                currency.updates++;
                currency.totalChange += parseFloat(record.change);
                currency.volatility.push(Math.abs(parseFloat(record.change)));
                currency.lastUpdate = record.timestamp;
            });

            // Calculate average changes and volatility
            Object.keys(stats.currencies).forEach(currency => {
                const data = stats.currencies[currency];
                data.averageChange = (data.totalChange / data.updates).toFixed(2);

                // Calculate volatility (standard deviation of changes)
                const mean = data.volatility.reduce((a, b) => a + b, 0) / data.volatility.length;
                const variance = data.volatility.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.volatility.length;
                data.volatility = Math.sqrt(variance).toFixed(2);
            });

            return stats;
        } catch (error) {
            return {
                totalUpdates: 0,
                currencies: {},
                recentChanges: [],
                volatility: {},
                updateFrequency: {}
            };
        }
    }

    async getAnalytics(period = '30d') {
        const conversationStats = await this.getConversationStats(period);
        const userStats = await this.getUserStats();
        const ratesStats = await this.getRatesStats();

        return {
            period,
            conversations: conversationStats,
            users: userStats,
            rates: ratesStats,
            generatedAt: new Date().toISOString()
        };
    }

    async generateReport(type = 'weekly') {
        const period = type === 'daily' ? '1d' : type === 'weekly' ? '7d' : '30d';
        const analytics = await this.getAnalytics(period);

        const report = {
            type,
            period,
            generatedAt: new Date().toISOString(),
            summary: {
                totalConversations: analytics.conversations.totalConversations,
                totalMessages: analytics.conversations.totalMessages,
                uniqueUsers: analytics.conversations.uniqueUsers,
                rateUpdates: analytics.rates.totalUpdates,
                averageMessagesPerDay: Math.round(analytics.conversations.totalMessages / this.getPeriodDays(period))
            },
            insights: [],
            recommendations: []
        };

        // Generate insights
        if (analytics.conversations.totalConversations > 0) {
            const avgMessagesPerConversation = Math.round(analytics.conversations.totalMessages / analytics.conversations.totalConversations);

            report.insights.push({
                type: 'conversation_efficiency',
                title: 'Eficiência das Conversas',
                value: avgMessagesPerConversation,
                description: `Em média, cada conversa tem ${avgMessagesPerConversation} mensagens`
            });
        }

        // Peak hours analysis
        const peakHour = analytics.conversations.hourlyDistribution.indexOf(Math.max(...analytics.conversations.hourlyDistribution));
        report.insights.push({
            type: 'peak_hours',
            title: 'Horário de Pico',
            value: `${peakHour}:00`,
            description: `Maior volume de mensagens às ${peakHour}:00`
        });

        // Generate recommendations
        if (analytics.conversations.totalConversations < 10) {
            report.recommendations.push({
                type: 'engagement',
                priority: 'high',
                title: 'Aumentar Engajamento',
                description: 'Considere implementar campanhas para aumentar o número de conversas'
            });
        }

        if (analytics.rates.totalUpdates === 0) {
            report.recommendations.push({
                type: 'rates',
                priority: 'medium',
                title: 'Atualizações de Taxa',
                description: 'Considere implementar atualizações automáticas de taxas'
            });
        }

        return report;
    }

    getPeriodDays(period) {
        switch (period) {
            case '1d': return 1;
            case '7d': return 7;
            case '30d': return 30;
            case '90d': return 90;
            default: return 7;
        }
    }
}

const statsManager = new StatsManager();

const StatsController = {
    getConversations: asyncHandler(async (req, res) => {
        const period = req.query.period || '7d';
        const stats = await statsManager.getConversationStats(period);

        res.json(stats);
    }),

    getUsers: asyncHandler(async (req, res) => {
        const stats = await statsManager.getUserStats();

        res.json(stats);
    }),

    getAnalytics: asyncHandler(async (req, res) => {
        const period = req.query.period || '30d';
        const analytics = await statsManager.getAnalytics(period);

        res.json(analytics);
    }),

    getReports: asyncHandler(async (req, res) => {
        const type = req.query.type || 'weekly';
        const report = await statsManager.generateReport(type);

        res.json(report);
    }),

    getTopUsers: asyncHandler(async (req, res) => {
        const days = parseInt(req.query.days) || 7;
        const topUsers = await statsManager.getTopUsers(days);

        res.json({
            period: `${days}d`,
            users: topUsers,
            generatedAt: new Date().toISOString()
        });
    }),

    getRatesStatistics: asyncHandler(async (req, res) => {
        const stats = await statsManager.getRatesStats();

        res.json(stats);
    }),

    getHourlyDistribution: asyncHandler(async (req, res) => {
        const period = req.query.period || '7d';
        const stats = await statsManager.getConversationStats(period);

        res.json({
            period,
            distribution: stats.hourlyDistribution,
            generatedAt: new Date().toISOString()
        });
    }),

    exportData: asyncHandler(async (req, res) => {
        const { type, period, format } = req.query;

        let data;
        switch (type) {
            case 'conversations':
                data = await statsManager.getConversationStats(period || '30d');
                break;
            case 'users':
                data = await statsManager.getUserStats();
                break;
            case 'rates':
                data = await statsManager.getRatesStats();
                break;
            default:
                data = await statsManager.getAnalytics(period || '30d');
        }

        if (format === 'csv') {
            // Convert to CSV format
            const csv = jsonToCsv(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${type}-${period || '30d'}.csv"`);
            res.send(csv);
        } else {
            // Default JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${type}-${period || '30d'}.json"`);
            res.json(data);
        }
    }),

    getRealTimeStats: asyncHandler(async (req, res) => {
        // Get real-time statistics
        const today = new Date().toISOString().split('T')[0];

        try {
            const logPath = path.join(statsManager.logsPath, `chat-${today}.json`);
            const logData = await fs.readFile(logPath, 'utf8');
            const logs = JSON.parse(logData);

            const realTimeStats = {
                timestamp: new Date().toISOString(),
                today: {
                    messages: logs.length,
                    conversations: new Set(logs.map(log => log.from)).size,
                    lastMessage: logs.length > 0 ? logs[logs.length - 1].timestamp : null
                },
                lastHour: {
                    messages: 0,
                    conversations: new Set()
                }
            };

            // Count messages from last hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            logs.forEach(log => {
                if (new Date(log.timestamp) > oneHourAgo) {
                    realTimeStats.lastHour.messages++;
                    realTimeStats.lastHour.conversations.add(log.from);
                }
            });

            realTimeStats.lastHour.conversations = realTimeStats.lastHour.conversations.size;

            res.json(realTimeStats);
        } catch (error) {
            res.json({
                timestamp: new Date().toISOString(),
                today: { messages: 0, conversations: 0, lastMessage: null },
                lastHour: { messages: 0, conversations: 0 }
            });
        }
    })
};

// Helper function to convert JSON to CSV
function jsonToCsv(data) {
    if (!data || typeof data !== 'object') {
        return '';
    }

    const flattenObject = (obj, prefix = '') => {
        const flattened = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}_${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    Object.assign(flattened, flattenObject(obj[key], newKey));
                } else {
                    flattened[newKey] = obj[key];
                }
            }
        }
        return flattened;
    };

    const flattened = flattenObject(data);
    const headers = Object.keys(flattened);
    const values = Object.values(flattened);

    return headers.join(',') + '\n' + values.join(',');
}

module.exports = StatsController;
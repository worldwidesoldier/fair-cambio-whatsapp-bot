const { asyncHandler } = require('../middleware/error');
const fs = require('fs').promises;
const path = require('path');
const branchesConfig = require('../../config/branches');

const DashboardController = {
    getOverview: asyncHandler(async (req, res) => {
        try {
            // Get conversations count for today
            const today = new Date().toISOString().split('T')[0];
            const conversationsToday = await getConversationsToday(today);

            // Get active users count
            const activeUsers = await getActiveUsersCount();

            // Get branches status
            const branchesStatus = await getBranchesStatus();

            // Get last rate update
            const lastRateUpdate = await getLastRateUpdate();

            // Recent activity
            const recentActivity = await getRecentActivity();

            res.json({
                conversationsToday,
                activeUsers,
                branchesOnline: branchesStatus.online,
                totalBranches: branchesStatus.total,
                lastRateUpdate,
                recentActivity
            });
        } catch (error) {
            console.error('Error getting overview:', error);
            res.status(500).json({ error: 'Erro ao obter dados do dashboard' });
        }
    }),

    getSystemStatus: asyncHandler(async (req, res) => {
        const systemStatus = [
            {
                name: 'WhatsApp Bot',
                status: 'online', // You would check the actual bot status here
                lastCheck: new Date().toISOString()
            },
            {
                name: 'Dashboard API',
                status: 'online',
                lastCheck: new Date().toISOString()
            },
            {
                name: 'Database',
                status: 'online', // You would check database connectivity here
                lastCheck: new Date().toISOString()
            },
            {
                name: 'File System',
                status: await checkFileSystemHealth() ? 'online' : 'offline',
                lastCheck: new Date().toISOString()
            }
        ];

        res.json(systemStatus);
    }),

    getMetrics: asyncHandler(async (req, res) => {
        const period = req.query.period || '24h';

        try {
            const metrics = await getMetricsForPeriod(period);
            res.json(metrics);
        } catch (error) {
            console.error('Error getting metrics:', error);
            res.status(500).json({ error: 'Erro ao obter métricas' });
        }
    }),

    getHealth: asyncHandler(async (req, res) => {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version,
            services: {
                dashboard: true,
                bot: await checkBotHealth(),
                fileSystem: await checkFileSystemHealth()
            }
        };

        const allServicesHealthy = Object.values(health.services).every(status => status);
        health.status = allServicesHealthy ? 'healthy' : 'degraded';

        res.json(health);
    })
};

// Helper functions
async function getConversationsToday(date) {
    try {
        const logPath = path.join(__dirname, '../../../logs', `chat-${date}.json`);
        const logData = await fs.readFile(logPath, 'utf8');
        const logs = JSON.parse(logData);

        // Count unique conversations (unique phone numbers)
        const uniqueUsers = new Set(logs.map(log => log.from));
        return uniqueUsers.size;
    } catch (error) {
        return 0;
    }
}

async function getActiveUsersCount() {
    try {
        // Get logs from the last 7 days
        const activeUsers = new Set();
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            try {
                const logPath = path.join(__dirname, '../../../logs', `chat-${dateStr}.json`);
                const logData = await fs.readFile(logPath, 'utf8');
                const logs = JSON.parse(logData);

                logs.forEach(log => activeUsers.add(log.from));
            } catch {
                // File doesn't exist for this date
            }
        }

        return activeUsers.size;
    } catch (error) {
        return 0;
    }
}

async function getBranchesStatus() {
    const branches = branchesConfig.branches;
    const online = branches.filter(b => b.active).length;
    const total = branches.length;

    return { online, total };
}

async function getLastRateUpdate() {
    try {
        const ratesPath = path.join(__dirname, '../../config/rates.json');
        const ratesData = await fs.readFile(ratesPath, 'utf8');
        const rates = JSON.parse(ratesData);

        return rates.lastUpdate;
    } catch (error) {
        return null;
    }
}

async function getRecentActivity() {
    try {
        const activities = [];

        // Get recent rate changes
        const historyPath = path.join(__dirname, '../../../logs/rates-history.json');
        try {
            const historyData = await fs.readFile(historyPath, 'utf8');
            const history = JSON.parse(historyData);

            history.slice(-5).forEach(record => {
                activities.push({
                    type: 'rate_update',
                    timestamp: record.timestamp,
                    description: `Taxa ${record.currency} ${record.type} atualizada: ${record.oldValue} → ${record.newValue}`,
                    icon: 'fas fa-coins'
                });
            });
        } catch {
            // No history file
        }

        // Get recent chat activity
        const today = new Date().toISOString().split('T')[0];
        try {
            const logPath = path.join(__dirname, '../../../logs', `chat-${today}.json`);
            const logData = await fs.readFile(logPath, 'utf8');
            const logs = JSON.parse(logData);

            logs.slice(-3).forEach(log => {
                activities.push({
                    type: 'conversation',
                    timestamp: log.timestamp,
                    description: `Nova conversa com ${log.name}`,
                    icon: 'fas fa-comments'
                });
            });
        } catch {
            // No chat logs for today
        }

        // Sort by timestamp (most recent first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return activities.slice(0, 10);
    } catch (error) {
        return [];
    }
}

async function checkFileSystemHealth() {
    try {
        // Check if we can read/write to important directories
        const testDirs = [
            path.join(__dirname, '../../../logs'),
            path.join(__dirname, '../../config'),
            path.join(__dirname, '../../../sessions')
        ];

        for (const dir of testDirs) {
            await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK);
        }

        return true;
    } catch (error) {
        return false;
    }
}

async function checkBotHealth() {
    // In a real implementation, you would check if the WhatsApp bot is connected
    // For now, we'll just return true
    return true;
}

async function getMetricsForPeriod(period) {
    const metrics = {
        period,
        conversations: {
            total: 0,
            byDay: []
        },
        users: {
            new: 0,
            active: 0
        },
        rates: {
            updates: 0,
            byDay: []
        }
    };

    try {
        const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
        const today = new Date();

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            // Get conversation metrics for this day
            try {
                const logPath = path.join(__dirname, '../../../logs', `chat-${dateStr}.json`);
                const logData = await fs.readFile(logPath, 'utf8');
                const logs = JSON.parse(logData);

                const dayConversations = logs.length;
                const uniqueUsers = new Set(logs.map(log => log.from)).size;

                metrics.conversations.total += dayConversations;
                metrics.conversations.byDay.unshift({
                    date: dateStr,
                    count: dayConversations,
                    users: uniqueUsers
                });
            } catch {
                metrics.conversations.byDay.unshift({
                    date: dateStr,
                    count: 0,
                    users: 0
                });
            }
        }

        // Get rate update metrics
        try {
            const historyPath = path.join(__dirname, '../../../logs/rates-history.json');
            const historyData = await fs.readFile(historyPath, 'utf8');
            const history = JSON.parse(historyData);

            const periodStart = new Date(today);
            periodStart.setDate(periodStart.getDate() - days);

            const periodUpdates = history.filter(record =>
                new Date(record.timestamp) >= periodStart
            );

            metrics.rates.updates = periodUpdates.length;

            // Group by day
            const updatesByDay = {};
            periodUpdates.forEach(record => {
                const date = record.timestamp.split('T')[0];
                updatesByDay[date] = (updatesByDay[date] || 0) + 1;
            });

            metrics.rates.byDay = Object.entries(updatesByDay).map(([date, count]) => ({
                date,
                count
            }));
        } catch {
            // No rate history
        }

        return metrics;
    } catch (error) {
        console.error('Error getting metrics:', error);
        return metrics;
    }
}

module.exports = DashboardController;
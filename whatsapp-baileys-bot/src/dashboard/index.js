require('dotenv').config();
const DashboardServer = require('./server');
const BroadcastController = require('./controllers/broadcast');

class DashboardApp {
    constructor() {
        this.dashboardServer = new DashboardServer();
        this.botInstance = null;
    }

    // Method to integrate with WhatsApp bot
    setBotInstance(botInstance) {
        this.botInstance = botInstance;
        BroadcastController.setBotInstance(botInstance);
        console.log('✅ Bot instance connected to dashboard');
    }

    // Start the dashboard server
    start() {
        this.dashboardServer.start();
        return this.dashboardServer;
    }

    // Stop the dashboard server
    stop() {
        this.dashboardServer.stop();
    }

    // Get dashboard server instance
    getServer() {
        return this.dashboardServer;
    }

    // Send real-time notification to dashboard users
    notify(notification) {
        DashboardServer.notifyUsers(notification);
    }

    // Broadcast real-time update
    broadcastUpdate(event, data) {
        DashboardServer.broadcastUpdate(event, data);
    }
}

// If running directly (not imported)
if (require.main === module) {
    console.log('🚀 Starting Fair Câmbio Dashboard...');

    const dashboard = new DashboardApp();
    dashboard.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n⚠️ Shutting down dashboard...');
        dashboard.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n⚠️ Shutting down dashboard...');
        dashboard.stop();
        process.exit(0);
    });
}

module.exports = DashboardApp;
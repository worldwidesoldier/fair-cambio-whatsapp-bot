#!/usr/bin/env node

const MasterCoordinator = require('./master');
const { validateConfig } = require('../config/shared');

class CoordinationStarter {
  constructor() {
    this.coordinator = new MasterCoordinator();
    this.isShuttingDown = false;
  }

  async start() {
    console.log('🎯 AGENTE SUPERVISOR - COORDENADOR MASTER');
    console.log('=============================================');

    try {
      // Validate configuration
      if (!validateConfig()) {
        console.error('❌ Configuration validation failed. Please fix the errors above.');
        process.exit(1);
      }

      console.log('✅ Configuration validated');

      // Initialize master coordinator
      await this.coordinator.initialize();

      console.log('');
      console.log('🤖 MASTER COORDINATOR STATUS:');
      console.log('===============================');

      const status = this.coordinator.getCoordinationStatus();
      console.log(`📊 Database: ${status.database}`);
      console.log(`🌐 API: ${status.api}`);
      console.log(`👥 Agents: ${status.totalAgents} total, ${status.healthyAgents} healthy`);
      console.log(`🔄 Initialization: ${status.initialized ? 'Complete' : 'Pending'}`);

      console.log('');
      console.log('📋 AGENT COORDINATION PLAN:');
      console.log('============================');
      console.log('Agent 1 (Tests): Framework integration validation');
      console.log('Agent 2 (Multi-filial): Branch coordination and sync');
      console.log('Agent 3 (Logs): Centralized logging and monitoring');
      console.log('Agent 4 (Dashboard): Web interface for all systems');
      console.log('');
      console.log('🔗 Integration Points:');
      console.log('- Shared database layer for all agents');
      console.log('- Unified configuration management');
      console.log('- Inter-agent communication API');
      console.log('- Coordinated deployment pipeline');
      console.log('');

      console.log('✅ Master Coordinator is ready to coordinate agents');
      console.log('📡 Listening for agent registrations...');
      console.log('🔄 Health monitoring active');
      console.log('');
      console.log('Press Ctrl+C to shutdown gracefully');

    } catch (error) {
      console.error('❌ Failed to start Master Coordinator:', error);
      process.exit(1);
    }
  }

  setupSignalHandlers() {
    // Graceful shutdown handling
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);

      try {
        await this.coordinator.shutdown();
        console.log('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      if (!this.isShuttingDown) {
        shutdown('uncaughtException');
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      if (!this.isShuttingDown) {
        shutdown('unhandledRejection');
      }
    });
  }

  // Print agent coordination status
  printCoordinationStatus() {
    console.log('');
    console.log('📊 CURRENT COORDINATION STATUS:');
    console.log('================================');

    const status = this.coordinator.getCoordinationStatus();

    console.log(`🔧 Master Coordinator: ${status.initialized ? '✅ Ready' : '⚠️ Initializing'}`);
    console.log(`💾 Database: ${status.database === 'connected' ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`🌐 API Server: ${status.api === 'running' ? '✅ Running' : '❌ Stopped'}`);
    console.log(`👥 Registered Agents: ${status.totalAgents}`);
    console.log(`❤️ Healthy Agents: ${status.healthyAgents}`);
    console.log(`⏰ Last Health Check: ${status.lastHealthCheck.toLocaleTimeString()}`);
    console.log('');
  }

  // Start status reporting interval
  startStatusReporting() {
    setInterval(() => {
      this.printCoordinationStatus();
    }, 30000); // Every 30 seconds
  }
}

// Start the coordination system
if (require.main === module) {
  const starter = new CoordinationStarter();

  starter.setupSignalHandlers();
  starter.start().then(() => {
    starter.startStatusReporting();
  }).catch(console.error);
}

module.exports = CoordinationStarter;
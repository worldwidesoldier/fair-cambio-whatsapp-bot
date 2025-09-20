const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { sharedConfig } = require('../config/shared');
const dbManager = require('../config/database');

class CoordinationAPI {
  constructor() {
    this.app = express();
    this.server = null;
    this.activeAgents = new Map();
    this.lastHealthChecks = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Rate limiting
    const limiter = rateLimit(sharedConfig.api.rateLimit);
    this.app.use(limiter);

    // CORS
    this.app.use(cors({ origin: sharedConfig.dashboard.cors.origin }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[API] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeAgents: Array.from(this.activeAgents.keys()),
        database: dbManager.isConnected ? 'connected' : 'disconnected'
      });
    });

    // Agent registration
    this.app.post('/agents/register', (req, res) => {
      const { agentId, type, capabilities, endpoint } = req.body;

      this.activeAgents.set(agentId, {
        type,
        capabilities,
        endpoint,
        registeredAt: new Date(),
        lastSeen: new Date()
      });

      console.log(`✅ Agent registered: ${agentId} (${type})`);
      res.json({ success: true, agentId });
    });

    // Agent heartbeat
    this.app.post('/agents/:agentId/heartbeat', (req, res) => {
      const { agentId } = req.params;
      const { status, metrics } = req.body;

      if (this.activeAgents.has(agentId)) {
        this.activeAgents.get(agentId).lastSeen = new Date();
        this.activeAgents.get(agentId).status = status;
        this.activeAgents.get(agentId).metrics = metrics;
      }

      this.lastHealthChecks.set(agentId, {
        timestamp: new Date(),
        status,
        metrics
      });

      res.json({ success: true });
    });

    // Inter-agent communication
    this.app.post('/agents/communicate', async (req, res) => {
      const { fromAgent, toAgent, message, type } = req.body;

      try {
        // Log communication
        await dbManager.saveData('agent_communications', {
          fromAgent,
          toAgent,
          message,
          type,
          timestamp: new Date()
        });

        // In a real implementation, you would route this to the target agent
        console.log(`[COMMUNICATION] ${fromAgent} → ${toAgent}: ${type}`);

        res.json({ success: true, messageId: Date.now() });
      } catch (error) {
        console.error('Communication error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Shared data endpoints
    this.app.get('/data/:collection', async (req, res) => {
      try {
        const { collection } = req.params;
        const { query } = req.query;

        const data = await dbManager.getData(collection, query ? JSON.parse(query) : {});
        res.json({ success: true, data });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/data/:collection', async (req, res) => {
      try {
        const { collection } = req.params;
        const data = req.body;

        const result = await dbManager.saveData(collection, data);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Configuration management
    this.app.get('/config', (req, res) => {
      res.json({
        success: true,
        config: sharedConfig
      });
    });

    this.app.post('/config/update', (req, res) => {
      const { path, value, agentId } = req.body;

      try {
        // Log configuration change
        console.log(`[CONFIG] ${agentId} updating ${path} to ${value}`);

        // In a real implementation, you would validate and apply the change
        res.json({ success: true, message: 'Configuration updated' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Coordination endpoints
    this.app.get('/coordination/status', (req, res) => {
      const agentStatuses = Array.from(this.activeAgents.entries()).map(([id, agent]) => ({
        id,
        type: agent.type,
        status: agent.status || 'unknown',
        lastSeen: agent.lastSeen,
        capabilities: agent.capabilities
      }));

      res.json({
        success: true,
        coordination: {
          totalAgents: this.activeAgents.size,
          healthyAgents: agentStatuses.filter(a => a.status === 'healthy').length,
          agents: agentStatuses
        }
      });
    });

    // Deployment coordination
    this.app.post('/coordination/deploy', async (req, res) => {
      const { components, strategy } = req.body;

      try {
        // Log deployment initiation
        await dbManager.saveData('deployments', {
          components,
          strategy,
          status: 'initiated',
          timestamp: new Date()
        });

        // In a real implementation, coordinate the deployment
        console.log(`[DEPLOY] Initiating deployment: ${strategy}`);

        res.json({
          success: true,
          deploymentId: Date.now(),
          message: 'Deployment initiated'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(sharedConfig.api.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 Coordination API listening on port ${sharedConfig.api.port}`);
          resolve(this.server);
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Coordination API stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Cleanup inactive agents
  cleanupInactiveAgents() {
    const now = new Date();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [agentId, agent] of this.activeAgents.entries()) {
      if (now - agent.lastSeen > timeout) {
        console.log(`⚠️ Removing inactive agent: ${agentId}`);
        this.activeAgents.delete(agentId);
        this.lastHealthChecks.delete(agentId);
      }
    }
  }

  // Start cleanup interval
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupInactiveAgents();
    }, 60000); // Run every minute
  }
}

module.exports = CoordinationAPI;
const CoordinationAPI = require('./api');
const dbManager = require('../config/database');
const { sharedConfig, getAgentConfig } = require('../config/shared');

class MasterCoordinator {
  constructor() {
    this.api = new CoordinationAPI();
    this.agents = new Map();
    this.deploymentQueue = [];
    this.isInitialized = false;
    this.healthCheckInterval = null;
    this.syncInterval = null;
  }

  async initialize() {
    console.log('🎯 Starting Master Coordinator...');

    try {
      // Initialize database
      await dbManager.connect();

      // Start coordination API
      await this.api.start();

      // Start monitoring intervals
      this.startHealthMonitoring();
      this.startSyncMonitoring();

      // Start agent cleanup
      this.api.startCleanupInterval();

      this.isInitialized = true;
      console.log('✅ Master Coordinator initialized successfully');

      // Send coordination status to all agents
      await this.broadcastCoordinationStatus();

    } catch (error) {
      console.error('❌ Master Coordinator initialization failed:', error);
      throw error;
    }
  }

  // Register an agent with the coordinator
  registerAgent(agentInfo) {
    const { id, type, capabilities, status = 'initializing' } = agentInfo;

    this.agents.set(id, {
      ...agentInfo,
      registeredAt: new Date(),
      lastHealthCheck: new Date(),
      status,
      metrics: {},
      dependencies: this.getAgentDependencies(type)
    });

    console.log(`📝 Agent registered: ${id} (${type})`);
    return this.generateAgentCoordinationPlan(id);
  }

  // Get agent dependencies based on type
  getAgentDependencies(agentType) {
    const dependencies = {
      tests: ['multiBranch', 'logging', 'dashboard'], // Tests depend on all others
      multiBranch: ['logging'], // Multi-branch needs logging
      logging: [], // No dependencies
      dashboard: ['logging', 'multiBranch'] // Dashboard shows data from others
    };

    return dependencies[agentType] || [];
  }

  // Generate coordination plan for an agent
  generateAgentCoordinationPlan(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const config = getAgentConfig(agent.type);
    const dependencies = agent.dependencies;

    return {
      agentId,
      config,
      dependencies,
      executionOrder: this.calculateExecutionOrder(agent.type),
      sharedResources: this.getSharedResources(),
      communicationChannels: this.getCommunicationChannels(agentId),
      validationRules: this.getValidationRules(agent.type)
    };
  }

  // Calculate execution order for agents
  calculateExecutionOrder(agentType) {
    const executionOrder = {
      logging: 1,    // First - needed by all others
      multiBranch: 2, // Second - core functionality
      dashboard: 3,   // Third - displays data from others
      tests: 4       // Last - validates everything
    };

    return executionOrder[agentType] || 999;
  }

  // Get shared resources available to agents
  getSharedResources() {
    return {
      database: dbManager,
      configuration: sharedConfig,
      api: {
        baseUrl: `http://localhost:${sharedConfig.api.port}`,
        endpoints: {
          health: '/health',
          communicate: '/agents/communicate',
          data: '/data',
          config: '/config'
        }
      },
      logging: {
        level: sharedConfig.logging.level,
        directory: sharedConfig.logging.directory
      }
    };
  }

  // Get communication channels for an agent
  getCommunicationChannels(agentId) {
    const channels = [];

    // All agents can communicate with coordinator
    channels.push({
      type: 'coordinator',
      endpoint: `/agents/${agentId}/heartbeat`,
      method: 'POST'
    });

    // Inter-agent communication
    channels.push({
      type: 'broadcast',
      endpoint: '/agents/communicate',
      method: 'POST'
    });

    return channels;
  }

  // Get validation rules for agent type
  getValidationRules(agentType) {
    const rules = {
      tests: {
        coverage: { minimum: 80 },
        quality: { violations: 0 },
        integration: { allAgentsConnected: true }
      },
      multiBranch: {
        synchronization: { maxLatency: 5000 },
        consistency: { conflictResolution: 'configured' },
        availability: { uptime: 99.9 }
      },
      logging: {
        retention: { days: 30 },
        performance: { maxLatency: 100 },
        completeness: { allEventsLogged: true }
      },
      dashboard: {
        performance: { loadTime: 2000 },
        security: { authenticationRequired: true },
        integration: { allDataSourcesConnected: true }
      }
    };

    return rules[agentType] || {};
  }

  // Coordinate deployment across all agents
  async coordinateDeployment(deploymentPlan) {
    console.log('🚀 Starting coordinated deployment...');

    const deployment = {
      id: Date.now(),
      plan: deploymentPlan,
      status: 'initiated',
      startTime: new Date(),
      agents: Array.from(this.agents.keys()),
      steps: []
    };

    try {
      // Save deployment record
      await dbManager.saveData('deployments', deployment);

      // Execute deployment in order
      const sortedAgents = Array.from(this.agents.values())
        .sort((a, b) => this.calculateExecutionOrder(a.type) - this.calculateExecutionOrder(b.type));

      for (const agent of sortedAgents) {
        console.log(`📦 Deploying agent: ${agent.id} (${agent.type})`);

        const stepResult = await this.deployAgent(agent, deploymentPlan);
        deployment.steps.push(stepResult);

        if (!stepResult.success) {
          throw new Error(`Deployment failed for agent ${agent.id}: ${stepResult.error}`);
        }
      }

      deployment.status = 'completed';
      deployment.endTime = new Date();

      console.log('✅ Coordinated deployment completed successfully');
      return deployment;

    } catch (error) {
      deployment.status = 'failed';
      deployment.error = error.message;
      deployment.endTime = new Date();

      console.error('❌ Coordinated deployment failed:', error);
      throw error;
    } finally {
      await dbManager.saveData('deployments', deployment, deployment.id);
    }
  }

  // Deploy individual agent
  async deployAgent(agent, deploymentPlan) {
    const step = {
      agentId: agent.id,
      agentType: agent.type,
      startTime: new Date(),
      success: false,
      error: null
    };

    try {
      // Pre-deployment validation
      const validationResult = await this.validateAgentDependencies(agent);
      if (!validationResult.valid) {
        throw new Error(`Dependencies not met: ${validationResult.errors.join(', ')}`);
      }

      // Agent-specific deployment logic would go here
      // For now, simulate deployment
      await new Promise(resolve => setTimeout(resolve, 1000));

      step.success = true;
      step.endTime = new Date();

      console.log(`✅ Agent ${agent.id} deployed successfully`);

    } catch (error) {
      step.error = error.message;
      step.endTime = new Date();
      console.error(`❌ Agent ${agent.id} deployment failed:`, error);
    }

    return step;
  }

  // Validate agent dependencies
  async validateAgentDependencies(agent) {
    const result = { valid: true, errors: [] };

    for (const depType of agent.dependencies) {
      const depAgent = Array.from(this.agents.values()).find(a => a.type === depType);

      if (!depAgent) {
        result.valid = false;
        result.errors.push(`Required dependency ${depType} not registered`);
        continue;
      }

      if (depAgent.status !== 'healthy') {
        result.valid = false;
        result.errors.push(`Dependency ${depType} is not healthy (${depAgent.status})`);
      }
    }

    return result;
  }

  // Start health monitoring
  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, sharedConfig.monitoring.healthCheckInterval);

    console.log('❤️ Health monitoring started');
  }

  // Perform health checks on all agents
  async performHealthChecks() {
    for (const [agentId, agent] of this.agents.entries()) {
      try {
        // In a real implementation, ping the agent
        const healthStatus = await this.checkAgentHealth(agent);

        agent.lastHealthCheck = new Date();
        agent.status = healthStatus.status;
        agent.metrics = healthStatus.metrics;

      } catch (error) {
        console.error(`Health check failed for agent ${agentId}:`, error);
        agent.status = 'unhealthy';
      }
    }
  }

  // Check individual agent health
  async checkAgentHealth(agent) {
    // Simulate health check - in reality, this would ping the agent
    return {
      status: 'healthy',
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        responseTime: Math.random() * 1000
      }
    };
  }

  // Start synchronization monitoring
  startSyncMonitoring() {
    if (sharedConfig.multiBranch.enabled) {
      this.syncInterval = setInterval(async () => {
        await this.coordinateSync();
      }, sharedConfig.multiBranch.syncInterval);

      console.log('🔄 Sync monitoring started');
    }
  }

  // Coordinate synchronization between agents
  async coordinateSync() {
    try {
      const syncData = await this.gatherSyncData();
      await this.distributeSyncData(syncData);
    } catch (error) {
      console.error('Sync coordination error:', error);
    }
  }

  // Gather data that needs to be synchronized
  async gatherSyncData() {
    const syncData = {
      timestamp: new Date(),
      rates: await dbManager.getData('rates'),
      branches: await dbManager.getData('branches'),
      configurations: sharedConfig
    };

    return syncData;
  }

  // Distribute synchronized data to agents
  async distributeSyncData(syncData) {
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.type === 'multiBranch') {
        // Send sync data to multi-branch agents
        console.log(`📡 Syncing data to agent ${agentId}`);
      }
    }
  }

  // Broadcast coordination status to all agents
  async broadcastCoordinationStatus() {
    const status = {
      coordinator: 'healthy',
      timestamp: new Date(),
      activeAgents: this.agents.size,
      sharedResources: 'available'
    };

    console.log('📢 Broadcasting coordination status to all agents');
    // In reality, this would send to all registered agents
  }

  // Shutdown coordinator
  async shutdown() {
    console.log('🔄 Shutting down Master Coordinator...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Stop API
    await this.api.stop();

    // Disconnect database
    await dbManager.disconnect();

    console.log('✅ Master Coordinator shutdown complete');
  }

  // Get current coordination status
  getCoordinationStatus() {
    return {
      initialized: this.isInitialized,
      totalAgents: this.agents.size,
      healthyAgents: Array.from(this.agents.values()).filter(a => a.status === 'healthy').length,
      database: dbManager.isConnected ? 'connected' : 'disconnected',
      api: this.api.server ? 'running' : 'stopped',
      lastHealthCheck: new Date()
    };
  }
}

module.exports = MasterCoordinator;
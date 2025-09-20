const WhatsAppBot = require('../core/WhatsAppBot');
const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');

class BranchManager {
  constructor() {
    this.branches = new Map();
    this.config = null;
    this.logger = pino({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    });
    this.isRunning = false;
    this.healthCheckInterval = null;
  }

  async initialize() {
    try {
      this.logger.info('🚀 Iniciando Fair Câmbio Multi-Branch Manager...');

      // Carrega configuração das filiais
      await this.loadBranchConfiguration();

      // Cria estrutura de diretórios necessária
      await this.ensureDirectoryStructure();

      // Inicializa filiais ativas
      await this.initializeActiveBranches();

      // Configura monitoramento
      this.setupHealthCheck();

      // Configura failover
      this.setupFailoverSystem();

      this.isRunning = true;
      this.logger.info('✅ Multi-Branch Manager iniciado com sucesso!');

    } catch (error) {
      this.logger.error('❌ Erro na inicialização do Branch Manager:', error);
      throw error;
    }
  }

  async loadBranchConfiguration() {
    const configPath = path.join(__dirname, '../config/branches.js');
    const branchConfig = require(configPath);
    this.config = branchConfig;

    this.logger.info(`📋 Carregadas ${branchConfig.branches.length} filiais da configuração`);

    // Valida configuração
    for (const branch of branchConfig.branches) {
      if (!branch.id || !branch.phone) {
        throw new Error(`Configuração inválida para filial: ${branch.id || 'ID não definido'}`);
      }
    }
  }

  async ensureDirectoryStructure() {
    const activeBranches = this.config.getActiveBranches();

    for (const branch of activeBranches) {
      const branchDirs = [
        path.join(__dirname, '../../sessions', branch.id),
        path.join(__dirname, '../../logs', branch.id),
        path.join(__dirname, '../../data', branch.id)
      ];

      for (const dir of branchDirs) {
        try {
          await fs.mkdir(dir, { recursive: true });
          this.logger.debug(`📁 Diretório criado/verificado: ${dir}`);
        } catch (error) {
          this.logger.error(`❌ Erro ao criar diretório ${dir}:`, error);
        }
      }
    }
  }

  async initializeActiveBranches() {
    const activeBranches = this.config.getActiveBranches();
    this.logger.info(`🏢 Inicializando ${activeBranches.length} filiais ativas...`);

    const initPromises = activeBranches.map(branch => this.initializeBranch(branch));
    const results = await Promise.allSettled(initPromises);

    let successCount = 0;
    results.forEach((result, index) => {
      const branch = activeBranches[index];
      if (result.status === 'fulfilled') {
        successCount++;
        this.logger.info(`✅ Filial ${branch.name} inicializada com sucesso`);
      } else {
        this.logger.error(`❌ Erro ao inicializar filial ${branch.name}:`, result.reason);
      }
    });

    this.logger.info(`🎯 ${successCount}/${activeBranches.length} filiais inicializadas com sucesso`);
  }

  async initializeBranch(branchConfig) {
    try {
      const bot = new WhatsAppBot(branchConfig, this);

      // Aguarda inicialização completa
      await bot.initialize();

      this.branches.set(branchConfig.id, {
        config: branchConfig,
        bot: bot,
        status: 'running',
        lastHealthCheck: new Date(),
        retryCount: 0,
        maxRetries: 3
      });

      return bot;
    } catch (error) {
      this.logger.error(`❌ Erro ao inicializar filial ${branchConfig.id}:`, error);
      throw error;
    }
  }

  setupHealthCheck() {
    // Health check a cada 30 segundos
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);

    this.logger.info('💓 Sistema de monitoramento de saúde configurado');
  }

  async performHealthCheck() {
    for (const [branchId, branchData] of this.branches) {
      try {
        const isHealthy = await this.checkBranchHealth(branchData);

        if (isHealthy) {
          branchData.status = 'healthy';
          branchData.lastHealthCheck = new Date();
          branchData.retryCount = 0;
        } else {
          await this.handleUnhealthyBranch(branchId, branchData);
        }
      } catch (error) {
        this.logger.error(`❌ Erro no health check da filial ${branchId}:`, error);
        await this.handleUnhealthyBranch(branchId, branchData);
      }
    }
  }

  async checkBranchHealth(branchData) {
    const { bot } = branchData;

    // Verifica se o bot existe e está conectado
    if (!bot || !bot.isConnected) {
      return false;
    }

    // Verifica se o socket está ativo
    if (!bot.sock || bot.sock.ws.readyState !== 1) {
      return false;
    }

    return true;
  }

  async handleUnhealthyBranch(branchId, branchData) {
    branchData.status = 'unhealthy';
    branchData.retryCount++;

    this.logger.warn(`⚠️ Filial ${branchId} não está saudável. Tentativa ${branchData.retryCount}/${branchData.maxRetries}`);

    if (branchData.retryCount <= branchData.maxRetries) {
      try {
        this.logger.info(`🔄 Tentando reconectar filial ${branchId}...`);
        await branchData.bot.reconnect();
      } catch (error) {
        this.logger.error(`❌ Erro ao reconectar filial ${branchId}:`, error);
      }
    } else {
      this.logger.error(`❌ Filial ${branchId} excedeu o número máximo de tentativas. Marcando como falha.`);
      branchData.status = 'failed';

      // Notifica sobre a falha
      await this.notifyBranchFailure(branchId, branchData.config);
    }
  }

  setupFailoverSystem() {
    this.logger.info('🔄 Sistema de failover configurado');

    // Configura eventos para failover automático
    process.on('message', async (msg) => {
      if (msg.type === 'branch_failure') {
        await this.handleBranchFailover(msg.branchId);
      }
    });
  }

  async handleBranchFailover(failedBranchId) {
    this.logger.warn(`⚡ Iniciando failover para filial ${failedBranchId}`);

    const failedBranch = this.branches.get(failedBranchId);
    if (!failedBranch) return;

    // Remove a filial falha temporariamente
    failedBranch.status = 'failover';

    // Aguarda 60 segundos antes de tentar reinicializar
    setTimeout(async () => {
      try {
        await this.reinitializeBranch(failedBranchId);
      } catch (error) {
        this.logger.error(`❌ Erro no failover da filial ${failedBranchId}:`, error);
      }
    }, 60000);
  }

  async reinitializeBranch(branchId) {
    this.logger.info(`🔄 Reinicializando filial ${branchId}...`);

    const branchData = this.branches.get(branchId);
    if (!branchData) return;

    try {
      // Para o bot atual se estiver rodando
      if (branchData.bot) {
        await branchData.bot.shutdown();
      }

      // Inicializa novo bot
      await this.initializeBranch(branchData.config);

      this.logger.info(`✅ Filial ${branchId} reinicializada com sucesso`);
    } catch (error) {
      this.logger.error(`❌ Erro ao reinicializar filial ${branchId}:`, error);
      branchData.status = 'failed';
    }
  }

  async notifyBranchFailure(branchId, branchConfig) {
    const message = `🚨 ALERTA: Filial ${branchConfig.name} (${branchId}) está com falha e foi desconectada.

⏰ Horário: ${new Date().toLocaleString('pt-BR')}
📍 Local: ${branchConfig.address}
📞 Telefone: ${branchConfig.phone}

O sistema tentará reconectar automaticamente.`;

    // Notifica administradores através de outras filiais ativas
    const healthyBranches = Array.from(this.branches.values())
      .filter(b => b.status === 'healthy' && b.bot.isConnected);

    if (healthyBranches.length > 0) {
      try {
        await healthyBranches[0].bot.notifyAdmins(message);
      } catch (error) {
        this.logger.error('❌ Erro ao notificar admins sobre falha:', error);
      }
    }
  }

  getBranchStatus() {
    const status = {};

    for (const [branchId, branchData] of this.branches) {
      status[branchId] = {
        name: branchData.config.name,
        phone: branchData.config.phone,
        status: branchData.status,
        isConnected: branchData.bot?.isConnected || false,
        lastHealthCheck: branchData.lastHealthCheck,
        retryCount: branchData.retryCount
      };
    }

    return status;
  }

  async restartBranch(branchId) {
    this.logger.info(`🔄 Reiniciando filial ${branchId} manualmente...`);

    try {
      await this.reinitializeBranch(branchId);
      return { success: true, message: `Filial ${branchId} reiniciada com sucesso` };
    } catch (error) {
      return { success: false, message: `Erro ao reiniciar filial ${branchId}: ${error.message}` };
    }
  }

  async stopBranch(branchId) {
    this.logger.info(`⏹️ Parando filial ${branchId}...`);

    const branchData = this.branches.get(branchId);
    if (!branchData) {
      return { success: false, message: 'Filial não encontrada' };
    }

    try {
      if (branchData.bot) {
        await branchData.bot.shutdown();
      }

      branchData.status = 'stopped';

      return { success: true, message: `Filial ${branchId} parada com sucesso` };
    } catch (error) {
      return { success: false, message: `Erro ao parar filial ${branchId}: ${error.message}` };
    }
  }

  async shutdown() {
    this.logger.info('🔄 Encerrando Branch Manager...');

    this.isRunning = false;

    // Para health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Para todas as filiais
    const shutdownPromises = Array.from(this.branches.values()).map(async (branchData) => {
      try {
        if (branchData.bot) {
          await branchData.bot.shutdown();
        }
      } catch (error) {
        this.logger.error(`Erro ao encerrar filial ${branchData.config.id}:`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);

    this.logger.info('✅ Branch Manager encerrado');
  }
}

module.exports = BranchManager;
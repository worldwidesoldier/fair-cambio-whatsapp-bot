#!/usr/bin/env node

require('dotenv').config();
const BranchManager = require('./managers/BranchManager');
const pino = require('pino');

class MultiBranchApp {
  constructor() {
    this.branchManager = null;
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    });

    this.isShuttingDown = false;
  }

  async start() {
    try {
      this.logger.info('🚀 Iniciando Fair Câmbio Multi-Branch System...');

      // Validações iniciais
      await this.validateEnvironment();

      // Inicializa o gerenciador de filiais
      this.branchManager = new BranchManager();
      await this.branchManager.initialize();

      // Configura handlers de sistema
      this.setupSignalHandlers();

      // Configura API de monitoramento (opcional)
      if (process.env.ENABLE_MONITORING_API === 'true') {
        await this.setupMonitoringAPI();
      }

      this.logger.info('✅ Fair Câmbio Multi-Branch System iniciado com sucesso!');
      this.logger.info('🏢 Sistema gerenciando múltiplas filiais simultaneamente');

      // Mantém o processo rodando
      process.stdin.resume();

    } catch (error) {
      this.logger.error('❌ Erro fatal na inicialização:', error);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    this.logger.info('🔍 Validando ambiente...');

    // Verifica variáveis obrigatórias
    const requiredEnvVars = [
      'ADMIN_NUMBERS',
      'BOT_NAME',
      'TZ'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Variáveis de ambiente obrigatórias não definidas: ${missingVars.join(', ')}`);
    }

    // Verifica se há pelo menos uma filial ativa
    const branchConfig = require('./config/branches');
    const activeBranches = branchConfig.getActiveBranches();

    if (activeBranches.length === 0) {
      throw new Error('Nenhuma filial ativa encontrada na configuração');
    }

    this.logger.info(`✅ Ambiente validado. ${activeBranches.length} filiais ativas encontradas`);

    // Lista filiais que serão inicializadas
    activeBranches.forEach((branch, index) => {
      this.logger.info(`   ${index + 1}. ${branch.name} (${branch.phone})`);
    });
  }

  setupSignalHandlers() {
    // Graceful shutdown em SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      this.logger.warn('\n⚠️ Sinal SIGINT recebido. Iniciando shutdown graceful...');
      await this.shutdown();
    });

    // Graceful shutdown em SIGTERM
    process.on('SIGTERM', async () => {
      this.logger.warn('\n⚠️ Sinal SIGTERM recebido. Iniciando shutdown graceful...');
      await this.shutdown();
    });

    // Tratamento de erros não capturados
    process.on('uncaughtException', async (error) => {
      this.logger.error('❌ Erro não capturado:', error);

      if (!this.isShuttingDown) {
        this.logger.error('🔄 Tentando recuperação do sistema...');

        try {
          // Notifica administradores sobre o erro
          if (this.branchManager) {
            const healthyBranches = Array.from(this.branchManager.branches.values())
              .filter(b => b.status === 'healthy');

            if (healthyBranches.length > 0) {
              const errorMessage = `🚨 ERRO CRÍTICO NO SISTEMA

⏰ ${new Date().toLocaleString('pt-BR')}
❌ Erro: ${error.message}
📊 Stack: ${error.stack?.substring(0, 500)}...

O sistema tentará se recuperar automaticamente.`;

              await healthyBranches[0].bot.notifyAdmins(errorMessage);
            }
          }

          // Aguarda um pouco antes de encerrar
          setTimeout(() => {
            process.exit(1);
          }, 5000);

        } catch (recoveryError) {
          this.logger.error('❌ Falha na recuperação:', recoveryError);
          process.exit(1);
        }
      }
    });

    // Tratamento de promises rejeitadas
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('❌ Promise rejeitada não tratada:', { reason, promise });

      // Para promises rejeitadas, apenas logamos mas não encerramos o processo
      // A menos que seja um erro crítico
      if (reason && reason.code === 'CRITICAL') {
        process.exit(1);
      }
    });

    this.logger.info('🛡️ Handlers de sistema configurados');
  }

  async setupMonitoringAPI() {
    try {
      const MonitoringAPI = require('./api/MonitoringAPI');
      const api = new MonitoringAPI(this.branchManager);

      await api.start(process.env.MONITORING_PORT || 3001);

      this.logger.info(`📊 API de monitoramento iniciada na porta ${process.env.MONITORING_PORT || 3001}`);
    } catch (error) {
      this.logger.warn('⚠️ Não foi possível iniciar API de monitoramento:', error.message);
    }
  }

  async shutdown() {
    if (this.isShuttingDown) {
      this.logger.warn('⚠️ Shutdown já está em andamento...');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('🔄 Iniciando shutdown do Multi-Branch System...');

    try {
      // Para todas as filiais
      if (this.branchManager) {
        await this.branchManager.shutdown();
      }

      this.logger.info('✅ Shutdown concluído com sucesso');
      process.exit(0);

    } catch (error) {
      this.logger.error('❌ Erro durante shutdown:', error);
      process.exit(1);
    }
  }

  // Métodos para controle remoto (opcional)
  async getSystemStatus() {
    if (!this.branchManager) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      branches: this.branchManager.getBranchStatus(),
      timestamp: new Date().toISOString()
    };
  }

  async restartBranch(branchId) {
    if (!this.branchManager) {
      throw new Error('Sistema não inicializado');
    }

    return await this.branchManager.restartBranch(branchId);
  }

  async stopBranch(branchId) {
    if (!this.branchManager) {
      throw new Error('Sistema não inicializado');
    }

    return await this.branchManager.stopBranch(branchId);
  }
}

// Função principal
async function main() {
  const app = new MultiBranchApp();

  try {
    await app.start();
  } catch (error) {
    console.error('❌ Falha fatal na inicialização:', error);
    process.exit(1);
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MultiBranchApp;
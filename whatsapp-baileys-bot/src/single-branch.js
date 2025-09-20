#!/usr/bin/env node

require('dotenv').config();
const WhatsAppBot = require('./core/WhatsAppBot');
const branchConfig = require('./config/branches');
const pino = require('pino');

class SingleBranchApp {
  constructor(branchId) {
    this.branchId = branchId;
    this.bot = null;
    this.isShuttingDown = false;

    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
      base: {
        branch: this.branchId
      }
    });
  }

  async start() {
    try {
      this.logger.info(`🚀 Iniciando filial individual: ${this.branchId}...`);

      // Valida configuração da filial
      const branch = this.validateBranch();

      // Inicializa o bot para esta filial
      this.bot = new WhatsAppBot(branch);
      await this.bot.initialize();

      // Configura handlers de sistema
      this.setupSignalHandlers();

      this.logger.info(`✅ Filial ${this.branchId} iniciada com sucesso!`);

      // Mantém o processo rodando
      process.stdin.resume();

    } catch (error) {
      this.logger.error(`❌ Erro na inicialização da filial ${this.branchId}:`, error);
      process.exit(1);
    }
  }

  validateBranch() {
    if (!this.branchId) {
      throw new Error('ID da filial não especificado. Use a variável BRANCH_ID.');
    }

    const branch = branchConfig.getBranchById(this.branchId);

    if (!branch) {
      throw new Error(`Filial '${this.branchId}' não encontrada na configuração`);
    }

    if (!branch.active) {
      throw new Error(`Filial '${this.branchId}' está marcada como inativa`);
    }

    const validation = branchConfig.validateBranchConfig(this.branchId);
    if (!validation.valid) {
      throw new Error(`Configuração inválida para filial '${this.branchId}': ${validation.error}`);
    }

    this.logger.info(`✅ Configuração da filial ${branch.name} validada`);
    this.logger.info(`📍 ${branch.address}`);
    this.logger.info(`📞 ${branch.phone}`);
    this.logger.info(`👤 Gerente: ${branch.manager}`);

    return branch;
  }

  setupSignalHandlers() {
    // Graceful shutdown em SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      this.logger.warn(`\n⚠️ Sinal SIGINT recebido para filial ${this.branchId}. Iniciando shutdown...`);
      await this.shutdown();
    });

    // Graceful shutdown em SIGTERM
    process.on('SIGTERM', async () => {
      this.logger.warn(`\n⚠️ Sinal SIGTERM recebido para filial ${this.branchId}. Iniciando shutdown...`);
      await this.shutdown();
    });

    // Tratamento de erros não capturados
    process.on('uncaughtException', async (error) => {
      this.logger.error(`❌ Erro não capturado na filial ${this.branchId}:`, error);

      if (!this.isShuttingDown) {
        try {
          // Notifica administradores sobre o erro
          if (this.bot && this.bot.isConnected) {
            const errorMessage = `🚨 ERRO NA FILIAL ${this.branchId.toUpperCase()}

⏰ ${new Date().toLocaleString('pt-BR')}
🏢 Filial: ${this.bot.branchConfig.name}
❌ Erro: ${error.message}

A filial será reiniciada automaticamente.`;

            await this.bot.notifyAdmins(errorMessage);
          }

          // Aguarda um pouco antes de encerrar
          setTimeout(() => {
            process.exit(1);
          }, 3000);

        } catch (recoveryError) {
          this.logger.error('❌ Falha na notificação de erro:', recoveryError);
          process.exit(1);
        }
      }
    });

    // Tratamento de promises rejeitadas
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`❌ Promise rejeitada na filial ${this.branchId}:`, { reason, promise });
    });

    this.logger.info(`🛡️ Handlers de sistema configurados para filial ${this.branchId}`);
  }

  async shutdown() {
    if (this.isShuttingDown) {
      this.logger.warn(`⚠️ Shutdown da filial ${this.branchId} já está em andamento...`);
      return;
    }

    this.isShuttingDown = true;
    this.logger.info(`🔄 Iniciando shutdown da filial ${this.branchId}...`);

    try {
      if (this.bot) {
        await this.bot.shutdown();
      }

      this.logger.info(`✅ Filial ${this.branchId} encerrada com sucesso`);
      process.exit(0);

    } catch (error) {
      this.logger.error(`❌ Erro durante shutdown da filial ${this.branchId}:`, error);
      process.exit(1);
    }
  }

  // Métodos para status e controle
  getStatus() {
    if (!this.bot) {
      return { status: 'not_initialized' };
    }

    return {
      branchId: this.branchId,
      status: this.bot.isConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: this.bot.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  async restart() {
    this.logger.info(`🔄 Reiniciando filial ${this.branchId}...`);

    try {
      if (this.bot) {
        await this.bot.shutdown();
      }

      // Aguarda um pouco antes de reinicializar
      await new Promise(resolve => setTimeout(resolve, 2000));

      const branch = this.validateBranch();
      this.bot = new WhatsAppBot(branch);
      await this.bot.initialize();

      this.logger.info(`✅ Filial ${this.branchId} reiniciada com sucesso`);

    } catch (error) {
      this.logger.error(`❌ Erro ao reiniciar filial ${this.branchId}:`, error);
      throw error;
    }
  }
}

// Função principal
async function main() {
  const branchId = process.env.BRANCH_ID;

  if (!branchId) {
    console.error('❌ Variável BRANCH_ID é obrigatória para execução de filial individual');
    console.error('Exemplo: BRANCH_ID=matriz node src/single-branch.js');
    process.exit(1);
  }

  const app = new SingleBranchApp(branchId);

  try {
    await app.start();
  } catch (error) {
    console.error(`❌ Falha fatal na inicialização da filial ${branchId}:`, error);
    process.exit(1);
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SingleBranchApp;
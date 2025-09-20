const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Handlers
const MenuHandler = require('../handlers/menu');
const AdminHandler = require('../handlers/admin');
const BranchSessionManager = require('../utils/BranchSessionManager');
const { formatPhoneNumber, createMessageHeader } = require('../utils/formatter');

class WhatsAppBot {
  constructor(branchConfig, branchManager = null) {
    if (!branchConfig || !branchConfig.id) {
      throw new Error('Configuração de filial é obrigatória');
    }

    this.branchConfig = branchConfig;
    this.branchManager = branchManager;
    this.branchId = branchConfig.id;

    // Configurações específicas da filial
    this.sessionManager = new BranchSessionManager(this.branchId);
    this.menuHandler = new MenuHandler(branchConfig);
    this.adminHandler = new AdminHandler(branchConfig);

    // Socket e estado
    this.sock = null;
    this.store = null;

    // Estado da conexão
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Logger específico da filial
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
        branch: this.branchId,
        branchName: branchConfig.name
      }
    });

    // Estatísticas
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      connectionsLost: 0,
      uptime: new Date(),
      lastActivity: null
    };
  }

  async initialize() {
    this.logger.info(`🚀 Iniciando ${this.branchConfig.name}...`);

    try {
      await this.ensureDirectories();
      await this.connect();
      this.logger.info(`✅ ${this.branchConfig.name} inicializada com sucesso`);
    } catch (error) {
      this.logger.error(`❌ Erro na inicialização da filial ${this.branchId}:`, error);
      throw error;
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.join(__dirname, '../../sessions', this.branchId),
      path.join(__dirname, '../../logs', this.branchId),
      path.join(__dirname, '../../data', this.branchId)
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.error(`Erro ao criar diretório ${dir}:`, error);
      }
    }
  }

  async connect() {
    const { state, saveCreds } = await this.sessionManager.getAuthState();

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS(`Fair Câmbio ${this.branchConfig.name}`),
      markOnlineOnConnect: true,
      syncFullHistory: false,
      getMessage: async (key) => {
        if (this.store) {
          const msg = await this.store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return undefined;
      }
    });

    this.store?.bind(this.sock.ev);

    // Eventos de conexão
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Salvar credenciais
    this.sock.ev.on('creds.update', saveCreds);

    // Processar mensagens
    this.sock.ev.on('messages.upsert', async (messageUpdate) => {
      await this.handleMessages(messageUpdate);
    });

    // Log de eventos
    this.sock.ev.on('messages.update', (messageUpdate) => {
      this.logger.debug('Mensagem atualizada:', messageUpdate);
    });

    this.sock.ev.on('presence.update', (presenceUpdate) => {
      this.logger.debug('Presença atualizada:', presenceUpdate);
    });

    this.logger.info(`🔗 ${this.branchConfig.name} configurado e aguardando conexão...`);
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.logger.info(`\n📱 QR CODE para ${this.branchConfig.name}:\n`);
      qrcode.generate(qr, { small: true });
      this.logger.info(`\n⏳ Aguardando conexão da filial ${this.branchId}...\n`);

      try {
        // Send QR string directly to dashboard (not the image)
        // The frontend will generate the QR code image from this string
        this.sendToDashboard('qrCode', qr);
        this.sendToDashboard('addLog', `QR Code gerado para filial ${this.branchConfig.name}`);

        console.log(`📱 QR Code string enviado para dashboard: ${qr.substring(0, 50)}...`);
      } catch (error) {
        this.logger.error(`Erro ao enviar QR Code para dashboard: ${error.message}`);
      }
    }

    if (connection === 'close') {
      this.isConnected = false;
      this.stats.connectionsLost++;

      const shouldReconnect = this.shouldReconnect(lastDisconnect);

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.logger.warn(`🔄 Tentando reconectar ${this.branchConfig.name}... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        await delay(5000);
        await this.connect();
      } else {
        this.logger.error(`❌ Não foi possível reconectar ${this.branchConfig.name}. Notificando manager...`);

        if (this.branchManager) {
          await this.branchManager.handleBranchFailover(this.branchId);
        }
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.stats.uptime = new Date();

      this.logger.info(`✅ ${this.branchConfig.name} conectado com sucesso!`);

      // Notify dashboard of successful connection
      this.sendToDashboard('setBotConnected', {
        branchId: this.branchId,
        branchName: this.branchConfig.name
      });
      this.sendToDashboard('addLog', `✅ ${this.branchConfig.name} conectado com sucesso!`);
      this.logger.info(`📱 Número: ${this.sock.user?.id}`);
      this.logger.info(`👤 Nome: ${this.sock.user?.name}`);
      this.logger.info(`🏢 Filial: ${this.branchConfig.name}`);
      this.logger.info(`📍 Endereço: ${this.branchConfig.address}`);

      // Mensagem de inicialização personalizada
      const startupMessage = `🚀 ${this.branchConfig.name} está online e operacional!

📍 ${this.branchConfig.address}
📞 ${this.branchConfig.phone}

⏰ Horários de funcionamento:
• Segunda a Sexta: ${this.branchConfig.hours.weekdays}
• Sábado: ${this.branchConfig.hours.saturday}
• Domingo: ${this.branchConfig.hours.sunday}`;

      await this.notifyAdmins(startupMessage);
    }

    if (connection === 'connecting') {
      this.logger.info(`🔄 Conectando ${this.branchConfig.name} ao WhatsApp...`);
    }
  }

  shouldReconnect(lastDisconnect) {
    if (!lastDisconnect?.error) return false;

    const reason = lastDisconnect.error?.output?.statusCode;
    const { shouldReconnect } = this.sessionManager.handleDisconnect(reason);

    return shouldReconnect;
  }

  async handleMessages(messageUpdate) {
    try {
      const messages = messageUpdate.messages;

      if (!messages || messages.length === 0) return;

      for (const msg of messages) {
        // Ignora mensagens antigas e de status
        if (!msg.message || msg.key.fromMe) continue;

        const messageType = Object.keys(msg.message)[0];

        // Processa apenas mensagens de texto
        if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
          await this.processMessage(msg);
        }
      }
    } catch (error) {
      this.logger.error('❌ Erro ao processar mensagens:', error);
    }
  }

  async processMessage(msg) {
    try {
      const from = msg.key.remoteJid;
      const pushName = msg.pushName || 'Cliente';
      const messageText = msg.message.conversation ||
        msg.message.extendedTextMessage?.text || '';

      if (!messageText) return;

      this.stats.messagesReceived++;
      this.stats.lastActivity = new Date();

      this.logger.info(`📩 [${this.branchId}] Mensagem de ${pushName} (${from}): ${messageText}`);

      // Marca como lida
      await this.sock.readMessages([msg.key]);

      // Simula digitação
      await this.sock.presenceSubscribe(from);
      await this.sock.sendPresenceUpdate('composing', from);
      await delay(1000);

      // Verifica comandos admin primeiro
      const adminResponse = await this.adminHandler.handleCommand(
        messageText,
        from,
        this.sock,
        this.branchConfig
      );

      if (adminResponse) {
        await this.sendMessage(from, adminResponse);
        await this.sock.sendPresenceUpdate('paused', from);
        return;
      }

      // Verifica se é primeira interação
      const userId = from.split('@')[0];

      if (this.menuHandler.isFirstInteraction(userId)) {
        const welcomeMessage = this.menuHandler.handleFirstInteraction(userId, pushName, this.branchConfig);
        await this.sendMessage(from, welcomeMessage);
        await delay(1500);
        const menuMessage = this.menuHandler.createMenuMessage(this.branchConfig);
        await this.sendMessage(from, menuMessage);
      } else {
        // Processa mensagem normal
        const response = await this.menuHandler.handleMessage(messageText, userId, this.branchConfig);
        await this.sendMessage(from, response);
      }

      await this.sock.sendPresenceUpdate('paused', from);
      await this.logMessage(from, pushName, messageText);

    } catch (error) {
      this.logger.error('❌ Erro ao processar mensagem:', error);
    }
  }

  async sendMessage(to, text) {
    try {
      const header = createMessageHeader(this.branchConfig);
      const fullMessage = header + text;

      await this.sock.sendMessage(to, {
        text: fullMessage
      });

      this.stats.messagesSent++;
      this.logger.info(`✅ [${this.branchId}] Mensagem enviada para ${to}`);
    } catch (error) {
      this.logger.error(`❌ [${this.branchId}] Erro ao enviar mensagem para ${to}:`, error);
    }
  }

  async notifyAdmins(message) {
    const adminNumbers = process.env.ADMIN_NUMBERS
      ? process.env.ADMIN_NUMBERS.split(',').map(n => n.trim())
      : [];

    for (const admin of adminNumbers) {
      const formattedNumber = formatPhoneNumber(admin) + '@s.whatsapp.net';
      try {
        const branchMessage = `🏢 ${this.branchConfig.name}\n\n${message}`;
        await this.sendMessage(formattedNumber, branchMessage);
      } catch (error) {
        this.logger.error(`Erro ao notificar admin ${admin}:`, error);
      }
    }
  }

  async logMessage(from, name, message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      branchId: this.branchId,
      branchName: this.branchConfig.name,
      from,
      name,
      message
    };

    const logPath = path.join(__dirname, '../../logs', this.branchId, `chat-${new Date().toISOString().split('T')[0]}.json`);

    try {
      let logs = [];

      try {
        const existingLogs = await fs.readFile(logPath, 'utf8');
        logs = JSON.parse(existingLogs);
      } catch {
        // Arquivo não existe ainda
      }

      logs.push(logEntry);

      await fs.writeFile(logPath, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
      this.logger.error('Erro ao salvar log:', error);
    }
  }

  async reconnect() {
    this.logger.info(`🔄 Forçando reconexão da filial ${this.branchId}...`);

    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (error) {
      this.logger.warn('Erro ao fazer logout:', error);
    }

    await delay(2000);
    await this.connect();
  }

  getStats() {
    return {
      branchId: this.branchId,
      branchName: this.branchConfig.name,
      isConnected: this.isConnected,
      phone: this.branchConfig.phone,
      uptime: this.stats.uptime,
      lastActivity: this.stats.lastActivity,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
      connectionsLost: this.stats.connectionsLost,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Send data to dashboard
  async sendToDashboard(method, data) {
    try {
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3001';
      await axios.post(`${dashboardUrl}/api/bot-update`, {
        method,
        data,
        branchId: this.branchId,
        branchName: this.branchConfig.name
      });
    } catch (error) {
      // Silent fail - dashboard may not be running
      if (error.code !== 'ECONNREFUSED') {
        this.logger.debug(`Dashboard communication error: ${error.message}`);
      }
    }
  }

  async shutdown() {
    this.logger.info(`🔄 Encerrando ${this.branchConfig.name}...`);

    try {
      if (this.isConnected && this.sock) {
        const shutdownMessage = `⚠️ ${this.branchConfig.name} está sendo desligado para manutenção`;
        await this.notifyAdmins(shutdownMessage);
        await delay(1000);
        await this.sock.logout();
      }

      this.isConnected = false;
      this.logger.info(`✅ ${this.branchConfig.name} encerrado com sucesso`);
    } catch (error) {
      this.logger.error(`❌ Erro ao encerrar ${this.branchConfig.name}:`, error);
    }
  }
}

module.exports = WhatsAppBot;
require('dotenv').config();
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

// Handlers
const MenuHandler = require('./handlers/menu');
const AdminHandler = require('./handlers/admin');
const SessionManager = require('./utils/session');
const { formatPhoneNumber, createMessageHeader } = require('./utils/formatter');

// Monitoring System
const monitoring = require('./monitoring');

class WhatsAppBot {
  constructor() {
    this.sessionManager = new SessionManager();
    this.menuHandler = new MenuHandler();
    this.adminHandler = new AdminHandler();
    this.sock = null;
    this.store = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🚀 Iniciando Fair Câmbio Bot com Monitoramento Avançado...');

    try {
      await this.ensureDirectories();

      // Initialize monitoring system
      await monitoring.initialize(this);

      await this.connect();
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      monitoring.onError(error, { context: 'initialization' });
      process.exit(1);
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.join(__dirname, '../sessions'),
      path.join(__dirname, '../logs'),
      path.join(__dirname, '../data/analytics'),
      path.join(__dirname, '../backups'),
      path.join(__dirname, '../reports'),
      path.join(__dirname, '../audit')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Erro ao criar diretório ${dir}:`, error);
        monitoring.onError(error, { context: 'directory_creation', dir });
      }
    }
  }

  async connect() {
    const { state, saveCreds } = await this.sessionManager.getAuthState();

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
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

    // Eventos de conexão com monitoramento
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);

      // Monitor connection changes
      monitoring.onConnection(update.connection, update);
    });

    // Salvar credenciais
    this.sock.ev.on('creds.update', saveCreds);

    // Processar mensagens com monitoramento
    this.sock.ev.on('messages.upsert', async (messageUpdate) => {
      await this.handleMessages(messageUpdate);
    });

    // Log de eventos com monitoramento
    this.sock.ev.on('messages.update', (messageUpdate) => {
      monitoring.Logger.debug('Mensagem atualizada', {
        messageUpdate,
        category: 'whatsapp'
      });
    });

    this.sock.ev.on('presence.update', (presenceUpdate) => {
      monitoring.Logger.trace('Presença atualizada', {
        presenceUpdate,
        category: 'whatsapp'
      });
    });

    monitoring.Logger.info('Bot configurado e aguardando conexão', {
      category: 'whatsapp'
    });
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE COM SEU WHATSAPP:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Aguardando conexão...\n');

      monitoring.Logger.info('QR Code gerado', { category: 'whatsapp' });
    }

    if (connection === 'close') {
      this.isConnected = false;
      const shouldReconnect = this.shouldReconnect(lastDisconnect);

      monitoring.Logger.warn('Conexão perdida', {
        reason: lastDisconnect?.error?.output?.statusCode,
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        category: 'whatsapp'
      });

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Tentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        await delay(5000);
        await this.connect();
      } else {
        monitoring.Logger.error('Reconexão falhada - Encerrando', {
          attempts: this.reconnectAttempts,
          category: 'whatsapp'
        });
        console.log('❌ Não foi possível reconectar. Encerrando...');
        await this.shutdown();
        process.exit(0);
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Bot conectado com sucesso!');
      console.log('📱 Número:', this.sock.user?.id);
      console.log('👤 Nome:', this.sock.user?.name);
      console.log('\n🤖 Bot está pronto para receber mensagens!\n');

      monitoring.Logger.info('Bot conectado com sucesso', {
        userId: this.sock.user?.id,
        userName: this.sock.user?.name,
        uptime: Date.now() - this.startTime,
        category: 'whatsapp'
      });

      // Mensagem de inicialização para admins
      await this.notifyAdmins('🚀 Bot Fair Câmbio iniciado e operacional com sistema de monitoramento ativo!');
    }

    if (connection === 'connecting') {
      console.log('🔄 Conectando ao WhatsApp...');
      monitoring.Logger.info('Conectando ao WhatsApp', { category: 'whatsapp' });
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
      monitoring.Logger.error('Erro ao processar mensagens', {
        error: error.message,
        category: 'whatsapp'
      });
      monitoring.onError(error, { context: 'message_processing' });
    }
  }

  async processMessage(msg) {
    const startTime = Date.now();

    try {
      const from = msg.key.remoteJid;
      const pushName = msg.pushName || 'Cliente';
      const messageText = msg.message.conversation ||
        msg.message.extendedTextMessage?.text || '';

      if (!messageText) return;

      console.log(`📩 Mensagem de ${pushName} (${from}): ${messageText}`);

      // Monitor incoming message
      monitoring.onMessage(from, messageText, pushName);

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
        this.sock
      );

      if (adminResponse) {
        await this.sendMessage(from, adminResponse);
        await this.sock.sendPresenceUpdate('paused', from);

        // Monitor admin action
        const userId = from.split('@')[0];
        monitoring.onAdminAction(userId, 'command_executed', {
          command: messageText,
          response: adminResponse.substring(0, 100)
        });

        return;
      }

      // Verifica se é primeira interação
      const userId = from.split('@')[0];

      if (this.menuHandler.isFirstInteraction(userId)) {
        const welcomeMessage = this.menuHandler.handleFirstInteraction(userId, pushName);
        await this.sendMessage(from, welcomeMessage);
        await delay(1500);
        const menuMessage = this.menuHandler.createMenuMessage();
        await this.sendMessage(from, menuMessage);
      } else {
        // Processa mensagem normal
        const response = await this.menuHandler.handleMessage(messageText, userId);
        await this.sendMessage(from, response);
      }

      await this.sock.sendPresenceUpdate('paused', from);

      // Track response time
      monitoring.trackResponseTime(startTime);

    } catch (error) {
      monitoring.Logger.error('Erro ao processar mensagem individual', {
        error: error.message,
        category: 'whatsapp'
      });
      monitoring.onError(error, { context: 'individual_message_processing' });
    }
  }

  async sendMessage(to, text) {
    try {
      const header = createMessageHeader();
      const fullMessage = header + text;

      await this.sock.sendMessage(to, {
        text: fullMessage
      });

      console.log(`✅ Mensagem enviada para ${to}`);

      // Monitor outgoing message
      monitoring.onMessageSent(to, text);

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${to}:`, error);
      monitoring.Logger.error('Erro ao enviar mensagem', {
        to,
        error: error.message,
        category: 'whatsapp'
      });
      monitoring.onError(error, { context: 'message_sending', to });
    }
  }

  async notifyAdmins(message) {
    const adminNumbers = process.env.ADMIN_NUMBERS
      ? process.env.ADMIN_NUMBERS.split(',').map(n => n.trim())
      : [];

    for (const admin of adminNumbers) {
      const formattedNumber = formatPhoneNumber(admin) + '@s.whatsapp.net';
      try {
        await this.sendMessage(formattedNumber, message);
      } catch (error) {
        monitoring.Logger.error('Erro ao notificar admin', {
          admin,
          error: error.message,
          category: 'whatsapp'
        });
      }
    }
  }

  async shutdown() {
    console.log('🔄 Encerrando bot...');

    try {
      if (this.isConnected && this.sock) {
        await this.notifyAdmins('⚠️ Bot Fair Câmbio está sendo desligado');
        await this.sock.logout();
      }

      // Shutdown monitoring system
      await monitoring.shutdown();

      monitoring.Logger.info('Bot encerrado com sucesso', {
        uptime: Date.now() - this.startTime,
        category: 'whatsapp'
      });

    } catch (error) {
      monitoring.Logger.error('Erro durante shutdown', {
        error: error.message,
        category: 'whatsapp'
      });
    }
  }

  // Public methods for monitoring integration
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      uptime: Date.now() - this.startTime,
      userId: this.sock?.user?.id,
      userName: this.sock?.user?.name
    };
  }
}

// Inicialização
const bot = new WhatsAppBot();

// Tratamento de sinais com monitoramento
process.on('SIGINT', async () => {
  console.log('\n⚠️ Sinal de interrupção recebido');
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Sinal de término recebido');
  await bot.shutdown();
  process.exit(0);
});

// Tratamento de erros não capturados com monitoramento
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  monitoring.onError(error, { context: 'uncaught_exception' });
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promise rejeitada não tratada:', error);
  monitoring.onError(error, { context: 'unhandled_rejection' });
  process.exit(1);
});

// Inicia o bot
bot.initialize().catch((error) => {
  console.error('❌ Falha crítica na inicialização:', error);
  monitoring.onError(error, { context: 'critical_initialization_failure' });
  process.exit(1);
});

// Exportar para testes
module.exports = bot;
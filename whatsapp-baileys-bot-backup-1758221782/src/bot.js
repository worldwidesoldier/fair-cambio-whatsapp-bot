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
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

// Handlers
const MenuHandler = require('./handlers/menu');
const AdminHandler = require('./handlers/admin');
const SessionManager = require('./utils/session');
const { formatPhoneNumber, createMessageHeader } = require('./utils/formatter');
const io = require('socket.io-client');

class WhatsAppBot {
  constructor() {
    this.sessionManager = new SessionManager();
    this.menuHandler = new MenuHandler();
    this.adminHandler = new AdminHandler();
    this.sock = null;
    this.store = null; // Removido makeInMemoryStore que não existe na versão atual
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // Aumentado para 10 tentativas
    this.dashboardSocket = null; // Dashboard socket connection
    this.connectionStartTime = null;
    this.lastDisconnectTime = null;
    this.reconnectTimeout = null;
    this.heartbeatInterval = null;
    this.backoffDelays = [1000, 2000, 5000, 10000, 20000, 30000]; // Backoff exponencial
  }

  async initialize() {
    console.log('🚀 Iniciando Fair Câmbio Bot...');

    try {
      // Connect to dashboard server
      this.connectToDashboard();

      await this.ensureDirectories();
      await this.connect();
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      process.exit(1);
    }
  }

  connectToDashboard() {
    try {
      this.dashboardSocket = io('http://localhost:3001');

      this.dashboardSocket.on('connect', () => {
        console.log('📊 Conectado ao dashboard');
      });

      this.dashboardSocket.on('disconnect', () => {
        console.log('📊 Desconectado do dashboard');
      });

      this.dashboardSocket.on('error', (error) => {
        console.log('📊 Erro de conexão com dashboard:', error.message);
      });

      // Listen for dashboard control events
      this.dashboardSocket.on('bot-generate-qr', () => {
        console.log('📊 Dashboard solicitou geração de QR Code');
        this.generateNewQR();
      });

      this.dashboardSocket.on('bot-disconnect', () => {
        console.log('📊 Dashboard solicitou desconexão do bot');
        this.disconnect();
      });

      this.dashboardSocket.on('bot-reconnect', () => {
        console.log('📊 Dashboard solicitou reconexão do bot');
        this.reconnect();
      });
    } catch (error) {
      console.log('📊 Dashboard não disponível:', error.message);
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.join(__dirname, '../sessions'),
      path.join(__dirname, '../logs')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Erro ao criar diretório ${dir}:`, error);
      }
    }
  }

  async connect() {
    const { state, saveCreds } = await this.sessionManager.getAuthState();

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
        // Simplificado sem store
        return undefined;
      }
    });

    // Store removido

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
      console.log('📝 Mensagem atualizada:', messageUpdate);
    });

    this.sock.ev.on('presence.update', (presenceUpdate) => {
      console.log('👤 Presença atualizada:', presenceUpdate);
    });

    console.log('✅ Bot configurado e aguardando conexão...');
  }

  sendToDashboard(method, data) {
    if (this.dashboardSocket && this.dashboardSocket.connected) {
      this.dashboardSocket.emit('botUpdate', { method, data });
    }
  }

  // Dashboard control methods
  async generateNewQR() {
    try {
      console.log('🔄 Gerando novo QR Code por solicitação do dashboard...');
      // Disconnect and reconnect to force QR generation
      if (this.sock) {
        await this.sock.logout();
        await delay(2000);
      }
      await this.connect();
      this.sendToDashboard('addLog', 'Novo QR Code solicitado e gerado');
    } catch (error) {
      console.error('❌ Erro ao gerar novo QR Code:', error);
      this.sendToDashboard('addLog', `Erro ao gerar QR Code: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      console.log('🔌 Desconectando bot por solicitação do dashboard...');
      if (this.sock) {
        await this.sock.logout();
      }
      this.isConnected = false;
      this.sendToDashboard('addLog', 'Bot desconectado por solicitação do dashboard');
    } catch (error) {
      console.error('❌ Erro ao desconectar bot:', error);
      this.sendToDashboard('addLog', `Erro ao desconectar: ${error.message}`);
    }
  }

  async reconnect() {
    try {
      console.log('🔄 Reconectando bot por solicitação do dashboard...');
      this.reconnectAttempts = 0; // Reset attempts
      await this.connect();
      this.sendToDashboard('addLog', 'Reconexão solicitada pelo dashboard');
    } catch (error) {
      console.error('❌ Erro ao reconectar bot:', error);
      this.sendToDashboard('addLog', `Erro ao reconectar: ${error.message}`);
    }
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n🔥 ===== NOVO QR CODE =====');
      console.log('📱 ESCANEIE O QR CODE COM SEU WHATSAPP:\n');

      try {
        // Generate QR code in terminal with better visibility
        qrcode.generate(qr, { small: false });

        // Generate QR code as PNG file
        const qrPath = path.join(__dirname, '../qrcode.png');
        await QRCode.toFile(qrPath, qr, {
          errorCorrectionLevel: 'M',
          type: 'png',
          quality: 0.92,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 512
        });

        console.log(`📁 QR Code salvo em: ${qrPath}`);
        console.log(`💡 Você pode abrir o arquivo ${qrPath} para escanear facilmente!`);

        // Generate Data URL for dashboard
        const qrDataURL = await QRCode.toDataURL(qr, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          quality: 1,
          margin: 4,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 512,
          scale: 8
        });

        console.log('\n⏳ Aguardando conexão...');
        console.log('🔧 PROBLEMAS? Tente estas opções:');
        console.log(`   1. Abra o arquivo: ${qrPath}`);
        console.log('   2. Use o dashboard: http://localhost:3001');
        console.log('   3. Certifique-se que o WhatsApp está atualizado');
        console.log('   4. Tente com outro celular/conta de teste');
        console.log('🔥 ===========================\n');

        // Send QR code to dashboard with data URL
        this.sendToDashboard('updateQRCode', qrDataURL);
        this.sendToDashboard('addLog', `QR Code gerado - Arquivo salvo em: ${qrPath}`);

      } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error);
        this.sendToDashboard('addLog', `Erro ao gerar QR Code: ${error.message}`);
      }
    }

    if (connection === 'close') {
      this.isConnected = false;
      this.lastDisconnectTime = new Date();

      // Clear heartbeat if running
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Update dashboard with disconnection
      this.sendToDashboard('setBotDisconnected');
      this.sendToDashboard('addLog', `Bot desconectado do WhatsApp - ${new Date().toLocaleString()}`);

      // Backup session before attempting reconnection
      await this.sessionManager.backupSession();

      const shouldReconnect = this.shouldReconnect(lastDisconnect);

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;

        // Calculate backoff delay with maximum cap
        const delayIndex = Math.min(this.reconnectAttempts - 1, this.backoffDelays.length - 1);
        const delayMs = this.backoffDelays[delayIndex];

        console.log(`🔄 Tentando reconectar em ${delayMs/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.sendToDashboard('addLog', `Reconectando em ${delayMs/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        // Clear any existing timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }

        // Schedule reconnection with backoff
        this.reconnectTimeout = setTimeout(async () => {
          try {
            await this.connect();
          } catch (error) {
            console.error('❌ Erro na reconexão:', error);
            this.sendToDashboard('addLog', `Erro na reconexão: ${error.message}`);
          }
        }, delayMs);

      } else {
        console.log('❌ Máximo de tentativas atingido ou reconexão não recomendada.');
        this.sendToDashboard('addLog', '❌ Conexão perdida permanentemente. Reinicie o bot manualmente.');

        // Don't exit, keep trying every 5 minutes
        setTimeout(() => {
          console.log('🔄 Tentativa de reconexão automática...');
          this.reconnectAttempts = 0; // Reset attempts
          this.connect();
        }, 300000); // 5 minutes
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionStartTime = new Date();

      // Clear any pending reconnection timeouts
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      console.log('✅ Bot conectado com sucesso!');
      console.log('📱 Número:', this.sock.user?.id);

      // Start heartbeat monitoring
      this.startHeartbeat();

      // Update dashboard with successful connection
      this.sendToDashboard('setBotConnected', {
        number: this.sock.user?.id,
        name: this.sock.user?.name,
        connectionTime: this.connectionStartTime
      });
      this.sendToDashboard('addLog', `✅ Bot conectado com sucesso! Número: ${this.sock.user?.id} - ${new Date().toLocaleString()}`);

      console.log('👤 Nome:', this.sock.user?.name);
      console.log('\n🤖 Bot está pronto para receber mensagens!\n');

      // Mensagem de inicialização para admins
      await this.notifyAdmins('🚀 Bot Fair Câmbio iniciado e operacional!');
    }

    if (connection === 'connecting') {
      console.log('🔄 Conectando ao WhatsApp...');
    }
  }

  shouldReconnect(lastDisconnect) {
    if (!lastDisconnect?.error) return false;

    const reason = lastDisconnect.error?.output?.statusCode;
    const { shouldReconnect } = this.sessionManager.handleDisconnect(reason);

    return shouldReconnect;
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.sock) {
        const now = new Date();
        const uptime = Math.floor((now - this.connectionStartTime) / 1000);

        // Send heartbeat to dashboard
        this.sendToDashboard('heartbeat', {
          uptime: uptime,
          connectionTime: this.connectionStartTime,
          lastUpdate: now,
          isConnected: this.isConnected
        });

        // Log connection status every hour
        if (uptime % 3600 === 0 && uptime > 0) {
          console.log(`💓 Heartbeat: Conectado há ${Math.floor(uptime/3600)} horas`);
          this.sendToDashboard('addLog', `💓 Bot conectado há ${Math.floor(uptime/3600)} horas`);
        }
      }
    }, 30000); // Every 30 seconds
  }

  getConnectionStats() {
    if (!this.connectionStartTime) {
      return null;
    }

    const now = new Date();
    const uptime = Math.floor((now - this.connectionStartTime) / 1000);

    return {
      isConnected: this.isConnected,
      connectionStartTime: this.connectionStartTime,
      lastDisconnectTime: this.lastDisconnectTime,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
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
      console.error('❌ Erro ao processar mensagens:', error);
    }
  }

  async processMessage(msg) {
    try {
      const from = msg.key.remoteJid;
      const pushName = msg.pushName || 'Cliente';
      const messageText = msg.message.conversation ||
        msg.message.extendedTextMessage?.text || '';

      if (!messageText) return;

      console.log(`📩 Mensagem de ${pushName} (${from}): ${messageText}`);

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
        return;
      }

      const userId = from.split('@')[0];

      // Verifica se é comando do atendente (assumir/finalizar)
      const attendantCommand = this.menuHandler.handleAttendantCommand(messageText, userId);
      if (attendantCommand) {
        await this.sendMessage(from, attendantCommand);
        await this.sock.sendPresenceUpdate('paused', from);
        return;
      }

      // Verifica se é primeira interação
      if (this.menuHandler.isFirstInteraction(userId)) {
        const welcomeMessage = this.menuHandler.handleFirstInteraction(userId, pushName);
        await this.sendMessage(from, welcomeMessage);
      } else {
        // Processa mensagem normal (passa a instância do bot para notificações)
        const response = await this.menuHandler.handleMessage(messageText, userId, null, this);

        // Se response for null, significa que usuário está em atendimento humano
        if (response) {
          await this.sendMessage(from, response);
        }
      }

      await this.sock.sendPresenceUpdate('paused', from);
      await this.logMessage(from, pushName, messageText);

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }

  async sendMessage(to, text) {
    try {
      await this.sock.sendMessage(to, {
        text: text
      });

      console.log(`✅ Mensagem enviada para ${to}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${to}:`, error);
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
        console.error(`Erro ao notificar admin ${admin}:`, error);
      }
    }
  }

  async logMessage(from, name, message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      from,
      name,
      message
    };

    const logPath = path.join(__dirname, '../logs', `chat-${new Date().toISOString().split('T')[0]}.json`);

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
      console.error('Erro ao salvar log:', error);
    }
  }

  async shutdown() {
    console.log('🔄 Encerrando bot...');

    if (this.isConnected && this.sock) {
      await this.notifyAdmins('⚠️ Bot Fair Câmbio está sendo desligado');
      await this.sock.logout();
    }

    process.exit(0);
  }
}

// Inicialização
const bot = new WhatsAppBot();

// Tratamento de sinais
process.on('SIGINT', async () => {
  console.log('\n⚠️ Sinal de interrupção recebido');
  await bot.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Sinal de término recebido');
  await bot.shutdown();
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promise rejeitada não tratada:', error);
  process.exit(1);
});

// Inicia o bot
bot.initialize().catch(console.error);
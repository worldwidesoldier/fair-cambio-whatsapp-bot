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
const express = require('express');
const http = require('http');

// Handlers
const MenuHandler = require('./handlers/menu');
const AdminHandler = require('./handlers/admin');
const SessionManager = require('./utils/session');
const { formatPhoneNumber, createMessageHeader } = require('./utils/formatter');
const io = require('socket.io-client');

class WhatsAppBotEnhanced {
  constructor() {
    this.sessionManager = new SessionManager();
    this.menuHandler = new MenuHandler();
    this.adminHandler = new AdminHandler();
    this.sock = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.dashboardSocket = null;
    this.connectionStartTime = null;
    this.lastDisconnectTime = null;
    this.reconnectTimeout = null;
    this.heartbeatInterval = null;
    this.backoffDelays = [1000, 2000, 5000, 10000, 20000, 30000];

    // Enhanced sync capabilities
    this.syncPort = process.env.BOT_SYNC_PORT || 3002;
    this.botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.syncServer = null;
    this.syncApp = null;

    // Cache para dados sincronizados
    this.cachedRates = null;
    this.cachedBranches = null;
    this.cachedMessages = null;
    this.lastSyncUpdate = null;
  }

  async initialize() {
    console.log(`🚀 Iniciando Fair Câmbio Bot Enhanced (ID: ${this.botId})...`);

    try {
      // Inicializar servidor de sincronização
      await this.initializeSyncServer();

      // Connect to dashboard server
      this.connectToDashboard();

      // Registrar bot no backend
      await this.registerWithBackend();

      await this.ensureDirectories();
      await this.loadInitialData();
      await this.connect();
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      process.exit(1);
    }
  }

  async initializeSyncServer() {
    this.syncApp = express();
    this.syncApp.use(express.json());

    // Endpoint para receber sincronizações do backend
    this.syncApp.post('/api/sync', (req, res) => {
      const { action, data, timestamp, id } = req.body;
      console.log(`🔄 SYNC recebido via HTTP: ${action} (${id})`);

      this.handleSyncMessage(action, data, timestamp);
      res.json({ success: true, received: action, id });
    });

    // Health check
    this.syncApp.get('/health', (req, res) => {
      res.json({
        botId: this.botId,
        status: this.isConnected ? 'connected' : 'disconnected',
        lastSync: this.lastSyncUpdate,
        uptime: process.uptime()
      });
    });

    this.syncServer = http.createServer(this.syncApp);
    this.syncServer.listen(this.syncPort, () => {
      console.log(`🔌 Bot sync server rodando na porta ${this.syncPort}`);
    });
  }

  async registerWithBackend() {
    try {
      const response = await fetch('http://localhost:3001/api/bot-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: this.botId,
          port: this.syncPort,
          capabilities: ['messages', 'rates', 'branches', 'qr']
        })
      });

      if (response.ok) {
        console.log('✅ Bot registrado no backend com sucesso');
      } else {
        console.log('⚠️ Falha ao registrar bot no backend');
      }
    } catch (error) {
      console.log('⚠️ Backend não disponível para registro:', error.message);
    }
  }

  connectToDashboard() {
    try {
      this.dashboardSocket = io('http://localhost:3001');

      this.dashboardSocket.on('connect', () => {
        console.log('📊 Conectado ao dashboard via WebSocket');

        // Identificar como bot
        this.dashboardSocket.emit('bot-identify', {
          botId: this.botId,
          port: this.syncPort,
          capabilities: ['messages', 'rates', 'branches', 'qr']
        });
      });

      this.dashboardSocket.on('disconnect', () => {
        console.log('📊 Desconectado do dashboard');
      });

      this.dashboardSocket.on('error', (error) => {
        console.log('📊 Erro de conexão com dashboard:', error.message);
      });

      // Listen for sync messages via WebSocket
      this.dashboardSocket.on('botSync', (syncData) => {
        const { action, data, timestamp } = syncData;
        console.log(`🔄 SYNC recebido via WS: ${action}`);
        this.handleSyncMessage(action, data, timestamp);
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

  // MÉTODO PRINCIPAL: Processar mensagens de sincronização
  async handleSyncMessage(action, data, timestamp) {
    this.lastSyncUpdate = timestamp;

    try {
      switch (action) {
        case 'initialSync':
          console.log('🔄 Processando sincronização inicial...');
          await this.handleInitialSync(data);
          break;

        case 'reloadMessages':
          console.log('🔄 Recarregando mensagens...');
          await this.handleMessagesSync(data);
          break;

        case 'updateRates':
          console.log('🔄 Atualizando cotações...');
          await this.handleRatesSync(data);
          break;

        case 'updateBranches':
          console.log('🔄 Atualizando filiais...');
          await this.handleBranchesSync(data);
          break;

        default:
          console.log(`⚠️ Ação de sync desconhecida: ${action}`);
      }

      // Enviar confirmação de recebimento
      this.sendStatusUpdate({
        lastSync: timestamp,
        action: action,
        status: 'processed'
      });

    } catch (error) {
      console.error(`❌ Erro ao processar sync ${action}:`, error);
      this.sendStatusUpdate({
        lastSync: timestamp,
        action: action,
        status: 'error',
        error: error.message
      });
    }
  }

  async handleInitialSync(data) {
    const { exchangeRates, branches, botStatus } = data;

    // Atualizar cache local
    this.cachedRates = exchangeRates;
    this.cachedBranches = branches;

    // Salvar dados localmente se necessário
    await this.saveRatesToFile(exchangeRates);
    await this.saveBranchesToFile(branches);

    console.log(`✅ Sync inicial: ${exchangeRates?.length || 0} cotações, ${branches?.length || 0} filiais`);
  }

  async handleMessagesSync(data) {
    const { messages, category } = data;

    // Atualizar cache de mensagens
    this.cachedMessages = messages;

    // Salvar mensagens no arquivo local
    await this.saveMessagesToFile(messages);

    // Recarregar handler de menu com novas mensagens
    this.menuHandler = new MenuHandler();
    await this.menuHandler.loadMessages();

    console.log(`✅ Mensagens sincronizadas: categoria ${category || 'todas'}`);
  }

  async handleRatesSync(data) {
    const { rates, currency, buyRate, sellRate } = data;

    // Atualizar cache local
    this.cachedRates = rates;

    // Salvar cotações no arquivo local
    await this.saveRatesToFile(rates);

    console.log(`✅ Cotações sincronizadas: ${currency} C:${buyRate} V:${sellRate}`);
  }

  async handleBranchesSync(data) {
    const { branches, branchData } = data;

    // Atualizar cache local
    this.cachedBranches = branches;

    // Salvar filiais no arquivo local
    await this.saveBranchesToFile(branches);

    console.log(`✅ Filiais sincronizadas: ${branchData?.name || 'atualização geral'}`);
  }

  // Salvar dados em arquivos locais
  async saveRatesToFile(rates) {
    try {
      const ratesPath = path.join(__dirname, 'config/rates.json');
      const ratesData = {
        currencies: {},
        lastUpdate: new Date().toISOString()
      };

      rates.forEach(rate => {
        ratesData.currencies[rate.currency] = {
          name: this.getCurrencyName(rate.currency),
          emoji: this.getCurrencyEmoji(rate.currency),
          buy: rate.buyRate,
          sell: rate.sellRate
        };
      });

      await fs.writeFile(ratesPath, JSON.stringify(ratesData, null, 2));
      console.log('💾 Cotações salvas em rates.json');
    } catch (error) {
      console.error('❌ Erro ao salvar cotações:', error);
    }
  }

  async saveBranchesToFile(branches) {
    try {
      const branchesPath = path.join(__dirname, 'config/branches.json');
      const branchesData = {
        branches: branches,
        lastUpdate: new Date().toISOString()
      };

      await fs.writeFile(branchesPath, JSON.stringify(branchesData, null, 2));
      console.log('💾 Filiais salvas em branches.json');
    } catch (error) {
      console.error('❌ Erro ao salvar filiais:', error);
    }
  }

  async saveMessagesToFile(messages) {
    try {
      const messagesPath = path.join(__dirname, 'config/messages.json');
      await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2));
      console.log('💾 Mensagens salvas em messages.json');
    } catch (error) {
      console.error('❌ Erro ao salvar mensagens:', error);
    }
  }

  getCurrencyName(currency) {
    const names = {
      'USD': 'Dólar Americano',
      'EUR': 'Euro',
      'GBP': 'Libra Esterlina',
      'ARS': 'Peso Argentino',
      'UYU': 'Peso Uruguaio'
    };
    return names[currency] || currency;
  }

  getCurrencyEmoji(currency) {
    const emojis = {
      'USD': '🇺🇸',
      'EUR': '🇪🇺',
      'GBP': '🇬🇧',
      'ARS': '🇦🇷',
      'UYU': '🇺🇾'
    };
    return emojis[currency] || '💱';
  }

  // Enviar atualizações de status para o backend
  sendStatusUpdate(statusData) {
    if (this.dashboardSocket && this.dashboardSocket.connected) {
      this.dashboardSocket.emit('bot-status-update', {
        botId: this.botId,
        connected: this.isConnected,
        connectionStatus: this.getConnectionStatus(),
        ...statusData,
        timestamp: new Date().toISOString()
      });
    }
  }

  getConnectionStatus() {
    if (this.isConnected) return 'connected';
    if (this.sock) return 'connecting';
    return 'disconnected';
  }

  async loadInitialData() {
    try {
      // Carregar dados dos arquivos se existirem
      const ratesPath = path.join(__dirname, 'config/rates.json');
      const branchesPath = path.join(__dirname, 'config/branches.json');
      const messagesPath = path.join(__dirname, 'config/messages.json');

      if (await this.fileExists(ratesPath)) {
        const ratesData = JSON.parse(await fs.readFile(ratesPath, 'utf8'));
        this.cachedRates = Object.entries(ratesData.currencies || {}).map(([currency, data]) => ({
          id: currency,
          currency,
          symbol: data.emoji || '💱',
          buyRate: data.buy,
          sellRate: data.sell,
          lastUpdated: new Date(ratesData.lastUpdate || Date.now())
        }));
        console.log(`📊 ${this.cachedRates.length} cotações carregadas do cache`);
      }

      if (await this.fileExists(branchesPath)) {
        const branchesData = JSON.parse(await fs.readFile(branchesPath, 'utf8'));
        this.cachedBranches = branchesData.branches || [];
        console.log(`🏢 ${this.cachedBranches.length} filiais carregadas do cache`);
      }

      if (await this.fileExists(messagesPath)) {
        const messagesData = JSON.parse(await fs.readFile(messagesPath, 'utf8'));
        this.cachedMessages = messagesData;
        console.log(`💬 Mensagens carregadas do cache`);
      }

    } catch (error) {
      console.log('⚠️ Erro ao carregar dados iniciais:', error.message);
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.join(__dirname, '../sessions'),
      path.join(__dirname, '../logs'),
      path.join(__dirname, 'config')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Diretório já existe ou erro ao criar
      }
    }
  }

  async connect() {
    try {
      console.log('🔐 Carregando sessão...');
      const { state, saveCreds } = await useMultiFileAuthState('./sessions');

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        defaultQueryTimeoutMs: 20000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        markOnlineOnConnect: true,
        emitOwnEvents: false,
        shouldIgnoreJid: jid => jid.includes('@broadcast'),
        retryRequestDelayMs: 250
      });

      this.sock.ev.on('creds.update', saveCreds);
      this.setupEventHandlers();

      this.connectionStartTime = Date.now();
      console.log('🔌 Conectando ao WhatsApp...');

    } catch (error) {
      console.error('❌ Erro na conexão:', error);
      this.scheduleReconnection();
    }
  }

  setupEventHandlers() {
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.handleQRCode(qr);
      }

      if (connection === 'close') {
        this.handleDisconnection(lastDisconnect);
      } else if (connection === 'open') {
        this.handleConnection();
      }
    });

    this.sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.key.fromMe && m.type === 'notify') {
        await this.handleMessage(message);
      }
    });
  }

  async handleQRCode(qr) {
    console.log('📱 QR Code gerado');

    try {
      const qrString = await QRCode.toString(qr, { type: 'terminal', small: true });
      console.log(qrString);

      // Enviar QR Code para o backend
      this.sendQRToBackend(qr);

      // Atualizar status
      this.sendStatusUpdate({
        connectionStatus: 'qr',
        qrCode: qr
      });

    } catch (error) {
      console.error('❌ Erro ao processar QR Code:', error);
    }
  }

  sendQRToBackend(qrCode) {
    // Enviar via HTTP POST
    fetch('http://localhost:3001/api/bot-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'qrCode',
        data: qrCode,
        branchId: this.botId
      })
    }).catch(error => {
      console.log('⚠️ Erro ao enviar QR para backend:', error.message);
    });
  }

  async handleConnection() {
    console.log('✅ Bot conectado ao WhatsApp!');

    this.isConnected = true;
    this.reconnectAttempts = 0;

    const phone = this.sock.user?.id || 'Conectado';

    // Enviar status de conexão para o backend
    this.sendConnectedStatus(phone);

    // Atualizar status
    this.sendStatusUpdate({
      connected: true,
      connectionStatus: 'connected',
      phone: phone
    });

    // Iniciar heartbeat
    this.startHeartbeat();
  }

  sendConnectedStatus(phone) {
    // Enviar via HTTP POST
    fetch('http://localhost:3001/api/bot-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'setBotConnected',
        data: {
          branchId: this.botId,
          branchName: `Bot ${this.botId}`,
          phone: phone
        }
      })
    }).catch(error => {
      console.log('⚠️ Erro ao enviar status conectado:', error.message);
    });
  }

  async handleDisconnection(lastDisconnect) {
    this.isConnected = false;
    this.lastDisconnectTime = Date.now();

    // Parar heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

    console.log(`🔌 Desconectado. Reconectar: ${shouldReconnect}`);

    // Atualizar status
    this.sendStatusUpdate({
      connected: false,
      connectionStatus: 'disconnected'
    });

    if (shouldReconnect) {
      this.scheduleReconnection();
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendStatusUpdate({
          heartbeat: new Date().toISOString(),
          uptime: process.uptime()
        });
      }
    }, 30000); // A cada 30 segundos
  }

  scheduleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Máximo de tentativas de reconexão atingido');
      return;
    }

    const delay = this.backoffDelays[Math.min(this.reconnectAttempts, this.backoffDelays.length - 1)];
    this.reconnectAttempts++;

    console.log(`🔄 Reagendando reconexão em ${delay}ms (tentativa ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  async handleMessage(message) {
    try {
      const text = message.message?.conversation ||
                   message.message?.extendedTextMessage?.text ||
                   '';

      if (!text) return;

      const sender = message.key.remoteJid;
      const senderName = message.pushName || sender.split('@')[0];

      console.log(`📨 Mensagem de ${senderName}: ${text}`);

      // Usar dados do cache se disponível, senão usar dados padrão
      const response = await this.menuHandler.handleMessage(text, {
        rates: this.cachedRates,
        branches: this.cachedBranches,
        messages: this.cachedMessages
      });

      if (response) {
        await this.sock.sendMessage(sender, { text: response });
        console.log(`📤 Resposta enviada para ${senderName}`);
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }

  async generateNewQR() {
    if (this.sock) {
      try {
        console.log('🔄 Gerando novo QR Code...');
        // Implementar geração de novo QR se necessário
      } catch (error) {
        console.error('❌ Erro ao gerar QR:', error);
      }
    }
  }

  async disconnect() {
    console.log('🛑 Desconectando bot...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.sock) {
      await this.sock.logout();
    }

    this.isConnected = false;
  }

  async reconnect() {
    console.log('🔄 Reconectando bot...');
    await this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 2000);
  }
}

// Inicializar bot se executado diretamente
if (require.main === module) {
  const bot = new WhatsAppBotEnhanced();
  bot.initialize().catch(error => {
    console.error('❌ Falha crítica:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando bot...');
    await bot.disconnect();
    if (bot.syncServer) {
      bot.syncServer.close();
    }
    process.exit(0);
  });
}

module.exports = WhatsAppBotEnhanced;
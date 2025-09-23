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
const CleanupService = require('./utils/cleanup-service');
const PerformanceMonitor = require('./utils/performance-monitor');
const io = require('socket.io-client');

class WhatsAppBotEnhanced {
  constructor() {
    this.sessionManager = new SessionManager();
    this.menuHandler = new MenuHandler();
    this.adminHandler = new AdminHandler();
    this.sock = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // Infinite reconnection attempts
    this.dashboardSocket = null;
    this.connectionStartTime = null;
    this.lastDisconnectTime = null;
    this.reconnectTimeout = null;
    this.heartbeatInterval = null;
    this.backoffDelays = [1000, 2000, 5000, 10000, 20000, 30000, 60000]; // Extended backoff delays

    // Enhanced backoff with intelligent progression
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 30000; // 30 seconds maximum
    this.backoffMultiplier = 2;
    this.consecutiveFailures = 0;
    this.lastSuccessfulConnection = null;

    // Connection tracking and fallback system
    this.connectionHistory = [];
    this.disconnectionReasons = new Map();
    this.fallbackMethods = ['default', 'legacy', 'mobile'];
    this.currentFallbackIndex = 0;

    // Session management and corruption detection
    this.sessionCorruptionIndicators = 0;
    this.sessionPath = './sessions';
    this.sessionBackupPath = './sessions-backup';
    this.lastSessionCleanup = null;
    this.autoRestartTimeout = null;
    this.sessionCleanupTimeout = null;

    // Memory management
    this.memoryCleanupInterval = null;
    this.lastMemoryCleanup = Date.now();
    this.memoryThreshold = 150 * 1024 * 1024; // 150MB threshold

    // Cleanup service
    this.cleanupService = new CleanupService({
      enableAutoCleanup: true,
      logRetentionDays: 7,
      sessionRetentionDays: 30,
      cacheRetentionDays: 3,
      maxLogFileSize: 50,
      logsDir: './logs',
      sessionsDir: './sessions',
      backupDir: './sessions-backup'
    });

    // Performance monitor
    this.performanceMonitor = new PerformanceMonitor({
      memoryThresholdMB: 200,
      cpuThresholdPercent: 80,
      diskSpaceThresholdGB: 1,
      enableAlerts: true,
      logToFile: true,
      logFilePath: './logs/performance.log'
    });

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

    // Initialize enhanced error handling
    this.setupEnhancedErrorHandling();

    // Schedule auto-restart (24 hours)
    this.scheduleAutoRestart();
  }

  async initialize() {
    console.log(`🚀 Iniciando Fair Câmbio Bot Enhanced (ID: ${this.botId})...`);

    try {
      // Start performance monitoring
      this.performanceMonitor.setBotReference(this);
      this.performanceMonitor.start();

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
      this.performanceMonitor.recordError(error);
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
    this.syncApp.get('/health', async (req, res) => {
      const health = await this.performanceMonitor.performHealthCheck();
      res.json({
        botId: this.botId,
        status: this.isConnected ? 'connected' : 'disconnected',
        lastSync: this.lastSyncUpdate,
        uptime: process.uptime(),
        health: health
      });
    });

    // Performance metrics endpoint
    this.syncApp.get('/metrics', async (req, res) => {
      const metrics = await this.performanceMonitor.getMetrics();
      res.json({
        botId: this.botId,
        timestamp: new Date().toISOString(),
        metrics: metrics
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

        // Optimized timeouts for stability
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,

        // Connection optimization
        markOnlineOnConnect: true,
        emitOwnEvents: false,
        shouldIgnoreJid: jid => jid.includes('@broadcast'),
        retryRequestDelayMs: 1000,

        // Enhanced stability settings
        experimentalStore: true,
        timeRelease: 10000,

        // Socket optimization
        socketConfig: {
          timeout: 60000,
          keepAlive: true,
          keepAliveInitialDelay: 10000
        },

        // Message handling optimization
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,

        // Performance settings
        maxMsgRetryCount: 5,
        msgRetryCounterCache: new Map(),

        // Memory optimization
        cachedGroupMetadata: new Map(),
        shouldIgnoreJid: jid => {
          if (jid.includes('@broadcast')) return true;
          if (jid.includes('@newsletter')) return true;
          return false;
        }
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
    this.consecutiveFailures = 0; // Reset failure counter
    this.lastSuccessfulConnection = Date.now(); // Track successful connection
    this.sessionCorruptionIndicators = 0; // Reset corruption indicators

    // Record successful connection
    this.performanceMonitor.recordConnection(true, {
      attempts: this.reconnectAttempts,
      method: this.fallbackMethods[this.currentFallbackIndex]
    });

    const phone = this.sock.user?.id || 'Conectado';

    // Log connection history
    this.connectionHistory.push({
      timestamp: Date.now(),
      success: true,
      phone: phone,
      attempt: this.reconnectAttempts
    });

    // Keep only last 10 connection records
    if (this.connectionHistory.length > 10) {
      this.connectionHistory = this.connectionHistory.slice(-10);
    }

    console.log(`📈 Conexão bem-sucedida após ${this.reconnectAttempts} tentativas`);

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

    // Iniciar monitoramento de memória
    this.startMemoryMonitoring();
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

    // Enhanced disconnect reason detection
    const disconnectReason = this.analyzeDisconnectReason(lastDisconnect);
    const shouldReconnect = this.shouldReconnectAfterDisconnect(disconnectReason);

    console.log(`🔌 Desconectado. Motivo: ${disconnectReason.type} | Reconectar: ${shouldReconnect}`);
    console.log(`📊 Detalhes: ${disconnectReason.description}`);

    // Track disconnect reason for analytics
    this.trackDisconnectReason(disconnectReason);

    // Record failed connection
    this.performanceMonitor.recordConnection(false, {
      reason: disconnectReason.type,
      attempts: this.reconnectAttempts
    });

    // Log disconnect to history
    this.connectionHistory.push({
      timestamp: Date.now(),
      success: false,
      reason: disconnectReason.type,
      shouldReconnect: shouldReconnect
    });

    // Atualizar status
    this.sendStatusUpdate({
      connected: false,
      connectionStatus: 'disconnected',
      disconnectReason: disconnectReason.type
    });

    if (shouldReconnect) {
      this.scheduleReconnection();
    } else {
      console.log('🛑 Não reconectando devido ao tipo de desconexão:', disconnectReason.type);
    }
  }

  analyzeDisconnectReason(lastDisconnect) {
    if (!lastDisconnect?.error?.output?.statusCode) {
      return {
        type: 'unknown',
        description: 'Desconexão sem código de status',
        shouldReconnect: true
      };
    }

    const statusCode = lastDisconnect.error.output.statusCode;

    switch (statusCode) {
      case DisconnectReason.badSession:
        this.sessionCorruptionIndicators++;
        return {
          type: 'badSession',
          description: 'Sessão corrompida ou inválida',
          shouldReconnect: true
        };

      case DisconnectReason.connectionClosed:
        return {
          type: 'connectionClosed',
          description: 'Conexão fechada pelo servidor',
          shouldReconnect: true
        };

      case DisconnectReason.connectionLost:
        return {
          type: 'connectionLost',
          description: 'Conexão perdida (rede)',
          shouldReconnect: true
        };

      case DisconnectReason.connectionReplaced:
        return {
          type: 'connectionReplaced',
          description: 'Conexão substituída por outra instância',
          shouldReconnect: false
        };

      case DisconnectReason.loggedOut:
        return {
          type: 'loggedOut',
          description: 'Usuário fez logout do WhatsApp',
          shouldReconnect: false
        };

      case DisconnectReason.restartRequired:
        return {
          type: 'restartRequired',
          description: 'Restart necessário',
          shouldReconnect: true
        };

      case DisconnectReason.timedOut:
        return {
          type: 'timedOut',
          description: 'Timeout de conexão',
          shouldReconnect: true
        };

      default:
        return {
          type: 'other',
          description: `Código desconhecido: ${statusCode}`,
          shouldReconnect: true
        };
    }
  }

  shouldReconnectAfterDisconnect(disconnectReason) {
    // Never reconnect for certain disconnect types
    const noReconnectTypes = ['loggedOut', 'connectionReplaced'];

    if (noReconnectTypes.includes(disconnectReason.type)) {
      return false;
    }

    return true;
  }

  trackDisconnectReason(reasonOrError) {
    const reason = typeof reasonOrError === 'string' ? reasonOrError :
                  reasonOrError?.type || 'unknown';

    if (!this.disconnectionReasons.has(reason)) {
      this.disconnectionReasons.set(reason, 0);
    }

    this.disconnectionReasons.set(reason, this.disconnectionReasons.get(reason) + 1);

    // Log statistics periodically
    if (this.disconnectionReasons.get(reason) % 5 === 0) {
      console.log(`📊 Estatísticas de desconexão:`, Array.from(this.disconnectionReasons.entries()));
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
    // INFINITE RECONNECTION - Never give up!
    this.reconnectAttempts++;
    this.consecutiveFailures++;

    // Calculate intelligent backoff delay
    const delay = this.calculateBackoffDelay();

    // Log connection attempt info
    const timeSinceLastSuccess = this.lastSuccessfulConnection
      ? Date.now() - this.lastSuccessfulConnection
      : 'never';

    console.log(`🔄 Reagendando reconexão em ${delay}ms`);
    console.log(`📊 Tentativa: ${this.reconnectAttempts} | Falhas consecutivas: ${this.consecutiveFailures}`);
    console.log(`⏰ Última conexão bem-sucedida: ${timeSinceLastSuccess === 'never' ? 'nunca' : Math.round(timeSinceLastSuccess/1000) + 's atrás'}`);

    // Check if session cleanup is needed
    if (this.shouldCleanSession()) {
      console.log('🧹 Iniciando limpeza de sessão corrompida...');
      this.scheduleSessionCleanup();
    }

    // Check if fallback method should be used
    if (this.shouldUseFallback()) {
      this.rotateFallbackMethod();
    }

    this.reconnectTimeout = setTimeout(async () => {
      await this.reconnectWithBackoff();
    }, delay);
  }

  calculateBackoffDelay() {
    // Exponential backoff with jitter and max cap
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, Math.min(this.consecutiveFailures - 1, 5));
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;

    return Math.floor(cappedDelay + jitter);
  }

  shouldCleanSession() {
    // Clean session if:
    // 1. Too many consecutive failures (> 15)
    // 2. Connection attempts span more than 10 minutes
    // 3. Specific disconnect reasons indicate corruption

    if (this.consecutiveFailures > 15) {
      console.log('🧹 Limpeza necessária: muitas falhas consecutivas');
      return true;
    }

    if (this.connectionStartTime && (Date.now() - this.connectionStartTime) > 600000) {
      console.log('🧹 Limpeza necessária: tentativas por mais de 10 minutos');
      return true;
    }

    if (this.sessionCorruptionIndicators > 3) {
      console.log('🧹 Limpeza necessária: indicadores de corrupção de sessão');
      return true;
    }

    return false;
  }

  shouldUseFallback() {
    // Use fallback every 10 consecutive failures
    return this.consecutiveFailures > 0 && this.consecutiveFailures % 10 === 0;
  }

  rotateFallbackMethod() {
    this.currentFallbackIndex = (this.currentFallbackIndex + 1) % this.fallbackMethods.length;
    const method = this.fallbackMethods[this.currentFallbackIndex];
    console.log(`🔄 Alternando para método de conexão: ${method}`);
  }

  async reconnectWithBackoff() {
    try {
      console.log(`🔌 Tentativa de reconexão #${this.reconnectAttempts}`);

      // Try current fallback method
      await this.connectWithMethod(this.fallbackMethods[this.currentFallbackIndex]);

    } catch (error) {
      console.error(`❌ Falha na reconexão #${this.reconnectAttempts}:`, error.message);

      // Track disconnect reason
      this.trackDisconnectReason(error);

      // Record error in performance monitor
      this.performanceMonitor.recordError(error);

      // Schedule next attempt
      this.scheduleReconnection();
    }
  }

  async handleMessage(message) {
    const startTime = Date.now();

    try {
      const text = message.message?.conversation ||
                   message.message?.extendedTextMessage?.text ||
                   '';

      if (!text) return;

      const sender = message.key.remoteJid;
      const senderName = message.pushName || sender.split('@')[0];

      console.log(`📨 Mensagem de ${senderName}: ${text}`);

      // Record message received
      this.performanceMonitor.recordMessage();

      // Usar dados do cache se disponível, senão usar dados padrão
      // Precisamos determinar a filial baseada no remetente ou usar configuração geral
      let branchConfig = null;

      // Se temos branches em cache, usar a primeira como padrão
      if (this.cachedBranches && this.cachedBranches.length > 0) {
        branchConfig = null; // null = mostrar todas as filiais
      }

      const response = await this.menuHandler.handleMessage(text, sender, branchConfig, this);

      if (response) {
        await this.sock.sendMessage(sender, { text: response });
        console.log(`📤 Resposta enviada para ${senderName}`);

        // Record response time
        const responseTime = Date.now() - startTime;
        this.performanceMonitor.recordResponse(responseTime);
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      this.performanceMonitor.recordError(error);
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

  // ==================== SESSION MANAGEMENT ====================

  async scheduleSessionCleanup() {
    if (this.sessionCleanupTimeout) {
      clearTimeout(this.sessionCleanupTimeout);
    }

    this.sessionCleanupTimeout = setTimeout(async () => {
      await this.cleanCorruptedSession();
    }, 5000); // Wait 5 seconds before cleaning
  }

  async cleanCorruptedSession() {
    console.log('🧹 Iniciando limpeza de sessão corrompida...');

    try {
      // Backup current session before cleaning
      await this.backupSession();

      // Remove current session files
      await this.removeSessionFiles();

      // Reset corruption indicators
      this.sessionCorruptionIndicators = 0;
      this.lastSessionCleanup = Date.now();

      console.log('✅ Sessão corrompida limpa com sucesso');

      // Reset connection counters to give fresh start
      this.consecutiveFailures = Math.floor(this.consecutiveFailures / 2);

    } catch (error) {
      console.error('❌ Erro ao limpar sessão corrompida:', error);
    }
  }

  async backupSession() {
    try {
      const sessionExists = await this.fileExists(this.sessionPath);
      if (!sessionExists) return;

      // Create backup directory
      await fs.mkdir(this.sessionBackupPath, { recursive: true });

      // Copy session files to backup
      const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.sessionBackupPath, `session_backup_${backupTimestamp}`);

      await fs.mkdir(backupPath, { recursive: true });

      // Copy all session files
      const sessionFiles = await fs.readdir(this.sessionPath);
      for (const file of sessionFiles) {
        const srcPath = path.join(this.sessionPath, file);
        const destPath = path.join(backupPath, file);
        await fs.copyFile(srcPath, destPath);
      }

      console.log(`💾 Sessão backup criado em: ${backupPath}`);

      // Keep only last 5 backups
      await this.cleanOldBackups();

    } catch (error) {
      console.log('⚠️ Erro ao fazer backup da sessão:', error.message);
    }
  }

  async removeSessionFiles() {
    try {
      const sessionExists = await this.fileExists(this.sessionPath);
      if (!sessionExists) return;

      const sessionFiles = await fs.readdir(this.sessionPath);
      for (const file of sessionFiles) {
        const filePath = path.join(this.sessionPath, file);
        await fs.unlink(filePath);
      }

      console.log('🗑️ Arquivos de sessão removidos');

    } catch (error) {
      console.log('⚠️ Erro ao remover arquivos de sessão:', error.message);
    }
  }

  async cleanOldBackups() {
    try {
      const backupExists = await this.fileExists(this.sessionBackupPath);
      if (!backupExists) return;

      const backups = await fs.readdir(this.sessionBackupPath);
      if (backups.length <= 5) return;

      // Sort by creation time and remove oldest
      const backupDetails = await Promise.all(
        backups.map(async (backup) => {
          const backupPath = path.join(this.sessionBackupPath, backup);
          const stats = await fs.stat(backupPath);
          return { name: backup, path: backupPath, created: stats.birthtimeMs };
        })
      );

      backupDetails.sort((a, b) => a.created - b.created);

      // Remove oldest backups (keep only last 5)
      const toRemove = backupDetails.slice(0, -5);
      for (const backup of toRemove) {
        await fs.rmdir(backup.path, { recursive: true });
        console.log(`🗑️ Backup antigo removido: ${backup.name}`);
      }

    } catch (error) {
      console.log('⚠️ Erro ao limpar backups antigos:', error.message);
    }
  }

  // ==================== FALLBACK CONNECTION METHODS ====================

  async connectWithMethod(method) {
    console.log(`🔌 Conectando com método: ${method}`);

    switch (method) {
      case 'default':
        return await this.connect();

      case 'legacy':
        return await this.connectWithLegacyConfig();

      case 'mobile':
        return await this.connectWithMobileConfig();

      default:
        return await this.connect();
    }
  }

  async connectWithLegacyConfig() {
    try {
      console.log('🔐 Carregando sessão (modo legado)...');
      const { state, saveCreds } = await useMultiFileAuthState('./sessions');

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'), // Different browser
        syncFullHistory: false,

        // Legacy timeouts
        defaultQueryTimeoutMs: 30000,
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,

        // Basic settings
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        shouldIgnoreJid: jid => jid.includes('@broadcast'),
        retryRequestDelayMs: 500
      });

      this.sock.ev.on('creds.update', saveCreds);
      this.setupEventHandlers();

      this.connectionStartTime = Date.now();
      console.log('🔌 Conectando ao WhatsApp (modo legado)...');

    } catch (error) {
      console.error('❌ Erro na conexão legada:', error);
      throw error;
    }
  }

  async connectWithMobileConfig() {
    try {
      console.log('🔐 Carregando sessão (modo móvel)...');
      const { state, saveCreds } = await useMultiFileAuthState('./sessions');

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Safari'), // Mobile-like browser
        syncFullHistory: false,

        // Mobile-optimized timeouts
        defaultQueryTimeoutMs: 45000,
        connectTimeoutMs: 45000,
        keepAliveIntervalMs: 20000,

        // Mobile settings
        markOnlineOnConnect: true,
        emitOwnEvents: false,
        shouldIgnoreJid: jid => jid.includes('@broadcast'),
        retryRequestDelayMs: 750,

        // Reduced performance for stability
        maxMsgRetryCount: 3,
        cachedGroupMetadata: new Map()
      });

      this.sock.ev.on('creds.update', saveCreds);
      this.setupEventHandlers();

      this.connectionStartTime = Date.now();
      console.log('🔌 Conectando ao WhatsApp (modo móvel)...');

    } catch (error) {
      console.error('❌ Erro na conexão móvel:', error);
      throw error;
    }
  }

  // ==================== AUTO-RESTART SYSTEM ====================

  scheduleAutoRestart() {
    // Schedule restart every 24 hours
    const RESTART_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    this.autoRestartTimeout = setTimeout(() => {
      this.performScheduledRestart();
    }, RESTART_INTERVAL);

    const restartTime = new Date(Date.now() + RESTART_INTERVAL);
    console.log(`⏰ Auto-restart agendado para: ${restartTime.toLocaleString()}`);
  }

  async performScheduledRestart() {
    console.log('🔄 Executando restart automático programado...');

    try {
      // Notify about scheduled restart
      this.sendStatusUpdate({
        connectionStatus: 'restarting',
        reason: 'scheduled_restart'
      });

      // Graceful disconnect
      await this.disconnect();

      // Clear all timers
      this.clearAllTimers();

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Perform memory cleanup
      this.performMemoryCleanup();

      // Reconnect
      await this.connect();

      // Schedule next restart
      this.scheduleAutoRestart();

      console.log('✅ Restart automático concluído');

    } catch (error) {
      console.error('❌ Erro no restart automático:', error);
      // Fallback to normal reconnection
      this.scheduleReconnection();
    }
  }

  // ==================== MEMORY MANAGEMENT ====================

  startMemoryMonitoring() {
    this.memoryCleanupInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 60000); // Check every minute

    console.log('🧠 Monitoramento de memória iniciado');
  }

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    console.log(`🧠 Memória: ${heapUsedMB.toFixed(2)}MB heap, ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB RSS`);

    // Force garbage collection if memory usage is high
    if (memUsage.heapUsed > this.memoryThreshold) {
      console.log('⚠️ Uso de memória alto, executando limpeza...');
      this.performMemoryCleanup();
    }

    // Periodic cleanup every 30 minutes
    if (Date.now() - this.lastMemoryCleanup > 1800000) {
      this.performPeriodicCleanup();
    }
  }

  performMemoryCleanup() {
    try {
      // Clear message cache if exists
      if (this.sock && this.sock.msgRetryCounterCache) {
        this.sock.msgRetryCounterCache.clear();
      }

      // Clear cached metadata
      if (this.sock && this.sock.cachedGroupMetadata) {
        this.sock.cachedGroupMetadata.clear();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️ Garbage collection executado');
      }

      this.lastMemoryCleanup = Date.now();

      const memUsage = process.memoryUsage();
      console.log(`✅ Limpeza de memória concluída: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
      console.error('❌ Erro na limpeza de memória:', error);
    }
  }

  performPeriodicCleanup() {
    console.log('🧹 Executando limpeza periódica...');

    // Clear any accumulated logs in memory
    this.clearLogBuffers();

    // Reset connection metrics
    this.resetConnectionMetrics();

    // Perform memory cleanup
    this.performMemoryCleanup();

    console.log('✅ Limpeza periódica concluída');
  }

  clearLogBuffers() {
    // Clear any internal log buffers if they exist
    if (this.sock && this.sock._logBuffer) {
      this.sock._logBuffer = [];
    }
  }

  resetConnectionMetrics() {
    // Reset connection attempt counters periodically
    if (this.reconnectAttempts > 50) {
      this.reconnectAttempts = 0;
      console.log('🔄 Contador de reconexão resetado');
    }
  }

  // ==================== ENHANCED ERROR HANDLING ====================

  setupEnhancedErrorHandling() {
    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      console.error('❌ Exceção não capturada:', error);
      console.log('🔄 Tentando recuperação automática...');

      // Try to gracefully recover
      setTimeout(() => {
        this.performEmergencyRestart();
      }, 5000);
    });

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejeitada não tratada:', reason);
      console.log('🔄 Continuando execução...');
    });

    // Memory warning handler
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        console.warn('⚠️ Muitos listeners detectados, limpando...');
        this.cleanupEventListeners();
      }
    });
  }

  async performEmergencyRestart() {
    console.log('🚨 Executando reinicialização de emergência...');

    try {
      await this.disconnect();

      // Clear all intervals and timeouts
      this.clearAllTimers();

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Reconnect
      await this.connect();

      console.log('✅ Reinicialização de emergência concluída');
    } catch (error) {
      console.error('❌ Falha na reinicialização de emergência:', error);
      process.exit(1);
    }
  }

  clearAllTimers() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  cleanupEventListeners() {
    if (this.sock && this.sock.ev) {
      // Remove excess listeners
      const events = ['connection.update', 'messages.upsert', 'creds.update'];
      events.forEach(event => {
        const listeners = this.sock.ev.listeners(event);
        if (listeners.length > 5) {
          console.log(`🧹 Limpando ${listeners.length - 1} listeners em excesso para ${event}`);
          this.sock.ev.removeAllListeners(event);
          // Re-add only the essential listeners
          this.setupEventHandlers();
        }
      });
    }
  }

  // ==================== GRACEFUL SHUTDOWN ====================

  async gracefulShutdown() {
    console.log('🛑 Iniciando encerramento gracioso...');

    try {
      // Stop performance monitor
      if (this.performanceMonitor) {
        this.performanceMonitor.stop();
        console.log('✅ Monitor de performance parado');
      }

      // Stop cleanup service
      if (this.cleanupService) {
        await this.cleanupService.stop();
        console.log('✅ Serviço de limpeza parado');
      }

      // Disconnect from WhatsApp
      await this.disconnect();
      console.log('✅ Desconectado do WhatsApp');

      // Close sync server
      if (this.syncServer) {
        this.syncServer.close();
        console.log('✅ Servidor de sincronização fechado');
      }

      // Disconnect from dashboard
      if (this.dashboardSocket) {
        this.dashboardSocket.disconnect();
        console.log('✅ Desconectado do dashboard');
      }

      // Final memory cleanup
      this.performMemoryCleanup();

      console.log('✅ Encerramento gracioso concluído');
      process.exit(0);

    } catch (error) {
      console.error('❌ Erro no encerramento gracioso:', error);
      process.exit(1);
    }
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
    await bot.gracefulShutdown();
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando bot (SIGTERM)...');
    await bot.gracefulShutdown();
  });
}

module.exports = WhatsAppBotEnhanced;
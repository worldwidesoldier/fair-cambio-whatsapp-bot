const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;

// Handlers - A única lógica que importa
const MenuHandler = require('./handlers/menu');
const AdminHandler = require('./handlers/admin');
const RatesManager = require('./handlers/rates');

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.qrGenerated = false;
    this.qrCode = null;
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Handlers essenciais
    this.menuHandler = new MenuHandler();
    this.adminHandler = new AdminHandler();
    this.ratesManager = new RatesManager();

    // Dashboard integrado
    this.app = express();
    this.server = null;
    this.dashboardPort = process.env.DASHBOARD_PORT || 3001;

    this.setupDashboard();
  }

  async initialize() {
    console.log('🚀 Iniciando WhatsBot Clean...');

    try {
      await this.startBot();
      await this.startDashboard();
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      process.exit(1);
    }
  }

  async startBot() {
    const sessionPath = path.join(__dirname, 'sessions');

    try {
      // Configuração da sessão
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version, isLatest } = await fetchLatestBaileysVersion();

      console.log(`📱 Usando Baileys v${version.join('.')}, Latest: ${isLatest}`);

      // Criação do socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, console)
        },
        printQRInTerminal: false,
        browser: ['WhatsBot Clean', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true
      });

      // Event handlers
      this.sock.ev.on('connection.update', (update) => this.handleConnection(update));
      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('messages.upsert', (m) => this.handleMessages(m));

      // Configura referência no menu handler
      this.menuHandler.setBotInstance(this);

    } catch (error) {
      console.error('❌ Erro ao iniciar bot:', error);
      throw error;
    }
  }

  handleConnection(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !this.qrGenerated) {
      console.log('📱 QR Code gerado! Escaneie com seu WhatsApp:');
      qrcode.generate(qr, { small: true });
      this.qrCode = qr;
      this.qrGenerated = true;
      this.connectionState = 'qr_generated';
    }

    if (connection === 'close') {
      this.qrGenerated = false;
      this.connectionState = 'disconnected';

      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Reconectando... Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => this.startBot(), 5000);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('❌ Máximo de tentativas de reconexão atingido');
        process.exit(1);
      } else {
        console.log('❌ Desconectado do WhatsApp');
        process.exit(0);
      }
    }

    if (connection === 'open') {
      this.reconnectAttempts = 0;
      this.connectionState = 'connected';
      console.log('✅ WhatsBot conectado com sucesso!');
      console.log(`🌐 Dashboard disponível em: http://localhost:${this.dashboardPort}`);
    }
  }

  async handleMessages(m) {
    const message = m.messages[0];
    if (!message.message || message.key.fromMe) return;

    const userId = message.key.remoteJid;
    const messageText = this.extractMessageText(message);

    if (!messageText) return;

    try {
      // Verifica comandos admin primeiro
      if (this.adminHandler.isAdmin(userId)) {
        const adminResponse = await this.adminHandler.handleCommand(messageText, userId, this.sock);
        if (adminResponse) {
          await this.sendMessage(userId, adminResponse);
          return;
        }
      }

      // Processa mensagem normal
      const response = await this.menuHandler.handleMessage(messageText, userId, null, this);

      if (response) {
        await this.sendMessage(userId, response);
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      await this.sendMessage(userId, "❌ Erro interno. Tente novamente em instantes.");
    }
  }

  extractMessageText(message) {
    return message.message.conversation ||
           message.message.extendedTextMessage?.text ||
           message.message.imageMessage?.caption ||
           '';
  }

  async sendMessage(jid, text) {
    if (!this.sock) return;

    try {
      await this.sock.sendMessage(jid, { text });
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
    }
  }

  // Dashboard integrado - Simples e funcional
  setupDashboard() {
    // CORS para permitir acesso do Next.js
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use(express.json());

    // Página principal
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });

    // API status
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: this.connectionState,
        connected: this.connectionState === 'connected',
        qrGenerated: this.qrGenerated,
        qrCode: this.qrCode,
        reconnectAttempts: this.reconnectAttempts,
        timestamp: new Date().toISOString()
      });
    });

    // API taxas
    this.app.get('/api/rates', async (req, res) => {
      try {
        const rates = await this.ratesManager.getAllRates();
        res.json(rates);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async startDashboard() {
    return new Promise((resolve) => {
      this.server = http.createServer(this.app);
      this.server.listen(this.dashboardPort, () => {
        console.log(`🌐 Dashboard iniciado na porta ${this.dashboardPort}`);
        resolve();
      });
    });
  }

  getDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsBot Clean - Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(45deg, #25D366, #128C7E);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .status {
            padding: 30px;
            text-align: center;
        }
        .status-badge {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1em;
            margin: 10px;
        }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .qr-section {
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eee;
        }
        .rates-section {
            padding: 30px;
            border-top: 1px solid #eee;
        }
        .rate-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .rate-info { display: flex; align-items: center; }
        .rate-emoji { font-size: 2em; margin-right: 15px; }
        .rate-values { text-align: right; }
        .rate-buy, .rate-sell { margin: 2px 0; }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            border-top: 1px solid #eee;
        }
        .refresh-btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            margin: 10px;
        }
        .refresh-btn:hover { background: #128C7E; }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .loading { animation: pulse 1.5s infinite; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 WhatsBot Clean</h1>
            <p>Dashboard Simplificado - Padrão da Indústria</p>
        </div>

        <div class="status">
            <h2>Status da Conexão</h2>
            <div id="status-badge" class="status-badge loading">Carregando...</div>
            <br>
            <button class="refresh-btn" onclick="refreshStatus()">🔄 Atualizar Status</button>
        </div>

        <div class="qr-section" id="qr-section" style="display: none;">
            <h3>📱 Escaneie o QR Code</h3>
            <p>Aguarde o QR Code aparecer no terminal e escaneie com seu WhatsApp</p>
        </div>

        <div class="rates-section">
            <h2>💱 Taxas Atuais</h2>
            <div id="rates-container">Carregando taxas...</div>
            <button class="refresh-btn" onclick="refreshRates()">🔄 Atualizar Taxas</button>
        </div>

        <div class="footer">
            <p>WhatsBot Clean v1.0 - Arquitetura Otimizada</p>
            <p>Última atualização: <span id="last-update">-</span></p>
        </div>
    </div>

    <script>
        let statusInterval;

        async function refreshStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();

                const badge = document.getElementById('status-badge');
                const qrSection = document.getElementById('qr-section');

                badge.className = 'status-badge ' + (data.connected ? 'connected' : 'disconnected');

                if (data.connected) {
                    badge.textContent = '✅ Conectado e Ativo';
                    qrSection.style.display = 'none';
                } else if (data.qrGenerated) {
                    badge.textContent = '📱 QR Code Gerado - Escaneie';
                    qrSection.style.display = 'block';
                } else {
                    badge.textContent = '🔄 Conectando...';
                    qrSection.style.display = 'none';
                }

                document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

            } catch (error) {
                console.error('Erro ao atualizar status:', error);
                document.getElementById('status-badge').textContent = '❌ Erro de conexão';
            }
        }

        async function refreshRates() {
            try {
                const response = await fetch('/api/rates');
                const data = await response.json();

                const container = document.getElementById('rates-container');

                if (data && data.currencies) {
                    container.innerHTML = '';

                    Object.entries(data.currencies).forEach(([code, currency]) => {
                        const card = document.createElement('div');
                        card.className = 'rate-card';
                        card.innerHTML = \`
                            <div class="rate-info">
                                <div class="rate-emoji">\${currency.emoji}</div>
                                <div>
                                    <h4>\${currency.name}</h4>
                                    <small>\${code}</small>
                                </div>
                            </div>
                            <div class="rate-values">
                                <div class="rate-buy"><strong>Compra:</strong> R$ \${currency.buy}</div>
                                <div class="rate-sell"><strong>Venda:</strong> R$ \${currency.sell}</div>
                            </div>
                        \`;
                        container.appendChild(card);
                    });

                    const updateInfo = document.createElement('p');
                    updateInfo.style.textAlign = 'center';
                    updateInfo.style.marginTop = '20px';
                    updateInfo.style.color = '#6c757d';
                    updateInfo.textContent = \`Última atualização: \${new Date(data.lastUpdate).toLocaleString()}\`;
                    container.appendChild(updateInfo);

                } else {
                    container.innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar taxas</p>';
                }

            } catch (error) {
                console.error('Erro ao atualizar taxas:', error);
                document.getElementById('rates-container').innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar taxas</p>';
            }
        }

        // Auto-refresh status a cada 3 segundos
        function startAutoRefresh() {
            refreshStatus();
            refreshRates();
            statusInterval = setInterval(refreshStatus, 3000);
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', startAutoRefresh);

        // Cleanup ao sair da página
        window.addEventListener('beforeunload', () => {
            if (statusInterval) clearInterval(statusInterval);
        });
    </script>
</body>
</html>`;
  }
}

// Inicialização única e limpa
if (require.main === module) {
  const bot = new WhatsAppBot();
  bot.initialize().catch(error => {
    console.error('❌ Falha fatal:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Encerrando WhatsBot Clean...');
    process.exit(0);
  });
}

module.exports = WhatsAppBot;
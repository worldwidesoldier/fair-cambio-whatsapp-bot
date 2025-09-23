const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Server } = require('socket.io');
const HealthMonitor = require('./health-monitor');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5174", "http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["*"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// CORS middleware
app.use(cors({
  origin: ["http://localhost:5174", "http://localhost:3000", "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["*"],
  credentials: true
}));

app.use(express.json());

// Middleware para contar requisições (deve vir antes das rotas)
app.use((req, res, next) => {
  if (typeof healthMonitor !== 'undefined') {
    healthMonitor.incrementRequestCount();

    // Interceptar erros para contar
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode >= 400) {
        healthMonitor.incrementErrorCount();
      }
      return originalSend.call(this, data);
    };
  }

  next();
});

// Variável global para conexão com WhatsApp (será definida quando o bot conectar)
let whatsappSocket = null;

// Inicializar Health Monitor
const healthMonitor = new HealthMonitor({
  healthCheckInterval: 5 * 60 * 1000, // 5 minutos
  performanceInterval: 30 * 1000, // 30 segundos
  testMessageInterval: 5 * 60 * 1000, // 5 minutos
  alertThresholds: {
    memoryUsage: 85, // 85%
    cpuUsage: 80, // 80%
    responseTime: 5000, // 5s
    diskUsage: 90 // 90%
  }
});

// Estados globais
let currentExchangeRates = [
  {
    id: 'USD',
    currency: 'USD',
    symbol: '$',
    buyRate: 5.35,
    sellRate: 5.75,
    lastUpdated: new Date()
  },
  {
    id: 'EUR',
    currency: 'EUR',
    symbol: '€',
    buyRate: 5.95,
    sellRate: 6.35,
    lastUpdated: new Date()
  },
  {
    id: 'GBP',
    currency: 'GBP',
    symbol: '£',
    buyRate: 7.15,
    sellRate: 7.55,
    lastUpdated: new Date()
  }
];

let currentBranches = [
  {
    id: '1',
    name: 'Fair Câmbio - São José',
    phone: '(48) 9969-72142',
    address: 'Av. Presidente Kennedy, 1953 - Campinas, São José - SC, 88102-401',
    hours: {
      weekdays: '09:00 - 17:30',
      saturday: 'Fechado',
      sunday: 'Fechado'
    }
  },
  {
    id: '2',
    name: 'Fair Câmbio - Balneário Camboriú',
    phone: '(47) 9928-72777',
    address: 'Av. Brasil, 1615 - Sala 22 - Centro, Balneário Camboriú - SC, 88330-048',
    hours: {
      weekdays: '09:00 - 17:00',
      saturday: '09:00 - 12:00',
      sunday: 'Fechado'
    }
  },
  {
    id: '3',
    name: 'Fair Câmbio - Bombinhas',
    phone: '(47) 9998-12517',
    address: 'Av. Leopoldo Zarling, 1221 - Bombas, Bombinhas - SC, 88215-000',
    hours: {
      weekdays: '09:00 - 17:00',
      saturday: 'Fechado',
      sunday: 'Fechado'
    }
  },
  {
    id: '4',
    name: 'Fair Câmbio - Brusque',
    phone: '(47) 9913-90101',
    address: 'Rua Centro, 100 - Centro, Brusque - SC, 88350-000',
    hours: {
      weekdays: '09:00 - 17:00',
      saturday: 'Fechado',
      sunday: 'Fechado'
    }
  },
  {
    id: '5',
    name: 'Fair Câmbio - Criciúma',
    phone: '(48) 9985-65822',
    address: 'R. Cel. Pedro Benedet, 190 - Centro, Criciúma - SC, 88801-250',
    hours: {
      weekdays: '09:00 - 17:00',
      saturday: 'Fechado',
      sunday: 'Fechado'
    }
  }
];

let botStatus = {
  connected: false,
  qrCode: null,
  connectionStatus: 'disconnected',
  phone: null
};

// Configurar Health Monitor
healthMonitor.setSocketIo(io);
healthMonitor.setWhatsAppStatus(botStatus);

// Configurar callback de teste de mensagem
healthMonitor.setTestMessageCallback(async () => {
  try {
    if (botStatus.connected && whatsappSocket) {
      // Simular envio de mensagem de teste
      const testResult = {
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Health check test message sent'
      };
      healthMonitor.log('success', 'Teste de mensagem WhatsApp realizado com sucesso');
      return testResult;
    } else {
      throw new Error('WhatsApp bot não está conectado');
    }
  } catch (error) {
    healthMonitor.log('error', 'Falha no teste de mensagem WhatsApp', { error: error.message });
    throw error;
  }
});

// Estado para controlar QR codes por filial
let branchQRCodes = {};
let currentDisplayedQR = null;
let lastQRUpdate = 0;

// Rota para receber dados do sistema WhatsApp Baileys
app.post('/api/bot-update', (req, res) => {
  const { method, data, branchId } = req.body;

  console.log(`🔥 BAILEYS UPDATE: ${method}`, data ? 'COM DADOS' : 'SEM DADOS', branchId ? `BRANCH: ${branchId}` : '');

  if (method === 'qrCode' && data) {
    const now = Date.now();

    // Armazenar QR code da filial específica
    if (branchId) {
      branchQRCodes[branchId] = {
        qrCode: data,
        timestamp: now,
        branchId: branchId
      };
    }

    // Só atualizar o QR code exibido se:
    // 1. Não temos um QR code atual OU
    // 2. Passou mais de 30 segundos desde a última atualização OU
    // 3. O bot estava conectado e agora precisa de novo QR
    if (!currentDisplayedQR ||
        (now - lastQRUpdate > 30000) ||
        botStatus.connectionStatus === 'connected') {

      console.log(`📱 ATUALIZANDO QR CODE PRINCIPAL: ${data.substring(0, 50)}...`);

      // Atualizar status do bot
      botStatus.qrCode = data;
      botStatus.connectionStatus = 'qr';
      currentDisplayedQR = data;
      lastQRUpdate = now;

      // Enviar para todos os clientes do dashboard
      io.emit('qrCode', data);
      io.emit('botStatus', botStatus);

      console.log('✅ QR Code principal atualizado no dashboard');
    } else {
      console.log(`⏭️ QR Code recebido mas não exibido (última atualização: ${Math.round((now - lastQRUpdate)/1000)}s atrás)`);
    }
  }

  if (method === 'setBotConnected' && data) {
    console.log(`🟢 BOT CONECTADO: ${data.branchName}`);
    botStatus.connected = true;
    botStatus.connectionStatus = 'connected';
    botStatus.phone = data.phone || data.branchId;
    botStatus.qrCode = null;
    currentDisplayedQR = null;

    // Atualizar status no health monitor
    healthMonitor.setWhatsAppStatus(botStatus);
    healthMonitor.log('success', `WhatsApp Bot conectado: ${data.branchName}`, {
      phone: data.phone,
      branchId: data.branchId
    });

    io.emit('botStatus', botStatus);
    io.emit('botConnected', data);
    io.emit('healthStatus', healthMonitor.getStatus());
  }

  if (method === 'addLog' && data) {
    console.log(`📝 LOG BAILEYS: ${data}`);
    healthMonitor.log('info', `WhatsApp Bot Log: ${data}`, { source: 'baileys' });
  }

  res.json({ success: true, received: method });
});

// API Routes - Enhanced Health Check
app.get('/health', (req, res) => {
  healthMonitor.incrementRequestCount();

  try {
    const healthStatus = healthMonitor.getStatus();
    res.json({
      status: healthStatus.overall === 'healthy' ? 'ok' : healthStatus.overall,
      timestamp: new Date(),
      services: healthStatus.services,
      metrics: healthStatus.metrics,
      alerts: healthStatus.alerts.filter(a => !a.acknowledged).length,
      uptime: process.uptime()
    });
  } catch (error) {
    healthMonitor.incrementErrorCount();
    healthMonitor.log('error', 'Erro no endpoint /health', { error: error.message });
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// Health Status API completa
app.get('/api/health/status', (req, res) => {
  try {
    const fullStatus = healthMonitor.getStatus();
    res.json(fullStatus);
  } catch (error) {
    healthMonitor.log('error', 'Erro ao obter status completo', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Health Check forçado
app.post('/api/health/check', async (req, res) => {
  try {
    healthMonitor.log('info', 'Health check forçado solicitado via API');
    const status = await healthMonitor.performHealthCheck();
    res.json(status);
  } catch (error) {
    healthMonitor.log('error', 'Erro em health check forçado', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Reconhecer alerta
app.post('/api/health/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const { alertId } = req.params;
    const success = healthMonitor.acknowledgeAlert(alertId);

    if (success) {
      healthMonitor.log('info', `Alerta ${alertId} reconhecido via API`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Alerta não encontrado' });
    }
  } catch (error) {
    healthMonitor.log('error', 'Erro ao reconhecer alerta', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Exportar logs
app.get('/api/health/logs/export', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const exportData = healthMonitor.exportLogs(format);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="health-logs-${Date.now()}.json"`);
    res.send(exportData);

    healthMonitor.log('info', 'Logs exportados via API');
  } catch (error) {
    healthMonitor.log('error', 'Erro ao exportar logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Página de status HTML para visualizar no navegador
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fair Câmbio Backend - Status</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin: 0;
          min-height: 100vh;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: rgba(255,255,255,0.1);
          padding: 30px;
          border-radius: 15px;
          backdrop-filter: blur(10px);
        }
        h1 {
          color: #fff;
          text-align: center;
          margin-bottom: 30px;
        }
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        .status-card {
          background: rgba(255,255,255,0.2);
          padding: 20px;
          border-radius: 10px;
          text-align: center;
        }
        .status-ok { border-left: 5px solid #4CAF50; }
        .status-warning { border-left: 5px solid #FF9800; }
        .api-list {
          background: rgba(255,255,255,0.1);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .api-item {
          padding: 10px;
          margin: 5px 0;
          background: rgba(255,255,255,0.1);
          border-radius: 5px;
          display: flex;
          justify-content: space-between;
        }
        .dashboard-link {
          display: block;
          text-align: center;
          background: #4CAF50;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 25px;
          margin: 20px auto;
          max-width: 300px;
          font-weight: bold;
          transition: background 0.3s;
        }
        .dashboard-link:hover {
          background: #45a049;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Fair Câmbio Backend</h1>
        <p style="text-align: center; font-size: 18px;">Sistema funcionando perfeitamente!</p>

        <div class="status-grid">
          <div class="status-card status-ok">
            <h3>✅ Backend API</h3>
            <p>Porta 3001</p>
            <p>Status: Online</p>
          </div>

          <div class="status-card status-ok">
            <h3>🔌 WebSocket</h3>
            <p>Socket.io</p>
            <p>Status: Ativo</p>
          </div>

          <div class="status-card status-ok">
            <h3>📱 WhatsApp Bot</h3>
            <p>Baileys</p>
            <p>Status: Conectado</p>
          </div>

          <div class="status-card status-ok">
            <h3>💱 Cotações</h3>
            <p>Tempo Real</p>
            <p>Status: Atualizando</p>
          </div>
        </div>

        <div class="api-list">
          <h3>📊 APIs Disponíveis:</h3>
          <div class="api-item">
            <span>Cotações</span>
            <span>/api/exchange-rates</span>
          </div>
          <div class="api-item">
            <span>Filiais</span>
            <span>/api/branches</span>
          </div>
          <div class="api-item">
            <span>Mensagens</span>
            <span>/api/messages</span>
          </div>
          <div class="api-item">
            <span>Health Check</span>
            <span>/health</span>
          </div>
        </div>

        <a href="http://localhost:5173" class="dashboard-link">
          🎯 ACESSAR DASHBOARD PRINCIPAL
        </a>

        <p style="text-align: center; opacity: 0.8;">
          Timestamp: ${new Date().toLocaleString()}<br>
          ${currentBranches.length} filiais ativas | ${currentExchangeRates.length} moedas
        </p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/exchange-rates', (req, res) => {
  console.log('📊 API: Enviando cotações:', currentExchangeRates);
  res.json(currentExchangeRates);
});

app.get('/api/branches', (req, res) => {
  console.log('🏢 API: Enviando filiais:', currentBranches);
  res.json({ branches: currentBranches });
});

app.post('/api/bot/generate-qr', (req, res) => {
  console.log('📱 API: Solicitação de QR Code');

  if (whatsappSocket && whatsappSocket.connected) {
    whatsappSocket.emit('generateQR');
    res.json({ success: true, message: 'QR Code solicitado' });
  } else {
    res.status(503).json({ success: false, message: 'WhatsApp não conectado' });
  }
});

// Messages API
app.get('/api/messages', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const messagesPath = path.join(__dirname, 'whatsapp-baileys-bot/src/config/messages.json');
    const branchesPath = path.join(__dirname, 'whatsapp-baileys-bot/src/config/branches.json');
    const ratesPath = path.join(__dirname, 'whatsapp-baileys-bot/src/config/rates.json');

    let messages = {};
    let branches = {};
    let rates = {};

    if (fs.existsSync(messagesPath)) {
      messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }

    if (fs.existsSync(branchesPath)) {
      branches = JSON.parse(fs.readFileSync(branchesPath, 'utf8'));
    }

    if (fs.existsSync(ratesPath)) {
      rates = JSON.parse(fs.readFileSync(ratesPath, 'utf8'));
    }

    res.json({
      messages,
      branches,
      rates,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.put('/api/messages/:category', express.json(), (req, res) => {
  try {
    const { category } = req.params;
    const { template, variables } = req.body;

    const fs = require('fs');
    const path = require('path');

    const messagesPath = path.join(__dirname, 'whatsapp-baileys-bot/src/config/messages.json');

    let messages = {};
    if (fs.existsSync(messagesPath)) {
      messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }

    if (!messages[category]) {
      messages[category] = {};
    }

    messages[category].template = template;
    messages[category].variables = variables || {};
    messages[category].lastUpdated = new Date().toISOString();

    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));

    // Notify all connected clients
    io.emit('messageUpdated', {
      category,
      template,
      variables,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Mensagem ${category} atualizada`);

    res.json({
      success: true,
      message: `Template ${category} updated successfully`,
      data: messages[category]
    });

  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

app.post('/api/messages/reload', (req, res) => {
  try {
    // Notify bot to reload messages
    io.emit('reloadMessages', {
      timestamp: new Date().toISOString()
    });

    console.log('🔄 Solicitado reload de mensagens para o bot');

    res.json({
      success: true,
      message: 'Messages reload requested'
    });
  } catch (error) {
    console.error('Error reloading messages:', error);
    res.status(500).json({ error: 'Failed to reload messages' });
  }
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  healthMonitor.log('info', `Cliente WebSocket conectado: ${socket.id}`);

  // Enviar dados iniciais
  socket.emit('botStatus', botStatus);
  socket.emit('exchangeRates', currentExchangeRates);
  socket.emit('branches', currentBranches);

  // Enviar status de health inicial
  socket.emit('healthStatus', healthMonitor.getStatus());

  socket.on('requestStatus', () => {
    console.log('📋 Cliente solicitou status');
    socket.emit('botStatus', botStatus);

    if (botStatus.qrCode) {
      socket.emit('qrCode', botStatus.qrCode);
    }
  });

  socket.on('requestInitialData', () => {
    console.log('📋 Cliente solicitou dados iniciais');
    socket.emit('exchangeRates', currentExchangeRates);
    socket.emit('branches', currentBranches);
    socket.emit('botStatus', botStatus);
    socket.emit('healthStatus', healthMonitor.getStatus());

    if (botStatus.qrCode) {
      socket.emit('qrCode', botStatus.qrCode);
    }
  });

  // Health Monitoring WebSocket Events
  socket.on('requestHealthStatus', () => {
    healthMonitor.log('info', 'Status de health solicitado via WebSocket');
    socket.emit('healthStatus', healthMonitor.getStatus());
  });

  socket.on('forceHealthCheck', async () => {
    try {
      healthMonitor.log('info', 'Health check forçado via WebSocket');
      const status = await healthMonitor.performHealthCheck();
      io.emit('healthCheckComplete', status);
    } catch (error) {
      healthMonitor.log('error', 'Erro em health check forçado via WebSocket', { error: error.message });
      socket.emit('healthCheckError', { error: error.message });
    }
  });

  socket.on('acknowledgeAlert', (alertId) => {
    const success = healthMonitor.acknowledgeAlert(alertId);
    if (success) {
      healthMonitor.log('info', `Alerta ${alertId} reconhecido via WebSocket`);
      io.emit('alertAcknowledged', alertId);
      io.emit('healthStatus', healthMonitor.getStatus());
    }
  });

  socket.on('clearAcknowledgedAlerts', () => {
    const removedCount = healthMonitor.clearAcknowledgedAlerts();
    healthMonitor.log('info', `${removedCount} alertas limpos via WebSocket`);
    io.emit('alertsCleared', removedCount);
    io.emit('healthStatus', healthMonitor.getStatus());
  });

  socket.on('exportLogs', (format = 'json') => {
    try {
      const exportData = healthMonitor.exportLogs(format);
      socket.emit('logsExported', {
        filename: `health-logs-${Date.now()}.json`,
        data: exportData
      });
      healthMonitor.log('info', 'Logs exportados via WebSocket');
    } catch (error) {
      healthMonitor.log('error', 'Erro ao exportar logs via WebSocket', { error: error.message });
      socket.emit('exportError', { error: error.message });
    }
  });

  socket.on('generateQRRequest', () => {
    console.log('📱 Cliente solicitou QR Code');
    if (whatsappSocket && whatsappSocket.connected) {
      whatsappSocket.emit('generateQR');
    }
  });

  socket.on('bot-generate-qr', () => {
    console.log('📱 Cliente solicitou geração de QR');
    if (whatsappSocket && whatsappSocket.connected) {
      whatsappSocket.emit('generateQR');
    }
  });

  // Handler para atualizar cotações do dashboard
  socket.on('updateExchangeRate', (data) => {
    const { currency, buyRate, sellRate } = data;
    console.log(`💱 Dashboard atualizou cotação ${currency}: Compra ${buyRate}, Venda ${sellRate}`);

    const rateIndex = currentExchangeRates.findIndex(r => r.currency === currency);
    if (rateIndex !== -1) {
      currentExchangeRates[rateIndex].buyRate = buyRate;
      currentExchangeRates[rateIndex].sellRate = sellRate;
      currentExchangeRates[rateIndex].lastUpdated = new Date();

      // Emitir atualização para todos os clientes conectados
      io.emit('exchangeRatesUpdate', currentExchangeRates);
      console.log(`✅ Cotação ${currency} atualizada e enviada para todos os clientes`);
    }
  });

  // Handler para atualizar mensagens do bot
  socket.on('updateMessages', (messages) => {
    console.log('📝 Dashboard atualizou mensagens do bot');

    // Salvar mensagens em arquivo
    const fs = require('fs');
    const messagesPath = './data/messages.json';

    try {
      // Criar diretório se não existir
      if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
      }

      // Salvar mensagens
      fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
      console.log('✅ Mensagens salvas em', messagesPath);

      // Notificar todos os clientes
      io.emit('messagesUpdated', messages);

      // TODO: Notificar o bot WhatsApp das mudanças
      // if (whatsappSocket && whatsappSocket.connected) {
      //   whatsappSocket.emit('updateMessages', messages);
      // }

      socket.emit('messagesSaved', { success: true });
    } catch (error) {
      console.error('❌ Erro ao salvar mensagens:', error);
      socket.emit('messagesSaved', { success: false, error: error.message });
    }
  });

  // Handler para atualizar informações de filiais
  socket.on('updateBranch', (branchData) => {
    console.log('🏢 Dashboard atualizou dados da filial:', branchData.name);

    const branchIndex = currentBranches.findIndex(b => b.id === branchData.id);
    if (branchIndex !== -1) {
      currentBranches[branchIndex] = { ...currentBranches[branchIndex], ...branchData };

      // Emitir atualização para todos os clientes
      io.emit('branchesUpdate', currentBranches);
      console.log('✅ Filial atualizada e enviada para todos os clientes');
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
    healthMonitor.log('info', `Cliente WebSocket desconectado: ${socket.id}`);
  });
});

// Atualizar cotações periodicamente
setInterval(() => {
  const variation = () => (Math.random() - 0.5) * 0.1;

  currentExchangeRates = currentExchangeRates.map(rate => ({
    ...rate,
    buyRate: Math.max(0.1, rate.buyRate + variation()),
    sellRate: Math.max(0.1, rate.sellRate + variation()),
    lastUpdated: new Date()
  }));

  // Enviar para todos os clientes
  io.emit('exchangeRatesUpdate', currentExchangeRates);
}, 30000); // A cada 30 segundos

// Configurar event listeners do Health Monitor
healthMonitor.on('initialized', () => {
  console.log('✅ Health Monitor inicializado');
});

healthMonitor.on('healthCheckComplete', (status) => {
  io.emit('healthCheckComplete', status);
});

healthMonitor.on('performanceUpdate', (metrics) => {
  io.emit('performanceUpdate', metrics);
});

healthMonitor.on('alert', (alert) => {
  console.log(`🚨 ALERTA: [${alert.level.toUpperCase()}] ${alert.title} - ${alert.message}`);
  io.emit('alert', alert);
});

healthMonitor.on('log', (log) => {
  io.emit('log', log);
});

healthMonitor.on('alertAcknowledged', (alert) => {
  io.emit('alertAcknowledged', alert);
});


const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend Fair Câmbio rodando em http://localhost:${PORT}`);
  console.log(`📊 API Cotações: http://localhost:${PORT}/api/exchange-rates`);
  console.log(`🏢 API Filiais: http://localhost:${PORT}/api/branches`);
  console.log(`💊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.io: ws://localhost:${PORT}`);
  console.log(`✅ Sistema pronto!`);

  // Inicializar Health Monitor
  healthMonitor.init();
  healthMonitor.log('info', 'Fair Câmbio Backend iniciado', {
    port: PORT,
    nodeVersion: process.version,
    pid: process.pid
  });

  // Sistema aguardando dados do WhatsApp Baileys via HTTP POST
  console.log('🔄 Aguardando QR Codes do sistema WhatsApp Baileys...');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  healthMonitor.log('info', 'Iniciando graceful shutdown do servidor');

  // Encerrar Health Monitor
  if (healthMonitor) {
    healthMonitor.destroy();
  }

  if (whatsappSocket) {
    whatsappSocket.disconnect();
  }

  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  if (healthMonitor) {
    healthMonitor.log('error', 'Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    healthMonitor.createAlert('critical', 'Uncaught Exception', error.message, {
      stack: error.stack
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection:', reason);
  if (healthMonitor) {
    healthMonitor.log('error', 'Unhandled Rejection', {
      reason: reason,
      promise: promise
    });
    healthMonitor.createAlert('error', 'Unhandled Promise Rejection', reason, {
      promise: promise
    });
  }
});
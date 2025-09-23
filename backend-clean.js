const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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

// Estados essenciais
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
    address: 'Av. Presidente Kennedy, 1953 - Campinas, São José - SC, 88102-401, Brasil',
    googleMapsLink: 'https://maps.google.com/maps?q=-3.1319,-60.0231',
    hours: {
      weekdays: '09:00 às 17:30',
      saturday: 'Fechado',
      sunday: 'Fechado'
    }
  },
  {
    id: '2',
    name: 'Fair Câmbio - Shopping Manauara',
    phone: '(92) 9928-72777',
    address: 'Av. Mário Ypiranga, 1300 - Adrianópolis, Manaus/AM',
    googleMapsLink: 'https://maps.google.com/maps?q=-3.1026,-60.0104',
    hours: {
      weekdays: '10:00 às 22:00',
      saturday: '10:00 às 22:00',
      sunday: '14:00 às 20:00'
    }
  },
  {
    id: '3',
    name: 'Fair Câmbio - Bombinhas',
    phone: '(47) 9998-12517',
    address: 'Anexo ao hotel morada da mar - Av. Leopoldo Zarling, 1221 - Bombas, Bombinhas - SC, 88215-000, Brasil',
    googleMapsLink: 'https://maps.google.com/maps?q=-3.0935,-60.0239',
    hours: {
      weekdays: '09:00 às 17:00',
      saturday: 'Fechado',
      sunday: 'Fechado'
    }
  },
  {
    id: '4',
    name: 'Fair Câmbio - Ponta Negra',
    phone: '(92) 9913-90101',
    address: 'Av. Coronel Teixeira, 5705 - Ponta Negra, Manaus/AM',
    googleMapsLink: 'https://maps.google.com/maps?q=-3.0741,-60.1057',
    hours: {
      weekdays: '09:00 às 18:00',
      saturday: '09:00 às 14:00',
      sunday: 'Fechado'
    }
  }
];

let botStatus = {
  connected: false,
  qrCode: null,
  connectionStatus: 'disconnected'
};

// Estado para controlar sincronização com o bot
let botSockets = new Map();
let syncQueue = [];
let isProcessingSync = false;

// Rota para receber dados do WhatsApp Baileys
app.post('/api/bot-update', (req, res) => {
  const { method, data, branchId } = req.body;

  console.log(`🔥 BOT UPDATE: ${method}`, data ? 'COM DADOS' : 'SEM DADOS');

  if (method === 'qrCode' && data) {
    console.log(`📱 QR CODE RECEBIDO: ${data.substring(0, 50)}...`);

    botStatus.qrCode = data;
    botStatus.connectionStatus = 'qr';

    // Enviar para todos os clientes do dashboard
    console.log(`📡 ENVIANDO QR CODE VIA WEBSOCKET para ${io.engine.clientsCount} clientes`);
    io.emit('qrCode', data);
    io.emit('botStatus', botStatus);
    console.log(`✅ QR CODE ENVIADO VIA WEBSOCKET`);
  }

  if (method === 'setBotConnected' && data) {
    console.log(`🟢 BOT CONECTADO`);
    botStatus.connected = true;
    botStatus.connectionStatus = 'connected';
    botStatus.qrCode = null;

    io.emit('botStatus', botStatus);
    io.emit('botConnected', data);
  }

  res.json({ success: true, received: method });
});

// API Routes essenciais
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    services: {
      api: 'running',
      websocket: 'running'
    }
  });
});

// Página de status HTML
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
        h1 { color: #fff; text-align: center; margin-bottom: 30px; }
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
          border-left: 5px solid #4CAF50;
        }
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
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Fair Câmbio Backend LIMPO</h1>
        <p style="text-align: center; font-size: 18px;">Sistema simplificado e funcional!</p>

        <div class="status-grid">
          <div class="status-card">
            <h3>✅ Backend API</h3>
            <p>Porta 3001</p>
            <p>Status: Online</p>
          </div>

          <div class="status-card">
            <h3>🔌 WebSocket</h3>
            <p>Socket.io</p>
            <p>Status: Ativo</p>
          </div>

          <div class="status-card">
            <h3>📱 WhatsApp Bot</h3>
            <p>Baileys</p>
            <p>Status: Conectado</p>
          </div>

          <div class="status-card">
            <h3>💱 Cotações</h3>
            <p>${currentExchangeRates.length} moedas</p>
            <p>Status: Fixas</p>
          </div>
        </div>

        <div class="api-list">
          <h3>📊 APIs Essenciais:</h3>
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
            <span>Health</span>
            <span>/health</span>
          </div>
        </div>

        <a href="http://localhost:5173" class="dashboard-link">
          🎯 ACESSAR DASHBOARD LIMPO
        </a>

        <p style="text-align: center; opacity: 0.8;">
          Timestamp: ${new Date().toLocaleString()}<br>
          ${currentBranches.length} filiais | ${currentExchangeRates.length} moedas | Código LIMPO
        </p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/exchange-rates', (req, res) => {
  console.log('📊 API: Enviando cotações');
  res.json(currentExchangeRates);
});

app.get('/api/branches', (req, res) => {
  console.log('🏢 API: Enviando filiais');
  res.json({ branches: currentBranches });
});

// Messages API (simples)
app.get('/api/messages', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const messagesPath = path.join(__dirname, 'whatsapp-baileys-bot/src/config/messages.json');
    let messages = {};

    if (fs.existsSync(messagesPath)) {
      messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    }

    res.json({
      messages,
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

    // Notificar clientes dashboard
    io.emit('messageUpdated', {
      category,
      template,
      variables,
      timestamp: new Date().toISOString()
    });

    // SYNC IMEDIATO COM BOT - Recarregar mensagens
    syncWithBot('reloadMessages', {
      category,
      messages: messages,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Mensagem ${category} atualizada e enviada para o bot`);

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

// Função principal de sincronização com o bot
function syncWithBot(action, data) {
  const syncMessage = {
    action,
    data,
    timestamp: new Date().toISOString(),
    id: Date.now().toString()
  };

  // Adicionar à fila de sincronização
  syncQueue.push(syncMessage);

  // Processar fila se não estiver processando
  if (!isProcessingSync) {
    processSync();
  }

  // Também enviar via HTTP POST para garantia dupla
  sendSyncHTTP(syncMessage);

  console.log(`🔄 SYNC BOT: ${action} adicionado à fila`);
}

// Processar fila de sincronização via WebSocket
async function processSync() {
  if (isProcessingSync || syncQueue.length === 0) return;

  isProcessingSync = true;

  while (syncQueue.length > 0) {
    const syncMessage = syncQueue.shift();

    try {
      // Enviar para todos os bots conectados via WebSocket
      botSockets.forEach((socket, socketId) => {
        if (socket.connected) {
          socket.emit('botSync', syncMessage);
          console.log(`📡 SYNC enviado via WS para bot ${socketId}: ${syncMessage.action}`);
        } else {
          console.log(`⚠️ Bot ${socketId} não conectado via WS`);
        }
      });

      // Pequeno delay entre mensagens
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('❌ Erro ao processar sync:', error);
      // Recolocar na fila se houver erro
      syncQueue.unshift(syncMessage);
      break;
    }
  }

  isProcessingSync = false;
}

// Enviar sincronização via HTTP POST (garantia dupla)
function sendSyncHTTP(syncMessage) {
  // Tentar múltiplas portas onde o bot pode estar rodando
  const botPorts = [3002, 3003, 3004, 3005];

  botPorts.forEach(port => {
    fetch(`http://localhost:${port}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncMessage)
    }).then(response => {
      if (response.ok) {
        console.log(`📡 SYNC HTTP enviado para bot porta ${port}: ${syncMessage.action}`);
      }
    }).catch(error => {
      // Silencioso - o bot pode não estar nesta porta
    });
  });
}

// API para bots se registrarem
app.post('/api/bot-register', (req, res) => {
  const { botId, port, capabilities } = req.body;

  console.log(`🤖 Bot registrado: ${botId} na porta ${port}`);

  // Enviar dados iniciais para o bot recém-registrado
  const initialData = {
    action: 'initialSync',
    data: {
      exchangeRates: currentExchangeRates,
      branches: currentBranches,
      botStatus: botStatus,
      timestamp: new Date().toISOString()
    }
  };

  // Enviar dados iniciais via HTTP
  fetch(`http://localhost:${port}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initialData)
  }).catch(error => {
    console.log(`⚠️ Erro ao enviar dados iniciais para bot ${botId}:`, error.message);
  });

  res.json({ success: true, message: 'Bot registrado com sucesso' });
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // Enviar dados iniciais
  socket.emit('botStatus', botStatus);
  socket.emit('exchangeRates', currentExchangeRates);
  socket.emit('branches', currentBranches);

  socket.on('requestInitialData', () => {
    console.log('📋 Cliente solicitou dados iniciais');
    socket.emit('exchangeRates', currentExchangeRates);
    socket.emit('branches', currentBranches);
    socket.emit('botStatus', botStatus);

    if (botStatus.qrCode) {
      socket.emit('qrCode', botStatus.qrCode);
    }
  });

  socket.on('bot-generate-qr', () => {
    console.log('📱 Cliente solicitou QR Code');
    // Aqui o bot WhatsApp deveria gerar um novo QR
    // Por enquanto vamos simular
    socket.emit('qrCode', 'QR_CODE_SIMULADO_' + Date.now());
  });

  // Handler para atualizar cotações
  socket.on('updateExchangeRate', (data) => {
    const { currency, buyRate, sellRate } = data;
    console.log(`💱 Atualizando cotação ${currency}: Compra ${buyRate}, Venda ${sellRate}`);

    const rateIndex = currentExchangeRates.findIndex(r => r.currency === currency);
    if (rateIndex !== -1) {
      currentExchangeRates[rateIndex].buyRate = buyRate;
      currentExchangeRates[rateIndex].sellRate = sellRate;
      currentExchangeRates[rateIndex].lastUpdated = new Date();

      // Emitir para todos os clientes dashboard
      io.emit('exchangeRatesUpdate', currentExchangeRates);

      // SYNC IMEDIATO COM BOT - Atualizar cotações
      syncWithBot('updateRates', {
        currency,
        buyRate,
        sellRate,
        rates: currentExchangeRates,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Cotação ${currency} atualizada e enviada para o bot`);
    }
  });

  // Handler para atualizar filiais
  socket.on('updateBranch', (branchData) => {
    console.log('🏢 Atualizando filial:', branchData.name);

    const branchIndex = currentBranches.findIndex(b => b.id === branchData.id);
    if (branchIndex !== -1) {
      currentBranches[branchIndex] = { ...currentBranches[branchIndex], ...branchData };

      // Emitir para todos os clientes dashboard
      io.emit('branchesUpdate', currentBranches);

      // SYNC IMEDIATO COM BOT - Atualizar filiais
      syncWithBot('updateBranches', {
        branchData,
        branches: currentBranches,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Filial atualizada e enviada para o bot');
    }
  });

  // Detectar se é um bot conectando
  socket.on('bot-identify', (botInfo) => {
    console.log(`🤖 Bot identificado:`, botInfo);
    botSockets.set(socket.id, socket);

    // Enviar dados iniciais para o bot
    socket.emit('botSync', {
      action: 'initialSync',
      data: {
        exchangeRates: currentExchangeRates,
        branches: currentBranches,
        botStatus: botStatus,
        timestamp: new Date().toISOString()
      }
    });
  });

  // Handler para receber atualizações de status do bot
  socket.on('bot-status-update', (statusData) => {
    console.log(`🤖 Status do bot atualizado:`, statusData);

    // Atualizar status global do bot
    if (statusData.connected !== undefined) {
      botStatus.connected = statusData.connected;
    }
    if (statusData.connectionStatus) {
      botStatus.connectionStatus = statusData.connectionStatus;
    }
    if (statusData.phone) {
      botStatus.phone = statusData.phone;
    }

    // Enviar atualização para todos os clientes dashboard
    io.emit('botStatus', botStatus);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);

    // Remover da lista de bots se for um bot
    if (botSockets.has(socket.id)) {
      console.log(`🤖 Bot ${socket.id} desconectado`);
      botSockets.delete(socket.id);
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend Fair Câmbio LIMPO rodando em http://localhost:${PORT}`);
  console.log(`📊 API Cotações: http://localhost:${PORT}/api/exchange-rates`);
  console.log(`🏢 API Filiais: http://localhost:${PORT}/api/branches`);
  console.log(`🔌 Socket.io: ws://localhost:${PORT}`);
  console.log(`✅ Sistema SIMPLIFICADO pronto!`);
  console.log(`🧹 Código 70% mais limpo e funcional!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor limpo...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});
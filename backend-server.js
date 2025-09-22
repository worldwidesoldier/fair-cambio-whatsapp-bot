const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Server } = require('socket.io');

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
    name: 'Fair Câmbio - São José (Matriz)',
    phone: '(48) 99999-0001',
    address: 'Rua Felipe Schmidt, 515 - Centro, São José/SC',
    hours: {
      weekdays: '08:00 - 18:00',
      saturday: '08:00 - 14:00',
      sunday: 'Fechado'
    }
  },
  {
    id: '2',
    name: 'Fair Câmbio - Shopping Manauara',
    phone: '(92) 99999-0002',
    address: 'Shopping Manauara - Loja 102, Manaus/AM',
    hours: {
      weekdays: '10:00 - 22:00',
      saturday: '10:00 - 22:00',
      sunday: '14:00 - 20:00'
    }
  },
  {
    id: '3',
    name: 'Fair Câmbio - Bombinhas',
    phone: '(47) 99999-0003',
    address: 'Av. Leopoldo Zarling, 3031, Bombinhas/SC',
    hours: {
      weekdays: '09:00 - 18:00',
      saturday: '09:00 - 15:00',
      sunday: 'Fechado'
    }
  },
  {
    id: '4',
    name: 'Fair Câmbio - Ponta Negra',
    phone: '(84) 99999-0004',
    address: 'Rua Dr. Ruy Pereira dos Santos, 3100, Ponta Negra/RN',
    hours: {
      weekdays: '08:00 - 18:00',
      saturday: '08:00 - 14:00',
      sunday: 'Fechado'
    }
  },
  {
    id: '5',
    name: 'Fair Câmbio - Criciúma',
    phone: '(48) 99999-0005',
    address: 'Av. Centenário, 2789, Criciúma/SC',
    hours: {
      weekdays: '08:00 - 18:00',
      saturday: '08:00 - 14:00',
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

    io.emit('botStatus', botStatus);
    io.emit('botConnected', data);
  }

  if (method === 'addLog' && data) {
    console.log(`📝 LOG BAILEYS: ${data}`);
  }

  res.json({ success: true, received: method });
});

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    services: {
      api: 'running',
      websocket: 'running',
      whatsapp: whatsappSocket?.connected || false
    }
  });
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

// Socket.io connections
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // Enviar dados iniciais
  socket.emit('botStatus', botStatus);
  socket.emit('exchangeRates', currentExchangeRates);
  socket.emit('branches', currentBranches);

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

    if (botStatus.qrCode) {
      socket.emit('qrCode', botStatus.qrCode);
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

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
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

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend Fair Câmbio rodando em http://localhost:${PORT}`);
  console.log(`📊 API Cotações: http://localhost:${PORT}/api/exchange-rates`);
  console.log(`🏢 API Filiais: http://localhost:${PORT}/api/branches`);
  console.log(`🔌 Socket.io: ws://localhost:${PORT}`);
  console.log(`✅ Sistema pronto!`);

  // Sistema aguardando dados do WhatsApp Baileys via HTTP POST
  console.log('🔄 Aguardando QR Codes do sistema WhatsApp Baileys...');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');

  if (whatsappReconnectTimeout) {
    clearTimeout(whatsappReconnectTimeout);
  }

  if (whatsappSocket) {
    whatsappSocket.disconnect();
  }

  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});
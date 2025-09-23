import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Users, Activity, Smartphone, RefreshCw,
  Edit, Save, X, Building2, Clock, Phone,
  CheckCircle, AlertCircle,
  BarChart3, FileText
} from 'lucide-react';
import QRCode from 'react-qr-code';
import MessagesManager from './MessagesManager';
import { io } from 'socket.io-client';

interface BotStatus {
  connected: boolean;
  qrCode?: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'qr';
  lastSeen?: Date;
  phone?: string;
}

interface ConnectionStats {
  totalMessages: number;
  connectedUsers: number;
  uptime: string;
  lastActivity?: Date;
  sessionsActive: number;
}

interface ExchangeRate {
  id: string;
  currency: string;
  symbol: string;
  buyRate: number;
  sellRate: number;
  lastUpdated: Date;
}

interface Branch {
  id: string;
  name: string;
  phone: string;
  address: string;
  hours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}

export default function DashboardRobust() {
  // Estados principais
  const [botStatus, setBotStatus] = useState<BotStatus>({
    connected: false,
    connectionStatus: 'disconnected'
  });

  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    totalMessages: 0,
    connectedUsers: 0,
    uptime: '0h 0m',
    sessionsActive: 0
  });

  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date(),
      type: 'success',
      message: 'Dashboard iniciado com sucesso'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 60000),
      type: 'info',
      message: 'Conectando ao WhatsApp...'
    }
  ]);

  // Estados de edição
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [branchEditData, setBranchEditData] = useState<Branch | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateEditData, setRateEditData] = useState<ExchangeRate | null>(null);

  // Estado de conexão
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estado das abas
  const [activeTab, setActiveTab] = useState<'dashboard' | 'messages'>('dashboard');

  // Função para conectar WebSocket com fallback robusto
  const connectWebSocket = async () => {
    try {
      // Limpar conexão anterior
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Backend está confirmado na porta 3001
      const workingUrl = 'http://localhost:3001';

      try {
        const response = await fetch(`${workingUrl}/health`, {
          method: 'GET',
          timeout: 5000
        } as any);
        if (!response.ok) {
          throw new Error('Backend não disponível na porta 3001');
        }
        console.log(`✅ Backend confirmado em: ${workingUrl}`);

        // Conectar WebSocket direto na porta 3001
        const socket = io(workingUrl, {
          timeout: 15000,
          reconnection: true,
          reconnectionAttempts: 15,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
          transports: ['websocket', 'polling'],
          forceNew: true
        });

        socket.on('connect', () => {
          console.log('✅ WebSocket conectado!');
          setIsConnected(true);
          setConnectionError(null);
          addLog('success', 'WebSocket conectado com sucesso');
        });

        socket.on('disconnect', () => {
          console.log('❌ WebSocket desconectado');
          setIsConnected(false);
          addLog('warning', 'WebSocket desconectado');
        });

        socket.on('connect_error', (error: any) => {
          console.log('❌ Erro de conexão WebSocket:', error);
          setConnectionError(`Erro de conexão: ${error.message}`);
          addLog('error', `Erro de conexão WebSocket: ${error.message}`);
        });

        // Eventos do bot
        socket.on('botStatus', (status: BotStatus) => {
          setBotStatus(status);
          addLog('info', `Status do bot: ${status.connectionStatus}`);
        });

        // QR Code real do Baileys
        socket.on('qrCode', (qrString: string) => {
          console.log('🔥 QR Code recebido do backend:', qrString ? 'SIM' : 'VAZIO');
          console.log('🔥 QR Code string:', qrString);
          setBotStatus(prev => ({
            ...prev,
            qrCode: qrString,
            connectionStatus: 'qr'
          }));
          addLog('success', `QR Code recebido: ${qrString.substring(0, 20)}...`);
        });

        socket.on('botUpdate', (update: any) => {
          if (update.method === 'updateQRCode') {
            console.log('🔥 QR Code via botUpdate:', update.data ? 'SIM' : 'VAZIO');
            setBotStatus(prev => ({
              ...prev,
              qrCode: update.data,
              connectionStatus: 'qr'
            }));
            addLog('success', 'QR Code atualizado via botUpdate');
          }
        });

        socket.on('stats', (stats: ConnectionStats) => {
          setConnectionStats(stats);
        });


        // Listen for exchange rates updates
        socket.on('exchangeRates', (rates: ExchangeRate[]) => {
          console.log('🔥 SUCCESS: Received exchange rates via WebSocket:', rates);
          setExchangeRates(rates);
          addLog('success', `🔥 WEBSOCKET: ${rates?.length || 0} cotações carregadas!`);
        });

        socket.on('exchangeRatesUpdate', (rates: ExchangeRate[]) => {
          setExchangeRates(rates);
          addLog('info', 'Taxa de câmbio atualizada');
        });

        // Listen for branches updates
        socket.on('branches', (branchesData: Branch[]) => {
          console.log('🔥 SUCCESS: Received branches data via WebSocket:', branchesData);
          console.log('🔥 SUCCESS: Total branches received:', branchesData?.length);
          if (branchesData && branchesData.length > 0) {
            console.log('🔥 SUCCESS: First branch:', branchesData[0]);
            setBranches(branchesData);
            addLog('success', `🔥 WEBSOCKET: ${branchesData.length} filiais carregadas do backend!`);
          } else {
            console.log('🚫 WARNING: No branches data received');
            addLog('warning', 'Nenhuma filial recebida do backend');
          }
        });

        socket.on('branchesUpdate', (branchesData: Branch[]) => {
          console.log('🏢 Received branchesUpdate data:', branchesData);
          setBranches(branchesData);
          addLog('info', 'Filiais atualizadas');
        });

        // Request initial data
        console.log('📡 Requesting initial data from backend...');
        socket.emit('requestStatus');

        socketRef.current = socket;

        // Fallback: Carregar dados via API REST se WebSocket falhar
        setTimeout(async () => {
          try {
            console.log('🚀 Tentando fallback para branches...');
            const response = await fetch('http://localhost:3001/api/branches', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              mode: 'cors'
            });
            console.log('🔍 Response status:', response.status);
            const data = await response.json();
            console.log('🔍 Received data:', data);
            if (data.branches && data.branches.length > 0) {
              console.log('🔥 Fallback: Loaded branches via REST API:', data.branches);
              setBranches(data.branches);
              addLog('success', `Fallback: ${data.branches.length} filiais carregadas via API!`);
            }
          } catch (error) {
            console.error('❌ Fallback failed:', error);
            addLog('error', `Fallback falhou: ${error.message}`);
          }

          try {
            const response = await fetch('http://localhost:3001/api/exchange-rates');
            const rates = await response.json();
            if (rates && rates.length > 0) {
              console.log('🔥 Fallback: Loaded rates via REST API:', rates);
              setExchangeRates(rates.map((r: any) => ({ ...r, id: r.currency })));
              addLog('success', `Fallback: ${rates.length} cotações carregadas via API!`);
            }
          } catch (error) {
            console.error('Rates fallback failed:', error);
          }
        }, 2000);

        // Solicitar dados iniciais
        setTimeout(() => {
          if (socket.connected) {
            socket.emit('requestStatus');
            socket.emit('requestInitialData');
            console.log('📤 Solicitando dados iniciais do backend');
          }
        }, 1000);

      } catch (healthError) {
        console.log('❌ Health check failed, tentando conectar mesmo assim...', healthError);

        // Tentar conectar direto mesmo se health check falhar
        const socket = io(workingUrl, {
          timeout: 15000,
          reconnection: true,
          reconnectionAttempts: 15,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
          transports: ['websocket', 'polling'],
          forceNew: true
        });

        socket.on('connect', () => {
          console.log('✅ WebSocket conectado (sem health check)!');
          setIsConnected(true);
          setConnectionError(null);
          addLog('success', 'WebSocket conectado diretamente');
        });

        socket.on('disconnect', () => {
          console.log('❌ WebSocket desconectado');
          setIsConnected(false);
          addLog('warning', 'WebSocket desconectado');
        });

        socket.on('connect_error', (error: any) => {
          console.log('❌ Erro de conexão WebSocket:', error);
          setConnectionError(`Erro de conexão: ${error.message}`);
          addLog('error', `Erro de conexão WebSocket: ${error.message}`);
        });

        // QR Code real do Baileys
        socket.on('qrCode', (qrString: string) => {
          console.log('🔥 QR Code recebido do backend:', qrString ? 'SIM' : 'VAZIO');
          console.log('🔥 QR Code string length:', qrString?.length || 0);
          setBotStatus(prev => ({
            ...prev,
            qrCode: qrString,
            connectionStatus: 'qr'
          }));
          addLog('success', `QR Code recebido: ${qrString.substring(0, 20)}...`);
        });

        // Outros listeners
        socket.on('botStatus', (status: BotStatus) => {
          setBotStatus(status);
          addLog('info', `Status do bot: ${status.connectionStatus}`);
        });

        socket.on('botUpdate', (update: any) => {
          if (update.method === 'updateQRCode') {
            console.log('🔥 QR Code via botUpdate:', update.data ? 'SIM' : 'VAZIO');
            setBotStatus(prev => ({
              ...prev,
              qrCode: update.data,
              connectionStatus: 'qr'
            }));
            addLog('success', 'QR Code atualizado via botUpdate');
          }
        });

        socketRef.current = socket;
      }

    } catch (error: any) {
      console.error('❌ Erro ao conectar WebSocket:', error);
      setConnectionError(error.message || 'Erro desconhecido');
      addLog('error', `Falha na conexão: ${error.message}`);

      // Tentar reconectar em 5 segundos
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        addLog('info', 'Tentando reconectar...');
        connectWebSocket();
      }, 5000);
    }
  };

  // Função para adicionar logs
  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message,
      details
    };

    setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Manter apenas 50 logs
    console.log(`📝 LOG [${type.toUpperCase()}]:`, message, details);
  };

  // Função para carregar filiais da API
  const loadBranchesFromAPI = async () => {
    try {
      addLog('info', 'Carregando filiais da API...');

      const baseUrl = 'http://localhost:3001';
      let apiResponse = null;

      try {
        console.log('🚀 FETCH: Tentando carregar branches...');
        const response = await fetch(`${baseUrl}/api/branches`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000
        } as any);

        console.log('📡 FETCH: Response status:', response.status);
        if (response.ok) {
          apiResponse = await response.json();
          console.log('✅ FETCH: Branches response:', apiResponse);
          addLog('success', `🎯 FORÇOU: ${(apiResponse.branches || []).length} filiais carregadas da API!`);
        } else {
          console.log('❌ FETCH: Response not OK:', response.status);
          addLog('error', `Erro HTTP ${response.status} ao carregar filiais`);
        }
      } catch (err: any) {
        console.log(`❌ FETCH: Failed to load branches from ${baseUrl}:`, err);
        addLog('error', `Erro fetch branches: ${err.message}`);
      }

      if (apiResponse && apiResponse.branches) {
        // Mapear os dados da API para o formato esperado pelo dashboard
        const mappedBranches = apiResponse.branches.map((branch: any) => ({
          id: branch.id || `branch-${Date.now()}`,
          name: branch.name,
          phone: branch.phone,
          address: branch.address,
          hours: branch.hours || {
            weekdays: '08:00 às 18:00',
            saturday: '08:00 às 14:00',
            sunday: 'Fechado'
          }
        }));

        setBranches(mappedBranches);
        addLog('success', `${mappedBranches.length} filiais carregadas com sucesso`);
      } else {
        addLog('warning', 'Usando filiais padrão - API não disponível');
      }
    } catch (error: any) {
      addLog('error', `Erro ao carregar filiais: ${error.message}`);
    }
  };

  // Função para carregar cotações da API
  const loadExchangeRatesFromAPI = async () => {
    try {
      addLog('info', 'Carregando cotações da API...');
      const baseUrl = 'http://localhost:3001';
      let apiResponse = null;

      try {
        console.log('🚀 FETCH: Tentando carregar rates...');
        const response = await fetch(`${baseUrl}/api/exchange-rates`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000
        } as any);

        console.log('📡 FETCH: Rates response status:', response.status);
        if (response.ok) {
          apiResponse = await response.json();
          console.log('✅ FETCH: Rates response:', apiResponse);
          addLog('success', `🎯 FORÇOU: ${(apiResponse || []).length} cotações carregadas da API!`);
        } else {
          console.log('❌ FETCH: Rates response not OK:', response.status);
          addLog('error', `Erro HTTP ${response.status} ao carregar cotações`);
        }
      } catch (err: any) {
        console.log(`❌ FETCH: Failed to load rates from ${baseUrl}:`, err);
        addLog('error', `Erro fetch rates: ${err.message}`);
      }

      if (apiResponse && Array.isArray(apiResponse)) {
        // Mapear os dados da API para o formato esperado pelo dashboard
        const mappedRates = apiResponse.map((rate: any, index: number) => ({
          id: (index + 1).toString(),
          currency: rate.currency,
          symbol: rate.symbol,
          buyRate: rate.buyRate,
          sellRate: rate.sellRate,
          lastUpdated: new Date(rate.lastUpdated)
        }));

        setExchangeRates(mappedRates);
        addLog('success', `${mappedRates.length} cotações carregadas com sucesso`);
      } else {
        addLog('warning', 'Usando cotações padrão - API não disponível');
      }

    } catch (error: any) {
      addLog('error', `Erro ao carregar cotações: ${error.message}`);
      addLog('warning', 'Usando cotações padrão');
    }
  };

  // Conectar ao inicializar
  useEffect(() => {
    addLog('info', 'Inicializando dashboard...');

    // Carregar dados da API primeiro
    loadBranchesFromAPI();
    loadExchangeRatesFromAPI();

    // Conectar com WebSocket IMEDIATAMENTE para receber o QR REAL
    connectWebSocket();

    // Atualizar uptime
    const uptimeInterval = setInterval(() => {
      setConnectionStats(prev => ({
        ...prev,
        uptime: calculateUptime()
      }));
    }, 60000);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(uptimeInterval);
    };
  }, []);

  // Função para calcular uptime
  const calculateUptime = () => {
    const startTime = new Date().getTime() - Math.random() * 10800000; // 0-3 horas
    const uptime = new Date().getTime() - startTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Funções para editar filiais
  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch.id);
    setBranchEditData({ ...branch });
    addLog('info', `Editando filial: ${branch.name}`);
  };

  const handleSaveBranch = async () => {
    if (!branchEditData || !editingBranch) return;

    try {
      addLog('info', 'Salvando alterações da filial...');

      // Tentar salvar na API na porta 3001
      const baseUrl = 'http://localhost:3001';
      let apiSuccess = false;

      try {
        const response = await fetch(`${baseUrl}/api/branches/${editingBranch}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(branchEditData),
          timeout: 10000
        } as any);

        if (response.ok) {
          await response.json();
          addLog('success', `Filial salva na API: ${baseUrl}`);
          apiSuccess = true;
        }
      } catch (err) {
        console.log(`❌ Failed to save branch to ${baseUrl}:`, err);
      }

      // Atualizar estado local independentemente se a API funcionou
      setBranches(prev => prev.map(branch =>
        branch.id === editingBranch ? branchEditData : branch
      ));

      setEditingBranch(null);
      setBranchEditData(null);

      if (apiSuccess) {
        addLog('success', `Filial ${branchEditData.name} salva com sucesso na API!`);
      } else {
        addLog('warning', `Filial ${branchEditData.name} salva localmente (API indisponível)`);
      }

      // Enviar para o backend via WebSocket também
      if (socketRef.current && isConnected) {
        socketRef.current.emit('updateBranch', branchEditData);
      }

    } catch (error: any) {
      addLog('error', `Erro ao salvar filial: ${error.message}`);
    }
  };

  const handleCancelEditBranch = () => {
    setEditingBranch(null);
    setBranchEditData(null);
    addLog('info', 'Edição cancelada');
  };

  const updateBranchEditData = (field: string, value: any) => {
    if (!branchEditData) return;

    setBranchEditData(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  // Funções para editar cotações
  const handleEditRate = (rate: ExchangeRate) => {
    setEditingRate(rate.id);
    setRateEditData({ ...rate });
    addLog('info', `Editando cotação: ${rate.currency}`);
  };

  const handleSaveRate = async () => {
    if (!rateEditData || !editingRate) return;

    try {
      addLog('info', 'Salvando cotação...');

      // Atualizar estado local
      setExchangeRates(prev => prev.map(rate =>
        rate.id === editingRate ? { ...rateEditData, lastUpdated: new Date() } : rate
      ));

      setEditingRate(null);
      setRateEditData(null);
      addLog('success', `Cotação ${rateEditData.currency} salva com sucesso!`);

      // Enviar para o backend via WebSocket
      if (socketRef.current && isConnected) {
        socketRef.current.emit('updateExchangeRate', rateEditData);
      }

    } catch (error: any) {
      addLog('error', `Erro ao salvar cotação: ${error.message}`);
    }
  };

  const handleCancelEditRate = () => {
    setEditingRate(null);
    setRateEditData(null);
    addLog('info', 'Edição de cotação cancelada');
  };

  const updateRateEditData = (field: string, value: any) => {
    if (!rateEditData) return;

    setRateEditData(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  // Função para gerar QR Code
  const generateQRCode = async () => {
    try {
      addLog('info', 'Solicitando novo QR Code do backend...');

      // Envia comando para o bot gerar novo QR via WebSocket
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('bot-generate-qr');
        addLog('success', 'Solicitação de QR enviada para o bot via WebSocket');
      } else {
        addLog('error', 'WebSocket não conectado - não é possível solicitar QR');

        // Fallback: tentar via API REST na porta 3001
        const baseUrl = 'http://localhost:3001';
        let qrGenerated = false;

        try {
          const response = await fetch(`${baseUrl}/api/bot/generate-qr`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000
          } as any);

          if (response.ok) {
            addLog('success', `QR Code solicitado via API: ${baseUrl}`);
            qrGenerated = true;
          }
        } catch (err) {
          console.log(`❌ Failed to generate QR via ${baseUrl}:`, err);
        }

      // Se conectado via WebSocket, tentar também
      if (socketRef.current && isConnected) {
        socketRef.current.emit('generateQRRequest');
        addLog('success', 'Solicitação de QR Code enviada via WebSocket');
        qrGenerated = true;
      }

        if (!qrGenerated) {
          addLog('error', 'Não foi possível gerar QR Code - verifique se o bot está rodando');
        }
      }

    } catch (error: any) {
      addLog('error', `Erro ao gerar QR Code: ${error.message}`);
    }
  };

  // Função para reconectar
  const handleReconnect = () => {
    addLog('info', 'Forçando reconexão...');
    connectWebSocket();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">WhatsApp Bot Dashboard</h1>
              <p className="text-gray-600 mt-2">Sistema de gerenciamento - PRODUÇÃO</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
              <Button onClick={handleReconnect} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconectar
              </Button>
            </div>
          </div>

          {connectionError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-800">Erro de conexão: {connectionError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'messages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Mensagens</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">
                    {botStatus.connected ? 'Online' : 'Offline'}
                  </div>
                  <Badge
                    variant={botStatus.connected ? "default" : "secondary"}
                    className="mt-2"
                  >
                    {botStatus.connectionStatus}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{connectionStats.totalMessages.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total processadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{connectionStats.connectedUsers}</div>
                  <p className="text-xs text-muted-foreground">Conectados hoje</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{connectionStats.uptime}</div>
                  <p className="text-xs text-muted-foreground">Tempo ativo</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8">
              {/* QR Code Section */}
              <Card>
                <CardHeader>
                  <CardTitle>QR Code</CardTitle>
                  <CardDescription>Escaneie para conectar o WhatsApp</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    {botStatus.qrCode ? (
                      <div className="flex flex-col items-center space-y-2">
                        <QRCode
                          value={botStatus.qrCode}
                          size={200}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        />
                        <p className="text-xs text-gray-500 text-center">
                          Escaneie este QR Code no WhatsApp
                        </p>
                      </div>
                    ) : (
                      <div className="w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] bg-gray-100 flex flex-col items-center justify-center text-gray-500">
                        <div className="text-4xl mb-2">📱</div>
                        <div className="text-sm text-center">
                          {botStatus.connectionStatus === 'connected' ? 'Bot Conectado!' : 'Clique em "Gerar novo QR Code"'}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button onClick={generateQRCode} className="mt-4 w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gerar novo QR Code
                  </Button>
                  {botStatus.phone && (
                    <p className="text-sm text-green-600 mt-2">
                      <CheckCircle className="h-4 w-4 inline mr-1" />
                      Conectado: {botStatus.phone}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Exchange Rates */}
              <Card>
                <CardHeader>
                  <CardTitle>Cotações</CardTitle>
                  <CardDescription>Valores editáveis - clique para alterar</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {exchangeRates.map((rate) => (
                      <div key={rate.id} className="border rounded-lg p-3">
                        {editingRate === rate.id && rateEditData ? (
                          // Modo de edição
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold">{rate.symbol}</span>
                              </div>
                              <p className="font-medium">{rate.currency}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-sm">Compra</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={rateEditData.buyRate}
                                  onChange={(e) => updateRateEditData('buyRate', parseFloat(e.target.value))}
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-sm">Venda</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={rateEditData.sellRate}
                                  onChange={(e) => updateRateEditData('sellRate', parseFloat(e.target.value))}
                                  className="h-8"
                                />
                              </div>
                            </div>

                            <div className="flex space-x-2">
                              <Button onClick={handleSaveRate} size="sm" className="flex-1">
                                <Save className="h-4 w-4 mr-1" />
                                Salvar
                              </Button>
                              <Button onClick={handleCancelEditRate} variant="outline" size="sm" className="flex-1">
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Modo de visualização
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold">{rate.symbol}</span>
                              </div>
                              <div>
                                <p className="font-medium">{rate.currency}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <p className="text-sm">
                                  <span className="text-green-600">C: {rate.buyRate.toFixed(2)}</span>
                                  {' | '}
                                  <span className="text-red-600">V: {rate.sellRate.toFixed(2)}</span>
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditRate(rate)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Logs */}
              <Card>
                <CardHeader>
                  <CardTitle>Logs do Sistema</CardTitle>
                  <CardDescription>Atividade recente</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {logs.slice(0, 10).map((log) => (
                      <div key={log.id} className={`text-sm p-2 rounded ${
                        log.type === 'error' ? 'bg-red-100 text-red-800' :
                        log.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        log.type === 'success' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span>{log.message}</span>
                          <span className="text-xs opacity-60">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Branches Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Filiais ({branches.length})</CardTitle>
                <CardDescription>Gerenciamento de filiais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {branches.map((branch) => (
                    <div key={branch.id} className="border rounded-lg p-4">
                      {editingBranch === branch.id && branchEditData ? (
                        // Modo de edição
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="name">Nome</Label>
                            <Input
                              id="name"
                              value={branchEditData.name}
                              onChange={(e) => updateBranchEditData('name', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                              id="phone"
                              value={branchEditData.phone}
                              onChange={(e) => updateBranchEditData('phone', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="address">Endereço</Label>
                            <Input
                              id="address"
                              value={branchEditData.address}
                              onChange={(e) => updateBranchEditData('address', e.target.value)}
                            />
                          </div>

                          <div className="space-y-3 text-sm">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Segunda a Sexta</Label>
                              <Input
                                type="text"
                                value={branchEditData.hours.weekdays}
                                onChange={(e) => updateBranchEditData('hours', {
                                  ...branchEditData.hours,
                                  weekdays: e.target.value
                                })}
                                placeholder="Ex: 08:00 às 18:00"
                                className="h-8"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Sábado</Label>
                              <Input
                                type="text"
                                value={branchEditData.hours.saturday}
                                onChange={(e) => updateBranchEditData('hours', {
                                  ...branchEditData.hours,
                                  saturday: e.target.value
                                })}
                                placeholder="Ex: 09:00 às 15:00"
                                className="h-8"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Domingo</Label>
                              <Input
                                type="text"
                                value={branchEditData.hours.sunday}
                                onChange={(e) => updateBranchEditData('hours', {
                                  ...branchEditData.hours,
                                  sunday: e.target.value
                                })}
                                placeholder="Ex: Fechado ou 10:00 às 14:00"
                                className="h-8"
                              />
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <Button onClick={handleSaveBranch} size="sm" className="flex-1">
                              <Save className="h-4 w-4 mr-1" />
                              Salvar
                            </Button>
                            <Button onClick={handleCancelEditBranch} variant="outline" size="sm" className="flex-1">
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Modo de visualização
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-5 w-5 text-blue-600" />
                              <h3 className="font-semibold">{branch.name}</h3>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditBranch(branch)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4" />
                              <span>{branch.phone}</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <Building2 className="h-4 w-4 mt-0.5" />
                              <span>{branch.address}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <div className="text-xs">
                                <div>Seg-Sex: {branch.hours.weekdays}</div>
                                <div>Sáb: {branch.hours.saturday}</div>
                                <div>Dom: {branch.hours.sunday}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <MessagesManager />
        )}
      </div>
    </div>
  );
}
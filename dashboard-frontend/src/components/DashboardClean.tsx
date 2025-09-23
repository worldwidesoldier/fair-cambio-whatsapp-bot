import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Users, Activity, Smartphone, RefreshCw,
  Edit, Save, X, Building2, Clock, Phone,
  CheckCircle, BarChart3, FileText, Shield
} from 'lucide-react';
import QRCode from 'react-qr-code';
import MessagesManager from './MessagesManager';
import HealthDashboard from './HealthDashboard';
import { io } from 'socket.io-client';

interface BotStatus {
  connected: boolean;
  qrCode?: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'qr';
  phone?: string;
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
}

interface SyncStatus {
  lastSync: string;
  action: string;
  status: 'processing' | 'completed' | 'error';
  timestamp: string;
}

export default function DashboardClean() {
  // Estados essenciais
  const [botStatus, setBotStatus] = useState<BotStatus>({
    connected: false,
    connectionStatus: 'disconnected'
  });

  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Estado de sincronização
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState<string[]>([]);

  // Estados de edição
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [branchEditData, setBranchEditData] = useState<Branch | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateEditData, setRateEditData] = useState<ExchangeRate | null>(null);

  // Estado de conexão
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<any>(null);

  // Estado das abas
  const [activeTab, setActiveTab] = useState<'dashboard' | 'messages' | 'health'>('dashboard');

  // Conectar WebSocket simples
  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io('http://localhost:3001', {
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setIsConnected(true);
      addLog('success', 'WebSocket conectado');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      addLog('warning', 'WebSocket desconectado');
    });

    // QR Code do bot
    socket.on('qrCode', (qrString: string) => {
      setBotStatus(prev => ({
        ...prev,
        qrCode: qrString,
        connectionStatus: 'qr'
      }));
      addLog('success', 'QR Code recebido');
    });

    // Status do bot
    socket.on('botStatus', (status: BotStatus) => {
      setBotStatus(status);
      addLog('info', `Bot: ${status.connectionStatus}`);
    });

    // Cotações
    socket.on('exchangeRates', (rates: ExchangeRate[]) => {
      setExchangeRates(rates);
      addLog('success', `${rates?.length || 0} cotações carregadas`);
    });

    socket.on('exchangeRatesUpdate', (rates: ExchangeRate[]) => {
      setExchangeRates(rates);
    });

    // Filiais
    socket.on('branches', (branchesData: Branch[]) => {
      if (branchesData && branchesData.length > 0) {
        setBranches(branchesData);
        addLog('success', `${branchesData.length} filiais carregadas`);
      }
    });

    socket.on('branchesUpdate', (branchesData: Branch[]) => {
      setBranches(branchesData);
    });

    // Eventos de sincronização
    socket.on('syncCompleted', (syncData: SyncStatus) => {
      setSyncStatus(syncData);
      addLog('success', `Sync ${syncData.action} concluído`);

      // Remover da fila de pendências
      setPendingSyncs(prev => prev.filter(sync => sync !== syncData.action));
    });

    socket.on('syncError', (syncData: SyncStatus & { error: string }) => {
      setSyncStatus(syncData);
      addLog('error', `Erro no sync ${syncData.action}: ${syncData.error}`);

      // Remover da fila de pendências
      setPendingSyncs(prev => prev.filter(sync => sync !== syncData.action));
    });

    socketRef.current = socket;

    // Solicitar dados iniciais
    setTimeout(() => {
      if (socket.connected) {
        socket.emit('requestInitialData');
      }
    }, 1000);
  };

  // Função para adicionar logs
  const addLog = (type: LogEntry['type'], message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message
    };
    setLogs(prev => [newLog, ...prev.slice(0, 19)]); // Manter apenas 20 logs
  };

  // Carregar dados das APIs
  const loadData = async () => {
    try {
      // Carregar filiais
      const branchesResponse = await fetch('http://localhost:3001/api/branches');
      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json();
        if (branchesData.branches) {
          setBranches(branchesData.branches);
          addLog('success', `${branchesData.branches.length} filiais carregadas via API`);
        }
      }

      // Carregar cotações
      const ratesResponse = await fetch('http://localhost:3001/api/exchange-rates');
      if (ratesResponse.ok) {
        const rates = await ratesResponse.json();
        if (rates && rates.length > 0) {
          setExchangeRates(rates.map((r: any) => ({ ...r, id: r.currency })));
          addLog('success', `${rates.length} cotações carregadas via API`);
        }
      }
    } catch (error) {
      addLog('error', 'Erro ao carregar dados da API');
    }
  };

  // Inicializar
  useEffect(() => {
    addLog('info', 'Dashboard iniciado');
    loadData();
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Editar filiais
  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch.id);
    setBranchEditData({ ...branch });
  };

  const handleSaveBranch = () => {
    if (!branchEditData || !editingBranch) return;

    setBranches(prev => prev.map(branch =>
      branch.id === editingBranch ? branchEditData : branch
    ));

    // Adicionar à fila de sincronização
    setPendingSyncs(prev => [...prev, `branch-${branchEditData.id}`]);

    // Enviar para o backend
    if (socketRef.current && isConnected) {
      socketRef.current.emit('updateBranch', branchEditData);
      addLog('info', `Sincronizando filial ${branchEditData.name} com bot...`);
    } else {
      addLog('warning', 'WebSocket desconectado - alteração não sincronizada');
    }

    setEditingBranch(null);
    setBranchEditData(null);
    addLog('success', `Filial ${branchEditData.name} salva`);
  };

  const handleCancelEditBranch = () => {
    setEditingBranch(null);
    setBranchEditData(null);
  };

  const updateBranchEditData = (field: string, value: any) => {
    if (!branchEditData) return;
    setBranchEditData(prev => ({ ...prev!, [field]: value }));
  };

  // Editar cotações
  const handleEditRate = (rate: ExchangeRate) => {
    setEditingRate(rate.id);
    setRateEditData({ ...rate });
  };

  const handleSaveRate = () => {
    if (!rateEditData || !editingRate) return;

    setExchangeRates(prev => prev.map(rate =>
      rate.id === editingRate ? { ...rateEditData, lastUpdated: new Date() } : rate
    ));

    // Adicionar à fila de sincronização
    setPendingSyncs(prev => [...prev, `rate-${rateEditData.currency}`]);

    // Enviar para o backend
    if (socketRef.current && isConnected) {
      socketRef.current.emit('updateExchangeRate', rateEditData);
      addLog('info', `Sincronizando cotação ${rateEditData.currency} com bot...`);
    } else {
      addLog('warning', 'WebSocket desconectado - alteração não sincronizada');
    }

    setEditingRate(null);
    setRateEditData(null);
    addLog('success', `Cotação ${rateEditData.currency} salva`);
  };

  const handleCancelEditRate = () => {
    setEditingRate(null);
    setRateEditData(null);
  };

  const updateRateEditData = (field: string, value: any) => {
    if (!rateEditData) return;
    setRateEditData(prev => ({ ...prev!, [field]: value }));
  };

  // Gerar QR Code
  const generateQRCode = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('bot-generate-qr');
      addLog('success', 'QR Code solicitado');
    } else {
      addLog('error', 'WebSocket não conectado');
    }
  };

  // Reconectar
  const handleReconnect = () => {
    addLog('info', 'Reconectando...');
    connectWebSocket();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Fair Câmbio Dashboard</h1>
              <p className="text-gray-600 mt-2">Sistema de gerenciamento limpo e funcional</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
              {pendingSyncs.length > 0 && (
                <Badge variant="secondary" className="animate-pulse">
                  {pendingSyncs.length} sync pendente{pendingSyncs.length > 1 ? 's' : ''}
                </Badge>
              )}
              {syncStatus && (
                <Badge variant={
                  syncStatus.status === 'completed' ? 'default' :
                  syncStatus.status === 'error' ? 'destructive' : 'secondary'
                }>
                  {syncStatus.action}: {syncStatus.status}
                </Badge>
              )}
              <Button onClick={handleReconnect} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconectar
              </Button>
            </div>
          </div>
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
              <button
                onClick={() => setActiveTab('health')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'health'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Health Monitor</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {botStatus.connected ? 'Online' : 'Offline'}
                  </div>
                  <Badge variant={botStatus.connected ? "default" : "secondary"} className="mt-2">
                    {botStatus.connectionStatus}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cotações</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{exchangeRates.length}</div>
                  <p className="text-xs text-muted-foreground">Moedas ativas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Filiais</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{branches.length}</div>
                  <p className="text-xs text-muted-foreground">Localizações</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conexão</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{isConnected ? 'OK' : 'OFF'}</div>
                  <p className="text-xs text-muted-foreground">WebSocket</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* QR Code Section */}
              <Card>
                <CardHeader>
                  <CardTitle>QR Code WhatsApp</CardTitle>
                  <CardDescription>Escaneie para conectar</CardDescription>
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
                          Escaneie no WhatsApp
                        </p>
                      </div>
                    ) : (
                      <div className="w-[200px] h-[200px] bg-gray-100 flex flex-col items-center justify-center text-gray-500">
                        <div className="text-4xl mb-2">📱</div>
                        <div className="text-sm text-center">
                          {botStatus.connectionStatus === 'connected' ? 'Bot Conectado!' : 'Clique em "Gerar QR Code"'}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button onClick={generateQRCode} className="mt-4 w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gerar QR Code
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
                  <CardTitle>Cotações ({exchangeRates.length})</CardTitle>
                  <CardDescription>Clique para editar</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {exchangeRates.map((rate) => (
                      <div key={rate.id} className="border rounded-lg p-3">
                        {editingRate === rate.id && rateEditData ? (
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold">{rate.symbol}</span>
                              </div>
                              <p className="font-medium">{rate.currency}</p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <p className="text-sm">
                                  <span className="text-green-600">C: {rate.buyRate.toFixed(2)}</span>
                                  {' | '}
                                  <span className="text-red-600">V: {rate.sellRate.toFixed(2)}</span>
                                </p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => handleEditRate(rate)}>
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

              {/* System Logs */}
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
                <CardTitle>Filiais Fair Câmbio ({branches.length})</CardTitle>
                <CardDescription>Clique em editar para alterar dados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {branches.map((branch) => (
                    <div key={branch.id} className="border rounded-lg p-4">
                      {editingBranch === branch.id && branchEditData ? (
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
                            <div>
                              <Label className="text-sm">Segunda a Sexta</Label>
                              <Input
                                value={branchEditData.hours.weekdays}
                                onChange={(e) => updateBranchEditData('hours', {
                                  ...branchEditData.hours,
                                  weekdays: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Sábado</Label>
                              <Input
                                value={branchEditData.hours.saturday}
                                onChange={(e) => updateBranchEditData('hours', {
                                  ...branchEditData.hours,
                                  saturday: e.target.value
                                })}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Domingo</Label>
                              <Input
                                value={branchEditData.hours.sunday}
                                onChange={(e) => updateBranchEditData('hours', {
                                  ...branchEditData.hours,
                                  sunday: e.target.value
                                })}
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
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-5 w-5 text-blue-600" />
                              <h3 className="font-semibold">{branch.name}</h3>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleEditBranch(branch)}>
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

        {/* Health Monitor Tab */}
        {activeTab === 'health' && (
          <HealthDashboard />
        )}
      </div>
    </div>
  );
}
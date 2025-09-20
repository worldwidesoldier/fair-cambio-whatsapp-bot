import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Users, Activity, Smartphone, RefreshCw, Settings,
  DollarSign, Edit, Save, X, Building2, Clock, Phone, Zap,
  CheckCircle, XCircle, AlertCircle, Send, Copy, ExternalLink
} from 'lucide-react';
import QRCode from 'react-qr-code';

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
    [key: string]: { open: string; close: string; };
  };
}

interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export default function DashboardFull() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    connected: false,
    connectionStatus: 'disconnected',
    qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WhatsApp%20Connection%20QR%20Code%20-%20' + Date.now()
  });
  const [stats, setStats] = useState<ConnectionStats>({
    totalMessages: 1234,
    connectedUsers: 45,
    uptime: '2h 45m',
    sessionsActive: 3
  });
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: new Date(), type: 'success', message: 'Sistema iniciado com sucesso' },
    { timestamp: new Date(), type: 'info', message: 'Aguardando conexão com WhatsApp' }
  ]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([
    { id: '1', currency: 'USD', symbol: '$', buyRate: 5.45, sellRate: 5.50, lastUpdated: new Date() },
    { id: '2', currency: 'EUR', symbol: '€', buyRate: 6.05, sellRate: 6.15, lastUpdated: new Date() },
    { id: '3', currency: 'GBP', symbol: '£', buyRate: 6.95, sellRate: 7.10, lastUpdated: new Date() }
  ]);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{[key: string]: {buy: string, sell: string}}>({});

  const [branches, setBranches] = useState<Branch[]>([
    {
      id: '1',
      name: 'Filial Centro',
      phone: '+55 11 3333-4444',
      address: 'Rua Principal, 123 - Centro - São Paulo/SP',
      hours: {
        'Segunda': { open: '08:00', close: '18:00' },
        'Terça': { open: '08:00', close: '18:00' },
        'Quarta': { open: '08:00', close: '18:00' },
        'Quinta': { open: '08:00', close: '18:00' },
        'Sexta': { open: '08:00', close: '18:00' },
        'Sábado': { open: '08:00', close: '14:00' },
        'Domingo': { open: 'Fechado', close: 'Fechado' }
      }
    },
    {
      id: '2',
      name: 'Filial Shopping Ibirapuera',
      phone: '+55 11 5555-6666',
      address: 'Shopping Ibirapuera, Loja 145 - Ibirapuera/SP',
      hours: {
        'Segunda': { open: '10:00', close: '22:00' },
        'Terça': { open: '10:00', close: '22:00' },
        'Quarta': { open: '10:00', close: '22:00' },
        'Quinta': { open: '10:00', close: '22:00' },
        'Sexta': { open: '10:00', close: '22:00' },
        'Sábado': { open: '10:00', close: '22:00' },
        'Domingo': { open: '14:00', close: '20:00' }
      }
    },
    {
      id: '3',
      name: 'Filial Vila Madalena',
      phone: '+55 11 7777-8888',
      address: 'Rua Harmonia, 456 - Vila Madalena/SP',
      hours: {
        'Segunda': { open: '09:00', close: '19:00' },
        'Terça': { open: '09:00', close: '19:00' },
        'Quarta': { open: '09:00', close: '19:00' },
        'Quinta': { open: '09:00', close: '19:00' },
        'Sexta': { open: '09:00', close: '19:00' },
        'Sábado': { open: '09:00', close: '15:00' },
        'Domingo': { open: 'Fechado', close: 'Fechado' }
      }
    },
    {
      id: '4',
      name: 'Filial Moema',
      phone: '+55 11 9999-0000',
      address: 'Av. Moema, 789 - Moema/SP',
      hours: {
        'Segunda': { open: '08:30', close: '18:30' },
        'Terça': { open: '08:30', close: '18:30' },
        'Quarta': { open: '08:30', close: '18:30' },
        'Quinta': { open: '08:30', close: '18:30' },
        'Sexta': { open: '08:30', close: '18:30' },
        'Sábado': { open: '08:30', close: '13:30' },
        'Domingo': { open: 'Fechado', close: 'Fechado' }
      }
    },
    {
      id: '5',
      name: 'Filial Brooklin',
      phone: '+55 11 2222-3333',
      address: 'Rua dos Chanés, 321 - Brooklin/SP',
      hours: {
        'Segunda': { open: '08:00', close: '17:00' },
        'Terça': { open: '08:00', close: '17:00' },
        'Quarta': { open: '08:00', close: '17:00' },
        'Quinta': { open: '08:00', close: '17:00' },
        'Sexta': { open: '08:00', close: '17:00' },
        'Sábado': { open: '08:00', close: '12:00' },
        'Domingo': { open: 'Fechado', close: 'Fechado' }
      }
    }
  ]);

  // WebSocket connection with error handling
  useEffect(() => {
    console.log('🚀 Dashboard Full carregando...');

    // Connect directly to port 3002 (real backend)
    setIsConnecting(true);

    try {
      const socketConnection = io('http://localhost:3002', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });

      socketConnection.on('connect', () => {
        console.log('✅ Conectado ao backend na porta 3002');
        setIsConnecting(false);
        addLog('success', 'WebSocket conectado ao bot real');
      });

      socketConnection.on('connect_error', (error) => {
        console.log('❌ Erro ao conectar:', error.message);
        setIsConnecting(false);
        addLog('warning', 'Falha na conexão - modo offline');
      });

      // Listen for bot status updates
      socketConnection.on('botStatus', (status: any) => {
        console.log('📡 Status do bot recebido:', status);
        setBotStatus(prev => ({
          ...prev,
          connected: status.connected,
          connectionStatus: status.connectionStatus,
          qrCode: status.qrCode || prev.qrCode,
          lastSeen: status.lastSeen ? new Date(status.lastSeen) : undefined,
          phone: status.phone
        }));

        // Add log based on connection status
        if (status.connected) {
          addLog('success', 'Bot WhatsApp conectado');
        } else if (status.connectionStatus === 'qr') {
          addLog('info', 'QR Code disponível para escaneamento');
        }
      });

      // Listen for stats updates
      socketConnection.on('stats', (statsData: any) => {
        console.log('📊 Stats recebidas:', statsData);
        setStats(prev => ({
          ...prev,
          ...statsData
        }));
      });

      // Listen for new messages/logs
      socketConnection.on('newMessage', (messageData: any) => {
        addLog('info', `Nova mensagem de ${messageData.from}`);
        setStats(prev => ({
          ...prev,
          totalMessages: prev.totalMessages + 1
        }));
      });

      // Listen for connection events
      socketConnection.on('whatsappConnected', () => {
        addLog('success', 'WhatsApp conectado com sucesso');
        setBotStatus(prev => ({ ...prev, connected: true, connectionStatus: 'connected' }));
      });

      socketConnection.on('whatsappDisconnected', () => {
        addLog('warning', 'WhatsApp desconectado');
        setBotStatus(prev => ({ ...prev, connected: false, connectionStatus: 'disconnected' }));
      });

      setSocket(socketConnection);

      return () => {
        socketConnection.disconnect();
      };
    } catch (error) {
      console.log('Erro na conexão WebSocket:', error);
      setIsConnecting(false);
      addLog('error', 'Erro na conexão com backend');
    }

  }, []);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date(),
      type,
      message
    }].slice(-10));
  };

  const handleRefreshQR = () => {
    addLog('info', 'Gerando novo QR Code...');

    // Generate new QR Code
    const newQRCode = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WhatsApp%20Connection%20QR%20Code%20-%20' + Date.now();

    setBotStatus(prev => ({
      ...prev,
      qrCode: newQRCode,
      connectionStatus: 'qr'
    }));

    // If socket is connected, emit QR refresh request
    if (socket) {
      socket.emit('refreshQR');
    }

    setTimeout(() => {
      addLog('success', 'QR Code gerado com sucesso');
    }, 1000);
  };

  const handleEditRate = (rateId: string) => {
    const rate = exchangeRates.find(r => r.id === rateId);
    if (rate) {
      setEditingRate(rateId);
      setEditValues({
        ...editValues,
        [rateId]: {
          buy: rate.buyRate.toString(),
          sell: rate.sellRate.toString()
        }
      });
    }
  };

  const handleSaveRate = (rateId: string) => {
    const values = editValues[rateId];
    if (values) {
      setExchangeRates(prev => prev.map(rate =>
        rate.id === rateId
          ? { ...rate, buyRate: parseFloat(values.buy), sellRate: parseFloat(values.sell), lastUpdated: new Date() }
          : rate
      ));
      setEditingRate(null);
      addLog('success', `Cotação ${exchangeRates.find(r => r.id === rateId)?.currency} atualizada`);
    }
  };

  // Branch editing functions
  const handleEditBranch = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setEditingBranch(branchId);
      setBranchEditData({ ...branch });
      addLog('info', `Editando filial ${branch.name}`);
    }
  };

  const handleSaveBranch = () => {
    if (branchEditData && editingBranch) {
      setBranches(prev => prev.map(branch =>
        branch.id === editingBranch ? branchEditData : branch
      ));
      setEditingBranch(null);
      setBranchEditData(null);
      addLog('success', `Filial ${branchEditData.name} atualizada`);
    }
  };

  const handleCancelEditBranch = () => {
    setEditingBranch(null);
    setBranchEditData(null);
    addLog('info', 'Edição cancelada');
  };

  const updateBranchEditData = (field: keyof Branch, value: any) => {
    if (branchEditData) {
      setBranchEditData({
        ...branchEditData,
        [field]: value
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      case 'qr': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp Bot Dashboard</h1>
            <p className="text-gray-600 mt-2">Sistema de gerenciamento completo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Exportar Dados
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {botStatus.connected ? 'Online' : 'Offline'}
              </div>
              <div className="flex items-center mt-2 gap-2">
                <div className={`h-2 w-2 rounded-full ${getStatusColor(botStatus.connectionStatus)}`} />
                <Badge variant={botStatus.connected ? 'default' : 'secondary'}>
                  {botStatus.connectionStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total processadas hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.connectedUsers}</div>
              <p className="text-xs text-muted-foreground">Ativos hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessões</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sessionsActive}</div>
              <p className="text-xs text-muted-foreground">Ativas agora</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uptime}</div>
              <p className="text-xs text-muted-foreground">Tempo ativo</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* QR Code Section */}
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
              <CardDescription>Escaneie para conectar o WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="bg-gray-100 p-4 rounded-lg">
                {botStatus.qrCode ? (
                  <QRCode value={botStatus.qrCode} size={200} />
                ) : (
                  <div className="w-[200px] h-[200px] bg-white flex items-center justify-center">
                    {botStatus.connected ? (
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Conectado</p>
                        {botStatus.phone && (
                          <p className="text-xs text-gray-500 mt-1">{botStatus.phone}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">Aguardando QR...</p>
                    )}
                  </div>
                )}
              </div>
              <Button className="mt-4" onClick={handleRefreshQR} disabled={botStatus.connected}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {botStatus.connected ? 'Conectado' : 'Gerar novo QR'}
              </Button>
            </CardContent>
          </Card>

          {/* Exchange Rates */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Cotações</CardTitle>
              <CardDescription>Taxas de câmbio atuais</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {exchangeRates.map(rate => (
                  <div key={rate.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{rate.symbol}</div>
                      <div>
                        <p className="font-semibold">{rate.currency}</p>
                        <p className="text-xs text-gray-500">
                          Atualizado: {new Date(rate.lastUpdated).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {editingRate === rate.id ? (
                      <div className="flex items-center gap-2">
                        <div>
                          <Label className="text-xs">Compra</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20 h-8"
                            value={editValues[rate.id]?.buy || ''}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              [rate.id]: { ...editValues[rate.id], buy: e.target.value }
                            })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Venda</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20 h-8"
                            value={editValues[rate.id]?.sell || ''}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              [rate.id]: { ...editValues[rate.id], sell: e.target.value }
                            })}
                          />
                        </div>
                        <div className="flex gap-1 mt-4">
                          <Button size="sm" onClick={() => handleSaveRate(rate.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingRate(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Compra</p>
                          <p className="font-bold">R$ {rate.buyRate.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Venda</p>
                          <p className="font-bold">R$ {rate.sellRate.toFixed(2)}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleEditRate(rate.id)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branches and Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Branches */}
          <Card>
            <CardHeader>
              <CardTitle>Filiais</CardTitle>
              <CardDescription>Informações das unidades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {branches.map(branch => (
                  <div key={branch.id} className="border rounded-lg p-4">
                    {editingBranch === branch.id && branchEditData ? (
                      // Editing mode
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-blue-600">Editando Filial</h4>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveBranch}>
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEditBranch}>
                              <X className="h-3 w-3 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name" className="text-sm font-medium">Nome da Filial</Label>
                            <Input
                              id="name"
                              value={branchEditData.name}
                              onChange={(e) => updateBranchEditData('name', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
                            <Input
                              id="phone"
                              value={branchEditData.phone}
                              onChange={(e) => updateBranchEditData('phone', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="address" className="text-sm font-medium">Endereço</Label>
                          <Input
                            id="address"
                            value={branchEditData.address}
                            onChange={(e) => updateBranchEditData('address', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2 block">Horários de Funcionamento</Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {Object.entries(branchEditData.hours).map(([day, hours]) => (
                              <div key={day} className="flex items-center gap-2">
                                <span className="min-w-[50px]">{day}:</span>
                                <Input
                                  value={hours.open}
                                  onChange={(e) => updateBranchEditData('hours', {
                                    ...branchEditData.hours,
                                    [day]: { ...hours, open: e.target.value }
                                  })}
                                  className="w-16 h-6 text-xs"
                                  placeholder="08:00"
                                />
                                <span>-</span>
                                <Input
                                  value={hours.close}
                                  onChange={(e) => updateBranchEditData('hours', {
                                    ...branchEditData.hours,
                                    [day]: { ...hours, close: e.target.value }
                                  })}
                                  className="w-16 h-6 text-xs"
                                  placeholder="18:00"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-gray-500" />
                            <h4 className="font-semibold">{branch.name}</h4>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleEditBranch(branch.id)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{branch.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>Seg-Sex: {branch.hours['Segunda'].open} - {branch.hours['Segunda'].close}</span>
                          </div>
                          <p className="text-xs mt-2">{branch.address}</p>
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
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm p-2 bg-gray-50 rounded">
                    {getLogIcon(log.type)}
                    <div className="flex-1">
                      <p className="text-gray-700">{log.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
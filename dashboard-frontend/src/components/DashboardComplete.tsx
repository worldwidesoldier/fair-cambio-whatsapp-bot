import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Users, Activity, Smartphone, RefreshCw, Settings, DollarSign, Edit, Save, X, Building2, Clock, Phone } from 'lucide-react';
import QRCode from 'react-qr-code';

interface BotStatus {
  connected: boolean;
  qrCode?: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'qr';
  lastSeen?: Date;
}

interface ConnectionStats {
  totalMessages: number;
  connectedUsers: number;
  uptime: string;
  lastActivity?: Date;
}

interface ExchangeRate {
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
    monday: { open: string; close: string; };
    tuesday: { open: string; close: string; };
    wednesday: { open: string; close: string; };
    thursday: { open: string; close: string; };
    friday: { open: string; close: string; };
    saturday: { open: string; close: string; };
    sunday: { open: string; close: string; };
  };
}

export default function DashboardComplete() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    connected: false,
    connectionStatus: 'disconnected'
  });
  const [stats, setStats] = useState<ConnectionStats>({
    totalMessages: 0,
    connectedUsers: 0,
    uptime: '0h 0m'
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{[key: string]: {buy: string, sell: string}}>({});

  // Branches management states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [branchEditData, setBranchEditData] = useState<Branch | null>(null);

  useEffect(() => {
    console.log('🔥 DASHBOARD COMPLETO CARREGANDO...');

    const socketConnection = io('http://localhost:3001', {
      forceNew: true,
      transports: ['websocket', 'polling']
    });

    socketConnection.on('connect', () => {
      console.log('✅ Socket conectado com sucesso');
    });

    socketConnection.on('botStatus', (status: BotStatus) => {
      console.log('📡 Status do bot recebido:', status);
      setBotStatus(status);
    });

    socketConnection.on('stats', (statsData: ConnectionStats) => {
      setStats(statsData);
    });

    socketConnection.on('logs', (newLogs: string[]) => {
      setLogs(prev => [...prev, ...newLogs].slice(-50));
    });

    socketConnection.on('exchangeRates', (rates: ExchangeRate[]) => {
      console.log('📈 Cotações recebidas:', rates);
      setExchangeRates(rates);
    });

    socketConnection.on('exchangeRatesUpdate', (rates: ExchangeRate[]) => {
      console.log('💱 Cotações atualizadas:', rates);
      setExchangeRates(rates);
    });

    socketConnection.on('branches', (branchesData: Branch[]) => {
      console.log('🏢 Dados das filiais recebidos:', branchesData);
      setBranches(branchesData);
    });

    setSocket(socketConnection);

    // Request initial data
    socketConnection.emit('requestStatus');
    socketConnection.emit('branches');

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const getStatusBadge = () => {
    switch (botStatus.connectionStatus) {
      case 'connected':
        return <Badge variant="success">Connected</Badge>;
      case 'connecting':
        return <Badge variant="warning">Connecting</Badge>;
      case 'qr':
        return <Badge variant="warning">Awaiting QR Scan</Badge>;
      default:
        return <Badge variant="destructive">Disconnected</Badge>;
    }
  };

  const refreshStatus = () => {
    if (socket) {
      socket.emit('requestStatus');
      console.log('🔄 Status atualizado');
    }
  };

  const startEdit = (currency: string, buyRate: number, sellRate: number) => {
    setEditingRate(currency);
    setEditValues({
      ...editValues,
      [currency]: {
        buy: buyRate.toFixed(2),
        sell: sellRate.toFixed(2)
      }
    });
  };

  const cancelEdit = () => {
    setEditingRate(null);
    setEditValues({});
  };

  const saveRate = (currency: string) => {
    const values = editValues[currency];
    if (!values) return;

    const buyRate = parseFloat(values.buy);
    const sellRate = parseFloat(values.sell);

    if (isNaN(buyRate) || isNaN(sellRate) || buyRate <= 0 || sellRate <= 0) {
      alert('Por favor, insira valores válidos!');
      return;
    }

    if (buyRate >= sellRate) {
      alert('A taxa de compra deve ser menor que a de venda!');
      return;
    }

    if (socket) {
      socket.emit('updateExchangeRate', { currency, buyRate, sellRate });
    }

    setEditingRate(null);
    setEditValues({});
  };

  // Branch management functions
  const startEditingBranch = (branch: Branch) => {
    setEditingBranch(branch.id);
    setBranchEditData({ ...branch });
  };

  const saveBranch = () => {
    if (!branchEditData || !socket) return;
    socket.emit('updateBranch', branchEditData);
    setEditingBranch(null);
    setBranchEditData(null);
  };

  const cancelBranchEdit = () => {
    setEditingBranch(null);
    setBranchEditData(null);
  };

  const updateBranchField = (field: string, value: string) => {
    if (!branchEditData) return;
    setBranchEditData({ ...branchEditData, [field]: value });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">WhatsApp Bot Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your WhatsApp bot instance</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refreshStatus} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getStatusBadge()}
                {botStatus.lastSeen && (
                  <p className="text-xs text-muted-foreground">
                    Last seen: {new Date(botStatus.lastSeen).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Messages processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.connectedUsers}</div>
              <p className="text-xs text-muted-foreground">Active conversations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uptime}</div>
              <p className="text-xs text-muted-foreground">System uptime</p>
            </CardContent>
          </Card>
        </div>

        {/* Exchange Rates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cotações das Moedas
            </CardTitle>
            <CardDescription>
              Gerencie as taxas de compra e venda das principais moedas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {exchangeRates.map((rate) => (
                <Card key={rate.currency} className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="text-2xl">{rate.symbol}</span>
                        <span>{rate.currency}</span>
                      </span>
                      {editingRate !== rate.currency && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(rate.currency, rate.buyRate, rate.sellRate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {editingRate === rate.currency ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Taxa de Compra (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues[rate.currency]?.buy || ''}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              [rate.currency]: {
                                ...editValues[rate.currency],
                                buy: e.target.value
                              }
                            })}
                            className="text-center"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Taxa de Venda (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues[rate.currency]?.sell || ''}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              [rate.currency]: {
                                ...editValues[rate.currency],
                                sell: e.target.value
                              }
                            })}
                            className="text-center"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveRate(rate.currency)}
                            className="flex-1"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Salvar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                            className="flex-1"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-xs text-green-600 font-medium mb-1">COMPRA</div>
                            <div className="text-lg font-bold text-green-700">
                              R$ {rate.buyRate.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <div className="text-xs text-red-600 font-medium mb-1">VENDA</div>
                            <div className="text-lg font-bold text-red-700">
                              R$ {rate.sellRate.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                          Atualizado: {new Date(rate.lastUpdated).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Branches Management Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gerenciamento de Filiais
            </CardTitle>
            <CardDescription>
              Configure as informações das filiais (nome, telefone, horários e endereços)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch) => (
                <Card key={branch.id} className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {branch.name}
                      </span>
                      {editingBranch !== branch.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingBranch(branch)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{branch.phone}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {branch.address}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Clock className="h-3 w-3" />
                        Horários
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Seg-Sex: {branch.hours.monday.open} - {branch.hours.monday.close}</div>
                        <div>Sáb: {branch.hours.saturday.open} - {branch.hours.saturday.close}</div>
                        <div>Dom: {branch.hours.sunday.open} - {branch.hours.sunday.close}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* QR Code Section */}
        {botStatus.connectionStatus === 'qr' && botStatus.qrCode && (
          <Card>
            <CardHeader>
              <CardTitle>QR Code Authentication</CardTitle>
              <CardDescription>
                Scan this QR code with your WhatsApp to authenticate
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <QRCode
                  value={botStatus.qrCode}
                  size={256}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
            </CardContent>
          </Card>
        )}

        {/* Logs Section */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Real-time logs from your WhatsApp bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No recent activity</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
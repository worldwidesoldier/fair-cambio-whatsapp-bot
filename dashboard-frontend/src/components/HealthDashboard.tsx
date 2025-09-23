import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity, AlertTriangle, CheckCircle, Clock, AlertCircle,
  Cpu, HardDrive, MemoryStick, Wifi, MessageSquare,
  RefreshCw, Download, Settings, TrendingUp, TrendingDown,
  Zap, Database, Globe, Smartphone, Bell, X, Eye
} from 'lucide-react';
import { io } from 'socket.io-client';

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'unhealthy';
  services: {
    api: string;
    websocket: string;
    whatsapp: string;
    database: string;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    responseTime: number;
    errorRate: number;
    lastHealthCheck: string | null;
    lastTestMessage: string | null;
  };
  alerts: Alert[];
  logs: LogEntry[];
  timestamp: string;
  nodeVersion: string;
  pid: number;
}

interface Alert {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata: any;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success' | 'debug';
  message: string;
  metadata: any;
}

interface PerformanceMetrics {
  timestamp: string;
  memoryUsage: number;
  cpuUsage: number;
  responseTime: number;
  errorRate: number;
}

export default function HealthDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'logs' | 'metrics'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const socketRef = useRef<any>(null);

  // Conectar WebSocket para health monitoring
  const connectHealthSocket = () => {
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
      console.log('✅ Health Dashboard conectado ao WebSocket');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('❌ Health Dashboard desconectado do WebSocket');
    });

    // Eventos de health monitoring
    socket.on('healthStatus', (status: HealthStatus) => {
      setHealthStatus(status);
    });

    socket.on('healthCheckComplete', (status: HealthStatus) => {
      setHealthStatus(status);
    });

    socket.on('performanceUpdate', (metrics: any) => {
      const perfMetric: PerformanceMetrics = {
        timestamp: new Date().toISOString(),
        memoryUsage: metrics.memoryUsage || 0,
        cpuUsage: metrics.cpuUsage || 0,
        responseTime: metrics.responseTime || 0,
        errorRate: metrics.errorRate || 0
      };

      setPerformanceHistory(prev => {
        const updated = [perfMetric, ...prev.slice(0, 49)]; // Manter 50 pontos
        return updated;
      });
    });

    socket.on('alert', (alert: Alert) => {
      console.log('🚨 Novo alerta recebido:', alert);
      // Atualizar alertas no estado
      setHealthStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: [alert, ...prev.alerts.slice(0, 49)]
        };
      });
    });

    socket.on('log', (log: LogEntry) => {
      console.log('📝 Novo log recebido:', log);
      // Atualizar logs no estado
      setHealthStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          logs: [log, ...prev.logs.slice(0, 99)]
        };
      });
    });

    socketRef.current = socket;

    // Solicitar status inicial
    setTimeout(() => {
      if (socket.connected) {
        socket.emit('requestHealthStatus');
      }
    }, 1000);
  };

  // Inicializar
  useEffect(() => {
    connectHealthSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('requestHealthStatus');
      }
    }, 30000); // A cada 30 segundos

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Funções de controle
  const forceHealthCheck = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('forceHealthCheck');
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('acknowledgeAlert', alertId);
    }
  };

  const clearAcknowledgedAlerts = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('clearAcknowledgedAlerts');
    }
  };

  const exportLogs = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('exportLogs', 'json');
    }
  };

  // Formatação de tempo
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'error': case 'unhealthy': return 'destructive';
      default: return 'outline';
    }
  };

  // Alert level color
  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'default';
      default: return 'outline';
    }
  };

  // Log level color
  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'success': return 'bg-green-100 text-green-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'debug': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!healthStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando health dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Health & Monitoring</h2>
          <p className="text-gray-600">Sistema de monitoramento e alertas em tempo real</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={isConnected ? "default" : "destructive"}>
            <Wifi className="h-3 w-3 mr-1" />
            {isConnected ? 'Online' : 'Offline'}
          </Badge>

          <Badge variant={getStatusColor(healthStatus.overall)}>
            <Activity className="h-3 w-3 mr-1" />
            {healthStatus.overall.toUpperCase()}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto: {autoRefresh ? 'ON' : 'OFF'}
          </Button>

          <Button onClick={forceHealthCheck} size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Force Check
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Server</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              <Badge variant={getStatusColor(healthStatus.services.api)}>
                {healthStatus.services.api}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Response: {healthStatus.metrics.responseTime}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WebSocket</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              <Badge variant={getStatusColor(healthStatus.services.websocket)}>
                {healthStatus.services.websocket}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Realtime connection
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Bot</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              <Badge variant={getStatusColor(healthStatus.services.whatsapp)}>
                {healthStatus.services.whatsapp}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {healthStatus.metrics.lastTestMessage ?
                `Teste: ${formatTimestamp(healthStatus.metrics.lastTestMessage)}` :
                'Sem teste recente'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatUptime(healthStatus.metrics.uptime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              PID: {healthStatus.pid}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus.metrics.memoryUsage.toFixed(1)}%
            </div>
            <Progress
              value={healthStatus.metrics.memoryUsage}
              className="mt-2"
              // @ts-ignore
              indicatorClassName={healthStatus.metrics.memoryUsage > 85 ? 'bg-red-500' :
                                healthStatus.metrics.memoryUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {healthStatus.metrics.memoryUsage > 85 ? 'High usage' : 'Normal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus.metrics.cpuUsage.toFixed(1)}%
            </div>
            <Progress
              value={healthStatus.metrics.cpuUsage}
              className="mt-2"
              // @ts-ignore
              indicatorClassName={healthStatus.metrics.cpuUsage > 80 ? 'bg-red-500' :
                                healthStatus.metrics.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {healthStatus.metrics.cpuUsage > 80 ? 'High usage' : 'Normal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus.metrics.errorRate.toFixed(1)}%
            </div>
            <Progress
              value={healthStatus.metrics.errorRate}
              max={100}
              className="mt-2"
              // @ts-ignore
              indicatorClassName={healthStatus.metrics.errorRate > 10 ? 'bg-red-500' :
                                healthStatus.metrics.errorRate > 5 ? 'bg-yellow-500' : 'bg-green-500'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {healthStatus.metrics.errorRate > 10 ? 'High errors' : 'Normal'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: Activity },
            { key: 'alerts', label: `Alertas (${healthStatus.alerts.filter(a => !a.acknowledged).length})`, icon: Bell },
            { key: 'logs', label: `Logs (${healthStatus.logs.length})`, icon: MessageSquare },
            { key: 'metrics', label: 'Métricas', icon: TrendingUp }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>
                  Últimos eventos e verificações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {healthStatus.logs.slice(0, 5).map((log) => (
                    <div key={log.id} className={`text-sm p-3 rounded-lg ${getLogColor(log.level)}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.message}</span>
                        <span className="text-xs opacity-75">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Alerts */}
            {healthStatus.alerts.filter(a => !a.acknowledged).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                    Alertas Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {healthStatus.alerts.filter(a => !a.acknowledged).slice(0, 3).map((alert) => (
                      <div key={alert.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getAlertColor(alert.level)}>
                              {alert.level}
                            </Badge>
                            <span className="font-medium">{alert.title}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                          <p className="text-xs text-gray-500">{formatTimestamp(alert.timestamp)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Alertas do Sistema</CardTitle>
                  <CardDescription>
                    {healthStatus.alerts.filter(a => !a.acknowledged).length} alertas ativos,{' '}
                    {healthStatus.alerts.filter(a => a.acknowledged).length} reconhecidos
                  </CardDescription>
                </div>
                <Button onClick={clearAcknowledgedAlerts} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Limpar Reconhecidos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {healthStatus.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${alert.acknowledged ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={getAlertColor(alert.level)}>
                            {alert.level}
                          </Badge>
                          <span className="font-medium">{alert.title}</span>
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Reconhecido
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        <div className="text-xs text-gray-500">
                          <span>{formatTimestamp(alert.timestamp)}</span>
                          {alert.acknowledgedAt && (
                            <span className="ml-3">
                              Reconhecido em: {formatTimestamp(alert.acknowledgedAt)}
                            </span>
                          )}
                        </div>
                        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer">
                              Ver detalhes
                            </summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(alert.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'logs' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Logs do Sistema</CardTitle>
                  <CardDescription>
                    {healthStatus.logs.length} entradas de log
                  </CardDescription>
                </div>
                <Button onClick={exportLogs} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {healthStatus.logs.map((log) => (
                  <div key={log.id} className={`text-sm p-3 rounded-lg ${getLogColor(log.level)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.level}
                          </Badge>
                          <span className="font-medium">{log.message}</span>
                        </div>
                        <div className="text-xs opacity-75">
                          {formatTimestamp(log.timestamp)}
                        </div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer">
                              Ver metadata
                            </summary>
                            <pre className="text-xs bg-white bg-opacity-50 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance History</CardTitle>
                <CardDescription>
                  Últimas {performanceHistory.length} medições
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-sm text-gray-600">
                        {performanceHistory[0]?.memoryUsage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded">
                      <div
                        className="h-2 bg-blue-500 rounded"
                        style={{ width: `${Math.min(performanceHistory[0]?.memoryUsage || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">CPU Usage</span>
                      <span className="text-sm text-gray-600">
                        {performanceHistory[0]?.cpuUsage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded">
                      <div
                        className="h-2 bg-green-500 rounded"
                        style={{ width: `${Math.min(performanceHistory[0]?.cpuUsage || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Response Time</span>
                      <span className="text-sm text-gray-600">
                        {performanceHistory[0]?.responseTime}ms
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded">
                      <div
                        className="h-2 bg-yellow-500 rounded"
                        style={{ width: `${Math.min((performanceHistory[0]?.responseTime || 0) / 50, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Info</CardTitle>
                <CardDescription>
                  Informações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Node.js Version:</span>
                    <span className="font-medium">{healthStatus.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Process ID:</span>
                    <span className="font-medium">{healthStatus.pid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Uptime:</span>
                    <span className="font-medium">{formatUptime(healthStatus.metrics.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Health Check:</span>
                    <span className="font-medium">
                      {healthStatus.metrics.lastHealthCheck ?
                        formatTimestamp(healthStatus.metrics.lastHealthCheck) :
                        'Nunca'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Test Message:</span>
                    <span className="font-medium">
                      {healthStatus.metrics.lastTestMessage ?
                        formatTimestamp(healthStatus.metrics.lastTestMessage) :
                        'Nunca'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
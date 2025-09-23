import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, CheckCircle, Clock,
  Cpu, Wifi, MessageSquare,
  RefreshCw, Smartphone
} from 'lucide-react';

interface SimpleHealthStatus {
  status: string;
  timestamp: string;
  services: {
    api: string;
    websocket: string;
  };
  uptime?: number;
}

export default function HealthDashboard() {
  const [healthStatus, setHealthStatus] = useState<SimpleHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3001/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHealthStatus(data);
    } catch (err) {
      console.error('Erro ao buscar status de saúde:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();

    // Auto refresh a cada 30 segundos
    const interval = setInterval(fetchHealthStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !healthStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Carregando status do sistema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Erro de Conexão</CardTitle>
            <CardDescription>Não foi possível conectar ao backend</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchHealthStatus} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHealthy = healthStatus?.status === 'ok';
  const uptime = healthStatus?.uptime ? Math.floor(healthStatus.uptime / 60) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Health Monitor</h2>
          <p className="text-gray-600">Status do sistema em tempo real</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant={isHealthy ? "default" : "destructive"}>
            {isHealthy ? 'Sistema Saudável' : 'Sistema com Problemas'}
          </Badge>
          <Button onClick={fetchHealthStatus} size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isHealthy ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  OK
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <Activity className="mr-2 h-5 w-5" />
                  ERRO
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sistema operacional
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Backend</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus?.services?.api ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {healthStatus.services.api}
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <Activity className="mr-2 h-5 w-5" />
                  offline
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Porto 3001
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WebSocket</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus?.services?.websocket ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {healthStatus.services.websocket}
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <Activity className="mr-2 h-5 w-5" />
                  offline
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Socket.io ativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {uptime > 0 ? `${uptime}m` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Sistema rodando
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
          <CardDescription>Dados básicos do backend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Última Verificação</h4>
              <p className="text-sm text-gray-600">
                {healthStatus?.timestamp ?
                  new Date(healthStatus.timestamp).toLocaleString('pt-BR') :
                  'Não disponível'
                }
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Backend Status</h4>
              <p className="text-sm text-gray-600">
                Fair Câmbio Backend LIMPO funcionando
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Endpoints Ativos</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>✅ /health</div>
                <div>✅ /api/branches</div>
                <div>✅ /api/exchange-rates</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Ferramentas de diagnóstico</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => window.open('http://localhost:3001/health', '_blank')}
            >
              <Activity className="mr-2 h-4 w-4" />
              Ver Health Endpoint
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open('http://localhost:3001', '_blank')}
            >
              <Cpu className="mr-2 h-4 w-4" />
              Backend Homepage
            </Button>

            <Button
              variant="outline"
              onClick={fetchHealthStatus}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
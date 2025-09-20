const http = require('http');
const url = require('url');
const pino = require('pino');

class MonitoringAPI {
  constructor(branchManager) {
    this.branchManager = branchManager;
    this.server = null;
    this.logger = pino({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
      base: { component: 'MonitoringAPI' }
    });
  }

  async start(port = 3001) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          this.logger.info(`📊 Monitoring API iniciada na porta ${port}`);
          resolve();
        }
      });

      this.server.on('error', (error) => {
        this.logger.error('❌ Erro no servidor de monitoramento:', error);
      });
    });
  }

  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      let response;

      switch (pathname) {
        case '/health':
          response = await this.getHealthStatus();
          break;

        case '/status':
          response = await this.getSystemStatus();
          break;

        case '/branches':
          response = await this.getBranchesStatus();
          break;

        case '/branch':
          if (method === 'GET') {
            response = await this.getBranchStatus(query.id);
          } else if (method === 'POST') {
            const action = query.action;
            const branchId = query.id;
            response = await this.executeBranchAction(branchId, action);
          }
          break;

        case '/metrics':
          response = await this.getMetrics();
          break;

        case '/logs':
          response = await this.getLogs(query.branch, query.limit);
          break;

        default:
          response = { error: 'Endpoint não encontrado', code: 404 };
      }

      const statusCode = response.code || 200;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response, null, 2));

    } catch (error) {
      this.logger.error('❌ Erro no handler da API:', error);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Erro interno do servidor',
        message: error.message,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
  }

  async getHealthStatus() {
    const branches = this.branchManager.getBranchStatus();
    const healthyCount = Object.values(branches).filter(b => b.status === 'healthy').length;
    const totalCount = Object.keys(branches).length;

    return {
      status: healthyCount > 0 ? 'healthy' : 'unhealthy',
      healthy_branches: healthyCount,
      total_branches: totalCount,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  async getSystemStatus() {
    const branches = this.branchManager.getBranchStatus();
    const memoryUsage = process.memoryUsage();

    return {
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          unit: 'MB'
        },
        cpu_usage: process.cpuUsage(),
        node_version: process.version,
        platform: process.platform
      },
      branches: branches,
      timestamp: new Date().toISOString()
    };
  }

  async getBranchesStatus() {
    const branches = this.branchManager.getBranchStatus();
    const branchesArray = Object.entries(branches).map(([id, data]) => ({
      id,
      ...data
    }));

    return {
      branches: branchesArray,
      summary: {
        total: branchesArray.length,
        healthy: branchesArray.filter(b => b.status === 'healthy').length,
        unhealthy: branchesArray.filter(b => b.status === 'unhealthy').length,
        failed: branchesArray.filter(b => b.status === 'failed').length
      },
      timestamp: new Date().toISOString()
    };
  }

  async getBranchStatus(branchId) {
    if (!branchId) {
      return { error: 'ID da filial é obrigatório', code: 400 };
    }

    const branches = this.branchManager.getBranchStatus();
    const branch = branches[branchId];

    if (!branch) {
      return { error: 'Filial não encontrada', code: 404 };
    }

    // Informações detalhadas da filial
    const branchData = this.branchManager.branches.get(branchId);
    const stats = branchData?.bot?.getStats() || {};

    return {
      branch: {
        ...branch,
        stats,
        config: {
          name: branchData?.config?.name,
          address: branchData?.config?.address,
          phone: branchData?.config?.phone,
          region: branchData?.config?.region,
          manager: branchData?.config?.manager
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  async executeBranchAction(branchId, action) {
    if (!branchId) {
      return { error: 'ID da filial é obrigatório', code: 400 };
    }

    if (!action) {
      return { error: 'Ação é obrigatória', code: 400 };
    }

    try {
      let result;

      switch (action) {
        case 'restart':
          result = await this.branchManager.restartBranch(branchId);
          break;

        case 'stop':
          result = await this.branchManager.stopBranch(branchId);
          break;

        case 'start':
          // Implementar se necessário
          result = { success: false, message: 'Ação não implementada' };
          break;

        default:
          return { error: 'Ação não reconhecida', code: 400 };
      }

      return {
        action,
        branchId,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        error: 'Erro ao executar ação',
        message: error.message,
        action,
        branchId,
        code: 500
      };
    }
  }

  async getMetrics() {
    const branches = this.branchManager.getBranchStatus();
    const branchesData = Array.from(this.branchManager.branches.values());

    const metrics = {
      system: {
        uptime: process.uptime(),
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpu_usage: process.cpuUsage()
      },
      branches: {
        total: Object.keys(branches).length,
        healthy: Object.values(branches).filter(b => b.status === 'healthy').length,
        unhealthy: Object.values(branches).filter(b => b.status === 'unhealthy').length,
        failed: Object.values(branches).filter(b => b.status === 'failed').length
      },
      messages: {
        total_received: branchesData.reduce((sum, b) => sum + (b.bot?.stats?.messagesReceived || 0), 0),
        total_sent: branchesData.reduce((sum, b) => sum + (b.bot?.stats?.messagesSent || 0), 0)
      },
      connections: {
        total_lost: branchesData.reduce((sum, b) => sum + (b.bot?.stats?.connectionsLost || 0), 0),
        current_connected: Object.values(branches).filter(b => b.isConnected).length
      },
      timestamp: new Date().toISOString()
    };

    return metrics;
  }

  async getLogs(branchId, limit = 100) {
    // Esta é uma implementação básica
    // Em produção, você pode querer integrar com um sistema de logs mais robusto

    try {
      const logs = {
        branch: branchId || 'all',
        limit: parseInt(limit),
        logs: [
          // Aqui você implementaria a leitura dos logs reais
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Log de exemplo',
            branch: branchId || 'system'
          }
        ],
        timestamp: new Date().toISOString()
      };

      return logs;
    } catch (error) {
      return {
        error: 'Erro ao carregar logs',
        message: error.message,
        code: 500
      };
    }
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info('📊 Monitoring API encerrada');
          resolve();
        });
      });
    }
  }
}

module.exports = MonitoringAPI;
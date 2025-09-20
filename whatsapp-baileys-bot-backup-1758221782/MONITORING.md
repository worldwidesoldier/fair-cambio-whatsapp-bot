# Sistema de Monitoramento Avançado - WhatsApp Bot

## Visão Geral

Este documento descreve o sistema completo de monitoramento, logs, analytics e auditoria implementado para o WhatsApp Bot Fair Câmbio. O sistema oferece visibilidade completa sobre o funcionamento do bot, com dashboards em tempo real, alertas automáticos e relatórios detalhados.

## Arquitetura do Sistema

### Componentes Principais

1. **Logger** (`src/utils/logger.js`) - Sistema de logs estruturados
2. **Analytics** (`src/utils/analytics.js`) - Métricas e análise de conversas
3. **Alerts** (`src/utils/alerts.js`) - Sistema de alertas automáticos
4. **Health** (`src/utils/health.js`) - Monitoramento de saúde do sistema
5. **Backup** (`src/utils/backup.js`) - Sistema de backup automático
6. **Reports** (`src/utils/reports.js`) - Relatórios diários/semanais/mensais
7. **Audit** (`src/utils/audit.js`) - Auditoria de ações administrativas
8. **Dashboard** (`src/dashboard/`) - Interface web em tempo real

### Estrutura de Diretórios

```
whatsapp-baileys-bot/
├── src/
│   ├── monitoring/
│   │   └── index.js              # Integração principal
│   ├── dashboard/
│   │   ├── server.js             # Servidor do dashboard
│   │   └── public/
│   │       ├── index.html        # Interface web
│   │       └── dashboard.js      # JavaScript do frontend
│   └── utils/
│       ├── logger.js             # Sistema de logs
│       ├── analytics.js          # Analytics e métricas
│       ├── alerts.js             # Sistema de alertas
│       ├── health.js             # Monitoramento de saúde
│       ├── backup.js             # Sistema de backup
│       ├── reports.js            # Relatórios automáticos
│       └── audit.js              # Sistema de auditoria
├── logs/                         # Logs do sistema
├── data/
│   └── analytics/                # Dados de analytics
├── backups/                      # Backups automáticos
├── reports/                      # Relatórios gerados
└── audit/                        # Logs de auditoria
```

## Configuração

### Variáveis de Ambiente

```bash
# Dashboard
DASHBOARD_PORT=3001
DASHBOARD_PASSWORD=dashboard123

# Alertas por Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
ALERT_EMAILS=admin1@example.com,admin2@example.com

# Alertas por WhatsApp
ADMIN_NUMBERS=5511999999999,5511888888888

# Backup
MAX_BACKUPS=30
BACKUP_INTERVAL=86400000
BACKUP_RETENTION_DAYS=30

# Relatórios
DAILY_REPORT_TIME=08:00
WEEKLY_REPORT_DAY=1
WEEKLY_REPORT_TIME=09:00
ENABLE_EMAIL_REPORTS=true
ENABLE_WHATSAPP_REPORTS=true

# Auditoria
MAX_AUDIT_ENTRIES=10000
AUDIT_RETENTION_DAYS=90
ENABLE_AUDIT_INTEGRITY=true
ENABLE_SESSION_TRACKING=true
```

### Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar apenas o bot
npm start

# Executar bot + dashboard
npm run monitoring

# Executar em modo desenvolvimento
npm run both

# Executar apenas o dashboard
npm run dashboard

# Comandos úteis
npm run backup    # Criar backup manual
npm run health    # Verificar saúde do sistema
npm run report    # Gerar relatório diário
npm run cleanup   # Limpar logs antigos
```

## Funcionalidades Detalhadas

### 1. Sistema de Logs Estruturados

#### Características:
- Logs em formato JSON estruturado
- Níveis: ERROR, WARN, INFO, DEBUG, TRACE
- Rotação automática de arquivos (10MB por arquivo)
- Retenção configurável (30 dias por padrão)
- Output colorido no console para desenvolvimento

#### Uso:
```javascript
const logger = require('./src/utils/logger');

// Logs básicos
logger.info('Usuário conectado', { userId: '123', ip: '192.168.1.1' });
logger.error('Erro na conexão', { error: 'Connection timeout' });

// Logs específicos para eventos do bot
logger.logMessage('received', 'from', 'to', 'message content');
logger.logConnection('connected', { reason: 'QR scanned' });
logger.logAdmin('config_change', 'admin_user', { setting: 'threshold' });
```

### 2. Sistema de Analytics

#### Métricas Coletadas:
- Total de mensagens (diário/semanal/mensal)
- Número de usuários únicos
- Conversas iniciadas
- Comandos mais utilizados
- Atividade por hora do dia
- Taxa de erro
- Tempo médio de resposta

#### Dados Armazenados:
- `metrics.json` - Métricas principais
- `conversations.json` - Dados de conversas por usuário
- `usage.json` - Dados de uso do sistema

#### API:
```javascript
const analytics = require('./src/utils/analytics');

// Tracking manual
analytics.trackMessage(from, message, 'received');
analytics.trackError(error, context);
analytics.trackAdminAction(admin, action, details);

// Consultas
const metrics = analytics.getMetrics();
const dailyStats = analytics.getDailyStats('2024-01-15');
const weeklyReport = analytics.getWeeklyReport();
const systemHealth = analytics.getSystemHealth();
```

### 3. Sistema de Alertas

#### Tipos de Alertas:
- **Erro crítico** - Enviado por WhatsApp e email
- **Alta taxa de erro** - > 5% de mensagens com erro
- **Tempo de resposta alto** - > 5 segundos
- **Alto uso de memória** - > 500MB
- **Bot inativo** - Sem atividade por 30+ minutos
- **Perda de conexão** - WhatsApp desconectado

#### Configuração de Limites:
```javascript
const alerts = require('./src/utils/alerts');

alerts.updateThresholds({
  errorRate: 5,        // 5% de taxa de erro
  responseTime: 5000,  // 5 segundos
  memoryUsage: 500,    // 500MB
  messageVolume: 1000, // 1000 mensagens/dia
  inactivityPeriod: 30 * 60 * 1000 // 30 minutos
});
```

#### Supressão de Alertas:
- Alertas duplicados são suprimidos por 15 minutos
- Configuração inteligente para evitar spam

### 4. Monitoramento de Saúde

#### Verificações Automáticas:
- **Memória** - Uso de heap e memória total
- **CPU** - Load average e utilização
- **Disco** - Espaço disponível
- **Uptime** - Tempo de funcionamento
- **Database** - Acesso aos dados
- **Logs** - Sistema de logging
- **Analytics** - Atualização de métricas
- **WhatsApp** - Status da conexão

#### Intervalos:
- Verificações a cada 5 minutos
- Histórico mantido por 24-48 horas
- Tendências calculadas automaticamente

#### Status:
- `healthy` - Tudo funcionando
- `warning` - Atenção necessária
- `unhealthy` - Problemas críticos

### 5. Sistema de Backup

#### Backup Automático:
- **Diário** - 03:00 (configurável)
- **Semanal** - Domingo 02:00
- **Manual** - Via comando ou API

#### Dados Incluídos:
- Dados de analytics
- Logs do sistema
- Configurações de sessão
- Manifest com metadados

#### Características:
- Compressão gzip
- Verificação de integridade
- Limpeza automática de backups antigos
- Retenção configurável (30 dias)

#### Uso:
```javascript
const backup = require('./src/utils/backup');

// Backup manual
const backupInfo = await backup.manualBackup('Backup antes da atualização');

// Restaurar backup
await backup.restoreBackup('backup-daily-2024-01-15');

// Estatísticas
const stats = await backup.getBackupStats();
```

### 6. Relatórios Automáticos

#### Tipos de Relatórios:
- **Diário** - 08:00 (configurável)
- **Semanal** - Segunda-feira 09:00
- **Mensal** - Dia 1 às 10:00

#### Conteúdo dos Relatórios:
- Resumo de atividade
- Métricas de performance
- Status de saúde do sistema
- Comparação com períodos anteriores
- Alertas e erros ocorridos

#### Envio:
- WhatsApp para administradores
- Email (se configurado)
- Arquivo JSON salvo no sistema

#### Formato WhatsApp:
```
📊 Relatório Diário - 15/01/2024

💬 Mensagens: 150 📈 (+20)
👥 Usuários: 45 📈 (+5)
💭 Conversas: 67
❌ Erros: 2

🔧 Status do Sistema: ✅ Saudável
```

### 7. Sistema de Auditoria

#### Eventos Auditados:
- **Login/Logout** de administradores
- **Ações administrativas** (mudanças de config, comandos)
- **Acesso a dados** (consultas, modificações)
- **Eventos de sistema** (startup, shutdown, erros)
- **Eventos de segurança** (tentativas de acesso)
- **Chamadas de API** (endpoints, status codes)

#### Sessões:
- Tracking de sessões administrativas
- Histórico de ações por sessão
- Detecção de sessões abandonadas
- Logs de início/fim de sessão

#### Integridade:
- Hash SHA256 para cada entrada
- Verificação de integridade
- Detecção de tampeamento

#### Uso:
```javascript
const audit = require('./src/utils/audit');

// Logs de auditoria
audit.logAdminAction('admin_user', 'config_change', details);
audit.logSecurityEvent('suspicious_access', { ip: '1.2.3.4' });

// Gestão de sessões
const sessionId = await audit.startSession('admin_user', { ip: '1.2.3.4' });
await audit.updateSession(sessionId, 'view_dashboard');
await audit.endSession(sessionId, 'logout');

// Consultas
const entries = await audit.getAuditEntries({ admin: 'admin_user' });
const summary = await audit.getAuditSummary(30); // últimos 30 dias
```

### 8. Dashboard Web

#### Acesso:
- URL: `http://localhost:3001`
- Login: `admin` / `dashboard123` (configurável)
- Atualização em tempo real via WebSocket

#### Seções:
1. **Métricas Principais**
   - Mensagens hoje
   - Usuários ativos
   - Conversas
   - Taxa de erro

2. **Gráficos**
   - Atividade por hora
   - Comandos mais usados

3. **Saúde do Sistema**
   - Uptime
   - Uso de memória
   - Tempo de resposta médio

4. **Logs Recentes**
   - Últimas 10 entradas
   - Filtro por nível
   - Atualização automática

5. **Relatório Semanal**
   - Resumo da semana
   - Comparações
   - Tendências

#### Recursos:
- Interface responsiva (mobile-friendly)
- Atalhos de teclado (Ctrl+R, Ctrl+T)
- Alertas em tempo real
- Exportação de dados

## Integração com o Bot Principal

### Inicialização

```javascript
// src/bot.js
const monitoring = require('./monitoring');

class WhatsAppBot {
  async initialize() {
    // ... código existente ...

    // Inicializar monitoramento
    await monitoring.initialize(this);
  }

  async processMessage(msg) {
    const startTime = Date.now();

    try {
      // ... processamento da mensagem ...

      // Monitorar mensagem recebida
      monitoring.onMessage(from, messageText, pushName);

    } catch (error) {
      // Monitorar erros
      monitoring.onError(error, { from, messageText });
    } finally {
      // Monitorar tempo de resposta
      monitoring.trackResponseTime(startTime);
    }
  }

  async sendMessage(to, text) {
    try {
      // ... envio da mensagem ...

      // Monitorar mensagem enviada
      monitoring.onMessageSent(to, text);

    } catch (error) {
      monitoring.onError(error, { to, text });
    }
  }
}
```

### Eventos de Conexão

```javascript
// Monitorar mudanças de conexão
this.sock.ev.on('connection.update', async (update) => {
  const { connection } = update;
  monitoring.onConnection(connection, update);
});
```

### Ações Administrativas

```javascript
// Monitorar comandos admin
if (isAdminCommand) {
  monitoring.onAdminAction(adminUser, command, details);
}
```

## APIs e Endpoints

### Dashboard API

```
GET  /health                    # Health check
GET  /api/metrics              # Métricas principais
GET  /api/daily-stats/:date?   # Estatísticas diárias
GET  /api/hourly-activity      # Atividade por hora
GET  /api/system-health        # Saúde do sistema
GET  /api/weekly-report        # Relatório semanal
GET  /api/logs/:date?          # Logs por data
GET  /api/user/:userId         # Estatísticas de usuário
```

### Monitoring API

```javascript
const monitoring = require('./src/monitoring');

// Status geral do sistema
const status = await monitoring.getSystemStatus();

// Dados para dashboard
const dashboardData = await monitoring.getDashboardData();

// Operações manuais
const report = await monitoring.generateReport('daily');
const backup = await monitoring.createBackup('Manual backup');

// Configuração
monitoring.updateConfig('alerts', { errorRate: 10 });
```

## Monitoramento em Produção

### Recursos de Produção

1. **Process Manager**
   ```bash
   # PM2 para reinicialização automática
   pm2 start ecosystem.config.js
   ```

2. **Proxy Reverso**
   ```nginx
   # Nginx para dashboard
   location /dashboard {
     proxy_pass http://localhost:3001;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection 'upgrade';
   }
   ```

3. **Monitoramento Externo**
   - Health check endpoint: `/health`
   - Uptime monitoring services
   - External alerting systems

### Alertas Críticos

Configure alertas externos para:
- Endpoint `/health` retornando erro
- Alto uso de CPU/memória por período prolongado
- Falha nos backups diários
- Taxa de erro > 10%

### Logs Centralizados

Para ambientes distribuídos:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Fluentd para coleta de logs
- Grafana para visualização

## Troubleshooting

### Problemas Comuns

1. **Dashboard não carrega**
   ```bash
   # Verificar se o servidor está rodando
   curl http://localhost:3001/health

   # Verificar logs
   tail -f logs/app-$(date +%Y-%m-%d).log
   ```

2. **Alertas não enviados**
   ```bash
   # Verificar configuração SMTP
   node -e "require('./src/utils/alerts').emailTransporter.verify(console.log)"

   # Verificar números WhatsApp
   echo $ADMIN_NUMBERS
   ```

3. **Backup falhou**
   ```bash
   # Verificar espaço em disco
   df -h

   # Verificar permissões
   ls -la backups/

   # Backup manual
   npm run backup
   ```

4. **Logs não sendo gerados**
   ```bash
   # Verificar diretório de logs
   ls -la logs/

   # Verificar nível de log
   node -e "console.log(require('./src/utils/logger').currentLogLevel)"
   ```

### Comandos de Diagnóstico

```bash
# Status geral
npm run health

# Verificar integridade de auditoria
node -e "require('./src/utils/audit').verifyIntegrity().then(console.log)"

# Estatísticas de backup
node -e "require('./src/utils/backup').getBackupStats().then(console.log)"

# Últimos alertas
node -e "console.log(require('./src/utils/alerts').getAlertHistory(10))"
```

## Segurança

### Proteções Implementadas

1. **Autenticação do Dashboard**
   - Basic Auth para acesso web
   - Senha configurável via ambiente

2. **Sanitização de Dados**
   - Logs sensíveis são mascarados
   - Dados pessoais protegidos

3. **Integridade de Auditoria**
   - Hash SHA256 para cada entrada
   - Detecção de tamperamento

4. **Controle de Acesso**
   - Logs de todas as ações administrativas
   - Sessões rastreadas

### Recomendações

1. **Produção**
   - Use HTTPS para dashboard
   - Configure firewall para porta do dashboard
   - Use senhas fortes
   - Configure rotação de logs

2. **Backup**
   - Armazene backups em local seguro
   - Criptografe backups sensíveis
   - Teste restauração regularmente

3. **Monitoramento**
   - Configure alertas externos
   - Monitore tentativas de acesso
   - Revise logs de auditoria regularmente

## Manutenção

### Tarefas Regulares

1. **Diárias**
   - Verificar dashboards
   - Revisar alertas críticos
   - Validar backups

2. **Semanais**
   - Analisar relatórios semanais
   - Verificar espaço em disco
   - Revisar logs de auditoria

3. **Mensais**
   - Limpeza de logs antigos
   - Atualização de dependências
   - Revisão de configurações

### Scripts de Manutenção

```bash
#!/bin/bash
# maintenance.sh

# Limpeza de logs antigos
npm run cleanup

# Verificar integridade
node -e "require('./src/utils/audit').verifyIntegrity().then(console.log)"

# Backup manual
npm run backup

# Gerar relatório
npm run report
```

## Expansões Futuras

### Recursos Planejados

1. **Machine Learning**
   - Detecção de anomalias
   - Previsão de carga
   - Análise de sentimento

2. **Integração com Terceiros**
   - Slack notifications
   - Telegram alerts
   - PagerDuty integration

3. **Analytics Avançados**
   - Funis de conversão
   - Análise de retenção
   - Segmentação de usuários

4. **API Externa**
   - REST API completa
   - Webhooks para eventos
   - GraphQL endpoint

---

## Contato e Suporte

Para dúvidas sobre o sistema de monitoramento:

- Documentação: Este arquivo (`MONITORING.md`)
- Logs: Consulte `/logs/` para troubleshooting
- Dashboard: `http://localhost:3001` para visualização
- Health Check: `http://localhost:3001/health` para verificação rápida

**Lembre-se**: O sistema de monitoramento é fundamental para operação confiável do bot. Mantenha-o sempre atualizado e monitore os alertas regularmente.
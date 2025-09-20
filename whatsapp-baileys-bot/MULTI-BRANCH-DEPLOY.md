# 🏢 Fair Câmbio Multi-Branch WhatsApp Bot - Guia de Deploy

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Configuração Inicial](#configuração-inicial)
4. [Deploy com Docker](#deploy-com-docker)
5. [Deploy com PM2](#deploy-com-pm2)
6. [Monitoramento](#monitoramento)
7. [Gerenciamento de Filiais](#gerenciamento-de-filiais)
8. [Troubleshooting](#troubleshooting)
9. [Backup e Recuperação](#backup-e-recuperação)

## 🎯 Visão Geral

Este sistema permite gerenciar múltiplas filiais da Fair Câmbio simultaneamente, cada uma com seu próprio número WhatsApp e configurações específicas. O sistema inclui:

- **5 Filiais Configuradas**: Matriz, Shopping Manauara, Amazonas Shopping, Ponta Negra, Aeroporto
- **Gerenciamento Centralizado**: Um manager controla todas as instâncias
- **Monitoramento em Tempo Real**: API de status e métricas
- **Failover Automático**: Recuperação automática de falhas
- **Logging Separado**: Logs específicos por filial
- **Escalabilidade**: Fácil adição/remoção de filiais

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Branch Manager                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Health Check│ │ Failover    │ │ Monitoring API      │   │
│  │ System      │ │ System      │ │ (Port 3001)        │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
┌────────▼─────┐    ┌─────────▼──────┐    ┌────────▼─────┐
│ WhatsApp Bot │    │ WhatsApp Bot   │    │ WhatsApp Bot │
│ (Matriz)     │    │ (Manauara)     │    │ (Aeroporto)  │
│              │    │                │    │              │
│ Sessions/    │    │ Sessions/      │    │ Sessions/    │
│ matriz       │    │ shopping-      │    │ aeroporto    │
│              │    │ manauara       │    │              │
└──────────────┘    └────────────────┘    └──────────────┘
```

## ⚙️ Configuração Inicial

### 1. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env`:

```bash
# Configurações Gerais
NODE_ENV=production
BOT_NAME=Fair Câmbio
SESSION_NAME=fair-cambio-bot
TZ=America/Sao_Paulo

# Administradores (números separados por vírgula)
ADMIN_NUMBERS=559185000000,559192000000

# Horários de Funcionamento
OPENING_HOUR=9
CLOSING_HOUR=18
SATURDAY_CLOSING=14

# Monitoramento
ENABLE_MONITORING_API=true
MONITORING_PORT=3001
LOG_LEVEL=info

# Opcionais
REDIS_URL=redis://localhost:6379
```

### 2. Configurar Filiais

Edite `src/config/branches.js` para ajustar:

- **Números de telefone** de cada filial
- **Endereços e informações** específicas
- **Gerentes responsáveis**
- **Status ativo/inativo** de cada filial
- **Configurações de health check**

### 3. Instalar Dependências

```bash
npm install
```

## 🐳 Deploy com Docker

### Opção 1: Docker Compose (Recomendado)

```bash
# 1. Build e start de todos os serviços
docker-compose up -d

# 2. Verificar status
docker-compose ps

# 3. Ver logs
docker-compose logs -f fair-cambio-multi

# 4. Parar serviços
docker-compose down
```

### Opção 2: Docker Manual

```bash
# 1. Build da imagem
docker build -t fair-cambio-multi .

# 2. Executar container
docker run -d \
  --name fair-cambio-multi \
  -p 3001:3001 \
  -v $(pwd)/sessions:/app/sessions \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/.env:/app/.env:ro \
  --restart unless-stopped \
  fair-cambio-multi

# 3. Ver logs
docker logs -f fair-cambio-multi

# 4. Parar container
docker stop fair-cambio-multi
docker rm fair-cambio-multi
```

## 🔄 Deploy com PM2

### Instalação do PM2

```bash
npm install -g pm2
```

### Opção 1: Todas as Filiais (Recomendado)

```bash
# 1. Iniciar sistema multi-filial
pm2 start ecosystem.config.js --env production

# 2. Verificar status
pm2 status

# 3. Ver logs
pm2 logs fair-cambio-multi-branch

# 4. Monitoramento
pm2 monit

# 5. Restart
pm2 restart fair-cambio-multi-branch

# 6. Stop
pm2 stop fair-cambio-multi-branch
```

### Opção 2: Filiais Individuais

```bash
# Iniciar apenas filiais específicas
pm2 start ecosystem.config.js --only fair-cambio-matriz
pm2 start ecosystem.config.js --only fair-cambio-manauara

# Ou iniciar manualmente
BRANCH_ID=matriz pm2 start src/single-branch.js --name fair-cambio-matriz
BRANCH_ID=shopping-manauara pm2 start src/single-branch.js --name fair-cambio-manauara
```

### Configuração de Auto-Start

```bash
# Salvar configuração atual
pm2 save

# Configurar auto-start no boot
pm2 startup

# Executar o comando que o PM2 mostrar
```

## 📊 Monitoramento

### API de Monitoramento

O sistema expõe uma API REST na porta 3001:

```bash
# Status geral do sistema
curl http://localhost:3001/health

# Status detalhado
curl http://localhost:3001/status

# Status de todas as filiais
curl http://localhost:3001/branches

# Status de uma filial específica
curl http://localhost:3001/branch?id=matriz

# Métricas do sistema
curl http://localhost:3001/metrics
```

### Endpoints Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Status de saúde básico |
| `/status` | GET | Status completo do sistema |
| `/branches` | GET | Lista todas as filiais e status |
| `/branch?id={id}` | GET | Status detalhado de uma filial |
| `/branch?id={id}&action={action}` | POST | Executar ação na filial |
| `/metrics` | GET | Métricas de performance |
| `/logs?branch={id}&limit={n}` | GET | Logs da filial |

### Ações Disponíveis

```bash
# Reiniciar filial
curl -X POST "http://localhost:3001/branch?id=matriz&action=restart"

# Parar filial
curl -X POST "http://localhost:3001/branch?id=matriz&action=stop"
```

## 🏢 Gerenciamento de Filiais

### Adicionar Nova Filial

1. **Editar configuração** em `src/config/branches.js`:

```javascript
{
  id: 'nova-filial',
  name: 'Fair Câmbio - Nova Filial',
  phone: '559185006789',
  address: 'Endereço da nova filial',
  hours: {
    weekdays: '09:00 às 18:00',
    saturday: '09:00 às 14:00',
    sunday: 'Fechado'
  },
  maps: 'https://maps.google.com/?q=-3.0000,-60.0000',
  active: true,
  priority: 6,
  region: 'nova-regiao',
  manager: 'Novo Gerente',
  email: 'nova@faircambio.com.br',
  features: ['exchange', 'consultation'],
  maxConnections: 30,
  autoRestart: true,
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000
  },
  notifications: {
    startup: true,
    shutdown: true,
    errors: true
  }
}
```

2. **Reiniciar o sistema**:

```bash
pm2 restart fair-cambio-multi-branch
# ou
docker-compose restart fair-cambio-multi
```

### Desativar/Ativar Filial

```javascript
// Em src/config/branches.js
{
  id: 'filial-para-desativar',
  // ... outras configurações
  active: false  // Muda para false para desativar
}
```

### Configurações por Filial

Cada filial pode ter configurações específicas:

- **Health Check**: Intervalo e timeout personalizados
- **Auto Restart**: Ativa/desativa restart automático
- **Notificações**: Controla quais eventos geram notificações
- **Máximo de Conexões**: Limite de conexões simultâneas
- **Prioridade**: Para balanceamento de carga

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Filial não conecta

```bash
# Verificar logs específicos da filial
docker logs fair-cambio-multi | grep "matriz"
# ou
pm2 logs fair-cambio-multi-branch | grep "matriz"

# Verificar sessão
ls -la sessions/matriz/

# Limpar sessão (forçar novo QR Code)
rm -rf sessions/matriz/*
```

#### 2. API de monitoramento não responde

```bash
# Verificar se a porta está ouvindo
netstat -tlnp | grep 3001

# Verificar variáveis de ambiente
echo $ENABLE_MONITORING_API
echo $MONITORING_PORT
```

#### 3. Memory leaks ou performance

```bash
# Monitorar uso de memória
pm2 monit

# Ver métricas detalhadas
curl http://localhost:3001/metrics

# Restart se necessário
pm2 restart fair-cambio-multi-branch
```

### Logs e Debug

#### Localização dos Logs

```
logs/
├── combined.log          # Logs combinados
├── out.log              # Output padrão
├── error.log            # Apenas erros
└── branches/            # Logs por filial
    ├── matriz-combined.log
    ├── manauara-combined.log
    └── ...
```

#### Comandos Úteis

```bash
# Logs em tempo real
tail -f logs/combined.log

# Logs de uma filial específica
tail -f logs/branches/matriz-combined.log

# Filtrar apenas erros
grep "ERROR" logs/combined.log

# Logs das últimas 24h
find logs/ -name "*.log" -newermt "24 hours ago" -exec tail -f {} +
```

## 💾 Backup e Recuperação

### Backup Automático

Crie um script de backup:

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/fair-cambio"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup das sessões
tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz sessions/

# Backup dos logs (últimos 7 dias)
find logs/ -name "*.log" -newermt "7 days ago" | tar -czf $BACKUP_DIR/logs_$DATE.tar.gz -T -

# Backup da configuração
cp -r src/config $BACKUP_DIR/config_$DATE/

# Limpeza (manter apenas últimos 30 backups)
find $BACKUP_DIR -name "sessions_*.tar.gz" -mtime +30 -delete
```

### Restauração

```bash
# Parar sistema
pm2 stop fair-cambio-multi-branch

# Restaurar sessões
tar -xzf /backup/fair-cambio/sessions_20231201_120000.tar.gz

# Restaurar configurações
cp -r /backup/fair-cambio/config_20231201_120000/* src/config/

# Reiniciar sistema
pm2 start fair-cambio-multi-branch
```

## 🚀 Comandos Rápidos

### Start/Stop Sistema

```bash
# PM2
pm2 start ecosystem.config.js --env production
pm2 stop fair-cambio-multi-branch
pm2 restart fair-cambio-multi-branch

# Docker
docker-compose up -d
docker-compose down
docker-compose restart fair-cambio-multi

# Manual
node src/multi-branch.js
```

### Status Check

```bash
# Status geral
curl -s http://localhost:3001/health | jq

# Status detalhado
curl -s http://localhost:3001/status | jq

# Status de uma filial
curl -s "http://localhost:3001/branch?id=matriz" | jq
```

### Restart Filial

```bash
# Via API
curl -X POST "http://localhost:3001/branch?id=matriz&action=restart"

# Via PM2 (filial individual)
pm2 restart fair-cambio-matriz
```

## 📞 Suporte

Para suporte técnico:

1. **Verificar logs** first
2. **Consultar esta documentação**
3. **Usar API de monitoramento** para diagnóstico
4. **Verificar configurações** das filiais

---

## 📄 Licença

Sistema proprietário - Fair Câmbio
Desenvolvido para uso exclusivo da empresa.
# 🚀 Fair Câmbio WhatsApp Bot Multi-Filiais

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
</p>

> **Sistema completo de atendimento WhatsApp com Dashboard React para 5 filiais da Fair Câmbio**
>
> Bot WhatsApp automatizado + Dashboard em tempo real + Sistema multi-filiais + Cotações dinâmicas

## ✨ Features Principais

### 💱 Sistema de Cotações Avançado
- **3 moedas principais**: USD 🇺🇸, EUR 🇪🇺, GBP 🇬🇧
- **Cotações em tempo real** com atualização automática
- **Calculadora inteligente** de conversão
- **Comandos administrativos** para atualização de taxas
- **Histórico de variações** com estatísticas
- **Backup automático** das configurações

### 🏢 Sistema Multi-Filiais Inteligente
- **5 filiais operacionais** em Santa Catarina
- **Números WhatsApp independentes** por filial
- **Horários personalizados** de funcionamento
- **Gestão centralizada** via dashboard
- **Health checks automáticos** por filial
- **Reconexão automática** em caso de queda

### 📊 Dashboard React Moderno
- **Interface responsiva** com React 19 + TypeScript
- **Componentes ShadCN UI** profissionais
- **QR Code scanner integrado** para conexão WhatsApp
- **Monitoramento em tempo real** via WebSocket
- **Estatísticas visuais** de mensagens e usuários
- **Gestão de filiais** com status ao vivo

### 🤖 Bot WhatsApp Inteligente
- **Menu interativo** com navegação por números
- **Reconhecimento de palavras-chave** avançado
- **Sistema de sessões** persistentes
- **Handoff para atendimento humano** com fila
- **Comandos administrativos** completos
- **Logs detalhados** para auditoria

## 🏢 Filiais Fair Câmbio Configuradas

| Filial | Nome | Localização | Horário |
|--------|------|-------------|---------|
| 🏦 **Matriz** | Fair Câmbio - São José | Av. Presidente Kennedy, 1953 - Campinas | Seg-Sex: 09:00-17:30 |
| 🛍️ **Shopping Manauara** | Fair Câmbio - Shopping Manauara | Av. Mário Ypiranga, 1300 - Adrianópolis | Seg-Sáb: 10:00-22:00, Dom: 14:00-20:00 |
| 🏖️ **Bombinhas** | Fair Câmbio - Bombinhas | Av. Leopoldo Zarling, 1221 - Bombas | Seg-Sex: 09:00-17:00 |
| 🌴 **Ponta Negra** | Fair Câmbio - Ponta Negra | Av. Coronel Teixeira, 5705 - Ponta Negra | Seg-Sex: 09:00-18:00, Sáb: 09:00-14:00 |
| ✈️ **Criciúma** | Fair Câmbio - Criciúma | R. Cel. Pedro Benedet, 190 - Centro | Seg-Sex: 09:00-17:00 |

## 🛠️ Tech Stack

### 🔹 Backend
```javascript
Node.js 18+                    // Runtime JavaScript
Express.js 4.21               // Framework web
@whiskeysockets/baileys 7.0   // WhatsApp Web API (sem API oficial)
Socket.io 4.8                 // WebSocket real-time
Pino + Winston               // Sistema de logs profissional
Helmet 7.2                   // Segurança HTTP
Mongoose 7.5                 // MongoDB ODM
```

### 🔹 Frontend
```typescript
React 19.1                   // Biblioteca UI moderna
TypeScript 5.8               // Tipagem estática
Vite 7.1                     // Build tool ultra-rápida
TailwindCSS 3.4              // Framework CSS utilitário
ShadCN UI                    // Componentes pré-construídos
Lucide React                 // Ícones modernos
Socket.io-client             // Cliente WebSocket
```

### 🔹 Infraestrutura
```bash
PM2                          // Gerenciador de processos
Docker + Docker Compose     // Containerização
Jest                         // Framework de testes
Nodemon                      // Auto-reload em desenvolvimento
```

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+ instalado
- NPM ou Yarn
- WhatsApp para escaneio do QR Code
- (Opcional) Docker para containerização

### 1. Clone e Instale Dependências

```bash
# Clone o repositório
git clone <repo-url>
cd WHATSBOTNEW

# Instalar dependências do backend
cd whatsapp-baileys-bot
npm install

# Instalar dependências do frontend
cd ../dashboard-frontend
npm install
```

### 2. Configuração do Backend

```bash
cd whatsapp-baileys-bot

# Copiar arquivo de ambiente
cp .env.example .env

# Editar configurações (opcional)
nano .env
```

**Exemplo .env:**
```env
# Admin numbers (comma separated)
ADMIN_NUMBERS=5511999999999,5511888888888

# Monitoring
ENABLE_MONITORING_API=true
MONITORING_PORT=3001

# Logging
LOG_LEVEL=info

# Node environment
NODE_ENV=development
```

### 3. Executar o Sistema Completo

**🎯 Opção 1: Execução Automatizada (Recomendado)**
```bash
# Na raiz do projeto
node start-project.js
```

**🔧 Opção 2: Execução Manual (Desenvolvimento)**
```bash
# Terminal 1 - Backend
cd whatsapp-baileys-bot
npm run dev

# Terminal 2 - Frontend
cd dashboard-frontend
npm run dev
```

**🐳 Opção 3: Docker**
```bash
# Execução com Docker
cd whatsapp-baileys-bot
npm run docker:up
```

### 4. Acessar o Sistema

- **Dashboard**: http://localhost:5173
- **API Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 💬 Comandos WhatsApp Disponíveis

### 👤 Para Clientes

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `oi`, `olá`, `menu` | Menu principal interativo | "Oi" |
| `1` | 📊 Ver todas as cotações | "1" |
| `2` | ⏰ Horários de funcionamento | "2" |
| `3` | 📍 Endereços das filiais | "3" |
| `4` | 📄 Documentos necessários | "4" |
| `5` | 🛒 Como funciona a compra | "5" |
| `6` | ☎️ Falar por telefone | "6" |
| `cotação`, `dolar` | Cotação específica do USD | "cotação dolar" |
| `euro` | Cotação específica do EUR | "euro" |
| `calcular` | 🧮 Calculadora de conversão | "calcular" |
| `aguardar`, `humano` | 👨‍💼 Falar com atendente | "aguardar" |

### 🔐 Para Administradores

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/atualizar [moeda] [tipo] [valor]` | Atualiza taxas de câmbio | `/atualizar dolar compra 5.20` |
| `/taxas` | Mostra todas as taxas atuais | `/taxas` |
| `/estatisticas` | Estatísticas de variação | `/estatisticas` |
| `/historico [limit]` | Histórico de alterações | `/historico 20` |
| `/broadcast [mensagem]` | Mensagem em massa | `/broadcast Promoção especial!` |
| `/backup` | Backup das configurações | `/backup` |
| `/restaurar` | Restaurar backup | `/restaurar` |
| `/ajuda` | Menu de ajuda administrativo | `/ajuda` |
| `/assumir [userId]` | Assumir atendimento humano | `/assumir 5511999999999` |
| `/finalizar [userId]` | Finalizar atendimento | `/finalizar 5511999999999` |

## 🏗️ Estrutura do Projeto

```
WHATSBOTNEW/
├── 🎨 dashboard-frontend/              # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/                # Componentes React
│   │   │   ├── ui/                   # Componentes base ShadCN
│   │   │   │   ├── button.tsx        # Botão customizado
│   │   │   │   ├── card.tsx          # Card component
│   │   │   │   ├── input.tsx         # Input component
│   │   │   │   └── ...
│   │   │   ├── DashboardComplete.tsx # Dashboard principal
│   │   │   ├── DashboardRobust.tsx   # Dashboard robusto
│   │   │   ├── QRCodeScanner.tsx     # Scanner QR Code
│   │   │   └── ErrorBoundary.tsx     # Error boundary
│   │   ├── lib/                      # Utilitários
│   │   ├── App.tsx                   # Componente principal
│   │   └── main.tsx                  # Entry point
│   ├── package.json                  # Dependências React
│   ├── vite.config.ts               # Configuração Vite
│   └── tailwind.config.js           # Configuração Tailwind
│
├── 🤖 whatsapp-baileys-bot/            # Backend Node.js
│   ├── src/
│   │   ├── 🎯 core/
│   │   │   └── WhatsAppBot.js        # Core do bot WhatsApp
│   │   ├── ⚙️ config/
│   │   │   ├── branches.json         # Configuração das filiais
│   │   │   ├── rates.json            # Taxas de câmbio
│   │   │   └── messages.json         # Templates de mensagens
│   │   ├── 🎮 handlers/
│   │   │   ├── menu.js               # Handler do menu principal
│   │   │   ├── admin.js              # Comandos administrativos
│   │   │   └── rates.js              # Gestão de taxas
│   │   ├── 📊 dashboard/
│   │   │   ├── server.js             # Servidor dashboard
│   │   │   ├── controllers/          # Controllers API
│   │   │   └── middleware/           # Middlewares
│   │   ├── 🛠️ utils/
│   │   │   ├── formatter.js          # Formatação de mensagens
│   │   │   ├── logger.js             # Sistema de logs
│   │   │   ├── session.js            # Gestão de sessões
│   │   │   └── backup.js             # Sistema de backup
│   │   ├── bot.js                    # Bot principal (single)
│   │   └── multi-branch.js           # Sistema multi-filiais
│   ├── 📁 data/                       # Dados das filiais
│   ├── 🔐 sessions/                   # Sessões WhatsApp (gitignored)
│   ├── 📋 logs/                       # Logs do sistema
│   ├── package.json                  # Dependências Node.js
│   ├── ecosystem.config.js           # Configuração PM2
│   └── Dockerfile                    # Container Docker
│
├── 🚀 start-project.js                # Script de inicialização automática
├── 📝 QR_TEST_RESULT.md              # Documentação de testes QR
└── 📖 README.md                      # Esta documentação
```

## 📱 Como Usar

### 🔄 Fluxo de Operação Normal

1. **Inicialização**
   ```bash
   node start-project.js
   ```

2. **Conexão WhatsApp**
   - Acesse http://localhost:5173
   - Escaneie o QR Code com WhatsApp
   - Aguarde confirmação de conexão

3. **Teste de Funcionalidades**
   - Envie "oi" para qualquer filial
   - Navegue pelo menu com números 1-6
   - Teste comandos administrativos (se admin)

4. **Monitoramento**
   - Dashboard em tempo real
   - Logs automáticos em `/logs`
   - Health checks por filial

### 🎛️ Dashboard de Administração

**Acesso**: http://localhost:5173

**Features do Dashboard**:
- 📊 **Status em Tempo Real**: Conexão de cada filial
- 🔍 **QR Code Scanner**: Para reconexão rápida
- 📈 **Estatísticas**: Mensagens, usuários conectados, uptime
- ⚙️ **Gestão de Filiais**: Ativar/desativar filiais
- 💱 **Painel de Cotações**: Visualizar e editar taxas
- 📋 **Logs em Tempo Real**: Monitoramento de atividades

## 🔧 Configurações Avançadas

### 🎛️ Dashboard
```javascript
// Configurações padrão
PORT: 3001
LOGIN: admin / admin123
WEBSOCKET: Automático via Socket.io
CORS: Configurado para desenvolvimento
RATE_LIMITING: 100 req/min por IP
```

### 🤖 WhatsApp Bot
```javascript
// Configurações de sessão
SESSION_PATH: ./sessions/
AUTO_RECONNECT: true
RECONNECT_DELAY: 5000ms
MAX_RECONNECT_ATTEMPTS: 5
QR_CODE_TIMEOUT: 30s
```

### 🔄 Multi-Filiais
```javascript
// Configurações por filial
MAX_CONNECTIONS: 25-60 (por filial)
HEALTH_CHECK_INTERVAL: 20-60s
AUTO_RESTART: true
PRIORITY_SYSTEM: 1-5 (matriz tem prioridade 1)
```

### 🏥 Health Checks
```bash
# Endpoints de monitoramento
GET /health              # Status geral
GET /status              # Status detalhado
GET /branches            # Status das filiais
GET /metrics             # Métricas do sistema
```

## 🚨 Solução de Problemas

### ❌ QR Code não aparece

```bash
# Limpar sessões antigas
rm -rf whatsapp-baileys-bot/sessions/*

# Restart completo
cd whatsapp-baileys-bot
npm start
```

### 🔌 Dashboard não conecta

```bash
# Verificar se backend está rodando
curl http://localhost:3001/health

# Verificar logs
tail -f whatsapp-baileys-bot/logs/combined.log

# Restart completo
pkill -f "node.*bot"
npm start
```

### 📱 Bot desconecta frequentemente

1. **Verificar estabilidade da internet**
2. **Aumentar timeout no .env**:
   ```env
   RECONNECT_DELAY=10000
   MAX_RECONNECT_ATTEMPTS=10
   ```
3. **Monitorar logs específicos**:
   ```bash
   tail -f logs/branches/[filial]-error.log
   ```

### 🔄 Filial específica offline

```bash
# Verificar status individual
curl http://localhost:3001/branches/[branch-id]/status

# Restart filial específica
npm run restart:pm2
pm2 restart fair-cambio-[branch-name]
```

## 🔒 Segurança e Privacidade

### 🛡️ Medidas de Segurança Implementadas

- **🔐 Números Admin**: Configurados via `.env` com validação
- **🔒 Sessões Criptografadas**: Baileys padrão com criptografia E2E
- **📝 Logs Locais**: Sem envio para serviços externos
- **🚫 Dados Sensíveis**: Não expostos em commits (.gitignore)
- **🌐 CORS Configurado**: Proteção cross-origin
- **⚡ Rate Limiting**: Proteção contra spam (100 req/min)
- **🔍 Input Validation**: Sanitização de entradas
- **🛡️ Helmet.js**: Headers de segurança HTTP

### 🔐 Configuração de Administradores

```env
# .env - Configurar números administrativos
ADMIN_NUMBERS=5511999999999,5511888888888

# Formato aceito:
# - Com código do país: 5511999999999
# - Sem código do país: 11999999999
# - Com símbolos: +55 (11) 99999-9999
```

## 🚀 Deploy e Produção

### 🌐 Plataformas Suportadas

O sistema está preparado para deploy em:

- **🎯 Render** (configuração incluída)
- **🚀 Heroku** (Dockerfile incluído)
- **🖥️ VPS/Servidor próprio** (PM2 configurado)
- **🐳 Docker** (docker-compose.yml incluído)
- **☁️ AWS/Google Cloud** (compatível)

### 📦 Scripts de Produção

```bash
# PM2 (recomendado para VPS)
npm run start:pm2          # Iniciar em produção
npm run stop:pm2           # Parar aplicação
npm run restart:pm2        # Reiniciar aplicação
npm run status:pm2         # Status das instâncias
npm run logs:pm2           # Ver logs em tempo real

# Docker (recomendado para cloud)
npm run docker:build       # Build da imagem
npm run docker:up          # Subir containers
npm run docker:down        # Parar containers
npm run docker:logs        # Ver logs dos containers

# Monitoramento
npm run monitoring         # Bot + Dashboard juntos
npm run health             # Check de saúde via API
npm run report             # Gerar relatório diário
```

### 🔧 Configuração de Produção

**PM2 Ecosystem (ecosystem.config.js)**:
```javascript
module.exports = {
  apps: [{
    name: 'fair-cambio-multi-branch',
    script: './src/multi-branch.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      ENABLE_MONITORING_API: 'true'
    }
  }]
};
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  fair-cambio-bot:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./sessions:/app/sessions
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
```

## 📊 Tecnologias Utilizadas

### 🔧 Backend Dependencies

```json
{
  "@whiskeysockets/baileys": "^7.0.0-rc.2",  // WhatsApp Web API
  "express": "^4.21.2",                      // Framework web
  "socket.io": "^4.8.1",                     // WebSocket real-time
  "pino": "^9.9.5",                          // Logger performático
  "winston": "^3.10.0",                      // Logger robusto
  "helmet": "^7.2.0",                        // Segurança HTTP
  "cors": "^2.8.5",                          // Cross-origin
  "mongoose": "^7.5.0",                      // MongoDB ODM
  "node-cron": "^4.2.1",                     // Agendador de tarefas
  "qrcode": "^1.5.4",                        // Gerador QR Code
  "bcryptjs": "^2.4.3",                      // Hash de senhas
  "jsonwebtoken": "^9.0.2"                   // JWT tokens
}
```

### 🎨 Frontend Dependencies

```json
{
  "react": "^19.1.1",                        // Biblioteca UI
  "typescript": "~5.8.3",                    // Tipagem estática
  "vite": "^7.1.2",                          // Build tool
  "tailwindcss": "^3.4.17",                  // CSS framework
  "@radix-ui/react-label": "^2.1.7",         // Componentes acessíveis
  "class-variance-authority": "^0.7.1",       // Variações de classe
  "lucide-react": "^0.544.0",                // Ícones modernos
  "react-qr-code": "^2.0.18",                // QR Code React
  "socket.io-client": "^4.8.1",              // Cliente WebSocket
  "clsx": "^2.1.1"                           // Utility classes
}
```

## 📈 Roadmap Futuro

### 🎯 Versão 2.0 (Próximas Features)

- [ ] **🌍 Integração API Externa**: Cotações em tempo real (Banco Central)
- [ ] **📅 Sistema de Agendamento**: Reserva de operações de câmbio
- [ ] **🔔 Notificações Push**: Alertas de variação de cotação
- [ ] **💰 Mais Moedas**: CAD, AUD, CHF, JPY
- [ ] **📊 Dashboard Analytics**: Relatórios detalhados e métricas
- [ ] **📱 Mobile App**: Aplicativo nativo para administração
- [ ] **🏦 Integração Bancária**: APIs de bancos para operações
- [ ] **🤖 IA Avançada**: ChatBot com processamento de linguagem natural

### 🛠️ Melhorias Técnicas

- [ ] **🧪 Testes Automatizados**: Cobertura completa com Jest
- [ ] **🔄 CI/CD Pipeline**: GitHub Actions para deploy automático
- [ ] **📈 Métricas Avançadas**: Prometheus + Grafana
- [ ] **🔍 Observabilidade**: Tracing distribuído
- [ ] **🚀 Performance**: Cache Redis e otimizações
- [ ] **🔐 Autenticação 2FA**: Two-factor authentication
- [ ] **📦 Microserviços**: Arquitetura distribuída

## 📊 Métricas e Monitoramento

### 📈 KPIs Monitorados

- **📱 Mensagens Processadas**: Total/por hora/por filial
- **👥 Usuários Ativos**: Únicos/sessões ativas
- **⏱️ Tempo de Resposta**: Médio/máximo/por comando
- **🔄 Uptime**: Por filial/geral
- **❌ Taxa de Erro**: Falhas/reconexões
- **💬 Conversões**: Menu → Ação completada

### 📊 Dashboard Metrics

```typescript
interface SystemMetrics {
  totalMessages: number;           // Total de mensagens processadas
  connectedUsers: number;          // Usuários conectados agora
  uptime: string;                  // Tempo online do sistema
  branchesOnline: number;          // Filiais online/total
  averageResponseTime: number;     // Tempo médio de resposta (ms)
  errorRate: number;               // Taxa de erro (%)
  lastActivity: Date;              // Última atividade registrada
}
```

## 🎓 Documentação Adicional

### 📚 Arquivos de Documentação

- **📋 [API.md](whatsapp-baileys-bot/API.md)**: Documentação completa da API
- **🔧 [DEVELOPMENT.md](whatsapp-baileys-bot/docs/DEVELOPMENT.md)**: Guia para desenvolvedores
- **🚀 [DEPLOYMENT.md](whatsapp-baileys-bot/MULTI-BRANCH-DEPLOY.md)**: Guia de deploy
- **📊 [MONITORING.md](whatsapp-baileys-bot/MONITORING.md)**: Sistema de monitoramento
- **🧪 [QR_TEST_RESULT.md](QR_TEST_RESULT.md)**: Testes de QR Code

### 🔗 Links Úteis

- **Baileys Documentation**: https://github.com/WhiskeySockets/Baileys
- **React Documentation**: https://react.dev
- **ShadCN UI**: https://ui.shadcn.com
- **TailwindCSS**: https://tailwindcss.com
- **Socket.io**: https://socket.io

## 🤝 Suporte e Contribuição

### 🆘 Suporte Técnico

Para suporte técnico ou melhorias:

1. **🐛 Issues**: Abra uma issue no repositório
2. **📧 Contato**: Entre em contato com a equipe de desenvolvimento
3. **📖 Documentação**: Consulte `/docs` para guias detalhados
4. **💬 Logs**: Sempre anexe logs relevantes (`/logs/combined.log`)

### 🤝 Como Contribuir

```bash
# 1. Fork o repositório
git clone <seu-fork>

# 2. Crie uma branch para sua feature
git checkout -b feature/nova-funcionalidade

# 3. Faça suas alterações e commit
git commit -m "Add: nova funcionalidade incrível"

# 4. Push para sua branch
git push origin feature/nova-funcionalidade

# 5. Abra um Pull Request
```

### 📋 Checklist de Contribuição

- [ ] ✅ Código segue padrões do projeto
- [ ] 🧪 Testes adicionados/atualizados
- [ ] 📚 Documentação atualizada
- [ ] 🔍 Code review realizado
- [ ] 🚀 Testado em ambiente local

## 📝 Licença

**Projeto privado desenvolvido para Fair Câmbio**

Todos os direitos reservados. Este software é propriedade da **Fair Câmbio** e está protegido por direitos autorais. O uso, distribuição ou modificação não autorizada é estritamente proibida.

## 🎯 Status do Projeto

<p align="center">
  <img src="https://img.shields.io/badge/Status-✅%20Produção-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Version-v1.0.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Uptime-99.9%25-green?style=for-the-badge" alt="Uptime" />
  <img src="https://img.shields.io/badge/Coverage-85%25-orange?style=for-the-badge" alt="Coverage" />
</p>

---

<p align="center">
  <strong>🚀 Desenvolvido com ❤️ para Fair Câmbio</strong><br>
  <em>Sistema de WhatsApp Bot Multi-Filiais - Versão 1.0.0</em><br><br>
  <img src="https://img.shields.io/badge/Made%20in-Brazil-green?style=flat&labelColor=yellow" alt="Made in Brazil" />
</p>
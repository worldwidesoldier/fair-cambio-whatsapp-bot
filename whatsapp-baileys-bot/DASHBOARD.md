# Fair Câmbio - Dashboard Administrativo

Dashboard web completo para administração centralizada de todas as filiais do Fair Câmbio.

## 🚀 Funcionalidades

### ✅ Interface Web Responsiva
- Design profissional e intuitivo
- Compatível com desktop, tablet e mobile
- Interface em tempo real com WebSocket
- Navegação simplificada e acessível

### ✅ Gestão de Taxas de Câmbio
- **Visualização em tempo real** de todas as moedas
- **Atualização individual** ou em lote
- **Histórico completo** de alterações
- **Estatísticas** de volatilidade e frequência
- **Alertas** para variações significativas
- **API REST** para integração externa

### ✅ Monitoramento de Filiais
- **Status em tempo real** de todas as filiais
- **Gestão completa** (criar, editar, ativar/desativar)
- **Estatísticas** por localização
- **Monitoramento de conectividade**
- **Operações em lote**

### ✅ Estatísticas e Analytics
- **Conversas por período** (diário, semanal, mensal)
- **Usuários ativos** e novos
- **Distribuição por horários**
- **Top usuários** por atividade
- **Relatórios personalizados**
- **Exportação** em JSON/CSV

### ✅ Sistema de Broadcast
- **Envio para múltiplos destinatários**
- **Templates personalizáveis** com variáveis
- **Agendamento** de mensagens
- **Histórico completo** de broadcasts
- **Segmentação avançada** de público
- **Preview** de mensagens

### ✅ Gestão de Usuários
- **Sistema de permissões** granular
- **Roles** (admin, manager, user)
- **Autenticação segura** com JWT
- **Logs de atividade**
- **Gestão de sessões**

### ✅ Backup e Restauração
- **Backup automático** e manual
- **Tipos de backup** (completo, config, dados, logs)
- **Restauração seletiva**
- **Compressão** e otimização
- **Agendamento** de backups

### ✅ API REST Completa
- **Documentação completa** (ver API.md)
- **Autenticação JWT**
- **Rate limiting**
- **CORS configurado**
- **Integração externa** facilitada

## 📦 Instalação

### 1. Dependências
```bash
npm install
```

### 2. Configuração
Crie um arquivo `.env` na raiz do projeto:

```env
# Dashboard Configuration
DASHBOARD_PORT=3000
DASHBOARD_ORIGIN=http://localhost:3000

# JWT Secret
JWT_SECRET=your-super-secure-secret-key

# Admin Numbers (comma separated)
ADMIN_NUMBERS=5511999999999,5511888888888

# Optional: Backup configuration
BACKUP_LOGS_DAYS=90
```

### 3. Executar

#### Apenas Dashboard
```bash
npm run dashboard
```

#### Apenas Bot WhatsApp
```bash
npm start
```

#### Bot + Dashboard simultaneamente
```bash
npm run both
```

#### Modo Desenvolvimento
```bash
npm run dashboard:dev  # Dashboard com auto-reload
npm run dev           # Bot com auto-reload
```

## 🎯 Acesso

### Dashboard Web
- **URL:** http://localhost:3000
- **Usuário padrão:** `admin`
- **Senha padrão:** `password`

### API REST
- **Base URL:** http://localhost:3000/api
- **Documentação:** Ver [API.md](API.md)

## 🔐 Autenticação

### Usuário Padrão
O sistema cria automaticamente um usuário administrador:
- **Username:** admin
- **Password:** password
- **Role:** admin
- **Permissions:** all

### Criando Novos Usuários
Via dashboard ou API:

```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager1",
    "name": "Gerente Filial",
    "password": "senha123",
    "role": "manager",
    "permissions": ["rates", "broadcast", "stats"]
  }'
```

## 📊 Estrutura de Pastas

```
src/dashboard/
├── server.js              # Servidor Express principal
├── index.js               # Inicializador do dashboard
├── controllers/           # Controladores da API
│   ├── auth.js            # Autenticação
│   ├── dashboard.js       # Dashboard overview
│   ├── rates.js           # Gestão de taxas
│   ├── branches.js        # Gestão de filiais
│   ├── stats.js           # Estatísticas
│   ├── broadcast.js       # Sistema de broadcast
│   └── backup.js          # Backup e restauração
├── middleware/            # Middlewares
│   ├── auth.js            # Autenticação JWT
│   └── error.js           # Tratamento de erros
├── public/               # Frontend
│   ├── index.html        # Interface principal
│   └── js/
│       └── dashboard.js   # JavaScript do frontend
└── config/               # Configurações
    ├── users.json        # Usuários do sistema
    └── broadcast-templates.json
```

## 🔧 Configurações Avançadas

### Variáveis de Ambiente

```env
# Porta do dashboard
DASHBOARD_PORT=3000

# Origem permitida para CORS
DASHBOARD_ORIGIN=http://localhost:3000

# Chave secreta JWT (OBRIGATÓRIO em produção)
JWT_SECRET=your-super-secure-secret-key

# Números de administradores WhatsApp
ADMIN_NUMBERS=5511999999999,5511888888888

# Configurações de backup
BACKUP_LOGS_DAYS=90
BACKUP_AUTO_INTERVAL=24h

# Configurações de rate limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
```

### Segurança

#### Produção
- ✅ **Altere a senha padrão** imediatamente
- ✅ **Configure JWT_SECRET** único e seguro
- ✅ **Use HTTPS** em produção
- ✅ **Configure firewall** adequadamente
- ✅ **Mantenha backups** regulares

#### CORS
```javascript
// Configure no .env para produção
DASHBOARD_ORIGIN=https://seu-dominio.com
```

#### Rate Limiting
- **15 minutos:** 100 requests por IP
- **Configurável** via variáveis de ambiente

## 📱 Uso do Dashboard

### 1. Login
- Acesse http://localhost:3000
- Use as credenciais admin/password
- O sistema redirecionará para o dashboard

### 2. Gestão de Taxas
- **Navegar:** Menu lateral > Taxas de Câmbio
- **Atualizar:** Clique em "Editar" na moeda desejada
- **Lote:** Use "Atualizar Taxas" para múltiplas
- **Histórico:** Automático para todas as alterações

### 3. Monitoramento de Filiais
- **Status:** Dashboard principal mostra resumo
- **Detalhes:** Menu lateral > Filiais
- **Gestão:** Criar, editar, ativar/desativar
- **Bulk:** Operações em múltiplas filiais

### 4. Sistema de Broadcast
- **Enviar:** Menu lateral > Broadcast
- **Templates:** Crie templates reutilizáveis
- **Segmentação:** All, Active, Recent, Custom
- **Agendamento:** Para envios futuros

### 5. Estatísticas
- **Overview:** Dashboard principal
- **Detalhadas:** Menu lateral > Estatísticas
- **Exportar:** JSON ou CSV
- **Períodos:** 1d, 7d, 30d, 90d

### 6. Backup
- **Manual:** Menu lateral > Backup > Criar
- **Tipos:** Full, Config, Data, Logs
- **Restaurar:** Selecionar backup e restaurar
- **Download:** Baixar backups localmente

## 🔌 Integração com Bot WhatsApp

O dashboard se integra automaticamente com o bot WhatsApp:

```javascript
// src/bot.js - exemplo de integração
const DashboardApp = require('./dashboard');

const dashboard = new DashboardApp();
dashboard.start();

// Conectar bot ao dashboard
dashboard.setBotInstance(sock);

// Notificar dashboard sobre eventos
dashboard.notify({
  type: 'info',
  title: 'Bot Conectado',
  message: 'WhatsApp bot conectado com sucesso'
});
```

## 🌐 WebSocket - Tempo Real

### Conexão
```javascript
const socket = io({
  auth: { token: 'your_jwt_token' }
});
```

### Eventos
```javascript
// Inscrever-se em atualizações
socket.emit('subscribe-rates');
socket.emit('subscribe-stats');
socket.emit('subscribe-branches');

// Escutar atualizações
socket.on('rates', (data) => {
  console.log('Taxa atualizada:', data);
});

socket.on('notification', (notification) => {
  console.log('Notificação:', notification);
});
```

## 🚀 Deploy

### Desenvolvimento Local
```bash
npm run both  # Bot + Dashboard
```

### Produção
```bash
# Instalar dependências
npm install --production

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com valores de produção

# Iniciar serviços
npm start           # Bot WhatsApp
npm run dashboard   # Dashboard (porta separada)
```

### Docker (Futuro)
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "both"]
```

## 🔧 Troubleshooting

### Dashboard não abre
1. Verificar porta 3000 disponível
2. Conferir logs no console
3. Verificar variáveis de ambiente

### Erro de autenticação
1. Verificar JWT_SECRET configurado
2. Limpar localStorage do browser
3. Verificar credenciais admin/password

### Bot não conecta ao dashboard
1. Verificar se dashboard está rodando
2. Conferir integração no bot.js
3. Verificar logs do servidor

### WebSocket não funciona
1. Verificar token JWT válido
2. Confirmar porta WebSocket (mesma do HTTP)
3. Verificar firewall/proxy

### Backup falha
1. Verificar permissões de escrita
2. Conferir espaço em disco
3. Verificar pasta backups/ existe

## 📞 Suporte

Para suporte técnico:
1. Verificar logs do console
2. Consultar documentação API.md
3. Verificar issues conhecidos
4. Abrir ticket se necessário

## 🔄 Atualizações

### Versão Atual: 1.0.0
- ✅ Dashboard completo funcional
- ✅ API REST documentada
- ✅ Sistema de backup
- ✅ WebSocket tempo real
- ✅ Autenticação segura
- ✅ Interface responsiva

### Próximas Versões
- 📅 Agendamento automático de backups
- 📅 Integração com APIs externas de cotação
- 📅 Notificações push
- 📅 Dashboard mobile app
- 📅 Relatórios avançados com gráficos
- 📅 Integração com múltiplos bots

---

## 🎉 Dashboard Pronto!

O dashboard está **100% funcional** com todas as features solicitadas:

✅ **Interface web responsiva** - HTML/CSS/JS profissional
✅ **Gestão de taxas em tempo real** - Todas as moedas
✅ **Monitoramento de filiais** - Status de todas as filiais
✅ **Estatísticas completas** - Conversas e usuários
✅ **Sistema de broadcast** - Para todas as filiais
✅ **Gestão de admins** - Permissões granulares
✅ **Backup/restore** - Configurações completas
✅ **API REST** - Integração externa facilitada
✅ **WebSocket** - Atualizações em tempo real
✅ **Autenticação robusta** - JWT + bcrypt
✅ **Mobile-friendly** - Interface responsiva
✅ **Deploy fácil** - Configuração simplificada

**Acesse:** http://localhost:3000 (admin/password)
**Execute:** `npm run both` para bot + dashboard
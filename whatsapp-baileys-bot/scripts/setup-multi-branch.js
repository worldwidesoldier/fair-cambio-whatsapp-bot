#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function createDirectoryStructure() {
  log('📁 Criando estrutura de diretórios...', 'blue');

  const branches = ['matriz', 'shopping-manauara', 'amazonas-shopping', 'ponta-negra', 'aeroporto'];
  const baseDirs = ['sessions', 'logs', 'data'];

  try {
    // Criar diretórios base
    for (const baseDir of baseDirs) {
      await fs.mkdir(baseDir, { recursive: true });
      log(`   ✅ ${baseDir}/`, 'green');

      // Criar subdiretórios para cada filial
      for (const branch of branches) {
        const branchDir = path.join(baseDir, branch);
        await fs.mkdir(branchDir, { recursive: true });
        log(`   ✅ ${branchDir}/`, 'green');
      }
    }

    // Diretórios específicos para logs
    await fs.mkdir('logs/branches', { recursive: true });
    log('   ✅ logs/branches/', 'green');

    // Diretório para backups
    await fs.mkdir('backups', { recursive: true });
    log('   ✅ backups/', 'green');

    // Diretório para Docker
    await fs.mkdir('docker/ssl', { recursive: true });
    log('   ✅ docker/ssl/', 'green');

  } catch (error) {
    log(`❌ Erro ao criar diretórios: ${error.message}`, 'red');
    throw error;
  }
}

async function checkEnvironmentFile() {
  log('🔧 Verificando arquivo .env...', 'blue');

  try {
    await fs.access('.env');
    log('   ✅ Arquivo .env encontrado', 'green');

    const envContent = await fs.readFile('.env', 'utf8');
    const requiredVars = [
      'ADMIN_NUMBERS',
      'BOT_NAME',
      'SESSION_NAME',
      'TZ'
    ];

    const missingVars = requiredVars.filter(varName =>
      !envContent.includes(`${varName}=`)
    );

    if (missingVars.length > 0) {
      log(`   ⚠️ Variáveis ausentes no .env: ${missingVars.join(', ')}`, 'yellow');
      log('   📝 Adicione essas variáveis ao arquivo .env', 'yellow');
    } else {
      log('   ✅ Todas as variáveis obrigatórias estão presentes', 'green');
    }

  } catch (error) {
    log('   ❌ Arquivo .env não encontrado', 'red');
    log('   📝 Criando arquivo .env de exemplo...', 'yellow');

    const exampleEnv = `# Configurações do Bot WhatsApp Multi-Filial
ADMIN_NUMBERS=559185000000,559192000000
BOT_NAME=Fair Câmbio
SESSION_NAME=fair-cambio-bot

# Horários de Funcionamento
OPENING_HOUR=9
CLOSING_HOUR=18
SATURDAY_CLOSING=14

# Timezone
TZ=America/Sao_Paulo

# Monitoramento
ENABLE_MONITORING_API=true
MONITORING_PORT=3001
LOG_LEVEL=info

# Opcionais
# REDIS_URL=redis://localhost:6379
`;

    await fs.writeFile('.env', exampleEnv);
    log('   ✅ Arquivo .env criado com configurações de exemplo', 'green');
    log('   📝 Edite o arquivo .env com suas configurações específicas', 'yellow');
  }
}

async function validateBranchConfiguration() {
  log('🏢 Validando configuração das filiais...', 'blue');

  try {
    const branchConfig = require('../src/config/branches');
    const branches = branchConfig.branches;

    log(`   📊 Total de filiais configuradas: ${branches.length}`, 'cyan');

    const activeBranches = branchConfig.getActiveBranches();
    log(`   ✅ Filiais ativas: ${activeBranches.length}`, 'green');

    activeBranches.forEach((branch, index) => {
      log(`      ${index + 1}. ${branch.name} (${branch.phone})`, 'cyan');
    });

    // Validar cada filial
    let validationErrors = 0;

    for (const branch of branches) {
      const validation = branchConfig.validateBranchConfig(branch.id);
      if (!validation.valid) {
        log(`   ❌ ${branch.id}: ${validation.error}`, 'red');
        validationErrors++;
      }
    }

    if (validationErrors === 0) {
      log('   ✅ Todas as filiais estão configuradas corretamente', 'green');
    } else {
      log(`   ⚠️ ${validationErrors} filiais têm problemas de configuração`, 'yellow');
    }

  } catch (error) {
    log(`   ❌ Erro ao validar configuração: ${error.message}`, 'red');
  }
}

async function checkDependencies() {
  log('📦 Verificando dependências...', 'blue');

  try {
    const packageJson = require('../package.json');
    const dependencies = packageJson.dependencies;
    const devDependencies = packageJson.devDependencies || {};

    const requiredDeps = [
      '@whiskeysockets/baileys',
      'dotenv',
      'pino',
      'qrcode-terminal'
    ];

    const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);

    if (missingDeps.length > 0) {
      log(`   ❌ Dependências ausentes: ${missingDeps.join(', ')}`, 'red');
      log('   📝 Execute: npm install', 'yellow');
    } else {
      log('   ✅ Todas as dependências obrigatórias estão instaladas', 'green');
    }

    // Verificar node_modules
    try {
      await fs.access('node_modules');
      log('   ✅ Diretório node_modules encontrado', 'green');
    } catch {
      log('   ❌ Diretório node_modules não encontrado', 'red');
      log('   📝 Execute: npm install', 'yellow');
    }

  } catch (error) {
    log(`   ❌ Erro ao verificar dependências: ${error.message}`, 'red');
  }
}

async function generateQuickStartGuide() {
  log('📖 Gerando guia de início rápido...', 'blue');

  const quickStart = `# 🚀 Fair Câmbio Multi-Branch - Início Rápido

## Configuração Inicial Concluída

### 1. Próximos Passos

1. **Editar configurações:**
   \`\`\`bash
   nano .env                          # Configurar variáveis de ambiente
   nano src/config/branches.js       # Ajustar dados das filiais
   \`\`\`

2. **Instalar dependências (se ainda não fez):**
   \`\`\`bash
   npm install
   \`\`\`

### 2. Executar o Sistema

#### Opção 1: Desenvolvimento
\`\`\`bash
npm run dev                # Modo desenvolvimento com todas as filiais
npm run dev:single         # Modo desenvolvimento filial única (legacy)
\`\`\`

#### Opção 2: Produção com PM2
\`\`\`bash
npm run start:pm2          # Iniciar com PM2
npm run status:pm2         # Ver status
npm run logs:pm2           # Ver logs
npm run stop:pm2           # Parar
\`\`\`

#### Opção 3: Docker
\`\`\`bash
npm run docker:up          # Iniciar com Docker Compose
npm run docker:logs        # Ver logs
npm run docker:down        # Parar
\`\`\`

### 3. Monitoramento

- **API de Status:** http://localhost:3001/health
- **Status Completo:** http://localhost:3001/status
- **Filiais:** http://localhost:3001/branches

### 4. Comandos Úteis

\`\`\`bash
npm run monitor            # Status rápido via API
npm run health             # Health check
\`\`\`

### 5. Configurar QR Codes

1. Execute o sistema
2. Escaneie os QR codes que aparecerão no terminal
3. Cada filial terá seu próprio QR code
4. Aguarde todas as filiais conectarem

### 6. Logs

- **Logs gerais:** \`logs/combined.log\`
- **Logs por filial:** \`logs/branches/[filial]-combined.log\`
- **Sessões:** \`sessions/[filial]/\`

Para mais detalhes, consulte: MULTI-BRANCH-DEPLOY.md
`;

  await fs.writeFile('QUICK-START.md', quickStart);
  log('   ✅ Guia criado: QUICK-START.md', 'green');
}

async function main() {
  log('🎯 Fair Câmbio Multi-Branch Setup', 'magenta');
  log('====================================', 'magenta');

  try {
    await createDirectoryStructure();
    await checkEnvironmentFile();
    await validateBranchConfiguration();
    await checkDependencies();
    await generateQuickStartGuide();

    log('\n🎉 Setup concluído com sucesso!', 'green');
    log('📖 Consulte QUICK-START.md para próximos passos', 'cyan');
    log('📚 Documentação completa: MULTI-BRANCH-DEPLOY.md', 'cyan');

  } catch (error) {
    log(`\n❌ Erro durante setup: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
#!/usr/bin/env node

/**
 * SCRIPT DE INICIALIZAÇÃO UNIFICADO - WhatsApp Bot Project
 * Este script garante que todos os componentes sejam iniciados na ordem correta
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando WhatsApp Bot Project...\n');

// Configurações
const BACKEND_DIR = path.join(__dirname, 'whatsapp-baileys-bot');
const FRONTEND_DIR = path.join(__dirname, 'dashboard-frontend');

let backendProcess = null;
let frontendProcess = null;

// Função para iniciar apenas o bot (sem dashboard básico)
function startBackend() {
  console.log('🤖 Iniciando Bot WhatsApp...');

  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    shell: true
  });

  backendProcess.on('error', (error) => {
    console.error('❌ Erro no bot:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`🤖 Bot encerrado com código: ${code}`);
  });
}

// Função para iniciar o frontend
function startFrontend() {
  console.log('🎨 Iniciando Frontend React...');

  frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    shell: true
  });

  frontendProcess.on('error', (error) => {
    console.error('❌ Erro no frontend:', error);
  });

  frontendProcess.on('exit', (code) => {
    console.log(`🎨 Frontend encerrado com código: ${code}`);
  });
}

// Função de shutdown graceful
function gracefulShutdown() {
  console.log('\n🔄 Encerrando projeto...');

  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }

  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
  }

  setTimeout(() => {
    console.log('✅ Projeto encerrado com sucesso!');
    process.exit(0);
  }, 2000);
}

// Handlers de sinais
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Inicializar serviços
console.log('🔧 Configuração:');
console.log('   🎯 SEU DASHBOARD: http://localhost:5173');
console.log('   🤖 Bot WhatsApp: Integrado ao dashboard\n');

// Iniciar backend primeiro, depois frontend
startBackend();

// Aguardar um pouco e iniciar frontend
setTimeout(() => {
  startFrontend();
}, 3000);

console.log('🎯 Projeto iniciado! Use Ctrl+C para encerrar.\n');
#!/usr/bin/env node

/**
 * Script de teste para verificar a sincronização em tempo real
 * entre Dashboard -> Backend -> Bot
 */

const fetch = require('node-fetch').default || require('node-fetch');
const io = require('socket.io-client');

class SyncTester {
  constructor() {
    this.backendUrl = 'http://localhost:3001';
    this.dashboardSocket = null;
    this.testResults = [];
  }

  async run() {
    console.log('🧪 TESTE DE SINCRONIZAÇÃO INICIADO\n');

    try {
      // 1. Verificar se o backend está rodando
      await this.checkBackendHealth();

      // 2. Conectar dashboard socket
      await this.connectDashboard();

      // 3. Executar testes de sincronização
      await this.testExchangeRateSync();
      await this.testBranchSync();
      await this.testMessageSync();

      // 4. Resultados finais
      this.showResults();

    } catch (error) {
      console.error('❌ Erro durante os testes:', error);
    } finally {
      if (this.dashboardSocket) {
        this.dashboardSocket.disconnect();
      }
      process.exit(0);
    }
  }

  async checkBackendHealth() {
    console.log('1️⃣ Verificando saúde do backend...');

    try {
      const response = await fetch(`${this.backendUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend está rodando:', data.status);
        this.testResults.push({ test: 'Backend Health', status: 'PASS' });
      } else {
        throw new Error(`Backend retornou status ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Backend não está acessível:', error.message);
      this.testResults.push({ test: 'Backend Health', status: 'FAIL', error: error.message });
      throw error;
    }

    console.log('');
  }

  async connectDashboard() {
    console.log('2️⃣ Conectando dashboard socket...');

    return new Promise((resolve, reject) => {
      this.dashboardSocket = io(this.backendUrl, {
        timeout: 5000
      });

      this.dashboardSocket.on('connect', () => {
        console.log('✅ Dashboard conectado ao WebSocket');
        this.testResults.push({ test: 'Dashboard Connection', status: 'PASS' });

        // Configurar listeners para testes
        this.setupSyncListeners();
        resolve();
      });

      this.dashboardSocket.on('connect_error', (error) => {
        console.log('❌ Erro ao conectar dashboard:', error.message);
        this.testResults.push({ test: 'Dashboard Connection', status: 'FAIL', error: error.message });
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('Timeout na conexão do dashboard'));
      }, 10000);
    });
  }

  setupSyncListeners() {
    this.dashboardSocket.on('exchangeRatesUpdate', (rates) => {
      console.log(`📊 Recebida atualização de cotações: ${rates?.length || 0} moedas`);
    });

    this.dashboardSocket.on('branchesUpdate', (branches) => {
      console.log(`🏢 Recebida atualização de filiais: ${branches?.length || 0} filiais`);
    });

    this.dashboardSocket.on('messageUpdated', (data) => {
      console.log(`💬 Recebida atualização de mensagem: ${data.category}`);
    });

    this.dashboardSocket.on('syncCompleted', (data) => {
      console.log(`✅ Sync completado: ${data.action}`);
    });

    this.dashboardSocket.on('syncError', (data) => {
      console.log(`❌ Erro no sync: ${data.action} - ${data.error}`);
    });
  }

  async testExchangeRateSync() {
    console.log('3️⃣ Testando sincronização de cotações...');

    try {
      const testRate = {
        currency: 'USD',
        buyRate: 5.25,
        sellRate: 5.45,
        id: 'USD',
        symbol: '$',
        lastUpdated: new Date()
      };

      // Simular atualização do dashboard
      this.dashboardSocket.emit('updateExchangeRate', testRate);

      // Aguardar um pouco para o processamento
      await this.sleep(2000);

      // Verificar se a cotação foi atualizada no backend
      const response = await fetch(`${this.backendUrl}/api/exchange-rates`);
      const rates = await response.json();

      const updatedRate = rates.find(r => r.currency === 'USD');
      if (updatedRate && updatedRate.buyRate === testRate.buyRate) {
        console.log('✅ Cotação sincronizada com sucesso no backend');
        this.testResults.push({ test: 'Exchange Rate Sync', status: 'PASS' });
      } else {
        throw new Error('Cotação não foi atualizada no backend');
      }

    } catch (error) {
      console.log('❌ Falha no teste de cotação:', error.message);
      this.testResults.push({ test: 'Exchange Rate Sync', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  async testBranchSync() {
    console.log('4️⃣ Testando sincronização de filiais...');

    try {
      const testBranch = {
        id: '1',
        name: 'Fair Câmbio - São José (TESTE)',
        phone: '(48) 9969-72142',
        address: 'Endereço Teste Atualizado',
        hours: {
          weekdays: '09:00 - 17:30',
          saturday: 'Fechado',
          sunday: 'Fechado'
        }
      };

      // Simular atualização do dashboard
      this.dashboardSocket.emit('updateBranch', testBranch);

      // Aguardar processamento
      await this.sleep(2000);

      // Verificar se a filial foi atualizada no backend
      const response = await fetch(`${this.backendUrl}/api/branches`);
      const data = await response.json();

      const updatedBranch = data.branches?.find(b => b.id === '1');
      if (updatedBranch && updatedBranch.name.includes('TESTE')) {
        console.log('✅ Filial sincronizada com sucesso no backend');
        this.testResults.push({ test: 'Branch Sync', status: 'PASS' });
      } else {
        throw new Error('Filial não foi atualizada no backend');
      }

    } catch (error) {
      console.log('❌ Falha no teste de filial:', error.message);
      this.testResults.push({ test: 'Branch Sync', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  async testMessageSync() {
    console.log('5️⃣ Testando sincronização de mensagens...');

    try {
      const testMessage = {
        template: 'Mensagem de teste {{name}}! Sistema atualizado em {{timestamp}}.',
        variables: {
          name: 'Cliente',
          timestamp: new Date().toLocaleString()
        }
      };

      // Simular atualização de mensagem via API
      const response = await fetch(`${this.backendUrl}/api/messages/welcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Mensagem atualizada via API:', result.message);

        // Aguardar processamento
        await this.sleep(2000);

        // Verificar se a mensagem foi salva
        const checkResponse = await fetch(`${this.backendUrl}/api/messages`);
        const messagesData = await checkResponse.json();

        if (messagesData.messages?.welcome?.template.includes('teste')) {
          console.log('✅ Mensagem sincronizada com sucesso');
          this.testResults.push({ test: 'Message Sync', status: 'PASS' });
        } else {
          throw new Error('Mensagem não foi atualizada');
        }
      } else {
        throw new Error(`API retornou status ${response.status}`);
      }

    } catch (error) {
      console.log('❌ Falha no teste de mensagem:', error.message);
      this.testResults.push({ test: 'Message Sync', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  showResults() {
    console.log('📋 RESULTADOS DOS TESTES:');
    console.log('=' .repeat(50));

    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.status}`);
      if (result.error) {
        console.log(`   Erro: ${result.error}`);
      }

      if (result.status === 'PASS') passed++;
      else failed++;
    });

    console.log('=' .repeat(50));
    console.log(`Testes passaram: ${passed}`);
    console.log(`Testes falharam: ${failed}`);
    console.log(`Total: ${passed + failed}`);

    if (failed === 0) {
      console.log('\n🎉 TODOS OS TESTES PASSARAM!');
      console.log('✅ Sistema de sincronização funcionando perfeitamente!');
    } else {
      console.log(`\n⚠️ ${failed} teste(s) falharam`);
      console.log('📋 Verifique os logs acima para detalhes');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Executar testes
if (require.main === module) {
  const tester = new SyncTester();
  tester.run();
}

module.exports = SyncTester;
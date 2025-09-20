import React, { useState, useEffect } from 'react';

export default function DashboardSimple() {
  const [branches, setBranches] = useState([]);
  const [rates, setRates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (type: string, message: string) => {
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message
    };
    console.log(`[${type.toUpperCase()}] ${message}`);
    setLogs(prev => [...prev.slice(-15), newLog]);
  };

  const loadData = async () => {
    setLoading(true);
    addLog('info', '🔄 Carregando dados da API...');

    try {
      // Carregar filiais
      console.log('🚀 Fetching branches...');
      const branchResponse = await fetch('http://localhost:3001/api/branches', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📡 Branch response status:', branchResponse.status);
      if (branchResponse.ok) {
        const branchData = await branchResponse.json();
        console.log('✅ Branches response:', branchData);
        setBranches(branchData.branches || []);
        addLog('success', `✅ ${(branchData.branches || []).length} filiais carregadas!`);
      } else {
        addLog('error', `❌ Erro ao carregar filiais: HTTP ${branchResponse.status}`);
      }
    } catch (error) {
      console.error('❌ Branch error:', error);
      addLog('error', `❌ Erro ao carregar filiais: ${error.message}`);
    }

    try {
      // Carregar cotações
      console.log('🚀 Fetching rates...');
      const rateResponse = await fetch('http://localhost:3001/api/exchange-rates', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📡 Rate response status:', rateResponse.status);
      if (rateResponse.ok) {
        const rateData = await rateResponse.json();
        console.log('✅ Rates response:', rateData);
        setRates(rateData || []);
        addLog('success', `✅ ${(rateData || []).length} cotações carregadas!`);
      } else {
        addLog('error', `❌ Erro ao carregar cotações: HTTP ${rateResponse.status}`);
      }
    } catch (error) {
      console.error('❌ Rate error:', error);
      addLog('error', `❌ Erro ao carregar cotações: ${error.message}`);
    }

    setLoading(false);
  };

  useEffect(() => {
    addLog('info', '🚀 Dashboard SIMPLES iniciado');
    loadData();

    // Recarregar dados a cada 15 segundos
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-blue-900 mb-2">
          ⚡ DASHBOARD DIRETO - FUNCIONANDO
        </h1>
        <p className="text-gray-600 mb-6">Dados carregados diretamente da API (sem WebSocket)</p>

        {/* Controles */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={loadData}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-semibold ${loading
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? '⏳ Carregando...' : '🔄 Recarregar Dados'}
          </button>

          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              branches.length > 0 && rates.length > 0 ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">
              {branches.length > 0 && rates.length > 0 ? 'Dados carregados' : 'Dados pendentes'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Cotações */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-green-700">
              💱 Cotações ({rates.length})
            </h2>
            {rates.length > 0 ? (
              <div className="space-y-4">
                {rates.map((rate, index) => (
                  <div key={index} className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="font-bold text-lg">{rate.currency} {rate.symbol}</div>
                    <div className="text-green-700">
                      <span className="font-medium">Compra:</span> R$ {rate.buyRate} |
                      <span className="font-medium ml-2">Venda:</span> R$ {rate.sellRate}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Atualizado: {new Date(rate.lastUpdated).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">💸</div>
                <div>Nenhuma cotação carregada</div>
              </div>
            )}
          </div>

          {/* Filiais */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">
              🏢 Filiais ({branches.length})
            </h2>
            {branches.length > 0 ? (
              <div className="space-y-4">
                {branches.map((branch, index) => (
                  <div key={index} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="font-bold text-lg">{branch.name}</div>
                    <div className="text-blue-700 font-medium">{branch.phone}</div>
                    <div className="text-sm text-gray-600">{branch.address}</div>
                    {branch.hours && (
                      <div className="text-xs text-gray-500 mt-1">
                        Seg-Sex: {branch.hours.weekdays} | Sáb: {branch.hours.saturday}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏪</div>
                <div>Nenhuma filial carregada</div>
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-purple-700">📋 Logs do Sistema</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 text-sm p-3 rounded-lg bg-gray-50">
                <span className="text-gray-500 font-mono min-w-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-semibold min-w-0 ${
                  log.type === 'success' ? 'bg-green-200 text-green-800' :
                  log.type === 'error' ? 'bg-red-200 text-red-800' :
                  log.type === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-blue-200 text-blue-800'
                }`}>
                  {log.type}
                </span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-4 text-gray-500">Nenhum log ainda</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
const fs = require('fs').promises;
const path = require('path');
const { formatCurrency, formatDate } = require('../utils/formatter');

class RatesManager {
  constructor() {
    this.ratesPath = path.join(__dirname, '../config/rates.json');
    this.historyPath = path.join(__dirname, '../../logs/rates-history.json');
    this.rates = null;
    this.loadRates();
  }

  async loadRates() {
    try {
      const data = await fs.readFile(this.ratesPath, 'utf8');
      this.rates = JSON.parse(data);
      return this.rates;
    } catch (error) {
      console.error('Erro ao carregar taxas:', error);
      return null;
    }
  }

  async saveRates() {
    try {
      await fs.writeFile(
        this.ratesPath,
        JSON.stringify(this.rates, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error('Erro ao salvar taxas:', error);
      return false;
    }
  }

  async updateRate(currency, type, value) {
    if (!this.rates) await this.loadRates();

    const currencyUpper = currency.toUpperCase();

    if (!this.rates.currencies[currencyUpper]) {
      return {
        success: false,
        message: `Moeda ${currency} não encontrada`
      };
    }

    if (!['buy', 'sell'].includes(type)) {
      return {
        success: false,
        message: 'Tipo deve ser "buy" (compra) ou "sell" (venda)'
      };
    }

    const oldValue = this.rates.currencies[currencyUpper][type];
    this.rates.currencies[currencyUpper][type] = parseFloat(value);
    this.rates.lastUpdate = new Date().toISOString();

    // Salva histórico
    await this.saveHistory(currencyUpper, type, oldValue, value);

    if (await this.saveRates()) {
      return {
        success: true,
        message: `✅ Taxa atualizada com sucesso!\n\n${this.rates.currencies[currencyUpper].emoji} *${this.rates.currencies[currencyUpper].name}*\n${type === 'buy' ? 'Compra' : 'Venda'}: ${formatCurrency(oldValue)} → ${formatCurrency(value)}`
      };
    }

    return {
      success: false,
      message: 'Erro ao salvar as taxas'
    };
  }

  async saveHistory(currency, type, oldValue, newValue) {
    try {
      let history = [];

      try {
        const data = await fs.readFile(this.historyPath, 'utf8');
        history = JSON.parse(data);
      } catch {
        // Arquivo não existe ainda
      }

      history.push({
        timestamp: new Date().toISOString(),
        currency,
        type,
        oldValue,
        newValue,
        change: ((newValue - oldValue) / oldValue * 100).toFixed(2)
      });

      // Mantém apenas os últimos 100 registros
      if (history.length > 100) {
        history = history.slice(-100);
      }

      await fs.writeFile(
        this.historyPath,
        JSON.stringify(history, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }

  async getHistory(limit = 10) {
    try {
      const data = await fs.readFile(this.historyPath, 'utf8');
      const history = JSON.parse(data);
      return history.slice(-limit);
    } catch {
      return [];
    }
  }

  async bulkUpdate(updates) {
    if (!this.rates) await this.loadRates();

    const results = [];

    for (const update of updates) {
      const result = await this.updateRate(
        update.currency,
        update.type,
        update.value
      );
      results.push(result);
    }

    return results;
  }

  getRate(currency) {
    if (!this.rates) return null;

    const currencyUpper = currency.toUpperCase();
    return this.rates.currencies[currencyUpper] || null;
  }

  getAllRates() {
    return this.rates;
  }

  async getStatistics() {
    const history = await this.getHistory(50);

    if (history.length === 0) {
      return 'Nenhum histórico disponível';
    }

    const stats = {};

    history.forEach(record => {
      if (!stats[record.currency]) {
        stats[record.currency] = {
          updates: 0,
          avgChange: 0,
          lastUpdate: record.timestamp
        };
      }

      stats[record.currency].updates++;
      stats[record.currency].avgChange += parseFloat(record.change);
      stats[record.currency].lastUpdate = record.timestamp;
    });

    let message = '📊 *ESTATÍSTICAS DE TAXAS*\n\n';

    for (const [currency, data] of Object.entries(stats)) {
      data.avgChange = (data.avgChange / data.updates).toFixed(2);
      const currencyData = this.rates.currencies[currency];

      message += `${currencyData.emoji} *${currencyData.name}*\n`;
      message += `• Atualizações: ${data.updates}\n`;
      message += `• Variação média: ${data.avgChange}%\n`;
      message += `• Última atualização: ${formatDate(new Date(data.lastUpdate))}\n\n`;
    }

    return message;
  }

  formatRatesMessage() {
    if (!this.rates) return 'Taxas não disponíveis';

    let message = '💱 *TAXAS ATUAIS*\n\n';

    for (const [code, currency] of Object.entries(this.rates.currencies)) {
      message += `${currency.emoji} *${currency.name}*\n`;
      message += `Compra: ${formatCurrency(currency.buy)} | Venda: ${formatCurrency(currency.sell)}\n\n`;
    }

    message += `_Última atualização: ${formatDate(new Date(this.rates.lastUpdate))}_`;

    return message;
  }
}

module.exports = RatesManager;
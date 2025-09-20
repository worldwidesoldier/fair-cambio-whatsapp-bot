const fs = require('fs').promises;
const path = require('path');

class RatesManager {
  constructor() {
    this.ratesPath = path.join(__dirname, '../config/rates.json');
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
      // Rates padrão se não conseguir carregar
      this.rates = {
        currencies: {
          USD: { name: 'Dólar Americano', emoji: '💵', buy: 5.15, sell: 5.25 },
          EUR: { name: 'Euro', emoji: '💶', buy: 5.45, sell: 5.55 }
        },
        lastUpdate: new Date().toISOString()
      };
      return this.rates;
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

    if (await this.saveRates()) {
      return {
        success: true,
        message: `✅ Taxa atualizada com sucesso!\\n\\n${this.rates.currencies[currencyUpper].emoji} *${this.rates.currencies[currencyUpper].name}*\\n${type === 'buy' ? 'Compra' : 'Venda'}: R$ ${oldValue} → R$ ${value}`
      };
    }

    return {
      success: false,
      message: 'Erro ao salvar as taxas'
    };
  }

  getAllRates() {
    return this.rates;
  }

  formatRatesMessage() {
    if (!this.rates) return 'Taxas não disponíveis';

    let message = '💱 *TAXAS ATUAIS*\\n\\n';

    for (const [code, currency] of Object.entries(this.rates.currencies)) {
      message += `${currency.emoji} *${currency.name}*\\n`;
      message += `Compra: R$ ${currency.buy.toFixed(2)} | Venda: R$ ${currency.sell.toFixed(2)}\\n\\n`;
    }

    const lastUpdate = new Date(this.rates.lastUpdate);
    message += `_Última atualização: ${lastUpdate.toLocaleString('pt-BR')}_`;

    return message;
  }
}

module.exports = RatesManager;
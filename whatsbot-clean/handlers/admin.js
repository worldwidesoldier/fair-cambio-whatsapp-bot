const RatesManager = require('./rates');

class AdminHandler {
  constructor() {
    this.ratesManager = new RatesManager();
    this.adminNumbers = (process.env.ADMIN_NUMBERS || '').split(',').map(n => n.trim());

    this.commands = {
      '/atualizar': this.updateRate.bind(this),
      '/taxas': this.showRates.bind(this),
      '/estatisticas': this.showStatistics.bind(this),
      '/ajuda': this.showHelp.bind(this)
    };
  }

  isAdmin(phoneNumber) {
    const cleanNumber = phoneNumber.replace('@s.whatsapp.net', '').replace(/\\D/g, '');
    return this.adminNumbers.some(admin => {
      const cleanAdmin = admin.replace(/\\D/g, '');
      return cleanNumber === cleanAdmin || cleanNumber.endsWith(cleanAdmin);
    });
  }

  async handleCommand(message, phoneNumber) {
    if (!this.isAdmin(phoneNumber)) {
      return null;
    }

    const text = message.trim();
    const [command, ...args] = text.split(' ');
    const commandLower = command.toLowerCase();

    if (this.commands[commandLower]) {
      return await this.commands[commandLower](args, phoneNumber);
    }

    return null;
  }

  async updateRate(args) {
    if (args.length < 3) {
      return '❌ Formato incorreto!\\n\\nUse: /atualizar [moeda] [tipo] [valor]\\n\\nExemplo:\\n/atualizar USD compra 5.20\\n/atualizar EUR venda 6.15';
    }

    const [currency, type, value] = args;
    const typeMap = { 'compra': 'buy', 'venda': 'sell', 'buy': 'buy', 'sell': 'sell' };
    const mappedType = typeMap[type.toLowerCase()];

    if (!mappedType) {
      return '❌ Tipo inválido! Use "compra" ou "venda"';
    }

    const numValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) {
      return '❌ Valor inválido! Digite um número positivo';
    }

    const result = await this.ratesManager.updateRate(currency.toUpperCase(), mappedType, numValue);
    return result.message;
  }

  async showRates() {
    await this.ratesManager.loadRates();
    return this.ratesManager.formatRatesMessage();
  }

  async showStatistics() {
    return '📊 *ESTATÍSTICAS*\\n\\nRecurso em desenvolvimento...';
  }

  showHelp() {
    return `🔧 *COMANDOS ADMINISTRATIVOS*

📊 *Gestão de Taxas:*
/atualizar [moeda] [tipo] [valor] - Atualiza taxa
/taxas - Mostra todas as taxas atuais
/estatisticas - Estatísticas de variação

🔧 *Sistema:*
/ajuda - Mostra este menu

*Exemplos:*
/atualizar USD compra 5.20
/atualizar EUR venda 6.15`;
  }
}

module.exports = AdminHandler;
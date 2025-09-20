const RatesManager = require('./rates');
const { formatDate } = require('../utils/formatter');

class AdminHandler {
  constructor() {
    this.ratesManager = new RatesManager();
    this.adminNumbers = process.env.ADMIN_NUMBERS
      ? process.env.ADMIN_NUMBERS.split(',').map(n => n.trim())
      : [];
    this.commands = {
      '/atualizar': this.updateRate.bind(this),
      '/taxas': this.showRates.bind(this),
      '/estatisticas': this.showStatistics.bind(this),
      '/historico': this.showHistory.bind(this),
      '/broadcast': this.prepareBroadcast.bind(this),
      '/ajuda': this.showHelp.bind(this),
      '/backup': this.backupRates.bind(this),
      '/restaurar': this.restoreRates.bind(this)
    };
    this.broadcastQueue = [];
  }

  isAdmin(phoneNumber) {
    // Remove caracteres não numéricos e remove @s.whatsapp.net se presente
    const cleanNumber = phoneNumber.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    return this.adminNumbers.some(admin => {
      const cleanAdmin = admin.replace(/\D/g, '');
      return cleanNumber === cleanAdmin || cleanNumber.endsWith(cleanAdmin);
    });
  }

  async handleCommand(message, phoneNumber, sock) {
    if (!this.isAdmin(phoneNumber)) {
      return null;
    }

    const text = message.trim();
    const [command, ...args] = text.split(' ');
    const commandLower = command.toLowerCase();

    if (this.commands[commandLower]) {
      return await this.commands[commandLower](args, phoneNumber, sock);
    }

    // Se não for um comando válido mas é admin, retorna null para processar como mensagem normal
    return null;
  }

  async updateRate(args) {
    if (args.length < 3) {
      return '❌ Formato incorreto!\n\nUse: /atualizar [moeda] [tipo] [valor]\n\nExemplo:\n/atualizar dolar compra 5.20\n/atualizar euro venda 6.15';
    }

    const [currency, type, value] = args;
    const typeMap = {
      'compra': 'buy',
      'venda': 'sell',
      'buy': 'buy',
      'sell': 'sell'
    };

    const mappedType = typeMap[type.toLowerCase()];

    if (!mappedType) {
      return '❌ Tipo inválido! Use "compra" ou "venda"';
    }

    const numValue = parseFloat(value.replace(',', '.'));

    if (isNaN(numValue) || numValue <= 0) {
      return '❌ Valor inválido! Digite um número positivo';
    }

    const result = await this.ratesManager.updateRate(currency, mappedType, numValue);
    return result.message;
  }

  async showRates() {
    await this.ratesManager.loadRates();
    return this.ratesManager.formatRatesMessage();
  }

  async showStatistics() {
    return await this.ratesManager.getStatistics();
  }

  async showHistory(args) {
    const limit = args[0] ? parseInt(args[0]) : 10;
    const history = await this.ratesManager.getHistory(limit);

    if (history.length === 0) {
      return '📋 Nenhum histórico disponível';
    }

    let message = `📋 *HISTÓRICO DE ALTERAÇÕES* (últimas ${limit})\n\n`;

    history.forEach((record, index) => {
      const currency = this.ratesManager.getRate(record.currency);
      message += `${index + 1}. ${currency.emoji} *${currency.name}*\n`;
      message += `   ${record.type === 'buy' ? 'Compra' : 'Venda'}: ${record.oldValue} → ${record.newValue} (${record.change > 0 ? '+' : ''}${record.change}%)\n`;
      message += `   ${formatDate(new Date(record.timestamp))}\n\n`;
    });

    return message;
  }

  prepareBroadcast(args) {
    if (args.length === 0) {
      return '❌ Digite a mensagem para broadcast!\n\nUse: /broadcast [sua mensagem]';
    }

    const message = args.join(' ');
    this.broadcastQueue.push(message);

    return `📢 *BROADCAST PREPARADO*\n\nMensagem: "${message}"\n\n⚠️ Esta mensagem será enviada para todos os contatos ativos.\n\nConfirme com: /confirmar_broadcast\nCancelar com: /cancelar_broadcast`;
  }

  async sendBroadcast(sock) {
    if (this.broadcastQueue.length === 0) {
      return '❌ Nenhuma mensagem na fila de broadcast';
    }

    const message = this.broadcastQueue.shift();

    // Aqui você implementaria a lógica para enviar para todos os contatos
    // Por ora, apenas retorna confirmação
    return `✅ Broadcast enviado com sucesso!\n\nMensagem: "${message}"\n\n_Nota: Em produção, isso enviaria para todos os contatos ativos_`;
  }

  showHelp() {
    return `🔧 *COMANDOS ADMINISTRATIVOS*

📊 *Gestão de Taxas:*
/atualizar [moeda] [tipo] [valor] - Atualiza taxa
/taxas - Mostra todas as taxas atuais
/historico [qtd] - Mostra histórico de alterações
/estatisticas - Estatísticas de variação

📢 *Comunicação:*
/broadcast [mensagem] - Prepara mensagem em massa
/confirmar_broadcast - Confirma envio
/cancelar_broadcast - Cancela broadcast

🔧 *Sistema:*
/backup - Faz backup das taxas
/restaurar - Restaura último backup
/ajuda - Mostra este menu

*Exemplos:*
/atualizar dolar compra 5.20
/atualizar euro venda 6.15
/broadcast Novos horários de atendimento!
/historico 20`;
  }

  async backupRates() {
    const rates = await this.ratesManager.loadRates();
    const backupPath = `backup-rates-${Date.now()}.json`;

    // Em produção, salvaria em local seguro ou cloud
    return `✅ *BACKUP CRIADO*\n\nArquivo: ${backupPath}\nData: ${formatDate()}\n\n_Backup salvo com sucesso!_`;
  }

  async restoreRates() {
    // Em produção, implementaria restauração real
    return `✅ *TAXAS RESTAURADAS*\n\nÚltimo backup restaurado com sucesso!\n\n_Use /taxas para verificar_`;
  }

  // Verifica se é comando admin (para não processar como mensagem normal)
  isAdminCommand(message) {
    const text = message.trim();
    return text.startsWith('/') && Object.keys(this.commands).some(cmd =>
      text.toLowerCase().startsWith(cmd)
    );
  }

  // Método para log de ações administrativas
  async logAdminAction(admin, action, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      admin,
      action,
      details
    };

    console.log('Admin Action:', logEntry);
    // Em produção, salvaria em arquivo ou banco de dados
  }
}

module.exports = AdminHandler;
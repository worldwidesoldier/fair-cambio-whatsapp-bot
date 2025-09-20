const rates = require('../config/rates.json');

class MenuHandler {
  constructor() {
    this.userStates = new Map();
    this.userSessions = new Map();
    this.sessionTimeout = 10 * 60 * 1000; // 10 minutos
    this.botInstance = null;
  }

  setBotInstance(bot) {
    this.botInstance = bot;
  }

  getUserState(userId) {
    return this.userStates.get(userId) || { stage: 'initial', data: {} };
  }

  setUserState(userId, state) {
    this.userStates.set(userId, state);
  }

  clearUserState(userId) {
    this.userStates.delete(userId);
  }

  updateSession(userId) {
    this.userSessions.set(userId, {
      lastActivity: Date.now(),
      hasSeenMenu: this.userSessions.get(userId)?.hasSeenMenu || false
    });
  }

  isSessionActive(userId) {
    const session = this.userSessions.get(userId);
    if (!session) return false;

    const now = Date.now();
    const isActive = (now - session.lastActivity) < this.sessionTimeout;

    if (!isActive) {
      this.userSessions.delete(userId);
      this.clearUserState(userId);
    }

    return isActive;
  }

  shouldShowMenu(userId) {
    if (!this.isSessionActive(userId)) return true;
    const session = this.userSessions.get(userId);
    return !session.hasSeenMenu;
  }

  markMenuAsSeen(userId) {
    const session = this.userSessions.get(userId) || {};
    this.userSessions.set(userId, {
      ...session,
      lastActivity: Date.now(),
      hasSeenMenu: true
    });
  }

  async handleMessage(message, userId) {
    const text = message.toLowerCase().trim();
    const userState = this.getUserState(userId);

    this.updateSession(userId);

    // Cálculo em andamento
    if (userState.stage === 'calculating') {
      return this.handleCalculation(text, userId, userState);
    }

    // Comandos numéricos do menu
    if (/^[1-6]$/.test(text)) {
      return this.handleMenuOption(parseInt(text));
    }

    // Palavras-chave para menu/saudação
    const menuKeywords = ['menu', 'inicio', 'oi', 'olá', 'bom dia', 'boa tarde', 'boa noite'];
    if (menuKeywords.some(word => text.includes(word))) {
      if (this.shouldShowMenu(userId)) {
        this.markMenuAsSeen(userId);
        return this.createMenuMessage();
      } else {
        return "👋 Como posso ajudar?\\n\\n💡 _Digite o número da opção desejada (1-6)_";
      }
    }

    // Palavras-chave específicas
    const ratesKeywords = ['cotação', 'taxa', 'câmbio', 'valor'];
    if (ratesKeywords.some(word => text.includes(word))) {
      return this.createRatesMessage();
    }

    const locationKeywords = ['endereço', 'localização', 'onde'];
    if (locationKeywords.some(word => text.includes(word))) {
      return this.createLocationMessage();
    }

    const hoursKeywords = ['horário', 'funcionamento', 'abre'];
    if (hoursKeywords.some(word => text.includes(word))) {
      return this.createHoursMessage();
    }

    // Resposta padrão
    if (this.shouldShowMenu(userId)) {
      this.markMenuAsSeen(userId);
      return this.createMenuMessage();
    }

    return "❓ Não entendi. Digite o número da opção desejada (1-6) ou 'menu' para ver as opções.";
  }

  handleMenuOption(option) {
    switch (option) {
      case 1: return this.createRatesMessage();
      case 2: return this.createHoursMessage();
      case 3: return this.createLocationMessage();
      case 4: return this.createDocumentsMessage();
      case 5: return this.createProcessMessage();
      case 6: return this.createContactMessage();
      default: return "❌ Opção inválida. Digite um número de 1 a 6.";
    }
  }

  handleCalculation(text, userId, userState) {
    // Implementação simplificada da calculadora
    const { step } = userState;

    switch (step) {
      case 'selectCurrency':
        const currencyIndex = parseInt(text) - 1;
        const currencies = Object.entries(rates.currencies);

        if (currencyIndex >= 0 && currencyIndex < currencies.length) {
          const [code, currency] = currencies[currencyIndex];
          userState.data.currencyCode = code;
          userState.data.currency = currency;
          userState.step = 'selectOperation';
          this.setUserState(userId, userState);

          return `Você selecionou: ${currency.emoji} *${currency.name}*\\n\\nDeseja:\\n1. Comprar ${currency.name}\\n2. Vender ${currency.name}\\n\\nDigite 1 ou 2:`;
        }
        return `Opção inválida. Digite um número entre 1 e ${currencies.length}.`;

      case 'selectOperation':
        if (text === '1' || text === '2') {
          userState.data.operation = text === '1' ? 'buy' : 'sell';
          userState.step = 'enterAmount';
          this.setUserState(userId, userState);

          const operationType = text === '1' ? 'comprar' : 'vender';
          return `Digite o valor em ${userState.data.currency.name} que deseja ${operationType}:\\n\\n_Exemplo: 100 ou 1500.50_`;
        }
        return 'Digite 1 para comprar ou 2 para vender.';

      case 'enterAmount':
        const amount = parseFloat(text.replace(',', '.'));

        if (!isNaN(amount) && amount > 0) {
          const { currency, operation } = userState.data;
          const rate = operation === 'buy' ? currency.buy : currency.sell;
          const result = amount * rate;

          this.clearUserState(userId);

          const operationType = operation === 'buy' ? 'Compra' : 'Venda';
          return `💱 *RESULTADO DO CÂMBIO*\\n\\n${currency.emoji} ${currency.name}\\n${operationType}: ${amount.toFixed(2)}\\n\\n💰 Valor em Reais: R$ ${result.toFixed(2)}\\n\\n_Taxa utilizada: R$ ${rate.toFixed(2)}_\\n\\nDigite *MENU* para voltar ao menu principal.`;
        }
        return 'Por favor, digite um valor numérico válido.\\nExemplo: 100 ou 1500.50';

      default:
        this.clearUserState(userId);
        return this.createMenuMessage();
    }
  }

  createMenuMessage() {
    return `🏦 *FAIR CÂMBIO* - Menu Principal

Escolha uma opção:

1️⃣ *Cotações* - Taxas atuais
2️⃣ *Horários* - Funcionamento
3️⃣ *Endereços* - Nossas lojas
4️⃣ *Documentos* - O que levar
5️⃣ *Como comprar* - Processo
6️⃣ *Contato* - Falar conosco

_Digite o número da opção desejada_`;
  }

  createRatesMessage() {
    let message = '💱 *COTAÇÕES ATUAIS*\\n\\n';

    for (const [code, currency] of Object.entries(rates.currencies)) {
      message += `${currency.emoji} *${currency.name}*\\n`;
      message += `Compra: R$ ${currency.buy.toFixed(2)} | Venda: R$ ${currency.sell.toFixed(2)}\\n\\n`;
    }

    const lastUpdate = new Date(rates.lastUpdate);
    message += `_Última atualização: ${lastUpdate.toLocaleString('pt-BR')}_\\n\\n`;
    message += '💡 _Digite MENU para voltar ou o número de outra opção_';

    return message;
  }

  createHoursMessage() {
    return `⏰ *HORÁRIOS DE FUNCIONAMENTO*

📅 *Segunda a Sexta:*
🕘 09:00 às 18:00

📅 *Sábados:*
🕘 09:00 às 14:00

📅 *Domingos:*
❌ Fechado

⚠️ *Importante:*
• Consulte disponibilidade antes de se deslocar
• Valores altos podem precisar ser encomendados

💡 _Digite MENU para voltar ou o número de outra opção_`;
  }

  createLocationMessage() {
    return `📍 *NOSSAS LOJAS*

🏢 *Loja Centro*
📍 Rua das Flores, 123 - Centro
🚗 Estacionamento próprio

🏢 *Loja Shopping*
📍 Shopping Mall - Loja 45
🛒 Praça de alimentação

📞 *Contato:*
☎️ (11) 9999-9999

🚗 *Facilidades:*
• Estacionamento gratuito
• Fácil acesso ao transporte público

💡 _Digite MENU para voltar ou o número de outra opção_`;
  }

  createDocumentsMessage() {
    return `📄 *DOCUMENTOS NECESSÁRIOS*

✅ **Obrigatórios:**
• RG ou CNH (original com foto)
• CPF
• Comprovante de residência (últimos 90 dias)

📋 **Para valores acima de R$ 10.000:**
• Comprovante de renda
• Declaração de origem dos recursos

⚠️ **Importante:**
• Documentos devem estar dentro da validade
• Não aceitamos cópias simples
• Pessoa física apenas

💡 _Digite MENU para voltar ou o número de outra opção_`;
  }

  createProcessMessage() {
    return `🛒 *COMO FUNCIONA A COMPRA*

*Passo a passo:*

*1️⃣ Consulte nossa cotação*
Digite *1* para ver as taxas atuais

*2️⃣ Traga seus documentos*
Digite *4* para ver a lista completa

*3️⃣ Venha até nossa loja*
Digite *3* para ver nossas localizações

*4️⃣ Finalização*
• Preenchimento de declaração
• Pagamento em dinheiro ou cartão
• Recebimento da moeda

⏱️ **Tempo médio:** 10-15 minutos

💡 _Digite MENU para voltar ou o número de outra opção_`;
  }

  createContactMessage() {
    return `📞 *FALE CONOSCO*

☎️ **Telefone:**
(11) 9999-9999

💬 **WhatsApp:**
Este mesmo número!

⏰ **Atendimento:**
Segunda a Sexta: 09:00 às 18:00
Sábado: 09:00 às 14:00

📧 **Email:**
contato@faircambio.com.br

🌐 **Site:**
www.faircambio.com.br

💡 _Digite MENU para voltar ou o número de outra opção_`;
  }
}

module.exports = MenuHandler;
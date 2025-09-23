const rates = require('../config/rates.json');
const branches = require('../config/branches');
const {
  createMenuMessage,
  createRateMessage,
  createAllRatesMessage,
  createLocationMessage,
  createDocumentsMessage,
  createHoursMessage,
  createWelcomeMessage,
  createCalculationMessage,
  createErrorMessage,
  createAttendantMessage,
  calculateExchange,
  addMenuFooter
} = require('../utils/formatter');

class MenuHandler {
  constructor(branchConfig = null) {
    this.branchConfig = branchConfig;
    this.userStates = new Map();
    this.userSessions = new Map(); // Controle de sessões com timestamp
    this.sessionTimeout = 10 * 60 * 1000; // 10 minutos em milliseconds
    this.attendantQueue = new Map(); // Usuários aguardando atendimento
    this.humanHandoff = new Map(); // Usuários em atendimento humano
    this.reminderIntervals = new Map(); // Intervalos de lembrete
    this.botInstance = null; // Referência para a instância do bot
    this.keywords = {
      menu: ['menu', 'inicio', 'começar', 'start', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'],
      rates: ['cotação', 'cotacao', 'cotaçao', 'taxa', 'cambio', 'câmbio', 'valor', 'preço', 'preco'],
      dollar: ['dolar', 'dólar', 'dollar', 'usd', 'dolares', 'dólares'],
      euro: ['euro', 'euros', 'eur'],
      location: ['endereço', 'endereco', 'localização', 'localizacao', 'onde', 'filial', 'filiais', 'unidade'],
      hours: ['horário', 'horario', 'funcionamento', 'aberto', 'abre', 'fecha', 'atendimento'],
      documents: ['documento', 'documentos', 'documentação', 'documentacao', 'preciso', 'necessário'],
      attendant: ['atendente', 'humano', 'pessoa', 'falar', 'conversar', 'ajuda', 'suporte'],
      calculate: ['calcular', 'converter', 'conversão', 'conversao', 'quanto'],
      wait: ['aguardar', 'aguardo', 'esperar', 'espero']
    };
  }

  setBotInstance(botInstance) {
    this.botInstance = botInstance;
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

  // Gerenciamento de sessões
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

  updateSession(userId) {
    this.userSessions.set(userId, {
      lastActivity: Date.now(),
      hasSeenMenu: this.userSessions.get(userId)?.hasSeenMenu || false
    });
  }

  markMenuAsSeen(userId) {
    const session = this.userSessions.get(userId) || {};
    this.userSessions.set(userId, {
      ...session,
      lastActivity: Date.now(),
      hasSeenMenu: true
    });
  }

  shouldShowMenu(userId) {
    if (!this.isSessionActive(userId)) {
      return true; // Nova sessão, mostrar menu
    }

    const session = this.userSessions.get(userId);
    return !session.hasSeenMenu; // Só mostra se ainda não viu o menu
  }

  async handleMessage(message, userId, branchConfig = null, botInstance = null) {
    const currentBranch = branchConfig || this.branchConfig;
    const text = message.toLowerCase().trim();
    const userState = this.getUserState(userId);

    // Verifica se usuário está em atendimento humano
    if (this.humanHandoff.has(userId)) {
      // Usuário está em atendimento humano, bot não responde
      return null;
    }

    // Atualiza sessão do usuário
    this.updateSession(userId);

    // Verifica se usuário digitou "aguardar" - prioridade máxima
    if (this.keywords.wait.some(word => text.includes(word))) {
      return this.handleWaitRequest(userId, message, currentBranch, botInstance);
    }

    // Verifica se está em processo de cálculo
    if (userState.stage === 'calculating') {
      return this.handleCalculation(text, userId, userState, currentBranch);
    }

    // Verifica comandos numéricos do menu
    if (/^[1-6]$/.test(text)) {
      return this.handleMenuOption(parseInt(text), userId, currentBranch);
    }

    // Verifica outras palavras-chave específicas ANTES do menu
    for (const [category, words] of Object.entries(this.keywords)) {
      if (category !== 'menu' && category !== 'wait' && words.some(word => text.includes(word))) {
        return this.handleKeyword(category, userId, currentBranch);
      }
    }

    // QUALQUER OUTRA MENSAGEM = MENU PRINCIPAL
    // Não há mais mensagem de boas-vindas, sempre mostra o menu
    this.markMenuAsSeen(userId);
    return createMenuMessage(currentBranch);
  }

  handleMenuOption(option, userId, branchConfig = null) {
    const currentBranch = branchConfig || this.branchConfig;

    switch (option) {
      case 1:
        return addMenuFooter(createAllRatesMessage(rates, currentBranch));

      case 2:
        return addMenuFooter(createHoursMessage(currentBranch));

      case 3:
        return addMenuFooter(createLocationMessage(this.getBranchLocations(currentBranch)));

      case 4:
        return addMenuFooter(createDocumentsMessage(currentBranch));

      case 5:
        return addMenuFooter(this.createPurchaseProcessMessage(currentBranch));

      case 6:
        return this.createPhoneContactMessage(currentBranch);

      default:
        return addMenuFooter(createErrorMessage());
    }
  }

  handleKeyword(category, userId, branchConfig = null) {
    const currentBranch = branchConfig || this.branchConfig;

    switch (category) {
      case 'menu':
        return createMenuMessage(currentBranch); // Menu principal não precisa de footer

      case 'rates':
        return addMenuFooter(createAllRatesMessage(rates, currentBranch));

      case 'dollar':
        return addMenuFooter(createRateMessage(rates.currencies.USD, rates, currentBranch));

      case 'euro':
        return addMenuFooter(createRateMessage(rates.currencies.EUR, rates, currentBranch));

      case 'location':
        return addMenuFooter(createLocationMessage(this.getBranchLocations(currentBranch)));

      case 'hours':
        return addMenuFooter(createHoursMessage(currentBranch));

      case 'documents':
        return addMenuFooter(createDocumentsMessage(currentBranch));

      case 'attendant':
        return addMenuFooter(createAttendantMessage(currentBranch));

      case 'calculate':
        this.setUserState(userId, {
          stage: 'calculating',
          step: 'selectCurrency',
          data: { branchConfig: currentBranch }
        });
        return addMenuFooter(this.getCalculationMenu(currentBranch));

      default:
        return addMenuFooter(createErrorMessage());
    }
  }

  getBranchLocations(branchConfig) {
    if (branchConfig) {
      // Se é uma filial específica, mostra apenas ela
      return [{
        id: branchConfig.id,
        name: branchConfig.name,
        address: branchConfig.address,
        hours: branchConfig.hours,
        maps: branchConfig.maps,
        region: branchConfig.region,
        manager: branchConfig.manager,
        active: branchConfig.active
      }];
    }

    // Caso contrário, mostra todas as filiais
    return branches.getAllLocations();
  }

  getCalculationMenu(branchConfig = null) {
    const currentBranch = branchConfig || this.branchConfig;
    let message = '💱 *CALCULADORA DE CÂMBIO*\n';

    if (currentBranch) {
      message += `📍 ${currentBranch.name}\n`;
    }

    message += '\nEscolha a moeda:\n\n';

    const currencies = Object.entries(rates.currencies);
    currencies.forEach(([code, currency], index) => {
      message += `${index + 1}. ${currency.emoji} ${currency.name}\n`;
    });

    message += '\nDigite o número da moeda desejada:';
    return message;
  }

  handleCalculation(text, userId, userState, branchConfig = null) {
    const { step, data } = userState;
    const currentBranch = branchConfig || data.branchConfig || this.branchConfig;

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

          return `Você selecionou: ${currency.emoji} *${currency.name}*\n\nDeseja:\n1. Comprar ${currency.name}\n2. Vender ${currency.name}\n\nDigite 1 ou 2:`;
        }
        return `Opção inválida. Digite um número entre 1 e ${currencies.length}.`;

      case 'selectOperation':
        if (text === '1' || text === '2') {
          userState.data.operation = text === '1' ? 'buy' : 'sell';
          userState.step = 'enterAmount';
          this.setUserState(userId, userState);

          const operationType = text === '1' ? 'comprar' : 'vender';
          return `Digite o valor em ${userState.data.currency.name} que deseja ${operationType}:\n\n_Exemplo: 100 ou 1500.50_`;
        }
        return 'Digite 1 para comprar ou 2 para vender.';

      case 'enterAmount':
        const amount = parseFloat(text.replace(',', '.'));

        if (!isNaN(amount) && amount > 0) {
          const { currency, operation } = userState.data;
          const rate = operation === 'buy' ? currency.buy : currency.sell;
          const result = calculateExchange(amount, rate, operation);

          this.clearUserState(userId);

          return createCalculationMessage(
            amount,
            currency,
            { symbol: 'R$', name: 'Real' },
            result,
            operation
          ) + '\n\nDigite *MENU* para voltar ao menu principal.';
        }
        return 'Por favor, digite um valor numérico válido.\nExemplo: 100 ou 1500.50';

      default:
        this.clearUserState(userId);
        return createMenuMessage();
    }
  }

  isFirstInteraction(userId) {
    return !this.userStates.has(userId);
  }

  handleFirstInteraction(userId, userName, branchConfig = null) {
    const currentBranch = branchConfig || this.branchConfig;
    this.setUserState(userId, { stage: 'initial', data: { branchConfig: currentBranch } });
    return createMenuMessage(currentBranch); // Vai direto para o menu, sem boas-vindas
  }

  createMenuMessage(branchConfig = null) {
    const currentBranch = branchConfig || this.branchConfig;
    return createMenuMessage(currentBranch);
  }

  createPurchaseProcessMessage(branchConfig = null) {
    let message = `🛒 *COMO FUNCIONA A COMPRA*\n`;

    if (branchConfig) {
      message += `🏢 ${branchConfig.name}\n`;
    }

    message += `
*Passo a passo para comprar moeda estrangeira:*

*1️⃣ Consulte nossa cotação*
Digite *1* para ver as taxas atuais

*2️⃣ Traga seus documentos*
• RG ou CNH (documento com foto)
• CPF
• Comprovante de residência (últimos 90 dias)

*3️⃣ Venha até nossa loja*
Digite *3* para ver nossas localizações

*4️⃣ Finalização*
• Preenchimento de declaração
• Pagamento em dinheiro ou cartão
• Recebimento da moeda

⚠️ *Importante:*
• Valores acima de R$ 10.000 requerem comprovação de origem
• Consulte disponibilidade antes de se deslocar
• Atendimento de segunda a sábado

📞 Dúvidas? Digite *6* para falar com um atendente!`;

    return message;
  }

  createPhoneContactMessage(branchConfig = null) {
    const currentBranch = branchConfig || this.branchConfig;

    if (!currentBranch) {
      return addMenuFooter("📞 Entre em contato conosco pelo telefone para atendimento personalizado!");
    }

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const isBusinessHours = this.isWithinBusinessHours(currentBranch, hour, day);

    // Formatar telefone para exibição
    const formattedPhone = this.formatPhoneForDisplay(currentBranch.phone);

    let message = `📞 *FALE CONOSCO AGORA!*\n\n`;
    message += `🏢 **${currentBranch.name}**\n`;
    message += `☎️ **Telefone: ${formattedPhone}**\n\n`;

    if (isBusinessHours) {
      message += `🟢 *Estamos ONLINE e prontos para te atender!*\n\n`;
    } else {
      message += `🔴 *No momento estamos fechados*\n\n`;
    }

    message += `⏰ **Nosso horário:**\n`;
    message += `• Segunda a Sexta: ${currentBranch.hours.weekdays}\n`;
    message += `• Sábado: ${currentBranch.hours.saturday}\n`;
    message += `• Domingo: ${currentBranch.hours.sunday}\n\n`;

    if (isBusinessHours) {
      message += `📱 *Ligue agora e fale diretamente conosco!*`;
    } else {
      message += `💡 **Enquanto isso:**\n`;
      message += `• Digite *1* para ver cotações atuais\n`;
      message += `• Digite *3* para nossos endereços\n`;
      message += `• Deixe sua mensagem que retornamos!\n\n`;
      message += `📱 *Ligue assim que abrirmos para atendimento imediato!*`;
    }

    return addMenuFooter(message);
  }

  isWithinBusinessHours(branchConfig, hour, day) {
    if (!branchConfig || !branchConfig.hours) return false;

    // Domingo = 0, Segunda = 1, ..., Sábado = 6
    if (day === 0) { // Domingo
      return branchConfig.hours.sunday !== 'Fechado' && this.checkHourRange(branchConfig.hours.sunday, hour);
    } else if (day === 6) { // Sábado
      return branchConfig.hours.saturday !== 'Fechado' && this.checkHourRange(branchConfig.hours.saturday, hour);
    } else { // Segunda a Sexta
      return this.checkHourRange(branchConfig.hours.weekdays, hour);
    }
  }

  checkHourRange(hourRange, currentHour) {
    if (!hourRange || hourRange === 'Fechado') return false;

    // Extrair horários do formato "09:00 às 18:00"
    const match = hourRange.match(/(\d{2}):(\d{2})\s+às\s+(\d{2}):(\d{2})/);
    if (!match) return false;

    const startHour = parseInt(match[1]);
    const endHour = parseInt(match[3]);

    return currentHour >= startHour && currentHour < endHour;
  }

  formatPhoneForDisplay(phone) {
    // Converter 559185001234 para (91) 8500-1234
    if (phone && phone.length >= 10) {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('55')) {
        // Remove o código do país (55)
        const withoutCountry = cleaned.substring(2);
        if (withoutCountry.length === 11) {
          // Formato: XX9XXXXXXXX
          const area = withoutCountry.substring(0, 2);
          const number = withoutCountry.substring(2);
          const first = number.substring(0, 5);
          const second = number.substring(5);
          return `(${area}) ${first}-${second}`;
        }
      }
    }
    return phone;
  }

  // Sistema de Handoff para Atendimento Humano
  async handleWaitRequest(userId, originalMessage, branchConfig = null, botInstance = null) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Verifica horário comercial
    const isBusinessHours = (
      (day >= 1 && day <= 5 && hour >= 9 && hour < 18) ||
      (day === 6 && hour >= 9 && hour < 14)
    );

    // Adiciona à fila de atendimento
    this.attendantQueue.set(userId, {
      timestamp: now,
      originalMessage: originalMessage,
      branchConfig: branchConfig,
      isBusinessHours: isBusinessHours
    });

    // Envia notificação para o próprio bot (atendente)
    if (botInstance) {
      this.sendAttendantNotification(userId, originalMessage, isBusinessHours, botInstance);
      this.startReminderInterval(userId, originalMessage, isBusinessHours, botInstance);
    }

    // Resposta para o cliente
    if (isBusinessHours) {
      return "✅ Solicitação enviada!\n\n⏱️ Um atendente irá falar com você em breve.\n\n💡 Aguarde aqui no chat que logo te atendo!";
    } else {
      return "✅ Mensagem registrada!\n\n🌙 Como estamos fora do horário, responderemos assim que abrirmos:\n⏰ Segunda a Sexta: 09:00 às 18:00\n⏰ Sábado: 09:00 às 14:00\n\n💡 Aguarde aqui no chat!";
    }
  }

  async sendAttendantNotification(userId, originalMessage, isBusinessHours, botInstance) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const situacao = isBusinessHours ? "Dentro do horário" : "Fora do horário";

    // Mascarar o número do cliente para privacidade
    const maskedNumber = userId.replace(/(\d{2})(\d{5})(\d{4})/, '+55 $1 $2-$3');

    const notificationMessage = `🚨 *CLIENTE AGUARDANDO ATENDIMENTO*

👤 Cliente: ${maskedNumber}
⏰ Solicitou: ${timeStr}
📍 Situação: ${situacao}
💬 Mensagem: "${originalMessage}"

⚡ *Responda aqui mesmo para atender!*
✋ Digite '/assumir ${userId}' para assumir o atendimento`;

    // Configuração dos números de atendentes (pode ser configurado)
    const attendantNumbers = [
      '559192000000@s.whatsapp.net' // Número principal do atendente
    ];

    // Envia para todos os números de atendentes
    if (botInstance && botInstance.sock) {
      for (const attendantNumber of attendantNumbers) {
        try {
          await botInstance.sock.sendMessage(attendantNumber, { text: notificationMessage });
        } catch (error) {
          console.error(`Erro ao enviar notificação para ${attendantNumber}:`, error);
        }
      }
    }
  }

  startReminderInterval(userId, originalMessage, isBusinessHours, botInstance) {
    // Limpa lembrete anterior se existir
    if (this.reminderIntervals.has(userId)) {
      clearInterval(this.reminderIntervals.get(userId));
    }

    // Cria novo lembrete a cada 15 segundos
    const interval = setInterval(async () => {
      // Verifica se ainda está na fila
      if (!this.attendantQueue.has(userId) || this.humanHandoff.has(userId)) {
        clearInterval(interval);
        this.reminderIntervals.delete(userId);
        return;
      }

      const timeWaiting = Math.floor((Date.now() - this.attendantQueue.get(userId).timestamp) / 1000 / 60);
      const maskedNumber = userId.replace(/(\d{2})(\d{5})(\d{4})/, '+55 $1 $2-$3');

      const reminderMessage = `⏰ *LEMBRETE - CLIENTE AGUARDANDO*

👤 ${maskedNumber}
⏱️ Aguardando há: ${timeWaiting} minuto(s)
💬 "${originalMessage}"

✋ Digite '/assumir ${userId}' para atender`;

      if (botInstance && botInstance.sock) {
        const attendantNumbers = [
          '559192000000@s.whatsapp.net' // Número principal do atendente
        ];

        for (const attendantNumber of attendantNumbers) {
          try {
            await botInstance.sock.sendMessage(attendantNumber, { text: reminderMessage });
          } catch (error) {
            console.error(`Erro ao enviar lembrete para ${attendantNumber}:`, error);
          }
        }
      }
    }, 15000); // 15 segundos

    this.reminderIntervals.set(userId, interval);
  }

  // Atendente assume o atendimento
  assumeAttendance(userId) {
    if (this.attendantQueue.has(userId)) {
      // Move da fila para atendimento ativo
      this.humanHandoff.set(userId, {
        startTime: Date.now(),
        originalRequest: this.attendantQueue.get(userId)
      });

      // Remove da fila
      this.attendantQueue.delete(userId);

      // Para os lembretes
      if (this.reminderIntervals.has(userId)) {
        clearInterval(this.reminderIntervals.get(userId));
        this.reminderIntervals.delete(userId);
      }

      return true;
    }
    return false;
  }

  // Atendente finaliza o atendimento
  finishAttendance(userId) {
    if (this.humanHandoff.has(userId)) {
      this.humanHandoff.delete(userId);
      return true;
    }
    return false;
  }

  // Verifica se mensagem é comando do atendente
  handleAttendantCommand(message, userId) {
    const text = message.toLowerCase().trim();

    if (text.startsWith('/assumir ')) {
      const clientId = text.replace('/assumir ', '');
      if (this.assumeAttendance(clientId)) {
        return `✅ Atendimento assumido para cliente ${clientId}.\n\n💬 Agora você está conversando diretamente com o cliente.\n\n⚠️ Digite '/finalizar ${clientId}' quando terminar.`;
      } else {
        return `❌ Cliente ${clientId} não encontrado na fila de atendimento.`;
      }
    }

    if (text.startsWith('/finalizar ')) {
      const clientId = text.replace('/finalizar ', '');
      if (this.finishAttendance(clientId)) {
        return `✅ Atendimento finalizado para cliente ${clientId}.\n\n🤖 Cliente retornou ao atendimento automático.`;
      } else {
        return `❌ Cliente ${clientId} não estava em atendimento humano.`;
      }
    }

    return null;
  }
}

module.exports = MenuHandler;
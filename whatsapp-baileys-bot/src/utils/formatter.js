const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (date = new Date()) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatPhoneNumber = (number) => {
  // Remove todos os caracteres não numéricos
  const cleaned = number.replace(/\D/g, '');

  // Adiciona 55 se não tiver código do país
  if (!cleaned.startsWith('55')) {
    return '55' + cleaned;
  }

  return cleaned;
};

const calculateExchange = (amount, rate, type = 'buy') => {
  if (type === 'buy') {
    // Cliente comprando moeda estrangeira
    return amount * rate;
  } else {
    // Cliente vendendo moeda estrangeira
    return amount / rate;
  }
};

const createMessageHeader = (branchConfig = null) => {
  if (branchConfig) {
    return `🏪 *${branchConfig.name}*\n📍 ${branchConfig.address}\n_Seu câmbio de confiança há 30 anos_\n\n`;
  }
  return `🏪 *FAIR CÂMBIO*\n_Seu câmbio de confiança há 30 anos_\n\n`;
};

const createMenuMessage = (branchConfig = null) => {
  let message = `👋 Como posso ajudar?

📋 Escolha uma opção:

💰 Taxas de hoje - Digite 1
🕐 Nossos horários - Digite 2
📍 Nossas localizações - Digite 3
📋 Documentos necessários - Digite 4
🛒 Como funciona a compra - Digite 5
👨‍💼 Falar com atendente - Digite 6

ou mande sua dúvida diretamente! 💬`;

  if (branchConfig) {
    message = `👋 Como posso ajudar?

📋 Escolha uma opção:

💰 Taxas de hoje - Digite 1
🕐 Nossos horários - Digite 2
📍 Nossas localizações - Digite 3
📋 Documentos necessários - Digite 4
🛒 Como funciona a compra - Digite 5
👨‍💼 Falar com atendente - Digite 6

ou mande sua dúvida diretamente! 💬`;
  }

  return message;
};

const createRateMessage = (currency, rates, branchConfig = null) => {
  const { name, symbol, buy, sell, emoji } = currency;

  let message = `${emoji} *COTAÇÃO ${name.toUpperCase()}*\n`;

  if (branchConfig) {
    message += `🏢 ${branchConfig.name}\n`;
  }

  message += `
💰 *Compra:* ${formatCurrency(buy)}
💸 *Venda:* ${formatCurrency(sell)}

_Última atualização: ${formatDate(new Date(rates.lastUpdate))}_

⚠️ *Importante:*
• Valores sujeitos a alteração
• Consulte disponibilidade
• Traga documento com foto

Digite *8* para calcular uma conversão`;

  return message;
};

const createAllRatesMessage = (rates, branchConfig = null) => {
  let message = '💱 *TODAS AS COTAÇÕES*\n';

  if (branchConfig) {
    message += `🏢 ${branchConfig.name}\n`;
  }

  message += '\n';

  for (const [code, currency] of Object.entries(rates.currencies)) {
    message += `${currency.emoji} *${currency.name}*\n`;
    message += `Compra: ${formatCurrency(currency.buy)} | Venda: ${formatCurrency(currency.sell)}\n\n`;
  }

  message += `_Atualizado em: ${formatDate(new Date(rates.lastUpdate))}_`;

  return message;
};

const createLocationMessage = (branches) => {
  let message = '📍 *NOSSAS LOCALIZAÇÕES*\n\n';

  branches.forEach((branch, index) => {
    message += `*${index + 1}. ${branch.name}*\n`;
    message += `📍 ${branch.address}\n`;
    message += `⏰ Seg-Sex: ${branch.hours.weekdays}\n`;
    message += `⏰ Sábado: ${branch.hours.saturday}\n`;
    message += `⏰ Domingo: ${branch.hours.sunday}\n`;
    // Usar googleMapsLink se disponível, senão usar maps
    const mapLink = branch.googleMapsLink || branch.maps;
    if (mapLink) {
      message += `🗺️ ${mapLink}\n`;
    }
    message += `\n`;
  });

  return message;
};

const createDocumentsMessage = (branchConfig = null) => {
  let message = `📄 *DOCUMENTOS NECESSÁRIOS*\n`;

  if (branchConfig) {
    message += `🏢 ${branchConfig.name}\n`;
  }

  message += `
Para realizar operações de câmbio, você precisará:

*Pessoa Física:*
✅ Documento de identidade com foto (RG ou CNH)
✅ CPF
✅ Comprovante de residência (últimos 90 dias)

*Pessoa Jurídica:*
✅ CNPJ
✅ Contrato Social
✅ Documento do representante legal
✅ Procuração (se aplicável)

*Valores acima de R$ 10.000:*
📌 Comprovante de origem dos recursos
📌 Declaração de propósito da operação

⚠️ *Importante:* Todos os documentos devem ser originais ou cópias autenticadas.`;

  return message;
};

const createHoursMessage = (branchConfig = null) => {
  if (branchConfig) {
    return `⏰ *HORÁRIOS DE FUNCIONAMENTO*

🏢 *${branchConfig.name}*
📍 ${branchConfig.address}

⏰ *Horários:*
• Segunda a Sexta: ${branchConfig.hours.weekdays}
• Sábado: ${branchConfig.hours.saturday}
• Domingo: ${branchConfig.hours.sunday}

📞 Telefone: ${branchConfig.phone}
👤 Gerente: ${branchConfig.manager}

📞 *Atendimento WhatsApp:*
Segunda a Sexta: 09:00 às 18:00
Sábado: 09:00 às 14:00

_Mensagens fora do horário serão respondidas no próximo dia útil_`;
  }

  return `⏰ *HORÁRIOS DE FUNCIONAMENTO*

*Unidade Centro (Matriz):*
Segunda a Sexta: 09:00 às 18:00
Sábado: 09:00 às 14:00
Domingo: Fechado

*Unidades Shopping:*
Segunda a Sábado: 10:00 às 22:00
Domingo: 14:00 às 20:00

*Unidade Aeroporto:*
Todos os dias: 06:00 às 22:00

📞 *Atendimento WhatsApp:*
Segunda a Sexta: 09:00 às 18:00
Sábado: 09:00 às 14:00

_Mensagens fora do horário serão respondidas no próximo dia útil_`;
};

const createWelcomeMessage = (userName = '', branchConfig = null) => {
  const greeting = getGreeting();
  const name = userName ? ` ${userName}` : '';

  let message = `${greeting}${name}! 👋\n`;

  if (branchConfig) {
    message += `\nBem-vindo à *${branchConfig.name}*!\n`;
    message += `📍 ${branchConfig.address}\n`;
    message += `📞 ${branchConfig.phone}\n`;
  } else {
    message += `\nBem-vindo à *FAIR CÂMBIO*!\n`;
  }

  message += `Como posso ajudar você hoje?\n\nDigite *MENU* para ver as opções disponíveis ou envie sua dúvida diretamente.`;

  return message;
};

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const createCalculationMessage = (amount, fromCurrency, toCurrency, result, type) => {
  const operation = type === 'buy' ? 'COMPRA' : 'VENDA';

  return `🧮 *CÁLCULO DE CONVERSÃO*

*Operação:* ${operation}
*Valor:* ${fromCurrency.symbol} ${amount.toFixed(2)}
*Moeda:* ${fromCurrency.name}

💰 *Resultado:* ${formatCurrency(result)}

_Este é um valor aproximado. O valor final pode variar de acordo com a disponibilidade e taxas administrativas._

📞 Para confirmar esta operação, entre em contato conosco!`;
};

const createErrorMessage = () => {
  return `❌ Desculpe, não entendi sua mensagem.

Digite *MENU* para ver as opções disponíveis ou envie:
• *cotação* - Ver todas as cotações
• *horário* - Nossos horários
• *endereço* - Nossas localizações
• *documento* - Documentos necessários
• *atendente* - Falar com um atendente`;
};

const createAttendantMessage = (branchConfig = null) => {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday

  // Business hours: Mon-Fri 9-18, Sat 9-14
  const isBusinessHours = (
    (day >= 1 && day <= 5 && hour >= 9 && hour < 18) || // Mon-Fri 9-18
    (day === 6 && hour >= 9 && hour < 14) // Saturday 9-14
  );

  const phone = branchConfig?.phone || '(91) 3333-4444';
  const phoneNumber = branchConfig?.phone?.replace(/\D/g, '') || '5591333344444';

  if (isBusinessHours) {
    let message = `🙋‍♂️ Posso conectar você com um atendente agora!

Opção 1 (Ligar):
📞 Clique para ligar agora:
tel:+${phoneNumber}

Ou disque: ${phone}

Opção 2 (WhatsApp):
📱 Clique para ligar pelo WhatsApp:
https://wa.me/${phoneNumber}

Opção 3 (Aguardar no chat):
💬 Digite 'aguardar' para falar comigo aqui`;
    return message;
  } else {
    let message = `🌙 *ATENDIMENTO FORA DO HORÁRIO*\n\n⏰ Estaremos disponíveis:\nSegunda a Sexta: 09:00 às 18:00\nSábado: 09:00 às 14:00\n\nVocê pode:\n📞 Ligar amanhã: ${phone}\n💬 Deixar mensagem (responderemos no próximo horário)`;
    return message;
  }
};

const addMenuFooter = (message) => {
  return message + `\n\n💡 _Digite 'menu' para voltar às opções principais_`;
};

module.exports = {
  formatCurrency,
  formatDate,
  formatPhoneNumber,
  calculateExchange,
  createMessageHeader,
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
  getGreeting,
  addMenuFooter
};
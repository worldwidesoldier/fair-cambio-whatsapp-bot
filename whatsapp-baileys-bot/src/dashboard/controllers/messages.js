const fs = require('fs').promises;
const path = require('path');

class MessagesController {
  constructor() {
    this.messagesPath = path.join(__dirname, '../../config/messages.json');
  }

  async loadMessages() {
    try {
      const data = await fs.readFile(this.messagesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return null;
    }
  }

  async saveMessages(messages) {
    try {
      await fs.writeFile(
        this.messagesPath,
        JSON.stringify(messages, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error('Erro ao salvar mensagens:', error);
      return false;
    }
  }

  async getMessages(req, res) {
    try {
      const messages = await this.loadMessages();
      if (!messages) {
        return res.status(500).json({ error: 'Erro ao carregar mensagens' });
      }
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async updateMessage(req, res) {
    try {
      const { messageType } = req.params;
      const { template, variables } = req.body;

      const messages = await this.loadMessages();
      if (!messages) {
        return res.status(500).json({ error: 'Erro ao carregar mensagens' });
      }

      if (!messages[messageType]) {
        return res.status(404).json({ error: 'Tipo de mensagem não encontrado' });
      }

      messages[messageType].template = template;
      messages[messageType].variables = { ...messages[messageType].variables, ...variables };

      const saved = await this.saveMessages(messages);
      if (!saved) {
        return res.status(500).json({ error: 'Erro ao salvar mensagens' });
      }

      // Aqui você pode adicionar lógica para notificar o bot sobre a mudança
      // via WebSocket ou outro mecanismo

      res.json({
        success: true,
        message: 'Mensagem atualizada com sucesso',
        data: messages[messageType]
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async updateVariable(req, res) {
    try {
      const { messageType, variableName } = req.params;
      const { value } = req.body;

      const messages = await this.loadMessages();
      if (!messages) {
        return res.status(500).json({ error: 'Erro ao carregar mensagens' });
      }

      if (!messages[messageType]) {
        return res.status(404).json({ error: 'Tipo de mensagem não encontrado' });
      }

      messages[messageType].variables[variableName] = value;

      const saved = await this.saveMessages(messages);
      if (!saved) {
        return res.status(500).json({ error: 'Erro ao salvar mensagens' });
      }

      res.json({
        success: true,
        message: 'Variável atualizada com sucesso',
        data: { [variableName]: value }
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async previewMessage(req, res) {
    try {
      const { messageType } = req.params;
      const { variables } = req.body;

      const messages = await this.loadMessages();
      if (!messages || !messages[messageType]) {
        return res.status(404).json({ error: 'Tipo de mensagem não encontrado' });
      }

      let template = messages[messageType].template;
      const allVariables = { ...messages[messageType].variables, ...variables };

      // Substitui as variáveis no template
      for (const [key, value] of Object.entries(allVariables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, value);
      }

      // Lógica especial para mensagens condicionais
      if (messageType === 'attendant') {
        const hour = new Date().getHours();
        const isBusinessHours = hour >= 9 && hour < 18;

        if (isBusinessHours) {
          template = template.replace('{{status_message}}', allVariables.business_hours_message);
        } else {
          template = template.replace('{{status_message}}', allVariables.after_hours_message);
        }
      }

      // Remove variáveis não substituídas
      template = template.replace(/{{.*?}}/g, '');

      res.json({
        success: true,
        preview: template
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async resetMessages(req, res) {
    try {
      const defaultMessages = {
        welcome: {
          template: "{{greeting}}{{name}}! 👋\n\nBem-vindo à *{{company}}*!\n{{address}}\n{{phone}}\n\nComo posso ajudar você hoje?\n\nDigite *MENU* para ver as opções disponíveis ou envie sua dúvida diretamente.",
          variables: {
            company: "FAIR CÂMBIO SUL",
            address: "📍 Endereço da Filial",
            phone: "📞 (91) 3333-4444"
          }
        },
        menu: {
          template: "🏪 {{company}}\n  Seu câmbio de confiança há 30 anos\n\n  📋 Escolha uma opção:\n\n  💰 Taxas de hoje - Digite 1\n  🕐 Nossos horários - Digite 2\n  📍 Nossas localizações - Digite 3\n  📋 Documentos necessários - Digite 4\n  🛒 Como funciona a compra - Digite 5\n  👨‍💼 Falar com atendente - Digite 6\n\n  ou mande sua dúvida diretamente! 💬",
          variables: {
            company: "FAIR CÂMBIO SUL"
          }
        }
      };

      const saved = await this.saveMessages(defaultMessages);
      if (!saved) {
        return res.status(500).json({ error: 'Erro ao resetar mensagens' });
      }

      res.json({
        success: true,
        message: 'Mensagens resetadas para o padrão',
        data: defaultMessages
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

module.exports = MessagesController;
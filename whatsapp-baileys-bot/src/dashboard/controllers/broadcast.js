const { asyncHandler } = require('../middleware/error');
const fs = require('fs').promises;
const path = require('path');
const DashboardServer = require('../server');

const BROADCAST_HISTORY_FILE = path.join(__dirname, '../../../logs/broadcast-history.json');
const BROADCAST_TEMPLATES_FILE = path.join(__dirname, '../config/broadcast-templates.json');

class BroadcastManager {
    constructor() {
        this.botInstance = null;
        this.history = [];
        this.templates = [];
        this.initializeFiles();
    }

    async initializeFiles() {
        try {
            await this.loadHistory();
            await this.loadTemplates();
        } catch (error) {
            console.log('Initializing broadcast files...');
            await this.createDefaultFiles();
        }
    }

    async loadHistory() {
        try {
            const data = await fs.readFile(BROADCAST_HISTORY_FILE, 'utf8');
            this.history = JSON.parse(data);
        } catch (error) {
            this.history = [];
        }
    }

    async saveHistory() {
        await fs.writeFile(BROADCAST_HISTORY_FILE, JSON.stringify(this.history, null, 2));
    }

    async loadTemplates() {
        try {
            const data = await fs.readFile(BROADCAST_TEMPLATES_FILE, 'utf8');
            this.templates = JSON.parse(data);
        } catch (error) {
            this.templates = [];
        }
    }

    async saveTemplates() {
        // Ensure config directory exists
        const configDir = path.dirname(BROADCAST_TEMPLATES_FILE);
        try {
            await fs.mkdir(configDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        await fs.writeFile(BROADCAST_TEMPLATES_FILE, JSON.stringify(this.templates, null, 2));
    }

    async createDefaultFiles() {
        // Create default templates
        this.templates = [
            {
                id: 'welcome',
                name: 'Mensagem de Boas-Vindas',
                content: '🏦 *Fair Câmbio* - Bem-vindo!\n\nObrigado por entrar em contato conosco. Estamos aqui para ajudá-lo com suas necessidades de câmbio.\n\n💱 Taxas atualizadas\n📍 Nossas filiais\n⏰ Horários de funcionamento\n\nDigite uma opção ou fale conosco!',
                category: 'welcome',
                variables: [],
                active: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'rates_update',
                name: 'Atualização de Taxas',
                content: '💱 *ATUALIZAÇÃO DE TAXAS*\n\nNossas taxas foram atualizadas!\n\n{rates_content}\n\n_Taxas sujeitas a alteração sem aviso prévio_\n\nPara mais informações, visite nossas filiais ou entre em contato conosco.',
                category: 'rates',
                variables: ['rates_content'],
                active: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'new_branch',
                name: 'Nova Filial',
                content: '🎉 *NOVA FILIAL*\n\nTemos o prazer de anunciar a abertura de nossa nova filial!\n\n📍 **{branch_name}**\n🗺️ {branch_address}\n📞 {branch_phone}\n⏰ {branch_hours}\n\nVisite-nos e conheça nossos serviços!',
                category: 'announcement',
                variables: ['branch_name', 'branch_address', 'branch_phone', 'branch_hours'],
                active: true,
                createdAt: new Date().toISOString()
            }
        ];

        await this.saveTemplates();
        await this.saveHistory();
    }

    setBotInstance(bot) {
        this.botInstance = bot;
    }

    async getRecipientsList(target) {
        const recipients = [];

        switch (target.type) {
            case 'all':
                // Get all users from chat logs
                recipients.push(...await this.getAllUsers());
                break;

            case 'active':
                // Get active users (last 7 days)
                recipients.push(...await this.getActiveUsers(7));
                break;

            case 'recent':
                // Get recent users (last 24 hours)
                recipients.push(...await this.getActiveUsers(1));
                break;

            case 'custom':
                // Custom list of phone numbers
                recipients.push(...(target.numbers || []));
                break;

            case 'branches':
                // Send to specific branches (admin numbers)
                recipients.push(...await this.getBranchNumbers(target.branchIds));
                break;

            default:
                throw new Error('Tipo de destinatário inválido');
        }

        return [...new Set(recipients)]; // Remove duplicates
    }

    async getAllUsers() {
        const users = new Set();
        const logsPath = path.join(__dirname, '../../../logs');

        try {
            const files = await fs.readdir(logsPath);
            const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));

            for (const file of chatFiles) {
                try {
                    const logPath = path.join(logsPath, file);
                    const logData = await fs.readFile(logPath, 'utf8');
                    const logs = JSON.parse(logData);

                    logs.forEach(log => {
                        const phoneNumber = log.from.split('@')[0];
                        users.add(phoneNumber);
                    });
                } catch (error) {
                    console.error(`Error reading ${file}:`, error);
                }
            }
        } catch (error) {
            console.error('Error reading logs directory:', error);
        }

        return Array.from(users);
    }

    async getActiveUsers(days) {
        const users = new Set();
        const logsPath = path.join(__dirname, '../../../logs');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        try {
            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                try {
                    const logPath = path.join(logsPath, `chat-${dateStr}.json`);
                    const logData = await fs.readFile(logPath, 'utf8');
                    const logs = JSON.parse(logData);

                    logs.forEach(log => {
                        const phoneNumber = log.from.split('@')[0];
                        users.add(phoneNumber);
                    });
                } catch (error) {
                    // File doesn't exist for this date
                }
            }
        } catch (error) {
            console.error('Error getting active users:', error);
        }

        return Array.from(users);
    }

    async getBranchNumbers(branchIds) {
        const branchesConfig = require('../../config/branches');
        const numbers = [];

        if (branchIds && branchIds.length > 0) {
            branchIds.forEach(id => {
                const branch = branchesConfig.branches.find(b => b.id === id);
                if (branch && branch.phone) {
                    numbers.push(branch.phone);
                }
            });
        }

        return numbers;
    }

    async sendBroadcast(broadcastData, user) {
        const {
            message,
            target,
            templateId,
            variables,
            schedule,
            priority
        } = broadcastData;

        // Get recipients
        const recipients = await this.getRecipientsList(target);

        if (recipients.length === 0) {
            throw new Error('Nenhum destinatário encontrado');
        }

        // Prepare message content
        let messageContent = message;
        if (templateId) {
            const template = this.templates.find(t => t.id === templateId);
            if (template) {
                messageContent = template.content;

                // Replace variables
                if (variables && Object.keys(variables).length > 0) {
                    Object.entries(variables).forEach(([key, value]) => {
                        messageContent = messageContent.replace(
                            new RegExp(`{${key}}`, 'g'),
                            value
                        );
                    });
                }
            }
        }

        // Create broadcast record
        const broadcast = {
            id: Date.now().toString(),
            message: messageContent,
            target,
            recipients: recipients.length,
            recipientsList: recipients,
            status: schedule ? 'scheduled' : 'sending',
            priority: priority || 'normal',
            createdBy: user.id,
            createdByName: user.name,
            createdAt: new Date().toISOString(),
            scheduledFor: schedule ? new Date(schedule).toISOString() : null,
            startedAt: null,
            completedAt: null,
            sentCount: 0,
            failedCount: 0,
            errors: []
        };

        // Save to history
        this.history.unshift(broadcast);
        await this.saveHistory();

        // Send immediately or schedule
        if (schedule) {
            // TODO: Implement scheduling logic
            console.log(`Broadcast ${broadcast.id} scheduled for ${schedule}`);
        } else {
            // Send immediately
            await this.executeBroadcast(broadcast);
        }

        // Broadcast real-time update
        DashboardServer.broadcastUpdate('broadcast', {
            type: 'broadcast_created',
            broadcast: {
                ...broadcast,
                recipientsList: undefined // Don't send full list
            },
            timestamp: new Date().toISOString()
        });

        return broadcast;
    }

    async executeBroadcast(broadcast) {
        if (!this.botInstance) {
            throw new Error('Bot instance não configurado');
        }

        broadcast.status = 'sending';
        broadcast.startedAt = new Date().toISOString();
        await this.saveHistory();

        console.log(`Executing broadcast ${broadcast.id} to ${broadcast.recipients} recipients`);

        for (const phoneNumber of broadcast.recipientsList) {
            try {
                const formattedNumber = phoneNumber.includes('@')
                    ? phoneNumber
                    : `${phoneNumber}@s.whatsapp.net`;

                await this.botInstance.sendMessage(formattedNumber, {
                    text: broadcast.message
                });

                broadcast.sentCount++;

                // Small delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`Failed to send to ${phoneNumber}:`, error);
                broadcast.failedCount++;
                broadcast.errors.push({
                    recipient: phoneNumber,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        broadcast.status = 'completed';
        broadcast.completedAt = new Date().toISOString();
        await this.saveHistory();

        // Broadcast completion update
        DashboardServer.broadcastUpdate('broadcast', {
            type: 'broadcast_completed',
            broadcastId: broadcast.id,
            sentCount: broadcast.sentCount,
            failedCount: broadcast.failedCount,
            timestamp: new Date().toISOString()
        });

        console.log(`Broadcast ${broadcast.id} completed: ${broadcast.sentCount} sent, ${broadcast.failedCount} failed`);
    }

    async createTemplate(templateData, user) {
        const template = {
            id: Date.now().toString(),
            name: templateData.name,
            content: templateData.content,
            category: templateData.category || 'custom',
            variables: templateData.variables || [],
            active: true,
            createdBy: user.id,
            createdByName: user.name,
            createdAt: new Date().toISOString()
        };

        this.templates.push(template);
        await this.saveTemplates();

        return template;
    }

    async updateTemplate(templateId, updates, user) {
        const templateIndex = this.templates.findIndex(t => t.id === templateId);
        if (templateIndex === -1) {
            throw new Error('Template não encontrado');
        }

        const template = this.templates[templateIndex];

        if (updates.name) template.name = updates.name;
        if (updates.content) template.content = updates.content;
        if (updates.category) template.category = updates.category;
        if (updates.variables) template.variables = updates.variables;
        if (updates.active !== undefined) template.active = updates.active;

        template.updatedBy = user.id;
        template.updatedByName = user.name;
        template.updatedAt = new Date().toISOString();

        await this.saveTemplates();
        return template;
    }

    async deleteTemplate(templateId) {
        const templateIndex = this.templates.findIndex(t => t.id === templateId);
        if (templateIndex === -1) {
            throw new Error('Template não encontrado');
        }

        this.templates.splice(templateIndex, 1);
        await this.saveTemplates();
    }

    getHistory(limit = 50) {
        return this.history.slice(0, limit);
    }

    getTemplates() {
        return this.templates;
    }

    getBroadcastById(id) {
        return this.history.find(b => b.id === id);
    }
}

const broadcastManager = new BroadcastManager();

const BroadcastController = {
    sendBroadcast: asyncHandler(async (req, res) => {
        const {
            message,
            target,
            templateId,
            variables,
            schedule,
            priority
        } = req.body;

        if (!message && !templateId) {
            return res.status(400).json({
                error: 'Mensagem ou template são obrigatórios'
            });
        }

        if (!target || !target.type) {
            return res.status(400).json({
                error: 'Destinatário é obrigatório'
            });
        }

        const broadcast = await broadcastManager.sendBroadcast({
            message,
            target,
            templateId,
            variables,
            schedule,
            priority
        }, req.user);

        res.status(201).json({
            success: true,
            message: 'Broadcast criado com sucesso',
            broadcast: {
                ...broadcast,
                recipientsList: undefined // Don't return full recipient list
            }
        });
    }),

    getHistory: asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const history = broadcastManager.getHistory(limit);

        res.json({
            history: history.map(broadcast => ({
                ...broadcast,
                recipientsList: undefined // Don't return full recipient lists
            })),
            total: history.length
        });
    }),

    getBroadcast: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const broadcast = broadcastManager.getBroadcastById(id);

        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast não encontrado' });
        }

        res.json(broadcast);
    }),

    getTemplates: asyncHandler(async (req, res) => {
        const templates = broadcastManager.getTemplates();
        res.json(templates);
    }),

    createTemplate: asyncHandler(async (req, res) => {
        const { name, content, category, variables } = req.body;

        if (!name || !content) {
            return res.status(400).json({
                error: 'Nome e conteúdo são obrigatórios'
            });
        }

        const template = await broadcastManager.createTemplate({
            name,
            content,
            category,
            variables
        }, req.user);

        res.status(201).json({
            success: true,
            message: 'Template criado com sucesso',
            template
        });
    }),

    updateTemplate: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const template = await broadcastManager.updateTemplate(id, updates, req.user);

        res.json({
            success: true,
            message: 'Template atualizado com sucesso',
            template
        });
    }),

    deleteTemplate: asyncHandler(async (req, res) => {
        const { id } = req.params;

        await broadcastManager.deleteTemplate(id);

        res.json({
            success: true,
            message: 'Template removido com sucesso'
        });
    }),

    getRecipientCount: asyncHandler(async (req, res) => {
        const { target } = req.body;

        if (!target || !target.type) {
            return res.status(400).json({
                error: 'Configuração de destinatário é obrigatória'
            });
        }

        try {
            const recipients = await broadcastManager.getRecipientsList(target);
            res.json({
                count: recipients.length,
                target
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }),

    previewMessage: asyncHandler(async (req, res) => {
        const { templateId, variables } = req.body;

        if (!templateId) {
            return res.status(400).json({
                error: 'ID do template é obrigatório'
            });
        }

        const template = broadcastManager.getTemplates().find(t => t.id === templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template não encontrado' });
        }

        let preview = template.content;

        // Replace variables
        if (variables && Object.keys(variables).length > 0) {
            Object.entries(variables).forEach(([key, value]) => {
                preview = preview.replace(
                    new RegExp(`{${key}}`, 'g'),
                    value || `{${key}}`
                );
            });
        }

        res.json({
            preview,
            template: {
                id: template.id,
                name: template.name,
                variables: template.variables
            }
        });
    }),

    setBotInstance: (botInstance) => {
        broadcastManager.setBotInstance(botInstance);
    }
};

module.exports = BroadcastController;
const RatesManager = require('../../handlers/rates');
const { asyncHandler } = require('../middleware/error');
const DashboardServer = require('../server');

const ratesManager = new RatesManager();

const RatesController = {
    getAllRates: asyncHandler(async (req, res) => {
        const rates = ratesManager.getAllRates();
        res.json(rates);
    }),

    updateRate: asyncHandler(async (req, res) => {
        const { currency, type, value } = req.body;

        if (!currency || !type || value === undefined) {
            return res.status(400).json({
                error: 'Moeda, tipo (buy/sell) e valor são obrigatórios'
            });
        }

        const result = await ratesManager.updateRate(currency, type, parseFloat(value));

        if (result.success) {
            // Broadcast real-time update
            DashboardServer.broadcastUpdate('rates', {
                currency,
                type,
                value: parseFloat(value),
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: result.message,
                data: ratesManager.getRate(currency)
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }
    }),

    bulkUpdate: asyncHandler(async (req, res) => {
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                error: 'Lista de atualizações é obrigatória'
            });
        }

        // Validate each update
        for (const update of updates) {
            if (!update.currency || !update.type || update.value === undefined) {
                return res.status(400).json({
                    error: 'Cada atualização deve conter moeda, tipo e valor'
                });
            }
        }

        const results = await ratesManager.bulkUpdate(updates);
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        // Broadcast real-time update for successful updates
        if (successCount > 0) {
            DashboardServer.broadcastUpdate('rates', {
                type: 'bulk_update',
                successCount,
                failureCount,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: successCount > 0,
            message: `${successCount} atualizações realizadas com sucesso${failureCount > 0 ? `, ${failureCount} falharam` : ''}`,
            results,
            data: ratesManager.getAllRates()
        });
    }),

    getHistory: asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const history = await ratesManager.getHistory(limit);

        res.json({
            history,
            total: history.length
        });
    }),

    getStatistics: asyncHandler(async (req, res) => {
        const stats = await ratesManager.getStatistics();
        res.json({ statistics: stats });
    }),

    // Get rates formatted for WhatsApp message
    getFormattedRates: asyncHandler(async (req, res) => {
        const formattedMessage = ratesManager.formatRatesMessage();
        res.json({ message: formattedMessage });
    }),

    // Get specific currency rate
    getCurrencyRate: asyncHandler(async (req, res) => {
        const { currency } = req.params;
        const rate = ratesManager.getRate(currency);

        if (!rate) {
            return res.status(404).json({ error: 'Moeda não encontrada' });
        }

        res.json(rate);
    }),

    // Add new currency
    addCurrency: asyncHandler(async (req, res) => {
        const { code, name, emoji, buy, sell } = req.body;

        if (!code || !name || !emoji || buy === undefined || sell === undefined) {
            return res.status(400).json({
                error: 'Código, nome, emoji, taxa de compra e venda são obrigatórios'
            });
        }

        const rates = ratesManager.getAllRates();

        if (rates.currencies[code.toUpperCase()]) {
            return res.status(400).json({ error: 'Moeda já existe' });
        }

        rates.currencies[code.toUpperCase()] = {
            name,
            emoji,
            buy: parseFloat(buy),
            sell: parseFloat(sell)
        };

        rates.lastUpdate = new Date().toISOString();

        // Save the updated rates
        if (await ratesManager.saveRates()) {
            // Broadcast real-time update
            DashboardServer.broadcastUpdate('rates', {
                type: 'currency_added',
                currency: code.toUpperCase(),
                timestamp: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'Moeda adicionada com sucesso',
                data: rates.currencies[code.toUpperCase()]
            });
        } else {
            res.status(500).json({ error: 'Erro ao salvar a nova moeda' });
        }
    }),

    // Remove currency
    removeCurrency: asyncHandler(async (req, res) => {
        const { currency } = req.params;
        const rates = ratesManager.getAllRates();

        if (!rates.currencies[currency.toUpperCase()]) {
            return res.status(404).json({ error: 'Moeda não encontrada' });
        }

        delete rates.currencies[currency.toUpperCase()];
        rates.lastUpdate = new Date().toISOString();

        // Save the updated rates
        if (await ratesManager.saveRates()) {
            // Broadcast real-time update
            DashboardServer.broadcastUpdate('rates', {
                type: 'currency_removed',
                currency: currency.toUpperCase(),
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Moeda removida com sucesso'
            });
        } else {
            res.status(500).json({ error: 'Erro ao remover a moeda' });
        }
    }),

    // Get rate change alerts
    getRateAlerts: asyncHandler(async (req, res) => {
        const history = await ratesManager.getHistory(10);
        const alerts = [];

        history.forEach(record => {
            const changePercent = parseFloat(record.change);

            if (Math.abs(changePercent) > 5) { // Alert for changes > 5%
                alerts.push({
                    ...record,
                    severity: Math.abs(changePercent) > 10 ? 'high' : 'medium',
                    message: `${record.currency} ${record.type} teve uma variação de ${changePercent}%`
                });
            }
        });

        res.json({ alerts });
    })
};

module.exports = RatesController;
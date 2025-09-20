const { asyncHandler } = require('../middleware/error');
const branchesConfig = require('../../config/branches');
const fs = require('fs').promises;
const path = require('path');
const DashboardServer = require('../server');

const BRANCHES_FILE = path.join(__dirname, '../../config/branches.json');

class BranchesManager {
    constructor() {
        this.branches = branchesConfig.branches || [];
    }

    async loadBranches() {
        try {
            const data = await fs.readFile(BRANCHES_FILE, 'utf8');
            const config = JSON.parse(data);
            this.branches = config.branches || [];
            return this.branches;
        } catch (error) {
            // If file doesn't exist, use default config
            await this.saveBranches();
            return this.branches;
        }
    }

    async saveBranches() {
        const config = {
            branches: this.branches,
            lastUpdate: new Date().toISOString()
        };

        await fs.writeFile(BRANCHES_FILE, JSON.stringify(config, null, 2));

        // Update the original config file as well
        const originalConfigPath = path.join(__dirname, '../../config/branches.js');
        const jsConfig = `module.exports = ${JSON.stringify(config, null, 2)
            .replace(/"branches":/g, 'branches:')
            .replace(/"lastUpdate":/g, 'lastUpdate:')};`;

        try {
            await fs.writeFile(originalConfigPath, jsConfig);
        } catch (error) {
            console.warn('Could not update original branches.js file:', error);
        }
    }

    getAllBranches() {
        return this.branches;
    }

    getBranchById(id) {
        return this.branches.find(branch => branch.id === id);
    }

    getActiveBranches() {
        return this.branches.filter(branch => branch.active);
    }

    async createBranch(branchData) {
        // Generate unique ID
        const id = `branch-${Date.now()}`;

        const newBranch = {
            id,
            name: branchData.name,
            phone: branchData.phone,
            address: branchData.address,
            hours: branchData.hours || {
                weekdays: '09:00 às 18:00',
                saturday: '09:00 às 14:00',
                sunday: 'Fechado'
            },
            maps: branchData.maps || '',
            active: branchData.active !== undefined ? branchData.active : true,
            createdAt: new Date().toISOString()
        };

        this.branches.push(newBranch);
        await this.saveBranches();

        return newBranch;
    }

    async updateBranch(id, updates) {
        const branchIndex = this.branches.findIndex(branch => branch.id === id);
        if (branchIndex === -1) {
            throw new Error('Filial não encontrada');
        }

        const branch = this.branches[branchIndex];

        // Update allowed fields
        if (updates.name) branch.name = updates.name;
        if (updates.phone) branch.phone = updates.phone;
        if (updates.address) branch.address = updates.address;
        if (updates.hours) branch.hours = updates.hours;
        if (updates.maps) branch.maps = updates.maps;
        if (updates.active !== undefined) branch.active = updates.active;

        branch.updatedAt = new Date().toISOString();

        await this.saveBranches();
        return branch;
    }

    async deleteBranch(id) {
        const branchIndex = this.branches.findIndex(branch => branch.id === id);
        if (branchIndex === -1) {
            throw new Error('Filial não encontrada');
        }

        this.branches.splice(branchIndex, 1);
        await this.saveBranches();
    }

    async toggleBranch(id) {
        const branch = this.getBranchById(id);
        if (!branch) {
            throw new Error('Filial não encontrada');
        }

        branch.active = !branch.active;
        branch.updatedAt = new Date().toISOString();

        await this.saveBranches();
        return branch;
    }

    async getBranchStatistics() {
        const stats = {
            total: this.branches.length,
            active: this.getActiveBranches().length,
            inactive: this.branches.filter(branch => !branch.active).length,
            byCity: {},
            recentChanges: []
        };

        // Group by city (extracted from address)
        this.branches.forEach(branch => {
            const city = this.extractCity(branch.address);
            stats.byCity[city] = (stats.byCity[city] || 0) + 1;
        });

        // Get recent changes (branches updated in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        this.branches.forEach(branch => {
            if (branch.updatedAt && new Date(branch.updatedAt) > thirtyDaysAgo) {
                stats.recentChanges.push({
                    id: branch.id,
                    name: branch.name,
                    updatedAt: branch.updatedAt,
                    active: branch.active
                });
            }
        });

        return stats;
    }

    extractCity(address) {
        // Simple city extraction from address
        const parts = address.split(',');
        return parts[parts.length - 1]?.trim() || 'Unknown';
    }
}

const branchesManager = new BranchesManager();

const BranchesController = {
    getAllBranches: asyncHandler(async (req, res) => {
        await branchesManager.loadBranches();
        const branches = branchesManager.getAllBranches();

        res.json({
            branches,
            total: branches.length,
            active: branches.filter(b => b.active).length
        });
    }),

    getBranch: asyncHandler(async (req, res) => {
        const { id } = req.params;
        await branchesManager.loadBranches();
        const branch = branchesManager.getBranchById(id);

        if (!branch) {
            return res.status(404).json({ error: 'Filial não encontrada' });
        }

        res.json(branch);
    }),

    createBranch: asyncHandler(async (req, res) => {
        const { name, phone, address, hours, maps, active } = req.body;

        if (!name || !phone || !address) {
            return res.status(400).json({
                error: 'Nome, telefone e endereço são obrigatórios'
            });
        }

        await branchesManager.loadBranches();
        const newBranch = await branchesManager.createBranch({
            name,
            phone,
            address,
            hours,
            maps,
            active
        });

        // Broadcast real-time update
        DashboardServer.broadcastUpdate('branches', {
            type: 'branch_created',
            branch: newBranch,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            success: true,
            message: 'Filial criada com sucesso',
            branch: newBranch
        });
    }),

    updateBranch: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        await branchesManager.loadBranches();
        const updatedBranch = await branchesManager.updateBranch(id, updates);

        // Broadcast real-time update
        DashboardServer.broadcastUpdate('branches', {
            type: 'branch_updated',
            branch: updatedBranch,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Filial atualizada com sucesso',
            branch: updatedBranch
        });
    }),

    deleteBranch: asyncHandler(async (req, res) => {
        const { id } = req.params;

        await branchesManager.loadBranches();
        await branchesManager.deleteBranch(id);

        // Broadcast real-time update
        DashboardServer.broadcastUpdate('branches', {
            type: 'branch_deleted',
            branchId: id,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Filial removida com sucesso'
        });
    }),

    toggleBranch: asyncHandler(async (req, res) => {
        const { id } = req.params;

        await branchesManager.loadBranches();
        const branch = await branchesManager.toggleBranch(id);

        // Broadcast real-time update
        DashboardServer.broadcastUpdate('branches', {
            type: 'branch_toggled',
            branch: branch,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: `Filial ${branch.active ? 'ativada' : 'desativada'} com sucesso`,
            branch
        });
    }),

    getBranchStatistics: asyncHandler(async (req, res) => {
        await branchesManager.loadBranches();
        const stats = await branchesManager.getBranchStatistics();

        res.json(stats);
    }),

    getActiveBranches: asyncHandler(async (req, res) => {
        await branchesManager.loadBranches();
        const activeBranches = branchesManager.getActiveBranches();

        res.json({
            branches: activeBranches,
            count: activeBranches.length
        });
    }),

    getBranchesStatus: asyncHandler(async (req, res) => {
        await branchesManager.loadBranches();
        const branches = branchesManager.getAllBranches();

        // In a real implementation, you would check actual connectivity/health
        const branchesStatus = branches.map(branch => ({
            ...branch,
            status: branch.active ? 'online' : 'offline',
            lastCheck: new Date().toISOString(),
            // Mock health data - replace with real health checks
            health: {
                connectivity: branch.active ? 'good' : 'down',
                responseTime: branch.active ? Math.floor(Math.random() * 100) + 20 : null,
                lastMessage: branch.active ? new Date(Date.now() - Math.random() * 3600000).toISOString() : null
            }
        }));

        res.json({
            branches: branchesStatus,
            summary: {
                total: branches.length,
                online: branches.filter(b => b.active).length,
                offline: branches.filter(b => !b.active).length
            }
        });
    }),

    // Bulk operations
    bulkToggleBranches: asyncHandler(async (req, res) => {
        const { branchIds, active } = req.body;

        if (!Array.isArray(branchIds) || branchIds.length === 0) {
            return res.status(400).json({ error: 'IDs das filiais são obrigatórios' });
        }

        await branchesManager.loadBranches();
        const results = [];

        for (const id of branchIds) {
            try {
                const branch = await branchesManager.updateBranch(id, { active });
                results.push({ id, success: true, branch });
            } catch (error) {
                results.push({ id, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;

        // Broadcast real-time update
        DashboardServer.broadcastUpdate('branches', {
            type: 'bulk_toggle',
            affectedCount: successCount,
            active,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: successCount > 0,
            message: `${successCount} filiais atualizadas com sucesso`,
            results
        });
    })
};

module.exports = BranchesController;
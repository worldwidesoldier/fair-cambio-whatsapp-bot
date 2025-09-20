const { asyncHandler } = require('../middleware/error');
const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

const BACKUP_DIR = path.join(__dirname, '../../../backups');
const CONFIG_DIR = path.join(__dirname, '../../config');
const LOGS_DIR = path.join(__dirname, '../../../logs');
const SESSIONS_DIR = path.join(__dirname, '../../../sessions');

class BackupManager {
    constructor() {
        this.ensureBackupDirectory();
    }

    async ensureBackupDirectory() {
        try {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
        } catch (error) {
            console.error('Error creating backup directory:', error);
        }
    }

    async createBackup(type = 'full', description = '') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `backup-${type}-${timestamp}`;
        const backupPath = path.join(BACKUP_DIR, backupId);

        await fs.mkdir(backupPath, { recursive: true });

        const backup = {
            id: backupId,
            type,
            description,
            createdAt: new Date().toISOString(),
            size: 0,
            files: [],
            status: 'creating'
        };

        try {
            switch (type) {
                case 'full':
                    await this.createFullBackup(backupPath, backup);
                    break;
                case 'config':
                    await this.createConfigBackup(backupPath, backup);
                    break;
                case 'data':
                    await this.createDataBackup(backupPath, backup);
                    break;
                case 'logs':
                    await this.createLogsBackup(backupPath, backup);
                    break;
                default:
                    throw new Error('Tipo de backup inválido');
            }

            backup.status = 'completed';
            backup.completedAt = new Date().toISOString();

            // Calculate total size
            backup.size = await this.calculateDirectorySize(backupPath);

            // Save backup metadata
            await fs.writeFile(
                path.join(backupPath, 'metadata.json'),
                JSON.stringify(backup, null, 2)
            );

            console.log(`Backup ${backupId} created successfully`);
            return backup;

        } catch (error) {
            backup.status = 'failed';
            backup.error = error.message;
            backup.failedAt = new Date().toISOString();

            // Try to save metadata even if backup failed
            try {
                await fs.writeFile(
                    path.join(backupPath, 'metadata.json'),
                    JSON.stringify(backup, null, 2)
                );
            } catch (metaError) {
                console.error('Error saving backup metadata:', metaError);
            }

            throw error;
        }
    }

    async createFullBackup(backupPath, backup) {
        // Backup config files
        await this.copyDirectory(CONFIG_DIR, path.join(backupPath, 'config'));
        backup.files.push('config/');

        // Backup recent logs (last 30 days)
        await this.copyRecentLogs(path.join(backupPath, 'logs'));
        backup.files.push('logs/');

        // Backup session files (but not large session data)
        await this.copySessionConfig(path.join(backupPath, 'sessions'));
        backup.files.push('sessions/');

        // Backup dashboard config
        const dashboardConfigDir = path.join(__dirname, '../config');
        if (await this.directoryExists(dashboardConfigDir)) {
            await this.copyDirectory(dashboardConfigDir, path.join(backupPath, 'dashboard-config'));
            backup.files.push('dashboard-config/');
        }

        // Create system info
        await this.createSystemInfo(path.join(backupPath, 'system-info.json'));
        backup.files.push('system-info.json');
    }

    async createConfigBackup(backupPath, backup) {
        // Backup only configuration files
        await this.copyDirectory(CONFIG_DIR, path.join(backupPath, 'config'));
        backup.files.push('config/');

        const dashboardConfigDir = path.join(__dirname, '../config');
        if (await this.directoryExists(dashboardConfigDir)) {
            await this.copyDirectory(dashboardConfigDir, path.join(backupPath, 'dashboard-config'));
            backup.files.push('dashboard-config/');
        }

        // Backup package.json
        const packageJsonPath = path.join(__dirname, '../../../package.json');
        if (await this.fileExists(packageJsonPath)) {
            await this.copyFile(packageJsonPath, path.join(backupPath, 'package.json'));
            backup.files.push('package.json');
        }

        // Backup .env file (without sensitive data)
        await this.createSanitizedEnvBackup(path.join(backupPath, 'env-template.txt'));
        backup.files.push('env-template.txt');
    }

    async createDataBackup(backupPath, backup) {
        // Backup user data and logs
        await this.copyRecentLogs(path.join(backupPath, 'logs'));
        backup.files.push('logs/');

        // Backup rates history
        const ratesHistoryPath = path.join(LOGS_DIR, 'rates-history.json');
        if (await this.fileExists(ratesHistoryPath)) {
            await this.copyFile(ratesHistoryPath, path.join(backupPath, 'rates-history.json'));
            backup.files.push('rates-history.json');
        }

        // Backup broadcast history
        const broadcastHistoryPath = path.join(LOGS_DIR, 'broadcast-history.json');
        if (await this.fileExists(broadcastHistoryPath)) {
            await this.copyFile(broadcastHistoryPath, path.join(backupPath, 'broadcast-history.json'));
            backup.files.push('broadcast-history.json');
        }
    }

    async createLogsBackup(backupPath, backup) {
        // Backup all available logs
        const days = parseInt(process.env.BACKUP_LOGS_DAYS) || 90;
        await this.copyRecentLogs(path.join(backupPath, 'logs'), days);
        backup.files.push('logs/');
    }

    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await this.copyFile(srcPath, destPath);
            }
        }
    }

    async copyFile(src, dest) {
        try {
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await pipeline(
                createReadStream(src),
                createWriteStream(dest)
            );
        } catch (error) {
            console.error(`Error copying ${src} to ${dest}:`, error);
        }
    }

    async copyRecentLogs(destDir, days = 30) {
        await fs.mkdir(destDir, { recursive: true });

        try {
            const files = await fs.readdir(LOGS_DIR);
            const logFiles = files.filter(file => file.endsWith('.json'));

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            for (const file of logFiles) {
                try {
                    const filePath = path.join(LOGS_DIR, file);
                    const stats = await fs.stat(filePath);

                    if (stats.mtime >= cutoffDate) {
                        await this.copyFile(filePath, path.join(destDir, file));
                    }
                } catch (error) {
                    console.error(`Error processing log file ${file}:`, error);
                }
            }
        } catch (error) {
            console.error('Error copying logs:', error);
        }
    }

    async copySessionConfig(destDir) {
        await fs.mkdir(destDir, { recursive: true });

        try {
            const files = await fs.readdir(SESSIONS_DIR);

            // Only copy JSON configuration files, not binary session data
            const configFiles = files.filter(file =>
                file.endsWith('.json') || file.endsWith('.txt')
            );

            for (const file of configFiles) {
                const srcPath = path.join(SESSIONS_DIR, file);
                const destPath = path.join(destDir, file);
                await this.copyFile(srcPath, destPath);
            }
        } catch (error) {
            console.error('Error copying session config:', error);
        }
    }

    async createSystemInfo(filePath) {
        const systemInfo = {
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: {
                NODE_ENV: process.env.NODE_ENV,
                DASHBOARD_PORT: process.env.DASHBOARD_PORT
            }
        };

        await fs.writeFile(filePath, JSON.stringify(systemInfo, null, 2));
    }

    async createSanitizedEnvBackup(filePath) {
        try {
            const envPath = path.join(__dirname, '../../../.env');
            const envContent = await fs.readFile(envPath, 'utf8');

            // Remove sensitive values
            const sanitized = envContent
                .split('\n')
                .map(line => {
                    if (line.includes('PASSWORD') || line.includes('SECRET') || line.includes('KEY')) {
                        const [key] = line.split('=');
                        return `${key}=***REDACTED***`;
                    }
                    return line;
                })
                .join('\n');

            await fs.writeFile(filePath, sanitized);
        } catch (error) {
            // If .env doesn't exist, create a template
            const template = `# Environment Variables Template
# Generated during backup on ${new Date().toISOString()}

# WhatsApp Bot Configuration
# Add your actual values here

# Dashboard Configuration
DASHBOARD_PORT=3000
DASHBOARD_ORIGIN=http://localhost:3000

# JWT Secret
JWT_SECRET=***YOUR_SECRET_HERE***

# Admin Numbers (comma separated)
ADMIN_NUMBERS=***YOUR_ADMIN_NUMBERS***

# Other configurations...
`;
            await fs.writeFile(filePath, template);
        }
    }

    async restoreBackup(backupId, options = {}) {
        const backupPath = path.join(BACKUP_DIR, backupId);

        if (!await this.directoryExists(backupPath)) {
            throw new Error('Backup não encontrado');
        }

        // Load backup metadata
        const metadataPath = path.join(backupPath, 'metadata.json');
        let metadata;
        try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
        } catch (error) {
            throw new Error('Metadata do backup não encontrado ou inválido');
        }

        if (metadata.status !== 'completed') {
            throw new Error('Backup não está completo ou falhou');
        }

        const restore = {
            backupId,
            startedAt: new Date().toISOString(),
            status: 'restoring',
            restoredFiles: []
        };

        try {
            // Create backup of current state before restore
            if (!options.skipCurrentBackup) {
                await this.createBackup('full', `Pre-restore backup before restoring ${backupId}`);
            }

            // Restore files based on backup type
            if (metadata.files.includes('config/')) {
                await this.restoreDirectory(
                    path.join(backupPath, 'config'),
                    CONFIG_DIR
                );
                restore.restoredFiles.push('config/');
            }

            if (metadata.files.includes('dashboard-config/')) {
                await this.restoreDirectory(
                    path.join(backupPath, 'dashboard-config'),
                    path.join(__dirname, '../config')
                );
                restore.restoredFiles.push('dashboard-config/');
            }

            if (metadata.files.includes('logs/') && !options.skipLogs) {
                await this.restoreDirectory(
                    path.join(backupPath, 'logs'),
                    LOGS_DIR
                );
                restore.restoredFiles.push('logs/');
            }

            if (metadata.files.includes('sessions/') && !options.skipSessions) {
                await this.restoreDirectory(
                    path.join(backupPath, 'sessions'),
                    SESSIONS_DIR
                );
                restore.restoredFiles.push('sessions/');
            }

            restore.status = 'completed';
            restore.completedAt = new Date().toISOString();

            console.log(`Backup ${backupId} restored successfully`);
            return restore;

        } catch (error) {
            restore.status = 'failed';
            restore.error = error.message;
            restore.failedAt = new Date().toISOString();
            throw error;
        }
    }

    async restoreDirectory(src, dest) {
        if (!await this.directoryExists(src)) {
            return;
        }

        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.restoreDirectory(srcPath, destPath);
            } else {
                await this.copyFile(srcPath, destPath);
            }
        }
    }

    async listBackups() {
        try {
            const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
            const backups = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        const metadataPath = path.join(BACKUP_DIR, entry.name, 'metadata.json');
                        const metadataContent = await fs.readFile(metadataPath, 'utf8');
                        const metadata = JSON.parse(metadataContent);
                        backups.push(metadata);
                    } catch (error) {
                        // Skip directories without valid metadata
                        console.warn(`Invalid backup directory: ${entry.name}`);
                    }
                }
            }

            return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            return [];
        }
    }

    async deleteBackup(backupId) {
        const backupPath = path.join(BACKUP_DIR, backupId);

        if (!await this.directoryExists(backupPath)) {
            throw new Error('Backup não encontrado');
        }

        await this.deleteDirectory(backupPath);
    }

    async deleteDirectory(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await this.deleteDirectory(fullPath);
                } else {
                    await fs.unlink(fullPath);
                }
            }

            await fs.rmdir(dirPath);
        } catch (error) {
            console.error(`Error deleting directory ${dirPath}:`, error);
        }
    }

    async calculateDirectorySize(dirPath) {
        let size = 0;

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    size += await this.calculateDirectorySize(fullPath);
                } else {
                    const stats = await fs.stat(fullPath);
                    size += stats.size;
                }
            }
        } catch (error) {
            console.error(`Error calculating size of ${dirPath}:`, error);
        }

        return size;
    }

    async directoryExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async fileExists(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.isFile();
        } catch {
            return false;
        }
    }

    formatSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

const backupManager = new BackupManager();

const BackupController = {
    createBackup: asyncHandler(async (req, res) => {
        const { type = 'full', description = '' } = req.body;

        const validTypes = ['full', 'config', 'data', 'logs'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: 'Tipo de backup inválido. Use: full, config, data, logs'
            });
        }

        try {
            const backup = await backupManager.createBackup(type, description);

            res.status(201).json({
                success: true,
                message: 'Backup criado com sucesso',
                backup: {
                    ...backup,
                    sizeFormatted: backupManager.formatSize(backup.size)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Erro ao criar backup: ${error.message}`
            });
        }
    }),

    listBackups: asyncHandler(async (req, res) => {
        const backups = await backupManager.listBackups();

        const formattedBackups = backups.map(backup => ({
            ...backup,
            sizeFormatted: backupManager.formatSize(backup.size || 0)
        }));

        res.json({
            backups: formattedBackups,
            total: formattedBackups.length
        });
    }),

    getBackup: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const backups = await backupManager.listBackups();
        const backup = backups.find(b => b.id === id);

        if (!backup) {
            return res.status(404).json({ error: 'Backup não encontrado' });
        }

        res.json({
            ...backup,
            sizeFormatted: backupManager.formatSize(backup.size || 0)
        });
    }),

    restoreBackup: asyncHandler(async (req, res) => {
        const { backupId, options = {} } = req.body;

        if (!backupId) {
            return res.status(400).json({ error: 'ID do backup é obrigatório' });
        }

        try {
            const restore = await backupManager.restoreBackup(backupId, options);

            res.json({
                success: true,
                message: 'Backup restaurado com sucesso',
                restore
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Erro ao restaurar backup: ${error.message}`
            });
        }
    }),

    deleteBackup: asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            await backupManager.deleteBackup(id);

            res.json({
                success: true,
                message: 'Backup removido com sucesso'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Erro ao remover backup: ${error.message}`
            });
        }
    }),

    downloadBackup: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const backupPath = path.join(BACKUP_DIR, id);

        if (!await backupManager.directoryExists(backupPath)) {
            return res.status(404).json({ error: 'Backup não encontrado' });
        }

        // In a real implementation, you would create a zip file and send it
        // For now, we'll just return the backup metadata
        try {
            const metadataPath = path.join(backupPath, 'metadata.json');
            const metadata = await fs.readFile(metadataPath, 'utf8');

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${id}-metadata.json"`);
            res.send(metadata);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao baixar backup' });
        }
    }),

    getBackupStatistics: asyncHandler(async (req, res) => {
        const backups = await backupManager.listBackups();

        const stats = {
            total: backups.length,
            totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
            byType: {},
            byStatus: {},
            latest: backups[0] || null,
            oldest: backups[backups.length - 1] || null
        };

        stats.totalSizeFormatted = backupManager.formatSize(stats.totalSize);

        // Group by type and status
        backups.forEach(backup => {
            stats.byType[backup.type] = (stats.byType[backup.type] || 0) + 1;
            stats.byStatus[backup.status] = (stats.byStatus[backup.status] || 0) + 1;
        });

        res.json(stats);
    })
};

module.exports = BackupController;
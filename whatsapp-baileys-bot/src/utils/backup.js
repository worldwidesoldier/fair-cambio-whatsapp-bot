const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const logger = require('./logger');
const analytics = require('./analytics');

const pipelineAsync = promisify(pipeline);

class BackupSystem {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.dataDir = path.join(__dirname, '../../data');
    this.logsDir = path.join(__dirname, '../../logs');
    this.sessionsDir = path.join(__dirname, '../../sessions');

    this.config = {
      maxBackups: parseInt(process.env.MAX_BACKUPS) || 30,
      backupInterval: parseInt(process.env.BACKUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
      compressionLevel: 6,
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
    };

    this.backupQueue = [];
    this.isBackupRunning = false;

    this.initialize();
  }

  async initialize() {
    try {
      await this.ensureBackupDirectory();
      this.scheduleBackups();

      logger.info('Backup system initialized', {
        backupDir: this.backupDir,
        maxBackups: this.config.maxBackups,
        retentionDays: this.config.retentionDays,
        category: 'backup'
      });

      // Create initial backup
      await this.createBackup('initialization');

    } catch (error) {
      logger.error('Failed to initialize backup system', {
        error: error.message,
        category: 'backup'
      });
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });

      // Create subdirectories
      await fs.mkdir(path.join(this.backupDir, 'daily'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'weekly'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'manual'), { recursive: true });

    } catch (error) {
      logger.error('Failed to create backup directory', {
        error: error.message,
        category: 'backup'
      });
      throw error;
    }
  }

  scheduleBackups() {
    // Daily backup at 3 AM
    const scheduleDaily = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(3, 0, 0, 0);

      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      const msUntilTarget = target.getTime() - now.getTime();

      setTimeout(() => {
        this.createBackup('daily');
        setInterval(() => {
          this.createBackup('daily');
        }, 24 * 60 * 60 * 1000);
      }, msUntilTarget);
    };

    // Weekly backup every Sunday at 2 AM
    const scheduleWeekly = () => {
      const now = new Date();
      const target = new Date();
      target.setDate(target.getDate() + (7 - target.getDay()));
      target.setHours(2, 0, 0, 0);

      if (target <= now) {
        target.setDate(target.getDate() + 7);
      }

      const msUntilTarget = target.getTime() - now.getTime();

      setTimeout(() => {
        this.createBackup('weekly');
        setInterval(() => {
          this.createBackup('weekly');
        }, 7 * 24 * 60 * 60 * 1000);
      }, msUntilTarget);
    };

    scheduleDaily();
    scheduleWeekly();

    logger.info('Backup schedules configured', {
      daily: '03:00',
      weekly: 'Sunday 02:00',
      category: 'backup'
    });
  }

  async createBackup(type = 'manual', description = '') {
    if (this.isBackupRunning) {
      logger.warn('Backup already in progress, skipping', { type, category: 'backup' });
      return null;
    }

    this.isBackupRunning = true;
    const startTime = Date.now();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${type}-${timestamp}`;
      const backupPath = path.join(this.backupDir, type, `${backupName}.tar.gz`);

      logger.info('Starting backup', { type, backupName, category: 'backup' });

      // Create backup manifest
      const manifest = await this.createBackupManifest(type, description);

      // Create compressed backup
      await this.createCompressedBackup(backupPath, manifest);

      // Verify backup
      const backupSize = await this.getFileSize(backupPath);
      const duration = Date.now() - startTime;

      const backupInfo = {
        name: backupName,
        type,
        path: backupPath,
        size: backupSize,
        duration,
        timestamp: new Date().toISOString(),
        manifest
      };

      // Save backup info
      await this.saveBackupInfo(backupInfo);

      // Cleanup old backups
      await this.cleanupOldBackups(type);

      logger.info('Backup completed successfully', {
        ...backupInfo,
        sizeFormatted: this.formatFileSize(backupSize),
        durationFormatted: this.formatDuration(duration),
        category: 'backup'
      });

      // Track backup in analytics
      analytics.trackAdminAction('system', 'backup_created', {
        type,
        size: backupSize,
        duration
      });

      return backupInfo;

    } catch (error) {
      logger.error('Backup failed', {
        type,
        error: error.message,
        duration: Date.now() - startTime,
        category: 'backup'
      });

      // Track backup failure
      analytics.trackAdminAction('system', 'backup_failed', {
        type,
        error: error.message
      });

      throw error;

    } finally {
      this.isBackupRunning = false;
    }
  }

  async createBackupManifest(type, description) {
    const manifest = {
      type,
      description,
      timestamp: new Date().toISOString(),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      analytics: analytics.getMetrics(),
      files: {}
    };

    // Get file information for each directory
    const directories = [
      { name: 'data', path: this.dataDir },
      { name: 'logs', path: this.logsDir },
      { name: 'sessions', path: this.sessionsDir }
    ];

    for (const dir of directories) {
      try {
        const files = await this.getDirectoryFiles(dir.path);
        manifest.files[dir.name] = files;
      } catch (error) {
        manifest.files[dir.name] = { error: error.message };
      }
    }

    return manifest;
  }

  async getDirectoryFiles(dirPath) {
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      const result = {};

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        if (file.isFile()) {
          const stats = await fs.stat(filePath);
          result[file.name] = {
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        } else if (file.isDirectory()) {
          result[file.name] = await this.getDirectoryFiles(filePath);
        }
      }

      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  async createCompressedBackup(backupPath, manifest) {
    const manifestPath = backupPath.replace('.tar.gz', '.manifest.json');

    // Save manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Create compressed archive
    const output = createWriteStream(backupPath);
    const gzip = zlib.createGzip({ level: this.config.compressionLevel });

    // Create tar-like structure (simplified)
    const archive = [];

    // Add directories to archive
    const directories = [
      { name: 'data', path: this.dataDir },
      { name: 'logs', path: this.logsDir },
      { name: 'sessions', path: this.sessionsDir }
    ];

    for (const dir of directories) {
      try {
        const files = await this.getAllFiles(dir.path);
        for (const file of files) {
          const relativePath = path.relative(path.dirname(dir.path), file);
          const content = await fs.readFile(file);
          archive.push({
            path: relativePath,
            content: content.toString('base64')
          });
        }
      } catch (error) {
        logger.warn(`Failed to backup directory ${dir.name}`, {
          error: error.message,
          category: 'backup'
        });
      }
    }

    // Add manifest to archive
    archive.push({
      path: 'manifest.json',
      content: Buffer.from(JSON.stringify(manifest, null, 2)).toString('base64')
    });

    // Write compressed archive
    await pipelineAsync(
      require('stream').Readable.from([JSON.stringify(archive)]),
      gzip,
      output
    );

    // Clean up manifest file
    await fs.unlink(manifestPath);
  }

  async getAllFiles(dirPath) {
    const files = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isFile()) {
          files.push(fullPath);
        } else if (item.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
    }

    return files;
  }

  async saveBackupInfo(backupInfo) {
    const infoPath = path.join(this.backupDir, 'backup-info.json');

    try {
      let allBackups = [];

      try {
        const existingInfo = await fs.readFile(infoPath, 'utf8');
        allBackups = JSON.parse(existingInfo);
      } catch (error) {
        // File doesn't exist yet
      }

      allBackups.push(backupInfo);

      // Keep only recent backups info
      if (allBackups.length > this.config.maxBackups * 2) {
        allBackups = allBackups.slice(-this.config.maxBackups * 2);
      }

      await fs.writeFile(infoPath, JSON.stringify(allBackups, null, 2));

    } catch (error) {
      logger.error('Failed to save backup info', {
        error: error.message,
        category: 'backup'
      });
    }
  }

  async cleanupOldBackups(type) {
    try {
      const typeDir = path.join(this.backupDir, type);
      const files = await fs.readdir(typeDir);

      const backups = [];
      for (const file of files) {
        if (file.endsWith('.tar.gz')) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);
          backups.push({
            name: file,
            path: filePath,
            created: stats.birthtime
          });
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created - a.created);

      // Remove old backups based on retention policy
      const maxBackupsForType = type === 'daily' ? this.config.maxBackups :
                               type === 'weekly' ? 12 : // Keep 12 weeks
                               50; // Manual backups

      if (backups.length > maxBackupsForType) {
        const toDelete = backups.slice(maxBackupsForType);

        for (const backup of toDelete) {
          await fs.unlink(backup.path);
          logger.info('Old backup deleted', {
            name: backup.name,
            type,
            category: 'backup'
          });
        }
      }

      // Also cleanup by age
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      const expiredBackups = backups.filter(backup => backup.created < cutoffDate);

      for (const backup of expiredBackups) {
        try {
          await fs.unlink(backup.path);
          logger.info('Expired backup deleted', {
            name: backup.name,
            type,
            age: Math.floor((Date.now() - backup.created.getTime()) / (24 * 60 * 60 * 1000)),
            category: 'backup'
          });
        } catch (error) {
          logger.warn('Failed to delete expired backup', {
            name: backup.name,
            error: error.message,
            category: 'backup'
          });
        }
      }

    } catch (error) {
      logger.error('Failed to cleanup old backups', {
        type,
        error: error.message,
        category: 'backup'
      });
    }
  }

  async restoreBackup(backupName) {
    try {
      const backupPath = await this.findBackupPath(backupName);
      if (!backupPath) {
        throw new Error(`Backup not found: ${backupName}`);
      }

      logger.info('Starting backup restoration', { backupName, category: 'backup' });

      // Read and decompress backup
      const content = await fs.readFile(backupPath);
      const decompressed = zlib.gunzipSync(content);
      const archive = JSON.parse(decompressed.toString());

      // Restore files
      for (const item of archive) {
        if (item.path === 'manifest.json') continue;

        const targetPath = path.join(path.dirname(this.dataDir), item.path);
        const content = Buffer.from(item.content, 'base64');

        // Ensure directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        // Write file
        await fs.writeFile(targetPath, content);
      }

      logger.info('Backup restoration completed', { backupName, category: 'backup' });

      // Track restoration
      analytics.trackAdminAction('system', 'backup_restored', { backupName });

      return true;

    } catch (error) {
      logger.error('Backup restoration failed', {
        backupName,
        error: error.message,
        category: 'backup'
      });
      throw error;
    }
  }

  async findBackupPath(backupName) {
    const types = ['daily', 'weekly', 'manual'];

    for (const type of types) {
      const typePath = path.join(this.backupDir, type);

      try {
        const files = await fs.readdir(typePath);
        const matchingFile = files.find(file =>
          file.includes(backupName) && file.endsWith('.tar.gz')
        );

        if (matchingFile) {
          return path.join(typePath, matchingFile);
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    return null;
  }

  async getBackupList() {
    const infoPath = path.join(this.backupDir, 'backup-info.json');

    try {
      const content = await fs.readFile(infoPath, 'utf8');
      const backups = JSON.parse(content);

      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      return [];
    }
  }

  async getBackupStats() {
    const backups = await this.getBackupList();

    const stats = {
      total: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      byType: {},
      recent: backups.slice(0, 10)
    };

    backups.forEach(backup => {
      stats.byType[backup.type] = (stats.byType[backup.type] || 0) + 1;
    });

    stats.totalSizeFormatted = this.formatFileSize(stats.totalSize);

    return stats;
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Public API methods
  async manualBackup(description = 'Manual backup') {
    return await this.createBackup('manual', description);
  }

  async emergencyBackup() {
    return await this.createBackup('emergency', 'Emergency backup before critical operation');
  }

  getStatus() {
    return {
      isRunning: this.isBackupRunning,
      config: this.config,
      backupDir: this.backupDir
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Backup configuration updated', { config: this.config, category: 'backup' });
  }
}

module.exports = new BackupSystem();
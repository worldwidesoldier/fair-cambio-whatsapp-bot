const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

class CleanupService {
  constructor(options = {}) {
    this.options = {
      // Default retention periods (in days)
      logRetentionDays: options.logRetentionDays || 7,
      sessionRetentionDays: options.sessionRetentionDays || 30,
      cacheRetentionDays: options.cacheRetentionDays || 3,

      // File size limits (in MB)
      maxLogFileSize: options.maxLogFileSize || 50,
      maxSessionFileSize: options.maxSessionFileSize || 10,

      // Cleanup schedules
      dailyCleanupSchedule: options.dailyCleanupSchedule || '0 2 * * *', // 2 AM daily
      weeklyCleanupSchedule: options.weeklyCleanupSchedule || '0 3 * * 0', // 3 AM Sunday

      // Directories to clean
      directories: {
        logs: options.logsDir || './logs',
        sessions: options.sessionsDir || './sessions',
        cache: options.cacheDir || './cache',
        temp: options.tempDir || './temp',
        backup: options.backupDir || './sessions-backup'
      },

      // Advanced options
      enableAutoCleanup: options.enableAutoCleanup !== false,
      compressOldLogs: options.compressOldLogs !== false,
      backupBeforeCleanup: options.backupBeforeCleanup !== false,

      // Safety limits
      maxFilesToDeletePerRun: options.maxFilesToDeletePerRun || 100,
      minFreeSpaceGB: options.minFreeSpaceGB || 1
    };

    this.isRunning = false;
    this.lastCleanup = null;
    this.cleanupStats = {
      totalFilesDeleted: 0,
      totalSpaceFreed: 0,
      lastRun: null,
      errors: []
    };

    // Initialize cleanup schedules
    if (this.options.enableAutoCleanup) {
      this.initializeSchedules();
    }
  }

  initializeSchedules() {
    console.log('🧹 Iniciando serviço de limpeza automática...');

    // Daily cleanup task
    cron.schedule(this.options.dailyCleanupSchedule, () => {
      this.runDailyCleanup();
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });

    // Weekly deep cleanup
    cron.schedule(this.options.weeklyCleanupSchedule, () => {
      this.runWeeklyCleanup();
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });

    console.log(`✅ Limpeza diária agendada para: ${this.options.dailyCleanupSchedule}`);
    console.log(`✅ Limpeza semanal agendada para: ${this.options.weeklyCleanupSchedule}`);
  }

  async runDailyCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Limpeza já em execução, pulando...');
      return;
    }

    console.log('🧹 Iniciando limpeza diária...');

    try {
      this.isRunning = true;

      // Clean old logs
      await this.cleanupLogs();

      // Clean cache files
      await this.cleanupCache();

      // Clean temporary files
      await this.cleanupTempFiles();

      // Compress old log files
      if (this.options.compressOldLogs) {
        await this.compressOldLogs();
      }

      this.lastCleanup = new Date();
      console.log('✅ Limpeza diária concluída');

    } catch (error) {
      console.error('❌ Erro na limpeza diária:', error);
      this.cleanupStats.errors.push({
        timestamp: new Date(),
        type: 'daily',
        error: error.message
      });
    } finally {
      this.isRunning = false;
    }
  }

  async runWeeklyCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Limpeza já em execução, pulando...');
      return;
    }

    console.log('🧹 Iniciando limpeza semanal profunda...');

    try {
      this.isRunning = true;

      // Run daily cleanup first
      await this.cleanupLogs();
      await this.cleanupCache();
      await this.cleanupTempFiles();

      // Deep cleanup tasks
      await this.cleanupOldSessions();
      await this.cleanupBackupFiles();
      await this.rotateLargeLogs();

      // System optimization
      await this.optimizeFileSystem();

      console.log('✅ Limpeza semanal concluída');

    } catch (error) {
      console.error('❌ Erro na limpeza semanal:', error);
      this.cleanupStats.errors.push({
        timestamp: new Date(),
        type: 'weekly',
        error: error.message
      });
    } finally {
      this.isRunning = false;
    }
  }

  async cleanupLogs() {
    const logsDir = this.options.directories.logs;
    console.log(`🗂️ Limpando logs antigos em: ${logsDir}`);

    try {
      await this.ensureDirectoryExists(logsDir);
      const files = await this.getFilesOlderThan(logsDir, this.options.logRetentionDays);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files.slice(0, this.options.maxFilesToDeletePerRun)) {
        try {
          const stats = await fs.stat(file);
          await fs.unlink(file);

          deletedCount++;
          freedSpace += stats.size;

          console.log(`🗑️ Log removido: ${path.basename(file)} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        } catch (error) {
          console.error(`❌ Erro ao remover log ${file}:`, error.message);
        }
      }

      this.updateStats(deletedCount, freedSpace);
      console.log(`✅ Logs limpos: ${deletedCount} arquivos, ${(freedSpace / 1024 / 1024).toFixed(2)}MB liberados`);

    } catch (error) {
      console.error('❌ Erro na limpeza de logs:', error);
    }
  }

  async cleanupCache() {
    const cacheDir = this.options.directories.cache;
    console.log(`💾 Limpando cache em: ${cacheDir}`);

    try {
      await this.ensureDirectoryExists(cacheDir);
      const files = await this.getFilesOlderThan(cacheDir, this.options.cacheRetentionDays);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          await fs.unlink(file);

          deletedCount++;
          freedSpace += stats.size;
        } catch (error) {
          console.error(`❌ Erro ao remover cache ${file}:`, error.message);
        }
      }

      this.updateStats(deletedCount, freedSpace);
      console.log(`✅ Cache limpo: ${deletedCount} arquivos, ${(freedSpace / 1024 / 1024).toFixed(2)}MB liberados`);

    } catch (error) {
      console.error('❌ Erro na limpeza de cache:', error);
    }
  }

  async cleanupTempFiles() {
    const tempDir = this.options.directories.temp;
    console.log(`🗂️ Limpando arquivos temporários em: ${tempDir}`);

    try {
      await this.ensureDirectoryExists(tempDir);
      const files = await this.getFilesOlderThan(tempDir, 1); // Remove temp files older than 1 day

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          await fs.unlink(file);

          deletedCount++;
          freedSpace += stats.size;
        } catch (error) {
          console.error(`❌ Erro ao remover temp ${file}:`, error.message);
        }
      }

      this.updateStats(deletedCount, freedSpace);
      console.log(`✅ Temporários limpos: ${deletedCount} arquivos`);

    } catch (error) {
      console.error('❌ Erro na limpeza de temporários:', error);
    }
  }

  async cleanupOldSessions() {
    const sessionsDir = this.options.directories.sessions;
    console.log(`🔐 Limpando sessões antigas em: ${sessionsDir}`);

    try {
      await this.ensureDirectoryExists(sessionsDir);

      // Only clean obviously old/corrupted session files
      const files = await this.getFilesOlderThan(sessionsDir, this.options.sessionRetentionDays);
      const corruptedFiles = await this.findCorruptedSessionFiles(sessionsDir);

      const filesToDelete = [...new Set([...files, ...corruptedFiles])];

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of filesToDelete) {
        try {
          // Backup before deleting if enabled
          if (this.options.backupBeforeCleanup) {
            await this.backupFile(file);
          }

          const stats = await fs.stat(file);
          await fs.unlink(file);

          deletedCount++;
          freedSpace += stats.size;

          console.log(`🗑️ Sessão removida: ${path.basename(file)}`);
        } catch (error) {
          console.error(`❌ Erro ao remover sessão ${file}:`, error.message);
        }
      }

      this.updateStats(deletedCount, freedSpace);
      console.log(`✅ Sessões limpas: ${deletedCount} arquivos`);

    } catch (error) {
      console.error('❌ Erro na limpeza de sessões:', error);
    }
  }

  async cleanupBackupFiles() {
    const backupDir = this.options.directories.backup;
    console.log(`💾 Limpando backups antigos em: ${backupDir}`);

    try {
      await this.ensureDirectoryExists(backupDir);
      const files = await this.getFilesOlderThan(backupDir, 14); // Keep backups for 14 days

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          await fs.unlink(file);

          deletedCount++;
          freedSpace += stats.size;
        } catch (error) {
          console.error(`❌ Erro ao remover backup ${file}:`, error.message);
        }
      }

      this.updateStats(deletedCount, freedSpace);
      console.log(`✅ Backups limpos: ${deletedCount} arquivos`);

    } catch (error) {
      console.error('❌ Erro na limpeza de backups:', error);
    }
  }

  async rotateLargeLogs() {
    const logsDir = this.options.directories.logs;
    console.log(`🔄 Rotacionando logs grandes em: ${logsDir}`);

    try {
      const files = await fs.readdir(logsDir);

      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);

        // Rotate files larger than maxLogFileSize
        if (stats.size > this.options.maxLogFileSize * 1024 * 1024) {
          await this.rotateLogFile(filePath);
        }
      }

    } catch (error) {
      console.error('❌ Erro na rotação de logs:', error);
    }
  }

  async rotateLogFile(filePath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${filePath}.${timestamp}`;

      await fs.rename(filePath, rotatedPath);
      console.log(`🔄 Log rotacionado: ${path.basename(filePath)} -> ${path.basename(rotatedPath)}`);

    } catch (error) {
      console.error(`❌ Erro ao rotacionar log ${filePath}:`, error);
    }
  }

  async compressOldLogs() {
    // Note: Compression would require additional dependencies like zlib
    // For now, we'll just log the intention
    console.log('🗜️ Compressão de logs (funcionalidade futura)');
  }

  async optimizeFileSystem() {
    console.log('⚡ Otimizando sistema de arquivos...');

    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️ Garbage collection executado');
      }

      // Log current memory usage
      const memUsage = process.memoryUsage();
      console.log(`💾 Uso de memória após limpeza: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
      console.error('❌ Erro na otimização:', error);
    }
  }

  async getFilesOlderThan(directory, days) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const files = [];

    try {
      const items = await fs.readdir(directory);

      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao listar arquivos em ${directory}:`, error);
    }

    return files;
  }

  async findCorruptedSessionFiles(directory) {
    const corruptedFiles = [];

    try {
      const items = await fs.readdir(directory);

      for (const item of items) {
        const itemPath = path.join(directory, item);

        try {
          const stats = await fs.stat(itemPath);

          // Consider files corrupted if they're 0 bytes or very small
          if (stats.size === 0 || (stats.size < 10 && item.endsWith('.json'))) {
            corruptedFiles.push(itemPath);
          }
        } catch (error) {
          // If we can't stat the file, it might be corrupted
          corruptedFiles.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar arquivos corrompidos em ${directory}:`, error);
    }

    return corruptedFiles;
  }

  async backupFile(filePath) {
    try {
      const backupDir = this.options.directories.backup;
      await this.ensureDirectoryExists(backupDir);

      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${fileName}.backup.${timestamp}`);

      const data = await fs.readFile(filePath);
      await fs.writeFile(backupPath, data);

      console.log(`💾 Backup criado: ${path.basename(backupPath)}`);
    } catch (error) {
      console.error(`❌ Erro ao criar backup de ${filePath}:`, error);
    }
  }

  async ensureDirectoryExists(directory) {
    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  updateStats(filesDeleted, spaceFreed) {
    this.cleanupStats.totalFilesDeleted += filesDeleted;
    this.cleanupStats.totalSpaceFreed += spaceFreed;
    this.cleanupStats.lastRun = new Date();
  }

  // Manual cleanup methods
  async manualCleanup() {
    console.log('🧹 Executando limpeza manual...');
    await this.runDailyCleanup();
  }

  async deepCleanup() {
    console.log('🧹 Executando limpeza profunda manual...');
    await this.runWeeklyCleanup();
  }

  // Status and monitoring
  getCleanupStats() {
    return {
      ...this.cleanupStats,
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup,
      totalSpaceFreedMB: Math.round(this.cleanupStats.totalSpaceFreed / 1024 / 1024 * 100) / 100
    };
  }

  // Graceful shutdown
  async stop() {
    console.log('🛑 Parando serviço de limpeza...');
    // Note: node-cron tasks are automatically stopped when the process exits
  }
}

module.exports = CleanupService;
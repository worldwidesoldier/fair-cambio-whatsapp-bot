const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

class SessionManager {
  constructor(sessionName = 'fair-cambio') {
    this.sessionPath = path.join(__dirname, '../../sessions', sessionName);
    this.backupPath = path.join(__dirname, '../../sessions', `${sessionName}-backup`);
    this.activeSessions = new Map();
    this.maxBackups = 5; // Keep 5 backups
  }

  async getAuthState() {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
    return { state, saveCreds };
  }

  addSession(phone, sock) {
    this.activeSessions.set(phone, {
      sock,
      startTime: new Date(),
      lastActivity: new Date()
    });
  }

  getSession(phone) {
    return this.activeSessions.get(phone);
  }

  updateActivity(phone) {
    const session = this.activeSessions.get(phone);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  removeSession(phone) {
    this.activeSessions.delete(phone);
  }

  handleDisconnect(reason) {
    const lastDisconnect = reason;

    switch (lastDisconnect) {
      case DisconnectReason.badSession:
        console.log('Sessão inválida. Deletando sessão...');
        return { shouldReconnect: false, deleteSession: true };

      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
        console.log('Conexão perdida. Tentando reconectar...');
        return { shouldReconnect: true, deleteSession: false };

      case DisconnectReason.connectionReplaced:
        console.log('Conexão substituída em outro dispositivo');
        return { shouldReconnect: false, deleteSession: false };

      case DisconnectReason.loggedOut:
        console.log('Desconectado. Deletando sessão...');
        return { shouldReconnect: false, deleteSession: true };

      case DisconnectReason.restartRequired:
        console.log('Reinicialização necessária...');
        return { shouldReconnect: true, deleteSession: false };

      case DisconnectReason.timedOut:
        console.log('Tempo esgotado. Reconectando...');
        return { shouldReconnect: true, deleteSession: false };

      default:
        console.log('Razão de desconexão desconhecida:', lastDisconnect);
        return { shouldReconnect: true, deleteSession: false };
    }
  }

  async backupSession() {
    try {
      if (!fsSync.existsSync(this.sessionPath)) {
        console.log('⚠️ Sessão não encontrada para backup');
        return false;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `${this.backupPath}-${timestamp}`;

      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });

      // Copy all session files
      const sessionFiles = await fs.readdir(this.sessionPath);

      for (const file of sessionFiles) {
        const sourcePath = path.join(this.sessionPath, file);
        const destPath = path.join(backupDir, file);

        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          await fs.copyFile(sourcePath, destPath);
        }
      }

      console.log(`✅ Sessão salva em backup: ${backupDir}`);

      // Clean old backups
      await this.cleanOldBackups();

      return true;
    } catch (error) {
      console.error('❌ Erro ao fazer backup da sessão:', error);
      return false;
    }
  }

  async cleanOldBackups() {
    try {
      const sessionsDir = path.dirname(this.sessionPath);
      const files = await fs.readdir(sessionsDir);

      // Filter backup directories
      const backupDirs = files
        .filter(file => file.startsWith(path.basename(this.backupPath)))
        .map(file => ({
          name: file,
          path: path.join(sessionsDir, file),
          timestamp: file.split('-').slice(-6).join('-') // Extract timestamp
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort by newest first

      // Keep only maxBackups
      if (backupDirs.length > this.maxBackups) {
        const toDelete = backupDirs.slice(this.maxBackups);

        for (const backup of toDelete) {
          await fs.rm(backup.path, { recursive: true, force: true });
          console.log(`🗑️ Backup antigo removido: ${backup.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao limpar backups antigos:', error);
    }
  }

  async restoreSession(backupTimestamp = null) {
    try {
      const sessionsDir = path.dirname(this.sessionPath);
      const files = await fs.readdir(sessionsDir);

      // Find available backups
      const backupDirs = files
        .filter(file => file.startsWith(path.basename(this.backupPath)))
        .map(file => ({
          name: file,
          path: path.join(sessionsDir, file),
          timestamp: file.split('-').slice(-6).join('-')
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (backupDirs.length === 0) {
        console.log('❌ Nenhum backup encontrado');
        return false;
      }

      // Select backup to restore
      let selectedBackup;
      if (backupTimestamp) {
        selectedBackup = backupDirs.find(b => b.timestamp === backupTimestamp);
        if (!selectedBackup) {
          console.log(`❌ Backup com timestamp ${backupTimestamp} não encontrado`);
          return false;
        }
      } else {
        selectedBackup = backupDirs[0]; // Most recent
      }

      console.log(`🔄 Restaurando sessão de: ${selectedBackup.name}`);

      // Remove current session if exists
      if (fsSync.existsSync(this.sessionPath)) {
        await fs.rm(this.sessionPath, { recursive: true, force: true });
      }

      // Create session directory
      await fs.mkdir(this.sessionPath, { recursive: true });

      // Copy backup files to session directory
      const backupFiles = await fs.readdir(selectedBackup.path);

      for (const file of backupFiles) {
        const sourcePath = path.join(selectedBackup.path, file);
        const destPath = path.join(this.sessionPath, file);

        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          await fs.copyFile(sourcePath, destPath);
        }
      }

      console.log(`✅ Sessão restaurada com sucesso de: ${selectedBackup.name}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao restaurar sessão:', error);
      return false;
    }
  }

  async getSessionStatus() {
    const sessionExists = fsSync.existsSync(this.sessionPath);
    const sessionSize = sessionExists ? await this.calculateDirectorySize(this.sessionPath) : 0;

    const sessionsDir = path.dirname(this.sessionPath);
    const files = await fs.readdir(sessionsDir);

    const backupDirs = files
      .filter(file => file.startsWith(path.basename(this.backupPath)))
      .map(file => ({
        name: file,
        timestamp: file.split('-').slice(-6).join('-')
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      sessionExists,
      sessionPath: this.sessionPath,
      sessionSize,
      backups: backupDirs,
      backupCount: backupDirs.length,
      lastBackup: backupDirs[0]?.timestamp || null
    };
  }

  async calculateDirectorySize(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = SessionManager;
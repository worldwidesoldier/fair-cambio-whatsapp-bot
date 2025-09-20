const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs').promises;

class BranchSessionManager {
  constructor(branchId) {
    if (!branchId) {
      throw new Error('Branch ID é obrigatório para o SessionManager');
    }

    this.branchId = branchId;
    this.sessionPath = path.join(__dirname, '../../sessions', branchId);
  }

  async getAuthState() {
    try {
      // Garante que o diretório da sessão existe
      await fs.mkdir(this.sessionPath, { recursive: true });

      // Carrega ou cria novo estado de autenticação
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      console.log(`📁 Sessão carregada para filial ${this.branchId}: ${this.sessionPath}`);

      return {
        state,
        saveCreds: async () => {
          try {
            await saveCreds();
            console.log(`💾 Credenciais salvas para filial ${this.branchId}`);
          } catch (error) {
            console.error(`❌ Erro ao salvar credenciais da filial ${this.branchId}:`, error);
          }
        }
      };
    } catch (error) {
      console.error(`❌ Erro ao carregar estado de autenticação da filial ${this.branchId}:`, error);
      throw error;
    }
  }

  handleDisconnect(reason) {
    console.log(`🔌 Filial ${this.branchId} desconectada. Código:`, reason);

    let shouldReconnect = false;
    let shouldDeleteSession = false;
    let message = '';

    switch (reason) {
      case DisconnectReason.badSession:
        message = 'Sessão inválida';
        shouldDeleteSession = true;
        shouldReconnect = true;
        break;

      case DisconnectReason.connectionClosed:
        message = 'Conexão fechada';
        shouldReconnect = true;
        break;

      case DisconnectReason.connectionLost:
        message = 'Conexão perdida';
        shouldReconnect = true;
        break;

      case DisconnectReason.connectionReplaced:
        message = 'Conexão substituída (outro dispositivo conectou)';
        shouldReconnect = false;
        break;

      case DisconnectReason.loggedOut:
        message = 'Logout realizado';
        shouldDeleteSession = true;
        shouldReconnect = true;
        break;

      case DisconnectReason.restartRequired:
        message = 'Reinicialização necessária';
        shouldReconnect = true;
        break;

      case DisconnectReason.timedOut:
        message = 'Timeout de conexão';
        shouldReconnect = true;
        break;

      case DisconnectReason.multideviceMismatch:
        message = 'Incompatibilidade de multidispositivo';
        shouldDeleteSession = true;
        shouldReconnect = true;
        break;

      default:
        message = `Desconectado com código: ${reason}`;
        shouldReconnect = true;
        break;
    }

    console.log(`📋 Filial ${this.branchId}: ${message}`);
    console.log(`🔄 Deve reconectar: ${shouldReconnect}`);
    console.log(`🗑️ Deve limpar sessão: ${shouldDeleteSession}`);

    if (shouldDeleteSession) {
      this.deleteSession().catch(console.error);
    }

    return {
      shouldReconnect,
      shouldDeleteSession,
      message
    };
  }

  async deleteSession() {
    try {
      console.log(`🗑️ Limpando sessão da filial ${this.branchId}...`);

      // Remove todos os arquivos da sessão
      const files = await fs.readdir(this.sessionPath);

      for (const file of files) {
        const filePath = path.join(this.sessionPath, file);
        await fs.unlink(filePath);
        console.log(`🗑️ Arquivo removido: ${file}`);
      }

      console.log(`✅ Sessão da filial ${this.branchId} limpa com sucesso`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📁 Diretório de sessão da filial ${this.branchId} não existe`);
      } else {
        console.error(`❌ Erro ao limpar sessão da filial ${this.branchId}:`, error);
      }
    }
  }

  async backupSession() {
    try {
      const backupPath = path.join(__dirname, '../../sessions', 'backups', this.branchId);
      await fs.mkdir(backupPath, { recursive: true });

      const files = await fs.readdir(this.sessionPath);

      for (const file of files) {
        const sourcePath = path.join(this.sessionPath, file);
        const destPath = path.join(backupPath, `${Date.now()}-${file}`);
        await fs.copyFile(sourcePath, destPath);
      }

      console.log(`💾 Backup da sessão da filial ${this.branchId} criado em: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error(`❌ Erro ao fazer backup da sessão da filial ${this.branchId}:`, error);
      throw error;
    }
  }

  async restoreSession(backupPath) {
    try {
      console.log(`🔄 Restaurando sessão da filial ${this.branchId} de: ${backupPath}`);

      // Limpa sessão atual
      await this.deleteSession();

      // Copia arquivos do backup
      const backupFiles = await fs.readdir(backupPath);

      for (const file of backupFiles) {
        if (file.includes('-')) {
          const originalName = file.substring(file.indexOf('-') + 1);
          const sourcePath = path.join(backupPath, file);
          const destPath = path.join(this.sessionPath, originalName);
          await fs.copyFile(sourcePath, destPath);
        }
      }

      console.log(`✅ Sessão da filial ${this.branchId} restaurada com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao restaurar sessão da filial ${this.branchId}:`, error);
      throw error;
    }
  }

  async getSessionInfo() {
    try {
      const files = await fs.readdir(this.sessionPath);
      const fileStats = [];

      for (const file of files) {
        const filePath = path.join(this.sessionPath, file);
        const stats = await fs.stat(filePath);
        fileStats.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        });
      }

      return {
        branchId: this.branchId,
        sessionPath: this.sessionPath,
        files: fileStats,
        totalFiles: files.length,
        totalSize: fileStats.reduce((sum, file) => sum + file.size, 0)
      };
    } catch (error) {
      console.error(`❌ Erro ao obter informações da sessão da filial ${this.branchId}:`, error);
      return {
        branchId: this.branchId,
        sessionPath: this.sessionPath,
        files: [],
        totalFiles: 0,
        totalSize: 0,
        error: error.message
      };
    }
  }

  async validateSession() {
    try {
      const sessionInfo = await this.getSessionInfo();

      // Verifica se existem arquivos essenciais
      const requiredFiles = ['creds.json'];
      const existingFiles = sessionInfo.files.map(f => f.name);
      const hasRequiredFiles = requiredFiles.every(file => existingFiles.includes(file));

      if (!hasRequiredFiles) {
        console.log(`⚠️ Sessão da filial ${this.branchId} está incompleta`);
        return false;
      }

      // Verifica se os arquivos não estão corrompidos
      try {
        const credsPath = path.join(this.sessionPath, 'creds.json');
        const credsContent = await fs.readFile(credsPath, 'utf8');
        JSON.parse(credsContent); // Testa se é JSON válido
      } catch (error) {
        console.log(`⚠️ Arquivo de credenciais da filial ${this.branchId} está corrompido`);
        return false;
      }

      console.log(`✅ Sessão da filial ${this.branchId} é válida`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao validar sessão da filial ${this.branchId}:`, error);
      return false;
    }
  }
}

module.exports = BranchSessionManager;
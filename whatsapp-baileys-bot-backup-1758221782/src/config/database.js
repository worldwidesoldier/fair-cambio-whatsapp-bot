const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.models = {};
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/faircambio';

      this.connection = await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      this.isConnected = true;
      console.log('✅ Database connected successfully');
      return this.connection;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      // Fallback to file-based storage
      console.log('📁 Falling back to file-based storage');
      return null;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('✅ Database disconnected');
    }
  }

  // Hybrid storage methods - work with both database and files
  async saveData(collection, data, id = null) {
    if (this.isConnected && this.models[collection]) {
      // Database storage
      if (id) {
        return await this.models[collection].findByIdAndUpdate(id, data, { new: true, upsert: true });
      } else {
        const doc = new this.models[collection](data);
        return await doc.save();
      }
    } else {
      // File storage fallback
      return await this.saveToFile(collection, data, id);
    }
  }

  async getData(collection, query = {}) {
    if (this.isConnected && this.models[collection]) {
      // Database retrieval
      return await this.models[collection].find(query);
    } else {
      // File retrieval fallback
      return await this.loadFromFile(collection, query);
    }
  }

  async saveToFile(collection, data, id = null) {
    const filePath = path.join(__dirname, `../../data/${collection}.json`);

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      let existingData = [];
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        existingData = JSON.parse(fileContent);
      } catch {
        // File doesn't exist yet
      }

      if (id) {
        // Update existing record
        const index = existingData.findIndex(item => item._id === id);
        if (index !== -1) {
          existingData[index] = { ...existingData[index], ...data, _id: id };
        } else {
          existingData.push({ ...data, _id: id, createdAt: new Date().toISOString() });
        }
      } else {
        // Add new record
        const newRecord = {
          ...data,
          _id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };
        existingData.push(newRecord);
      }

      await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
      return existingData;
    } catch (error) {
      console.error(`Error saving to file ${collection}:`, error);
      throw error;
    }
  }

  async loadFromFile(collection, query = {}) {
    const filePath = path.join(__dirname, `../../data/${collection}.json`);

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      let data = JSON.parse(fileContent);

      // Simple query filtering for file-based storage
      if (Object.keys(query).length > 0) {
        data = data.filter(item => {
          return Object.entries(query).every(([key, value]) => item[key] === value);
        });
      }

      return data;
    } catch {
      return [];
    }
  }

  // Register schemas for database mode
  registerModel(name, schema) {
    if (mongoose.models[name]) {
      this.models[name] = mongoose.models[name];
    } else {
      this.models[name] = mongoose.model(name, schema);
    }
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;
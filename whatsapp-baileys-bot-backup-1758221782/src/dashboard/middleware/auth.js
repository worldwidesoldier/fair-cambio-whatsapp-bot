const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'fair-cambio-dashboard-secret-key';
const USERS_FILE = path.join(__dirname, '../config/users.json');

// Default admin user
const DEFAULT_ADMIN = {
    id: '1',
    username: 'admin',
    name: 'Administrador',
    email: 'admin@faircambio.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'admin',
    permissions: ['all'],
    active: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
};

class AuthManager {
    constructor() {
        this.users = [];
        this.initializeUsers();
    }

    async initializeUsers() {
        try {
            await this.loadUsers();
        } catch (error) {
            console.log('Creating default users file...');
            await this.createDefaultUsers();
        }
    }

    async loadUsers() {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        this.users = JSON.parse(data);
    }

    async saveUsers() {
        await fs.writeFile(USERS_FILE, JSON.stringify(this.users, null, 2));
    }

    async createDefaultUsers() {
        // Ensure config directory exists
        const configDir = path.dirname(USERS_FILE);
        try {
            await fs.mkdir(configDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        this.users = [DEFAULT_ADMIN];
        await this.saveUsers();
    }

    async findUserByUsername(username) {
        return this.users.find(user => user.username === username && user.active);
    }

    async findUserById(id) {
        return this.users.find(user => user.id === id && user.active);
    }

    async validatePassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }

    generateToken(user) {
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };

        return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    }

    verifyToken(token) {
        return jwt.verify(token, JWT_SECRET);
    }

    async updateLastLogin(userId) {
        const user = await this.findUserById(userId);
        if (user) {
            user.lastLogin = new Date().toISOString();
            await this.saveUsers();
        }
    }

    async createUser(userData) {
        const existingUser = await this.findUserByUsername(userData.username);
        if (existingUser) {
            throw new Error('Usuário já existe');
        }

        const newUser = {
            id: Date.now().toString(),
            username: userData.username,
            name: userData.name,
            email: userData.email,
            password: await this.hashPassword(userData.password),
            role: userData.role || 'user',
            permissions: userData.permissions || ['read'],
            active: true,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        this.users.push(newUser);
        await this.saveUsers();

        // Remove password from response
        const { password, ...userResponse } = newUser;
        return userResponse;
    }

    async updateUser(userId, updates) {
        const userIndex = this.users.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            throw new Error('Usuário não encontrado');
        }

        const user = this.users[userIndex];

        // Update allowed fields
        if (updates.name) user.name = updates.name;
        if (updates.email) user.email = updates.email;
        if (updates.role) user.role = updates.role;
        if (updates.permissions) user.permissions = updates.permissions;
        if (updates.password) user.password = await this.hashPassword(updates.password);

        user.updatedAt = new Date().toISOString();

        await this.saveUsers();

        // Remove password from response
        const { password, ...userResponse } = user;
        return userResponse;
    }

    async deleteUser(userId) {
        const userIndex = this.users.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            throw new Error('Usuário não encontrado');
        }

        // Don't allow deleting the default admin
        if (this.users[userIndex].username === 'admin') {
            throw new Error('Não é possível deletar o usuário admin padrão');
        }

        this.users.splice(userIndex, 1);
        await this.saveUsers();
    }

    async toggleUser(userId) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }

        // Don't allow disabling the default admin
        if (user.username === 'admin') {
            throw new Error('Não é possível desativar o usuário admin padrão');
        }

        user.active = !user.active;
        await this.saveUsers();

        const { password, ...userResponse } = user;
        return userResponse;
    }

    getAllUsers() {
        return this.users.map(user => {
            const { password, ...userResponse } = user;
            return userResponse;
        });
    }

    hasPermission(user, permission) {
        if (user.permissions.includes('all')) {
            return true;
        }
        return user.permissions.includes(permission);
    }
}

const authManager = new AuthManager();

// Middleware functions
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de acesso requerido' });
        }

        const token = authHeader.substring(7);
        const decoded = authManager.verifyToken(token);
        const user = await authManager.findUserById(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

const authorize = (roles = [], permissions = []) => {
    return (req, res, next) => {
        const user = req.user;

        // Check role
        if (roles.length > 0 && !roles.includes(user.role)) {
            return res.status(403).json({ error: 'Acesso negado: role insuficiente' });
        }

        // Check permissions
        if (permissions.length > 0) {
            const hasPermission = permissions.some(permission =>
                authManager.hasPermission(user, permission)
            );

            if (!hasPermission) {
                return res.status(403).json({ error: 'Acesso negado: permissão insuficiente' });
            }
        }

        next();
    };
};

module.exports = {
    authManager,
    authenticate,
    authorize
};
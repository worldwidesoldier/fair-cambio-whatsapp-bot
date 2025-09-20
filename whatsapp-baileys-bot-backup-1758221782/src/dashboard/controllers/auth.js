const { authManager } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const AuthController = {
    login: asyncHandler(async (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }

        const user = await authManager.findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const isValidPassword = await authManager.validatePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = authManager.generateToken(user);
        await authManager.updateLastLogin(user.id);

        // Remove password from response
        const { password: _, ...userResponse } = user;

        res.json({
            token,
            user: userResponse,
            message: 'Login realizado com sucesso'
        });
    }),

    logout: asyncHandler(async (req, res) => {
        // In a real implementation, you might want to blacklist the token
        res.json({ message: 'Logout realizado com sucesso' });
    }),

    refresh: asyncHandler(async (req, res) => {
        const user = req.user;
        const token = authManager.generateToken(user);

        res.json({
            token,
            message: 'Token renovado com sucesso'
        });
    }),

    getProfile: asyncHandler(async (req, res) => {
        const user = req.user;
        const { password, ...userResponse } = user;

        res.json(userResponse);
    }),

    updateProfile: asyncHandler(async (req, res) => {
        const { name, email, currentPassword, newPassword } = req.body;
        const user = req.user;

        const updates = {};

        if (name) updates.name = name;
        if (email) updates.email = email;

        // Handle password change
        if (currentPassword && newPassword) {
            const isValidPassword = await authManager.validatePassword(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(400).json({ error: 'Senha atual incorreta' });
            }
            updates.password = newPassword;
        }

        const updatedUser = await authManager.updateUser(user.id, updates);

        res.json({
            user: updatedUser,
            message: 'Perfil atualizado com sucesso'
        });
    }),

    // Admin-only methods
    getUsers: asyncHandler(async (req, res) => {
        const users = authManager.getAllUsers();
        res.json(users);
    }),

    createUser: asyncHandler(async (req, res) => {
        const { username, name, email, password, role, permissions } = req.body;

        if (!username || !name || !password) {
            return res.status(400).json({ error: 'Usuário, nome e senha são obrigatórios' });
        }

        const newUser = await authManager.createUser({
            username,
            name,
            email,
            password,
            role,
            permissions
        });

        res.status(201).json({
            user: newUser,
            message: 'Usuário criado com sucesso'
        });
    }),

    updateUser: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const updatedUser = await authManager.updateUser(id, updates);

        res.json({
            user: updatedUser,
            message: 'Usuário atualizado com sucesso'
        });
    }),

    deleteUser: asyncHandler(async (req, res) => {
        const { id } = req.params;

        await authManager.deleteUser(id);

        res.json({ message: 'Usuário deletado com sucesso' });
    }),

    toggleUser: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const user = await authManager.toggleUser(id);

        res.json({
            user,
            message: `Usuário ${user.active ? 'ativado' : 'desativado'} com sucesso`
        });
    }),

    // Method to verify token (used by middleware)
    verifyToken: (token) => {
        return authManager.verifyToken(token);
    }
};

module.exports = AuthController;
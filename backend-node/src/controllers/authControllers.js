const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña requeridos' });
        }

        const usuario = await prisma.usuario.findUnique({
            where: { email },
            include: { rol: true }
        });

        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        if (!usuario.estado) {
            return res.status(403).json({ message: 'Usuario desactivado' });
        }

        const isMatch = await bcrypt.compare(password, usuario.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // Actualizar última conexión
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: { ultimaConexion: new Date() }
        });

        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol.nombre },
            process.env.JWT_SECRET || 'secreto_super_seguro_123',
            { expiresIn: '8h' }
        );

        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol.nombre,
                rolId: usuario.rolId
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: error.message });
    }
};

const getProfile = async (req, res) => {
    try {
        const id = req.usuario?.id;
        if (!id) return res.status(401).json({ message: 'No autenticado' });

        const usuario = await prisma.usuario.findUnique({
            where: { id },
            include: { rol: true }
        });

        if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

        res.json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol.nombre
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    login,
    getProfile
};

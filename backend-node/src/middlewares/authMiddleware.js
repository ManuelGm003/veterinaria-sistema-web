const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const verificarToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Token de autenticación no proporcionado' });
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'secreto_super_seguro_123';

        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (jwtErr) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }

        const usuario = await prisma.usuario.findUnique({
            where: { id: decoded.id },
            include: { rol: true }
        });

        if (!usuario) {
            return res.status(401).json({ message: 'El usuario ya no existe en el sistema' });
        }

        if (!usuario.estado) {
            return res.status(403).json({ message: 'Usuario desactivado' });
        }

        req.usuario = {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            rol: usuario.rol.nombre,
            rolId: usuario.rolId
        };

        next();
    } catch (error) {
        console.error('Error en verificarToken:', error);
        return res.status(500).json({ error: error.message });
    }
};

const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ message: 'No autenticado' });
        }

        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                message: `Acceso denegado: Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}. Rol actual: ${req.usuario.rol}.`
            });
        }

        next();
    };
};

module.exports = {
    verificarToken,
    permitirRoles
};

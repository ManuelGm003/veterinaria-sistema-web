const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

// RF-02: Gestión de usuarios según su rol (Administrador, Cajero, Bodeguero)
const getUsuarios = async (req, res) => {
    try {
        const usuarios = await prisma.usuario.findMany({
            include: { rol: true },
            orderBy: { id: 'asc' }
        });

        // Omitir contraseñas en respuesta
        const usuariosSanitizados = usuarios.map(u => ({
            id: u.id,
            nombre: u.nombre,
            email: u.email,
            rolId: u.rolId,
            rol: u.rol.nombre,
            estado: u.estado,
            ultimaConexion: u.ultimaConexion
        }));

        res.json(usuariosSanitizados);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getRoles = async (req, res) => {
    try {
        const roles = await prisma.rol.findMany();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createUsuario = async (req, res) => {
    try {
        const { nombre, email, password, rolId } = req.body;
        if (!nombre || !email || !password || !rolId) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        const existente = await prisma.usuario.findUnique({ where: { email } });
        if (existente) {
            return res.status(400).json({ message: 'Ya existe un usuario con este correo electrónico' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const nuevo = await prisma.usuario.create({
            data: {
                nombre,
                email,
                password: hashedPassword,
                rolId: parseInt(rolId),
                estado: true
            },
            include: { rol: true }
        });

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            usuario: {
                id: nuevo.id,
                nombre: nuevo.nombre,
                email: nuevo.email,
                rol: nuevo.rol.nombre,
                estado: nuevo.estado
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateUsuario = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nombre, email, password, rolId, estado } = req.body;

        const dataUpdate = {};
        if (nombre) dataUpdate.nombre = nombre;
        if (email) dataUpdate.email = email;
        if (rolId) dataUpdate.rolId = parseInt(rolId);
        if (typeof estado === 'boolean') dataUpdate.estado = estado;
        if (password && password.trim() !== '') {
            dataUpdate.password = await bcrypt.hash(password, 10);
        }

        const actualizado = await prisma.usuario.update({
            where: { id },
            data: dataUpdate,
            include: { rol: true }
        });

        res.json({
            message: 'Usuario actualizado',
            usuario: {
                id: actualizado.id,
                nombre: actualizado.nombre,
                email: actualizado.email,
                rol: actualizado.rol.nombre,
                estado: actualizado.estado
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const toggleEstadoUsuario = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const user = await prisma.usuario.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const actualizado = await prisma.usuario.update({
            where: { id },
            data: { estado: !user.estado }
        });

        res.json({ message: `Usuario ${actualizado.estado ? 'activado' : 'desactivado'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getUsuarios,
    getRoles,
    createUsuario,
    updateUsuario,
    toggleEstadoUsuario
};

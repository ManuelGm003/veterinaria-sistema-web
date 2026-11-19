const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña requeridos' });
        }

        const emailTrim = email.trim().toLowerCase();
        const usuario = await prisma.usuario.findUnique({
            where: { email: emailTrim },
            include: { rol: true }
        });

        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        if (!usuario.estado) {
            return res.status(403).json({ message: 'Usuario desactivado' });
        }

        const ahora = new Date();

        // 1. Verificar si la cuenta se encuentra bloqueada por 15 minutos
        if (usuario.bloqueadoHasta && new Date(usuario.bloqueadoHasta) > ahora) {
            const msRestantes = new Date(usuario.bloqueadoHasta).getTime() - ahora.getTime();
            const minutosRestantes = Math.ceil(msRestantes / (60 * 1000));
            return res.status(429).json({
                bloqueado: true,
                message: `Cuenta bloqueada temporalmente por exceso de intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s).`,
                bloqueadoHasta: usuario.bloqueadoHasta
            });
        }

        // 2. Comparar contraseña
        const isMatch = await bcrypt.compare(password, usuario.password);
        if (!isMatch) {
            // Si el bloqueo anterior ya expiró, reiniciamos el contador a 0 antes de sumar el nuevo fallo
            const intentosPrevios = (usuario.bloqueadoHasta && new Date(usuario.bloqueadoHasta) <= ahora)
                ? 0
                : (usuario.intentosFallidos || 0);
            const nuevosIntentos = intentosPrevios + 1;

            if (nuevosIntentos >= 3) {
                const bloqueoFin = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
                await prisma.usuario.update({
                    where: { id: usuario.id },
                    data: {
                        intentosFallidos: nuevosIntentos,
                        bloqueadoHasta: bloqueoFin
                    }
                });
                return res.status(429).json({
                    bloqueado: true,
                    message: 'Ha superado el límite de 3 intentos fallidos. Su cuenta ha sido bloqueada temporalmente por 15 minutos.',
                    bloqueadoHasta: bloqueoFin
                });
            } else {
                await prisma.usuario.update({
                    where: { id: usuario.id },
                    data: {
                        intentosFallidos: nuevosIntentos,
                        bloqueadoHasta: null
                    }
                });
                const restantes = 3 - nuevosIntentos;
                return res.status(401).json({
                    message: `Contraseña incorrecta. Le quedan ${restantes} intento(s) antes del bloqueo temporal.`,
                    intentosRestantes: restantes
                });
            }
        }

        // 3. Inicio exitoso: reiniciar contador de intentos fallidos y actualizar última conexión
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
                intentosFallidos: 0,
                bloqueadoHasta: null,
                ultimaConexion: ahora
            }
        });

        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol.nombre,
                rolId: usuario.rolId
            },
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

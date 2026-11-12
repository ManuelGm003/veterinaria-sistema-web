const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isNonEmptyString,
    isValidEmail
} = require('../utils/validators');

const getProveedores = async (req, res) => {
    try {
        const proveedores = await prisma.proveedor.findMany({
            where: { estado: true },
            include: {
                _count: {
                    select: { productos: true, entradas: true }
                }
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(proveedores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createProveedor = async (req, res) => {
    try {
        const { nombre, telefono, email, direccion } = req.body;
        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre o razón social del proveedor es obligatorio.' });
        }

        if (email && isNonEmptyString(email) && !isValidEmail(email)) {
            return res.status(400).json({ message: 'El correo electrónico proporcionado no es válido.' });
        }

        const proveedor = await prisma.proveedor.create({
            data: {
                nombre: nombre.trim(),
                telefono: telefono ? telefono.trim() : null,
                email: email && isNonEmptyString(email) ? email.trim() : null,
                direccion: direccion ? direccion.trim() : null,
                estado: true
            }
        });
        res.status(201).json(proveedor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProveedor = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de proveedor inválido' });
        }

        const { nombre, telefono, email, direccion } = req.body;
        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre del proveedor no puede estar vacío.' });
        }

        if (email && isNonEmptyString(email) && !isValidEmail(email)) {
            return res.status(400).json({ message: 'El correo electrónico no es válido.' });
        }

        const proveedor = await prisma.proveedor.update({
            where: { id },
            data: {
                nombre: nombre.trim(),
                telefono: telefono ? telefono.trim() : null,
                email: email && isNonEmptyString(email) ? email.trim() : null,
                direccion: direccion ? direccion.trim() : null
            }
        });
        res.json(proveedor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteProveedor = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de proveedor inválido' });
        }

        await prisma.proveedor.update({
            where: { id },
            data: { estado: false }
        });
        res.json({ message: 'Proveedor eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getProveedores,
    createProveedor,
    updateProveedor,
    deleteProveedor
};

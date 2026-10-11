const prisma = require('../config/prisma');

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
        if (!nombre) return res.status(400).json({ message: 'El nombre es obligatorio' });

        const proveedor = await prisma.proveedor.create({
            data: { nombre, telefono, email, direccion, estado: true }
        });
        res.status(201).json(proveedor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProveedor = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nombre, telefono, email, direccion } = req.body;
        const proveedor = await prisma.proveedor.update({
            where: { id },
            data: { nombre, telefono, email, direccion }
        });
        res.json(proveedor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteProveedor = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.proveedor.update({
            where: { id },
            data: { estado: false }
        });
        res.json({ message: 'Proveedor eliminado' });
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

const prisma = require('../config/prisma');

const getCategorias = async (req, res) => {
    try {
        const categorias = await prisma.categoria.findMany({
            where: { estado: true },
            include: {
                _count: {
                    select: { productos: true }
                }
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(categorias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCategoria = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre) return res.status(400).json({ message: 'El nombre es obligatorio' });

        const categoria = await prisma.categoria.create({
            data: { nombre, descripcion, estado: true }
        });
        res.status(201).json(categoria);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateCategoria = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nombre, descripcion } = req.body;
        const categoria = await prisma.categoria.update({
            where: { id },
            data: { nombre, descripcion }
        });
        res.json(categoria);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCategoria = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.categoria.update({
            where: { id },
            data: { estado: false }
        });
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getCategorias,
    createCategoria,
    updateCategoria,
    deleteCategoria
};

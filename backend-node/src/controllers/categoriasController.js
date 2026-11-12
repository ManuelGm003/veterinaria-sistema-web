const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isNonEmptyString
} = require('../utils/validators');

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
        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre de la categoría es obligatorio y no puede estar vacío.' });
        }

        const nombreTrim = nombre.trim();
        const existente = await prisma.categoria.findFirst({
            where: { nombre: nombreTrim }
        });

        if (existente) {
            return res.status(400).json({ message: 'Ya existe una categoría con este nombre.' });
        }

        const categoria = await prisma.categoria.create({
            data: {
                nombre: nombreTrim,
                descripcion: descripcion ? descripcion.trim() : '',
                estado: true
            }
        });
        res.status(201).json(categoria);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateCategoria = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido' });
        }

        const { nombre, descripcion } = req.body;
        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre de la categoría no puede estar vacío.' });
        }

        const categoria = await prisma.categoria.update({
            where: { id },
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion ? descripcion.trim() : ''
            }
        });
        res.json(categoria);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCategoria = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido' });
        }

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

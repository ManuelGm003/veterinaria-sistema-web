const prisma = require('../config/prisma');

// RF-03: Gestión de Productos
const getProductos = async (req, res) => {
    try {
        const { search, categoriaId } = req.query;
        const whereClause = { estado: true };

        if (search) {
            whereClause.OR = [
                { nombre: { contains: search } },
                { codigoBarras: { contains: search } }
            ];
        }

        if (categoriaId) {
            whereClause.idCategoria = parseInt(categoriaId);
        }

        const productos = await prisma.producto.findMany({
            where: whereClause,
            include: {
                categoria: true,
                proveedor: true,
                lotes: {
                    where: { estadoDisponible: true }
                }
            },
            orderBy: { id: 'desc' }
        });

        // Calcular stock total disponible sumando los lotes
        const productosConStock = productos.map(p => {
            const stockTotal = p.lotes.reduce((sum, l) => sum + l.cantidad, 0);
            return {
                ...p,
                stockTotal,
                enAlertaStock: stockTotal <= p.stockMinimo
            };
        });

        res.json(productosConStock);
    } catch (error) {
        console.error('Error al listar productos:', error);
        res.status(500).json({ error: error.message });
    }
};

const getProductoById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const producto = await prisma.producto.findUnique({
            where: { id },
            include: {
                categoria: true,
                proveedor: true,
                lotes: true
            }
        });

        if (!producto) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createProducto = async (req, res) => {
    try {
        const {
            nombre, descripcion, tipo, requierePrescripcion,
            idCategoria, idProveedor, codigoBarras, precioCompra, precioVenta, stockMinimo,
            loteInicial, cantidadInicial, fechaVencimientoInicial
        } = req.body;

        if (!nombre || !idCategoria) {
            return res.status(400).json({ message: 'Nombre y categoría son requeridos' });
        }

        const nuevoProducto = await prisma.producto.create({
            data: {
                nombre,
                descripcion: descripcion || '',
                tipo: tipo || 'Medicamento',
                requierePrescripcion: Boolean(requierePrescripcion),
                idCategoria: parseInt(idCategoria),
                idProveedor: idProveedor ? parseInt(idProveedor) : null,
                codigoBarras: codigoBarras || null,
                precioCompra: parseFloat(precioCompra) || 0,
                precioVenta: parseFloat(precioVenta) || 0,
                stockMinimo: parseInt(stockMinimo) || 5,
                estado: true
            }
        });

        // Si se especificó lote inicial en la creación
        if (loteInicial && cantidadInicial) {
            await prisma.lote.create({
                data: {
                    idProducto: nuevoProducto.id,
                    numeroLote: loteInicial,
                    fechaVencimiento: fechaVencimientoInicial ? new Date(fechaVencimientoInicial) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                    cantidad: parseInt(cantidadInicial),
                    estadoDisponible: parseInt(cantidadInicial) > 0
                }
            });
        }

        res.status(201).json({ message: 'Producto creado exitosamente', producto: nuevoProducto });
    } catch (error) {
        console.error('Error creando producto:', error);
        res.status(500).json({ error: error.message });
    }
};

const updateProducto = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const {
            nombre, descripcion, tipo, requierePrescripcion,
            idCategoria, idProveedor, codigoBarras, precioCompra, precioVenta, stockMinimo
        } = req.body;

        const updated = await prisma.producto.update({
            where: { id },
            data: {
                nombre,
                descripcion,
                tipo,
                requierePrescripcion: Boolean(requierePrescripcion),
                idCategoria: parseInt(idCategoria),
                idProveedor: idProveedor ? parseInt(idProveedor) : null,
                codigoBarras: codigoBarras || null,
                precioCompra: parseFloat(precioCompra),
                precioVenta: parseFloat(precioVenta),
                stockMinimo: parseInt(stockMinimo)
            }
        });

        res.json({ message: 'Producto actualizado', producto: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteProducto = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        // Soft delete
        await prisma.producto.update({
            where: { id },
            data: { estado: false }
        });
        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getProductos,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto
};

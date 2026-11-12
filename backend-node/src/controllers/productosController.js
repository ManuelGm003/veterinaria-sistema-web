const prisma = require('../config/prisma');
const {
    isPositiveNumber,
    isPositiveInteger,
    isNonEmptyString,
    isValidDate
} = require('../utils/validators');

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
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de producto inválido' });
        }

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

        // Validaciones estrictas: no nulos, no vacíos, no 0, no -0, no negativos
        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre del producto es obligatorio y no puede estar vacío.' });
        }

        if (!isPositiveInteger(idCategoria)) {
            return res.status(400).json({ message: 'Debe seleccionar una categoría válida (no puede ser nula ni 0).' });
        }

        if (!isPositiveNumber(precioCompra)) {
            return res.status(400).json({ message: 'El precio de compra debe ser un número mayor a 0 (no se permite 0, -0 ni valores negativos).' });
        }

        if (!isPositiveNumber(precioVenta)) {
            return res.status(400).json({ message: 'El precio de venta debe ser un número mayor a 0 (no se permite 0, -0 ni valores negativos).' });
        }

        const pCompra = parseFloat(precioCompra);
        const pVenta = parseFloat(precioVenta);
        if (pVenta < pCompra) {
            return res.status(400).json({ message: `El precio de venta (C$ ${pVenta.toFixed(2)}) no puede ser menor al precio de compra (C$ ${pCompra.toFixed(2)}).` });
        }

        if (!isPositiveInteger(stockMinimo)) {
            return res.status(400).json({ message: 'El stock mínimo de alerta debe ser un número entero mayor o igual a 1 (no puede ser 0, -0 ni negativo).' });
        }

        if (idProveedor && !isPositiveInteger(idProveedor)) {
            return res.status(400).json({ message: 'El proveedor seleccionado es inválido.' });
        }

        // Validar lote inicial si se envía
        if (loteInicial || cantidadInicial) {
            if (!isNonEmptyString(loteInicial)) {
                return res.status(400).json({ message: 'El número de lote inicial no puede estar vacío.' });
            }
            if (!isPositiveInteger(cantidadInicial)) {
                return res.status(400).json({ message: 'La cantidad inicial del lote debe ser un número entero mayor a 0 (no se permite 0 ni negativos).' });
            }
            if (fechaVencimientoInicial && !isValidDate(fechaVencimientoInicial)) {
                return res.status(400).json({ message: 'La fecha de vencimiento inicial no es válida.' });
            }
        }

        const nuevoProducto = await prisma.producto.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion ? descripcion.trim() : '',
                tipo: isNonEmptyString(tipo) ? tipo.trim() : 'Medicamento',
                requierePrescripcion: Boolean(requierePrescripcion),
                idCategoria: parseInt(idCategoria),
                idProveedor: idProveedor ? parseInt(idProveedor) : null,
                codigoBarras: isNonEmptyString(codigoBarras) ? codigoBarras.trim() : null,
                precioCompra: pCompra,
                precioVenta: pVenta,
                stockMinimo: parseInt(stockMinimo),
                estado: true
            }
        });

        // Si se especificó lote inicial en la creación
        if (loteInicial && cantidadInicial) {
            await prisma.lote.create({
                data: {
                    idProducto: nuevoProducto.id,
                    numeroLote: loteInicial.trim(),
                    fechaVencimiento: fechaVencimientoInicial ? new Date(fechaVencimientoInicial) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                    cantidad: parseInt(cantidadInicial),
                    estadoDisponible: true
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
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de producto inválido' });
        }

        const {
            nombre, descripcion, tipo, requierePrescripcion,
            idCategoria, idProveedor, codigoBarras, precioCompra, precioVenta, stockMinimo
        } = req.body;

        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre del producto no puede estar vacío.' });
        }

        if (!isPositiveInteger(idCategoria)) {
            return res.status(400).json({ message: 'Debe seleccionar una categoría válida.' });
        }

        if (!isPositiveNumber(precioCompra)) {
            return res.status(400).json({ message: 'El precio de compra debe ser un número mayor a 0 (no se permite 0, -0 ni negativos).' });
        }

        if (!isPositiveNumber(precioVenta)) {
            return res.status(400).json({ message: 'El precio de venta debe ser un número mayor a 0 (no se permite 0, -0 ni negativos).' });
        }

        const pCompra = parseFloat(precioCompra);
        const pVenta = parseFloat(precioVenta);
        if (pVenta < pCompra) {
            return res.status(400).json({ message: `El precio de venta (C$ ${pVenta.toFixed(2)}) no puede ser menor al precio de compra (C$ ${pCompra.toFixed(2)}).` });
        }

        if (!isPositiveInteger(stockMinimo)) {
            return res.status(400).json({ message: 'El stock mínimo debe ser un número entero mayor o igual a 1.' });
        }

        if (idProveedor && !isPositiveInteger(idProveedor)) {
            return res.status(400).json({ message: 'El proveedor seleccionado es inválido.' });
        }

        const updated = await prisma.producto.update({
            where: { id },
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion ? descripcion.trim() : '',
                tipo: isNonEmptyString(tipo) ? tipo.trim() : 'Medicamento',
                requierePrescripcion: Boolean(requierePrescripcion),
                idCategoria: parseInt(idCategoria),
                idProveedor: idProveedor ? parseInt(idProveedor) : null,
                codigoBarras: isNonEmptyString(codigoBarras) ? codigoBarras.trim() : null,
                precioCompra: pCompra,
                precioVenta: pVenta,
                stockMinimo: parseInt(stockMinimo)
            }
        });

        res.json({ message: 'Producto actualizado exitosamente', producto: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteProducto = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de producto inválido' });
        }

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

const prisma = require('../config/prisma');
const {
    isPositiveNumber,
    isPositiveInteger,
    isNonNegativeInteger,
    isNonEmptyString,
    isValidDate
} = require('../utils/validators');

// RF-06 & RF-09: Entrada de Inventario con asignación obligatoria de lotes y vencimientos
const registrarEntrada = async (req, res) => {
    try {
        const { idProveedor, fecha, observaciones, productos } = req.body;

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ message: 'Se debe incluir al menos un producto en la entrada.' });
        }

        if (idProveedor && !isPositiveInteger(idProveedor)) {
            return res.status(400).json({ message: 'El proveedor seleccionado es inválido.' });
        }

        if (fecha && !isValidDate(fecha)) {
            return res.status(400).json({ message: 'La fecha de recepción no es válida.' });
        }

        // Validar cada producto de la lista antes de iniciar la transacción
        for (let i = 0; i < productos.length; i++) {
            const item = productos[i];
            const fila = i + 1;

            if (!isPositiveInteger(item.idProducto)) {
                return res.status(400).json({ message: `Fila ${fila}: Debe seleccionar un producto válido.` });
            }

            if (!isPositiveInteger(item.cantidad)) {
                return res.status(400).json({ message: `Fila ${fila}: La cantidad a ingresar debe ser un número entero mayor a 0 (no se permite 0, -0 ni valores negativos).` });
            }

            if (!isPositiveNumber(item.precioCompra)) {
                return res.status(400).json({ message: `Fila ${fila}: El precio de compra debe ser un número mayor a 0 (no se permite 0, -0 ni valores negativos).` });
            }

            if (!isNonEmptyString(item.numeroLote)) {
                return res.status(400).json({ message: `Fila ${fila}: El número de lote es obligatorio y no puede estar vacío.` });
            }

            if (!isValidDate(item.fechaVencimiento)) {
                return res.status(400).json({ message: `Fila ${fila}: La fecha de vencimiento es obligatoria y debe ser una fecha válida.` });
            }

            if (item.precioVenta !== undefined && item.precioVenta !== null && item.precioVenta !== '') {
                if (!isPositiveNumber(item.precioVenta)) {
                    return res.status(400).json({ message: `Fila ${fila}: El precio de venta debe ser un número mayor a 0.` });
                }
                if (parseFloat(item.precioVenta) < parseFloat(item.precioCompra)) {
                    return res.status(400).json({ message: `Fila ${fila}: El nuevo precio de venta no puede ser menor al precio de compra.` });
                }
            }
        }

        const totalProductos = productos.reduce((sum, p) => sum + parseInt(p.cantidad), 0);

        // Transacción Prisma para garantizar integridad
        const resultado = await prisma.$transaction(async (tx) => {
            // 1. Crear cabecera de entrada
            const entrada = await tx.entradaInventario.create({
                data: {
                    fecha: fecha ? new Date(fecha) : new Date(),
                    idProveedor: idProveedor ? parseInt(idProveedor) : null,
                    observaciones: observaciones ? observaciones.trim() : '',
                    totalProductos
                }
            });

            // 2. Procesar cada producto, crear/actualizar su lote y registrar el detalle
            for (const item of productos) {
                const idProducto = parseInt(item.idProducto);
                const cantidad = parseInt(item.cantidad);
                const precioCompra = parseFloat(item.precioCompra);
                const numeroLote = item.numeroLote.trim();
                const fechaVencimiento = new Date(item.fechaVencimiento);

                // Crear lote
                const nuevoLote = await tx.lote.create({
                    data: {
                        idProducto,
                        numeroLote,
                        fechaVencimiento,
                        cantidad,
                        estadoDisponible: true
                    }
                });

                // Crear detalle de entrada
                await tx.detalleEntrada.create({
                    data: {
                        idEntrada: entrada.id,
                        idProducto,
                        idLote: nuevoLote.id,
                        cantidad,
                        precioCompra,
                        subtotal: cantidad * precioCompra
                    }
                });

                // Si viene un precio de venta nuevo, actualizarlo en producto
                if (item.precioVenta) {
                    await tx.producto.update({
                        where: { id: idProducto },
                        data: {
                            precioCompra,
                            precioVenta: parseFloat(item.precioVenta)
                        }
                    });
                }
            }

            return entrada;
        });

        res.status(201).json({
            message: 'Entrada de inventario y lotes registrados exitosamente',
            idEntrada: resultado.id
        });
    } catch (error) {
        console.error('Error al registrar entrada de inventario:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener historial de entradas
const getEntradas = async (req, res) => {
    try {
        const entradas = await prisma.entradaInventario.findMany({
            include: {
                proveedor: true,
                detalles: {
                    include: {
                        producto: true,
                        lote: true
                    }
                }
            },
            orderBy: { fecha: 'desc' }
        });
        res.json(entradas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// RF-09 & RF-11: Listado de lotes con cálculo de días y estado
const getLotes = async (req, res) => {
    try {
        const { idProducto } = req.query;
        const whereClause = { estadoDisponible: true };
        if (idProducto && isPositiveInteger(idProducto)) {
            whereClause.idProducto = parseInt(idProducto);
        }

        const lotes = await prisma.lote.findMany({
            where: whereClause,
            include: {
                producto: {
                    include: { categoria: true }
                }
            },
            orderBy: { fechaVencimiento: 'asc' }
        });

        const ahora = new Date();
        const lotesFormateados = lotes.map(l => {
            const diasParaVencer = Math.ceil((new Date(l.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24));
            let estadoVencimiento = 'Optimo';
            if (diasParaVencer <= 0) estadoVencimiento = 'Vencido';
            else if (diasParaVencer <= 15) estadoVencimiento = 'Crítico';
            else if (diasParaVencer <= 30) estadoVencimiento = 'Próximo a Vencer';

            return {
                ...l,
                diasParaVencer,
                estadoVencimiento
            };
        });

        res.json(lotesFormateados);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// RF-07: Ajuste manual de inventario (para mermas, productos vencidos o ajustes de conteo)
const ajustarLote = async (req, res) => {
    try {
        const idLote = parseInt(req.params.id);
        if (!isPositiveInteger(idLote)) {
            return res.status(400).json({ message: 'ID de lote inválido' });
        }

        const { nuevaCantidad, motivo } = req.body;

        if (!isNonNegativeInteger(nuevaCantidad)) {
            return res.status(400).json({ message: 'La nueva cantidad debe ser un número entero mayor o igual a 0 (no se permite -0 ni valores negativos).' });
        }

        if (!isNonEmptyString(motivo)) {
            return res.status(400).json({ message: 'Debe especificar el motivo del ajuste de inventario.' });
        }

        const cant = parseInt(nuevaCantidad);

        const loteActualizado = await prisma.lote.update({
            where: { id: idLote },
            data: {
                cantidad: cant,
                estadoDisponible: cant > 0
            },
            include: { producto: true }
        });

        res.json({
            message: 'Stock del lote ajustado correctamente',
            lote: loteActualizado,
            motivo: motivo.trim()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    registrarEntrada,
    getEntradas,
    getLotes,
    ajustarLote
};

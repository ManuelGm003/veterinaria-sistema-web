const prisma = require('../config/prisma');

// RF-06 & RF-09: Entrada de Inventario con asignación obligatoria de lotes y vencimientos
const registrarEntrada = async (req, res) => {
    try {
        const { idProveedor, fecha, observaciones, productos } = req.body;

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ message: 'Se debe incluir al menos un producto en la entrada' });
        }

        const totalProductos = productos.reduce((sum, p) => sum + parseInt(p.cantidad || 0), 0);

        // Transacción Prisma para garantizar integridad
        const resultado = await prisma.$transaction(async (tx) => {
            // 1. Crear cabecera de entrada
            const entrada = await tx.entradaInventario.create({
                data: {
                    fecha: fecha ? new Date(fecha) : new Date(),
                    idProveedor: idProveedor ? parseInt(idProveedor) : null,
                    observaciones: observaciones || '',
                    totalProductos
                }
            });

            // 2. Procesar cada producto, crear/actualizar su lote y registrar el detalle
            for (const item of productos) {
                const idProducto = parseInt(item.idProducto);
                const cantidad = parseInt(item.cantidad);
                const precioCompra = parseFloat(item.precioCompra) || 0;
                const numeroLote = item.numeroLote || `LOT-${Date.now().toString().slice(-4)}`;
                const fechaVencimiento = item.fechaVencimiento ? new Date(item.fechaVencimiento) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

                // Crear o actualizar lote
                const nuevoLote = await tx.lote.create({
                    data: {
                        idProducto,
                        numeroLote,
                        fechaVencimiento,
                        cantidad,
                        estadoDisponible: cantidad > 0
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
        if (idProducto) whereClause.idProducto = parseInt(idProducto);

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
        const { nuevaCantidad, motivo } = req.body;

        const cant = parseInt(nuevaCantidad);
        if (isNaN(cant) || cant < 0) {
            return res.status(400).json({ message: 'La nueva cantidad debe ser un número entero mayor o igual a 0' });
        }

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
            motivo: motivo || 'Ajuste operativo'
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

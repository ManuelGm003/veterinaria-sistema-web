const prisma = require('../config/prisma');

// RF-12 & RF-13 & RF-08: Procesar venta POS con validación de receta médica y descuento automático de stock
const registrarVenta = async (req, res) => {
    try {
        const {
            cliente,
            idUsuario,
            prescripcionId,
            codigoPrescripcion,
            metodoPago,
            descuento,
            detalles
        } = req.body;

        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ message: 'La venta debe contener al menos un producto' });
        }

        // 1. Verificar si algún producto requiere prescripción médica
        const productosIds = detalles.map(d => parseInt(d.idProducto));
        const productosEnVenta = await prisma.producto.findMany({
            where: { id: { in: productosIds } }
        });

        const productosConRecetaObligatoria = productosEnVenta.filter(p => p.requierePrescripcion);

        let finalPrescripcionId = prescripcionId ? parseInt(prescripcionId) : null;

        if (productosConRecetaObligatoria.length > 0) {
            // Se requiere validación de prescripción médica (RF-13)
            let prescripcionValida = null;

            if (codigoPrescripcion) {
                prescripcionValida = await prisma.prescripcion.findFirst({
                    where: { numero: codigoPrescripcion.trim() }
                });
            } else if (finalPrescripcionId) {
                prescripcionValida = await prisma.prescripcion.findUnique({
                    where: { id: finalPrescripcionId }
                });
            }

            if (!prescripcionValida) {
                const nombresRestringidos = productosConRecetaObligatoria.map(p => p.nombre).join(', ');
                return res.status(400).json({
                    error: 'Validación médica requerida',
                    requierePrescripcion: true,
                    mensaje: `Los siguientes medicamentos requieren prescripción médica obligatoria antes de autorizar la venta: ${nombresRestringidos}. Ingrese un código de receta válido.`
                });
            }

            if (prescripcionValida.estado === 'Vencida') {
                return res.status(400).json({
                    error: 'Prescripción no válida',
                    mensaje: `La prescripción ${prescripcionValida.numero} se encuentra vencida.`
                });
            }

            finalPrescripcionId = prescripcionValida.id;
        }

        // 2. Transacción de venta con descuento automático de inventario (RF-08)
        const resultadoVenta = await prisma.$transaction(async (tx) => {
            let totalVenta = 0;
            const detallesParaInsertar = [];

            for (const item of detalles) {
                const idProducto = parseInt(item.idProducto);
                const cantidad = parseInt(item.cantidad);
                const precioUnitario = parseFloat(item.precioUnitario);
                let idLote = item.idLote ? parseInt(item.idLote) : null;

                const producto = productosEnVenta.find(p => p.id === idProducto);
                if (!producto) {
                    throw new Error(`Producto con ID ${idProducto} no encontrado`);
                }

                // Si no se envió un lote específico, seleccionar el lote disponible más próximo a vencer (FIFO / FEFO)
                if (!idLote) {
                    const loteDisponible = await tx.lote.findFirst({
                        where: {
                            idProducto,
                            estadoDisponible: true,
                            cantidad: { gte: cantidad }
                        },
                        orderBy: { fechaVencimiento: 'asc' }
                    });

                    if (!loteDisponible) {
                        throw new Error(`Stock insuficiente en lotes disponibles para el producto "${producto.nombre}". Solicitado: ${cantidad}`);
                    }
                    idLote = loteDisponible.id;
                }

                // Verificar stock del lote
                const loteActual = await tx.lote.findUnique({ where: { id: idLote } });
                if (!loteActual || loteActual.cantidad < cantidad) {
                    throw new Error(`Stock insuficiente en el lote ${loteActual ? loteActual.numeroLote : ''} para "${producto.nombre}". Disponible: ${loteActual ? loteActual.cantidad : 0}`);
                }

                // Descontar del lote
                const nuevaCantidadLote = loteActual.cantidad - cantidad;
                await tx.lote.update({
                    where: { id: idLote },
                    data: {
                        cantidad: nuevaCantidadLote,
                        estadoDisponible: nuevaCantidadLote > 0
                    }
                });

                const subtotal = cantidad * precioUnitario;
                totalVenta += subtotal;

                detallesParaInsertar.push({
                    idProducto,
                    idLote,
                    cantidad,
                    precioUnitario,
                    subtotal
                });
            }

            const descuentoFinal = parseFloat(descuento) || 0;
            const totalConDescuento = Math.max(0, totalVenta - descuentoFinal);

            // Crear venta
            const venta = await tx.venta.create({
                data: {
                    cliente: cliente || 'Cliente General',
                    idUsuario: idUsuario ? parseInt(idUsuario) : null,
                    prescripcionId: finalPrescripcionId,
                    total: totalConDescuento,
                    descuento: descuentoFinal,
                    metodoPago: metodoPago || 'Efectivo',
                    estado: 'Completada',
                    detalles: {
                        create: detallesParaInsertar
                    }
                },
                include: {
                    detalles: {
                        include: {
                            producto: true,
                            lote: true
                        }
                    },
                    prescripcion: true,
                    usuario: true
                }
            });

            // Si se usó una prescripción, actualizar su estado a Utilizada
            if (finalPrescripcionId) {
                await tx.prescripcion.update({
                    where: { id: finalPrescripcionId },
                    data: { estado: 'Utilizada' }
                });
            }

            return venta;
        });

        res.status(201).json({
            message: 'Venta registrada e inventario actualizado exitosamente',
            venta: resultadoVenta
        });
    } catch (error) {
        console.error('Error al registrar venta:', error);
        res.status(400).json({ error: error.message });
    }
};

const getVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, cliente } = req.query;
        const whereClause = {};

        if (fechaInicio && fechaFin) {
            whereClause.fecha = {
                gte: new Date(fechaInicio),
                lte: new Date(new Date(fechaFin).setHours(23, 59, 59))
            };
        }

        if (cliente) {
            whereClause.cliente = { contains: cliente };
        }

        const ventas = await prisma.venta.findMany({
            where: whereClause,
            include: {
                detalles: {
                    include: {
                        producto: true,
                        lote: true
                    }
                },
                prescripcion: true,
                usuario: {
                    select: { id: true, nombre: true, email: true }
                }
            },
            orderBy: { id: 'desc' }
        });

        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getVentaById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const venta = await prisma.venta.findUnique({
            where: { id },
            include: {
                detalles: {
                    include: {
                        producto: true,
                        lote: true
                    }
                },
                prescripcion: true,
                usuario: true
            }
        });

        if (!venta) return res.status(404).json({ message: 'Venta no encontrada' });
        res.json(venta);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const anularVenta = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const resultado = await prisma.$transaction(async (tx) => {
            const venta = await tx.venta.findUnique({
                where: { id },
                include: { detalles: true }
            });

            if (!venta) throw new Error('Venta no encontrada');
            if (venta.estado === 'Anulada') throw new Error('La venta ya fue anulada previamente');

            // Reintegrar stock a los lotes correspondientes
            for (const d of venta.detalles) {
                if (d.idLote) {
                    await tx.lote.update({
                        where: { id: d.idLote },
                        data: {
                            cantidad: { increment: d.cantidad },
                            estadoDisponible: true
                        }
                    });
                }
            }

            // Marcar venta como anulada
            const ventaAnulada = await tx.venta.update({
                where: { id },
                data: { estado: 'Anulada' }
            });

            return ventaAnulada;
        });

        res.json({ message: 'Venta anulada y stock de lotes reintegrado con éxito', venta: resultado });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    registrarVenta,
    getVentas,
    getVentaById,
    anularVenta
};

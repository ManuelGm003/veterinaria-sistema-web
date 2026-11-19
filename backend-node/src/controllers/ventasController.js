const prisma = require('../config/prisma');
const {
    isPositiveNumber,
    isPositiveInteger,
    isNonNegativeNumber,
    isNonEmptyString
} = require('../utils/validators');

// RF-12 & RF-13 & RF-08: Procesar venta POS con validación de receta médica, lotes y descuento automático de stock
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
            return res.status(400).json({ message: 'La venta debe contener al menos un producto.' });
        }

        // Validar cada ítem del detalle de venta
        for (let i = 0; i < detalles.length; i++) {
            const item = detalles[i];
            const fila = i + 1;

            if (!isPositiveInteger(item.idProducto)) {
                return res.status(400).json({ message: `Ítem ${fila}: ID de producto inválido.` });
            }

            if (!isPositiveInteger(item.cantidad)) {
                return res.status(400).json({ message: `Ítem ${fila}: La cantidad a vender debe ser un número entero mayor a 0 (no se permite 0, -0 ni valores negativos).` });
            }

            if (!isPositiveNumber(item.precioUnitario)) {
                return res.status(400).json({ message: `Ítem ${fila}: El precio unitario debe ser un número mayor a 0 (no se permite 0, -0 ni valores negativos).` });
            }

            if (item.idLote && !isPositiveInteger(item.idLote)) {
                return res.status(400).json({ message: `Ítem ${fila}: El lote seleccionado es inválido.` });
            }
        }

        if (descuento !== undefined && descuento !== null && descuento !== '') {
            if (!isNonNegativeNumber(descuento)) {
                return res.status(400).json({ message: 'El descuento debe ser un número mayor o igual a 0 (no se permite -0 ni valores negativos).' });
            }
        }

        // 1. Verificar si algún producto requiere prescripción médica
        const productosIds = detalles.map(d => parseInt(d.idProducto));
        const productosEnVenta = await prisma.producto.findMany({
            where: { id: { in: productosIds } }
        });

        const productosConRecetaObligatoria = productosEnVenta.filter(p => p.requierePrescripcion);

        let finalPrescripcionId = prescripcionId && isPositiveInteger(prescripcionId) ? parseInt(prescripcionId) : null;

        if (productosConRecetaObligatoria.length > 0) {
            let prescripcionValida = null;

            if (isNonEmptyString(codigoPrescripcion)) {
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

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            if (prescripcionValida.estado === 'Vencida' || (prescripcionValida.fechaVencimiento && new Date(prescripcionValida.fechaVencimiento) < hoy)) {
                return res.status(400).json({
                    error: 'Prescripción vencida',
                    mensaje: `La prescripción médica ${prescripcionValida.numero} se encuentra vencida.`
                });
            }

            if (prescripcionValida.estado === 'Utilizada') {
                return res.status(400).json({
                    error: 'Prescripción utilizada',
                    mensaje: `La prescripción médica ${prescripcionValida.numero} ya fue utilizada previamente.`
                });
            }

            if (prescripcionValida.estado === 'ANULADA' || prescripcionValida.estado === 'Anulada') {
                return res.status(400).json({
                    error: 'Prescripción anulada',
                    mensaje: `La prescripción médica ${prescripcionValida.numero} se encuentra anulada.`
                });
            }

            if (prescripcionValida.estado !== 'Activa') {
                return res.status(400).json({
                    error: 'Prescripción no activa',
                    mensaje: `La prescripción médica ${prescripcionValida.numero} se encuentra en estado no válido: ${prescripcionValida.estado}.`
                });
            }

            finalPrescripcionId = prescripcionValida.id;
        }

        // Usuario que realiza la venta: preferir el usuario autenticado del token
        const usuarioVentaId = req.usuario?.id || (idUsuario && isPositiveInteger(idUsuario) ? parseInt(idUsuario) : null);

        // 2. Transacción de venta con descuento automático de inventario y bloqueo de concurrencia
        const resultadoVenta = await prisma.$transaction(async (tx) => {
            let totalVenta = 0;
            const detallesParaInsertar = [];
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            for (const item of detalles) {
                const idProducto = parseInt(item.idProducto);
                const cantidad = parseInt(item.cantidad);
                const precioUnitario = parseFloat(item.precioUnitario);
                let idLote = item.idLote ? parseInt(item.idLote) : null;

                const producto = productosEnVenta.find(p => p.id === idProducto);
                if (!producto) {
                    throw new Error(`Producto con ID ${idProducto} no encontrado`);
                }

                // Si no se envió un lote específico, seleccionar el lote disponible más próximo a vencer no caducado (FIFO / FEFO)
                if (!idLote) {
                    const loteDisponible = await tx.lote.findFirst({
                        where: {
                            idProducto,
                            estadoDisponible: true,
                            cantidad: { gte: cantidad },
                            fechaVencimiento: { gte: hoy }
                        },
                        orderBy: { fechaVencimiento: 'asc' }
                    });

                    if (!loteDisponible) {
                        throw new Error(`Stock insuficiente o sin lotes vigentes disponibles para el producto "${producto.nombre}". Solicitado: ${cantidad}`);
                    }
                    idLote = loteDisponible.id;
                }

                // Bloqueo pesimista de fila en MySQL / InnoDB para evitar sobreventas concurrentes
                const lockedRows = await tx.$queryRaw`SELECT id, id_producto AS idProducto, numero_lote AS numeroLote, fecha_vencimiento AS fechaVencimiento, cantidad, estado_disponible AS estadoDisponible FROM lote WHERE id = ${idLote} FOR UPDATE`;

                if (!lockedRows || lockedRows.length === 0) {
                    throw new Error(`El lote con ID ${idLote} no existe en la base de datos.`);
                }

                const loteActual = lockedRows[0];

                // Validación 1: El lote debe pertenecer obligatoriamente al producto solicitado
                if (Number(loteActual.idProducto) !== idProducto) {
                    throw new Error(`El lote ${loteActual.numeroLote} no pertenece al producto "${producto.nombre}".`);
                }

                // Validación 2: El lote no debe estar vencido
                if (new Date(loteActual.fechaVencimiento) < hoy) {
                    const fVencStr = new Date(loteActual.fechaVencimiento).toISOString().split('T')[0];
                    throw new Error(`El lote ${loteActual.numeroLote} de "${producto.nombre}" está vencido (${fVencStr}). No se permite la venta de productos caducados.`);
                }

                // Validación 3: Stock suficiente en el lote
                if (Number(loteActual.cantidad) < cantidad || !loteActual.estadoDisponible) {
                    throw new Error(`Stock insuficiente en el lote ${loteActual.numeroLote} para "${producto.nombre}". Solicitado: ${cantidad}, Disponible: ${loteActual.cantidad}`);
                }

                // Descontar del lote
                const nuevaCantidadLote = Number(loteActual.cantidad) - cantidad;
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

            if (totalVenta <= 0) {
                throw new Error('El importe total de la venta debe ser mayor a 0.');
            }

            const descuentoFinal = descuento ? parseFloat(descuento) : 0;
            if (descuentoFinal >= totalVenta) {
                throw new Error('El descuento no puede ser mayor o igual al total de la venta.');
            }

            const totalConDescuento = Math.max(0.01, totalVenta - descuentoFinal);

            // Crear registro de venta con sus detalles
            const venta = await tx.venta.create({
                data: {
                    cliente: isNonEmptyString(cliente) ? cliente.trim() : 'Cliente General',
                    idUsuario: usuarioVentaId,
                    prescripcionId: finalPrescripcionId,
                    total: totalConDescuento,
                    descuento: descuentoFinal,
                    metodoPago: isNonEmptyString(metodoPago) ? metodoPago.trim() : 'Efectivo',
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

            // Si se usó una prescripción, marcarla como Utilizada
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
        const { fechaInicio, fechaFin, cliente, metodoPago } = req.query;
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

        if (metodoPago) {
            whereClause.metodoPago = metodoPago;
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
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de venta inválido' });
        }

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

// RF-08 & RF-12: Anulación segura de ventas con devolución de existencias
const anularVenta = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de venta inválido' });
        }

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

            // Si la venta tenía prescripción asociada, reactivarla
            if (venta.prescripcionId) {
                await tx.prescripcion.update({
                    where: { id: venta.prescripcionId },
                    data: { estado: 'Activa' }
                });
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

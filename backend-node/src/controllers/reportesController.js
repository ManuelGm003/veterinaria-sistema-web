const prisma = require('../config/prisma');

// RF-14: Reportes de Ventas
const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, metodoPago } = req.query;
        const whereClause = { estado: 'Completada' };

        if (fechaInicio && fechaFin) {
            whereClause.fecha = {
                gte: new Date(fechaInicio),
                lte: new Date(new Date(fechaFin).setHours(23, 59, 59))
            };
        }

        if (metodoPago) {
            whereClause.metodoPago = metodoPago;
        }

        const ventas = await prisma.venta.findMany({
            where: whereClause,
            include: {
                detalles: {
                    include: { producto: true }
                },
                usuario: {
                    select: { nombre: true }
                }
            },
            orderBy: { fecha: 'desc' }
        });

        const totalRecaudado = ventas.reduce((acc, v) => acc + Number(v.total), 0);
        const totalDescuentos = ventas.reduce((acc, v) => acc + Number(v.descuento), 0);
        const promedioTicket = ventas.length > 0 ? (totalRecaudado / ventas.length) : 0;

        res.json({
            resumen: {
                totalVentas: ventas.length,
                totalRecaudado,
                totalDescuentos,
                promedioTicket
            },
            ventas
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// RF-15: Reportes de Inventario
const getReporteInventario = async (req, res) => {
    try {
        const productos = await prisma.producto.findMany({
            where: { estado: true },
            include: {
                categoria: true,
                lotes: {
                    where: { estadoDisponible: true }
                }
            }
        });

        let valorTotalCosto = 0;
        let valorTotalVenta = 0;
        let totalUnidades = 0;

        const productosReporte = productos.map(p => {
            const stockActual = p.lotes.reduce((sum, l) => sum + l.cantidad, 0);
            const costoTotal = stockActual * Number(p.precioCompra);
            const valorVentaTotal = stockActual * Number(p.precioVenta);

            valorTotalCosto += costoTotal;
            valorTotalVenta += valorVentaTotal;
            totalUnidades += stockActual;

            return {
                id: p.id,
                nombre: p.nombre,
                categoria: p.categoria.nombre,
                tipo: p.tipo,
                requierePrescripcion: p.requierePrescripcion,
                stockActual,
                stockMinimo: p.stockMinimo,
                precioCompra: Number(p.precioCompra),
                precioVenta: Number(p.precioVenta),
                costoTotal,
                valorVentaTotal,
                alerta: stockActual <= p.stockMinimo
            };
        });

        // Lotes próximos a vencer (30 días)
        const ahora = new Date();
        const limiteVencimiento = new Date();
        limiteVencimiento.setDate(ahora.getDate() + 30);

        const lotesPorVencer = await prisma.lote.findMany({
            where: {
                estadoDisponible: true,
                fechaVencimiento: { lte: limiteVencimiento }
            },
            include: { producto: true },
            orderBy: { fechaVencimiento: 'asc' }
        });

        res.json({
            resumen: {
                totalProductos: productos.length,
                totalUnidades,
                valorTotalCosto,
                valorTotalVenta,
                margenGananciaEstimado: valorTotalVenta - valorTotalCosto
            },
            productos: productosReporte,
            lotesPorVencer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getReporteVentas,
    getReporteInventario
};

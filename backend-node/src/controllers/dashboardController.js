const prisma = require('../config/prisma');

const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Ventas del día
        const ventasHoy = await prisma.venta.aggregate({
            _sum: { total: true },
            where: {
                fecha: { gte: today },
                estado: 'Completada'
            }
        });
        const totalVentasDia = Number(ventasHoy._sum.total || 0);

        // 2. Total productos activos
        const totalProductos = await prisma.producto.count({
            where: { estado: true }
        });

        // 3. Configuración para umbrales de alerta
        const config = await prisma.configuracion.findFirst() || {
            stockMinimoAlerta: 5,
            diasAlertaVencimiento: 30
        };

        // 4. Lotes y stock
        const ahora = new Date();
        const fechaLimiteVence = new Date();
        fechaLimiteVence.setDate(ahora.getDate() + (config.diasAlertaVencimiento || 30));

        // Productos con stock bajo (suma de lotes <= stockMinimo)
        const productosConLotes = await prisma.producto.findMany({
            where: { estado: true },
            include: {
                lotes: {
                    where: { estadoDisponible: true }
                },
                categoria: true
            }
        });

        let productosStockBajoCount = 0;
        const alertas = [];

        for (const prod of productosConLotes) {
            const stockTotal = prod.lotes.reduce((acc, l) => acc + l.cantidad, 0);
            if (stockTotal <= prod.stockMinimo) {
                productosStockBajoCount++;
                alertas.push({
                    tipo: 'stock',
                    nivel: stockTotal === 0 ? 'CRÍTICO' : 'ALERTA',
                    mensaje: `[STOCK] ${prod.nombre} - Quedan ${stockTotal} unidades en almacén (mínimo: ${prod.stockMinimo})`,
                    fecha: new Date()
                });
            }

            // Revisar vencimientos de cada lote
            for (const lote of prod.lotes) {
                if (lote.fechaVencimiento <= fechaLimiteVence) {
                    const diasRestantes = Math.ceil((new Date(lote.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24));
                    alertas.push({
                        tipo: 'vencimiento',
                        nivel: diasRestantes <= 7 ? 'CRÍTICO' : 'ADVERTENCIA',
                        mensaje: `[VENCIMIENTO] ${prod.nombre} (Lote ${lote.numeroLote}) - Vence en ${diasRestantes <= 0 ? '¡HOY O YA VENCIDO!' : diasRestantes + ' días'}`,
                        fecha: lote.fechaVencimiento
                    });
                }
            }
        }

        // Lotes próximos a vencer count
        const proximosAVencerCount = await prisma.lote.count({
            where: {
                estadoDisponible: true,
                fechaVencimiento: { lte: fechaLimiteVence }
            }
        });

        // 5. Gráfico de ventas de los últimos 7 días
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const ultimos7Dias = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);

            const dFin = new Date(d);
            dFin.setDate(dFin.getDate() + 1);

            const vDia = await prisma.venta.aggregate({
                _sum: { total: true },
                where: {
                    fecha: { gte: d, lt: dFin },
                    estado: 'Completada'
                }
            });

            ultimos7Dias.push({
                dia: diasSemana[d.getDay()],
                fecha: d.toISOString().split('T')[0],
                total: Number(vDia._sum.total || 0)
            });
        }

        // 6. Distribución de ventas por categorías
        const categorias = await prisma.categoria.findMany({
            where: { estado: true },
            include: {
                productos: {
                    include: {
                        detallesVenta: true
                    }
                }
            }
        });

        const categoriasStats = categorias.map(c => {
            let totalVendido = 0;
            c.productos.forEach(p => {
                p.detallesVenta.forEach(dv => {
                    totalVendido += Number(dv.subtotal);
                });
            });
            return {
                nombre: c.nombre,
                total: totalVendido,
                cantidadProductos: c.productos.length
            };
        });

        // Últimas ventas registradas para el panel de alertas / notificaciones
        const ultimasVentas = await prisma.venta.findMany({
            take: 3,
            orderBy: { fecha: 'desc' },
            include: { usuario: true }
        });

        ultimasVentas.forEach(v => {
            alertas.push({
                tipo: 'venta',
                nivel: 'INFO',
                mensaje: `[VENTA] Venta #${v.id} de C$ ${Number(v.total).toFixed(2)} por ${v.usuario?.nombre || 'Caja'} a ${v.cliente}`,
                fecha: v.fecha
            });
        });

        res.json({
            kpis: {
                ventasDelDia: totalVentasDia,
                totalProductos,
                stockBajo: productosStockBajoCount,
                proximosAVencer: proximosAVencerCount
            },
            ventasUltimos7Dias: ultimos7Dias,
            categoriasStats,
            alertasRecientes: alertas.slice(0, 10)
        });
    } catch (error) {
        console.error('Error obteniendo dashboard:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getDashboardStats
};

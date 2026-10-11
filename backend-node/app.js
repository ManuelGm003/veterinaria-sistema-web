// app.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================================
// RF-04: GESTIÓN DE CATEGORÍAS
// =====================================================================
app.get('/api/categorias', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categoria WHERE estado = 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categorias', async (req, res) => {
    const { nombre, descripcion } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO categoria (nombre, descripcion, estado) VALUES (?, ?, 1)',
            [nombre, descripcion]
        );
        res.status(201).json({ id: result.insertId, nombre, descripcion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================================
// RF-05: GESTIÓN DE PROVEEDORES
// =====================================================================
app.get('/api/proveedores', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM proveedor WHERE estado = 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/proveedores', async (req, res) => {
    const { nombre, telefono, email, direccion } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO proveedor (nombre, telefono, email, direccion, estado) VALUES (?, ?, ?, ?, 1)',
            [nombre, telefono, email, direccion]
        );
        res.status(201).json({ id: result.insertId, nombre, telefono });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================================
// RF-03: GESTIÓN DE PRODUCTOS
// =====================================================================
app.get('/api/productos', async (req, res) => {
    try {
        const query = `
            SELECT p.*, c.nombre as categoria, pr.nombre as proveedor 
            FROM producto p
            LEFT JOIN categoria c ON p.idCategoria = c.id
            LEFT JOIN proveedor pr ON p.idProveedor = pr.id
            WHERE p.estado = 1
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/productos', async (req, res) => {
    // Incorporando los campos requeridos: código de barras, precios y prescripción
    const { 
        nombre, descripcion, tipo, requierePrescripcion, 
        idCategoria, idProveedor, codigoBarras, precioCompra, precioVenta 
    } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO producto (nombre, descripcion, tipo, requierePrescripcion, idCategoria, idProveedor, codigo_barras, precio_compra, precio_venta, estado) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [nombre, descripcion, tipo, requierePrescripcion, idCategoria, idProveedor, codigoBarras, precioCompra, precioVenta]
        );
        res.status(201).json({ msg: "Producto creado", id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================================
// RF-06 y RF-09: ENTRADA DE INVENTARIO Y CONTROL DE LOTES
// =====================================================================
app.post('/api/inventario/entrada', async (req, res) => {
    const { idProveedor, fecha, observaciones, totalProductos, productos } = req.body;
    
    // Obtenemos una conexión exclusiva para manejar la transacción de forma segura
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Insertar la entrada general de inventario
        const [entradaResult] = await connection.query(
            'INSERT INTO entrada_inventario (fecha, idProveedor, observaciones, totalProductos) VALUES (?, ?, ?, ?)',
            [fecha, idProveedor, observaciones, totalProductos]
        );
        const idEntrada = entradaResult.insertId;

        // 2. Procesar cada producto ingresado
        for (const item of productos) {
            // A. Registrar el lote obligatoriamente con su fecha de vencimiento
            const [loteResult] = await connection.query(
                'INSERT INTO lote (idProducto, numeroLote, fechaVencimiento, cantidad, estado_disponible) VALUES (?, ?, ?, ?, 1)',
                [item.idProducto, item.numeroLote, item.fechaVencimiento, item.cantidad]
            );
            const idLote = loteResult.insertId;

            // B. Registrar el detalle de la entrada vinculando la entrada, el producto y el lote
            await connection.query(
                'INSERT INTO detalle_entrada (idEntrada, idProducto, idLote, cantidad, precioCompra, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [idEntrada, item.idProducto, idLote, item.cantidad, item.precioCompra, (item.cantidad * item.precioCompra)]
            );
        }

        // Si todo sale bien, guardamos permanentemente en la base de datos
        await connection.commit();
        res.status(201).json({ msg: "Entrada de inventario y lotes procesados exitosamente", idEntrada });

    } catch (error) {
        // Si hay algún error, revertimos todos los cambios para no dejar datos a medias
        await connection.rollback();
        res.status(500).json({ error: "Transacción fallida, cambios revertidos", detalle: error.message });
    } finally {
        connection.release(); // Liberamos la conexión
    }
});

// =====================================================================
// RF-07: AJUSTE MANUAL DE INVENTARIO (Lotes vencidos/dañados)
// =====================================================================
app.put('/api/lotes/:id/ajuste', async (req, res) => {
    const idLote = req.params.id;
    const { nuevaCantidad, motivo } = req.body;

    try {
        // Actualizamos la cantidad del lote. Si llega a 0, cambiamos su estado de disponibilidad
        const estadoDisponible = nuevaCantidad > 0 ? 1 : 0;
        
        await pool.query(
            'UPDATE lote SET cantidad = ?, estado_disponible = ? WHERE id = ?',
            [nuevaCantidad, estadoDisponible, idLote]
        );
        
       
        res.json({ msg: "Stock del lote actualizado correctamente", lote: idLote, cantidad: nuevaCantidad, motivo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Inventario corriendo en http://localhost:${PORT}`);
});
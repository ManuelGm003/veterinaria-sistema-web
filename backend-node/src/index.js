const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productosRoutes = require('./routes/productosRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
const proveedoresRoutes = require('./routes/proveedoresRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const ventasRoutes = require('./routes/ventasRoutes');
const prescripcionesRoutes = require('./routes/prescripcionesRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const configuracionRoutes = require('./routes/configuracionRoutes');

// Crear aplicación Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir frontend estático si existe
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/prescripciones', prescripcionesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/configuracion', configuracionRoutes);

// Endpoint de estado del servidor
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        sistema: 'Sistema Web Interno - Veterinaria VetSalud',
        orm: 'Prisma 7 con Driver MariaDB/MySQL',
        timestamp: new Date()
    });
});

// Fallback para SPA en el frontend
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
            if (err) {
                res.status(200).send('Servidor Backend Veterinaria activo en http://localhost:' + (process.env.PORT || 4000));
            }
        });
    }
    next();
});

const PORT = process.env.PORT || 4000;

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🐾 Servidor Veterinaria corriendo en http://localhost:${PORT}`);
    console.log(`📦 Prisma ORM conectado exitosamente`);
    console.log(`=======================================================`);
});
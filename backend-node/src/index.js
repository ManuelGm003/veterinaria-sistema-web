const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const prescripcionRoutes = require('./routes/prescripcionRoutes');

// Crear aplicación Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de prescripciones médicas
app.use('/api/prescripciones', prescripcionRoutes);

// Configuración del puerto
const PORT = process.env.PORT || 4000;

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
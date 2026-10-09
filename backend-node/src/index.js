const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const ventasRoutes = require('./routes/ventasRoutes');
const prescripcionesRoutes = require('./routes/prescripcionesRoutes');

const app = express();

//Middlewares
app.use(cors());
app.use(express.json());
app.use('/api/ventas', ventasRoutes);
app.use('/api/prescripciones', prescripcionesRoutes);
//Routes
app.use('/api/auth', authRoutes);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
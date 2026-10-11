const db = require('../config/db');

// Registrar una prescripción médica
const crearPrescripcion = async (req, res) => {
    try {
        const {
            numero_receta,
            cedula_cliente,
            nombre_paciente,
            fecha_emision,
            fecha_vencimiento
        } = req.body;

        // Validar campos obligatorios
        if (!numero_receta || !cedula_cliente ||
            !nombre_paciente || !fecha_emision) {
            return res.status(400).json({
                mensaje: 'Faltan datos obligatorios'
            });
        }

        const resultado = await db.query(
            `INSERT INTO prescripcion
            (numero_receta, cedula_cliente,
             nombre_paciente, fecha_emision,
             fecha_vencimiento)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                numero_receta,
                cedula_cliente,
                nombre_paciente,
                fecha_emision,
                fecha_vencimiento || null
            ]
        );

        res.status(201).json({
            mensaje: 'Prescripción registrada correctamente',
            prescripcion: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(error.code === '23505' ? 409 : 500).json({
            mensaje: error.code === '23505'
                ? 'El número de receta ya existe'
                : 'Error al registrar la prescripción'
        });
    }
};

// Consultar todas las prescripciones
const obtenerPrescripciones = async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT * FROM prescripcion ORDER BY id DESC'
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al consultar las prescripciones'
        });
    }
};

// Consultar una prescripción por ID
const obtenerPrescripcionPorId = async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT * FROM prescripcion WHERE id = $1',
            [req.params.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: 'Prescripción no encontrada'
            });
        }

        res.json(resultado.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al consultar la prescripción'
        });
    }
};

module.exports = {
    crearPrescripcion,
    obtenerPrescripciones,
    obtenerPrescripcionPorId
};
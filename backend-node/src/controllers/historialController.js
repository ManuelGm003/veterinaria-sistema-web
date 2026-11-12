const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isPositiveNumber,
    isNonEmptyString
} = require('../utils/validators');

// Registrar una nueva entrada en el historial clínico
const crearHistorial = async (req, res) => {
    try {
        const { pacienteId, veterinario, diagnostico, tratamiento, peso } = req.body;

        if (!isPositiveInteger(pacienteId)) {
            return res.status(400).json({ mensaje: 'ID de paciente inválido' });
        }

        if (!isNonEmptyString(veterinario)) {
            return res.status(400).json({ mensaje: 'El nombre del veterinario es obligatorio' });
        }

        if (!isNonEmptyString(diagnostico)) {
            return res.status(400).json({ mensaje: 'El diagnóstico es obligatorio' });
        }

        if (peso !== undefined && peso !== null && peso !== '') {
            if (!isPositiveNumber(peso)) {
                return res.status(400).json({ mensaje: 'El peso debe ser un número mayor a 0 (no se permite 0, -0 ni valores negativos)' });
            }
        }

        const nuevoHistorial = await prisma.historialClinico.create({
            data: {
                pacienteId: Number(pacienteId),
                veterinario: veterinario.trim(),
                diagnostico: diagnostico.trim(),
                tratamiento: tratamiento ? tratamiento.trim() : '',
                peso: (peso !== undefined && peso !== null && peso !== '') ? parseFloat(peso) : null,
                fecha: new Date()
            }
        });

        res.status(201).json({ mensaje: 'Historial guardado con éxito', nuevoHistorial });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Ver el historial clínico de un paciente específico
const obtenerHistorialPorPaciente = async (req, res) => {
    try {
        const { pacienteId } = req.params;
        if (!isPositiveInteger(pacienteId)) {
            return res.status(400).json({ mensaje: 'ID de paciente inválido' });
        }

        const historial = await prisma.historialClinico.findMany({
            where: { pacienteId: Number(pacienteId) },
            orderBy: { fecha: 'desc' }
        });

        res.json(historial);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    crearHistorial,
    obtenerHistorialPorPaciente
};

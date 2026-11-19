const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isPositiveNumber,
    isNonEmptyString
} = require('../utils/validators');

// Registrar una nueva entrada en el historial clínico vinculada a una Mascota real
const crearHistorial = async (req, res) => {
    try {
        const { mascotaId, pacienteId, veterinario, diagnostico, tratamiento, peso } = req.body;
        const targetId = mascotaId || pacienteId;

        if (!isPositiveInteger(targetId)) {
            return res.status(400).json({ mensaje: 'ID de mascota/paciente inválido' });
        }

        const idNum = Number(targetId);

        // Verificar que la mascota exista en la base de datos (relación real, no simulada)
        const mascota = await prisma.mascota.findUnique({
            where: { id: idNum }
        });

        if (!mascota) {
            return res.status(404).json({ mensaje: `La mascota con ID ${idNum} no existe en el sistema` });
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
                mascotaId: idNum,
                veterinario: veterinario.trim(),
                diagnostico: diagnostico.trim(),
                tratamiento: tratamiento ? tratamiento.trim() : '',
                peso: (peso !== undefined && peso !== null && peso !== '') ? parseFloat(peso) : null,
                fecha: new Date()
            },
            include: {
                mascota: true
            }
        });

        res.status(201).json({ mensaje: 'Historial guardado con éxito', nuevoHistorial });
    } catch (error) {
        console.error('Error al crear historial clínico:', error);
        res.status(500).json({ error: error.message });
    }
};

// Ver el historial clínico de una mascota específica
const obtenerHistorialPorPaciente = async (req, res) => {
    try {
        const idParam = req.params.mascotaId || req.params.pacienteId;
        if (!isPositiveInteger(idParam)) {
            return res.status(400).json({ mensaje: 'ID de mascota/paciente inválido' });
        }

        const idNum = Number(idParam);

        // Verificar que la mascota exista
        const mascota = await prisma.mascota.findUnique({
            where: { id: idNum }
        });

        if (!mascota) {
            return res.status(404).json({ mensaje: `La mascota con ID ${idNum} no existe` });
        }

        const historial = await prisma.historialClinico.findMany({
            where: { mascotaId: idNum },
            include: {
                mascota: true
            },
            orderBy: { fecha: 'desc' }
        });

        res.json(historial);
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    crearHistorial,
    obtenerHistorialPorPaciente
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Registrar una nueva entrada en el historial clínico
const crearHistorial = async (req, res) => {
  try {
    const { pacienteId, veterinario, diagnostico, tratamiento, peso } = req.body;
    
    const nuevoHistorial = await prisma.historialClinico.create({
      data: {
        pacienteId: Number(pacienteId),
        veterinario,
        diagnostico,
        tratamiento,
        peso: peso ? parseFloat(peso) : null,
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